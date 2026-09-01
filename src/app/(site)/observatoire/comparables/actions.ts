"use server";

/**
 * LE PANIER DE COMPARABLES, côté compte.
 *
 * Le panier vit dans `localStorage` depuis le premier jour, et il y reste pour
 * qui n'a pas de compte : l'observatoire est libre en consultation, et exiger
 * une inscription pour cocher trois ventes reviendrait à fermer la porte de la
 * démonstration. Ces actions ne remplacent donc pas le magasin local, elles
 * lui donnent un DEUXIÈME registre, qui suit d'un appareil à l'autre.
 *
 * CHAQUE ACTION REVÉRIFIE LA SESSION. Une action serveur est une route publique
 * comme une autre : l'identifiant de la personne ne peut pas venir de
 * l'appelant, et l'identifiant du PANIER non plus. C'est pour cela que ce
 * fichier ne prend jamais de `setId` en argument et le retrouve lui-même, par
 * `listComparableSets`, à partir de la session. Un panier passé par le réseau
 * serait une invitation à lire celui du voisin, même si les clauses `where` de
 * `src/lib/db/scopes.ts` le refuseraient.
 *
 * AUCUNE DE CES ACTIONS N'EST APPELÉE DEPUIS UN RENDU. Elles le sont depuis le
 * magasin client, après l'hydratation. C'est ce qui laisse `/observatoire`,
 * `/observatoire/transactions` et `/observatoire/comparables` en rendu
 * STATIQUE : lire la session dans l'une de ces pages basculerait tout le
 * segment en dynamique, alors que deux de ces trois écrans sont indexés et que
 * le dépôt tient au rendu statique par défaut (voir
 * `src/components/layout/session-provider.tsx`, qui résout la session dans le
 * navigateur pour exactement la même raison).
 *
 * PAS DE `revalidatePath` NON PLUS : la page ne rend aucune donnée personnelle
 * côté serveur, il n'y a donc rien à invalider. C'est le magasin client qui
 * porte l'état, et il l'a déjà mis à jour quand l'action part.
 *
 * ── LA REPRISE ────────────────────────────────────────────────────────────
 *
 * Quelqu'un choisit quatorze comparables sans compte, puis se connecte. Sans
 * `syncComparablesAction`, la base ne saurait rien de ces quatorze lignes et la
 * personne perdrait son après-midi au moment précis où elle nous fait confiance
 * assez pour créer un compte. C'est le même geste que `importGrants` pour les
 * déblocages d'outils, et pour la même raison.
 *
 * CE QUI LA REND IDEMPOTENTE, et permet de l'appeler à chaque chargement sans
 * se demander si elle a déjà eu lieu :
 *
 *   1. `addComparable` insère en `onConflictDoNothing` sous l'index unique
 *      `(set_id, transaction_id)`. Reverser deux fois la même sélection
 *      n'ajoute pas une ligne de plus ;
 *   2. le panier visé est le panier COURANT, jamais un nouveau. Aucun appel ne
 *      crée un second panier à chaque rendu ;
 *   3. les surcharges du professionnel (exclusion, pondération, commentaire) ne
 *      sont recopiées que sur les lignes RÉELLEMENT insérées. Une ligne déjà
 *      présente garde ce que la base porte : c'est elle qui fait foi, et une
 *      reprise ne doit pas défaire une exclusion posée depuis un autre appareil ;
 *   4. côté navigateur, la copie locale est effacée une fois la reprise
 *      confirmée. Sans cela, retirer un comparable de son compte le verrait
 *      revenir au rechargement suivant, reversé par une copie locale que plus
 *      personne ne regarde.
 *
 * L'horodatage d'origine est conservé, comme `importGrants` conserve celui des
 * déblocages : l'ordre d'affichage du panier est l'ordre dans lequel la
 * personne l'a construit, et le remettre à l'heure de la connexion mélangerait
 * son travail.
 */

import { propertyDraftSchema } from "@/lib/valuation/request-schema";

import {
  addedAtDate,
  isTransactionId,
  parseComparableEntries,
  parseComparableEntry,
  type CartSync,
  type ComparableEntry,
} from "./wire";

/**
 * LA COUCHE SERVEUR EST CHARGÉE À L'APPEL, PAS À L'OUVERTURE DU MODULE.
 *
 * Ce fichier est importé, statiquement, par un composant client
 * (`comparables-store.tsx`). Le compilateur de Next remplace alors ses exports
 * par des références côté navigateur, et rien de ce qui suit ne part dans le
 * paquet du client. Mais tout ce qui est importé EN TÊTE reste visible des
 * outils qui lisent le graphe de modules SANS passer par ce compilateur, à
 * commencer par un test qui importe une page pour en relire les métadonnées.
 * `@/lib/db` et `@/lib/auth/current-user` ouvrent tous deux sur `server-only`,
 * qui lève dès qu'on le charge hors d'un rendu serveur.
 *
 * Les charger ICI, dans le corps des fonctions, c'est les charger au seul
 * moment où l'on est certain d'être sur le serveur : quand l'action s'exécute.
 */
async function session(): Promise<string | null> {
  const auth = await import("@/lib/auth/current-user");
  return auth.currentUserId();
}

async function db() {
  return import("@/lib/db");
}

/** Rien à reprendre, rien à lire : le navigateur garde la main. */
const NOT_BACKED: CartSync = { backed: false, items: [], subject: null };

/**
 * Le panier courant de la personne, par son seul identifiant.
 *
 * `listComparableSets` rend les paniers sans leur contenu, le plus récemment
 * touché en premier : c'est exactement la définition du panier « courant », et
 * cela évite de rapatrier cinquante mutations pour retirer une ligne.
 */
async function currentSetId(userId: string): Promise<string | null> {
  const { listComparableSets } = await db();
  const sets = await listComparableSets(userId);
  return sets[0]?.id ?? null;
}

/**
 * Verse la sélection du navigateur dans le compte, puis rend ce que le compte
 * porte. Voir « LA REPRISE » en tête de fichier.
 */
async function importEntries(userId: string, entries: readonly ComparableEntry[]): Promise<void> {
  const { addComparable, updateComparable } = await db();
  const now = new Date();

  // Du plus ancien au plus récent : le panier se relit dans l'ordre où il a
  // été construit, et le dernier ajout reste le dernier.
  const ordered = [...entries].sort(
    (a, b) => addedAtDate(a, now).getTime() - addedAtDate(b, now).getTime(),
  );

  for (const entry of ordered) {
    const outcome = await addComparable(userId, entry.transaction, addedAtDate(entry, now));

    // Pas écrit, ou déjà présent : dans les deux cas on ne touche à rien. Le
    // second cas est le cœur de l'idempotence.
    if (!outcome.stored || !outcome.value.added) continue;

    const carriesOverride =
      entry.excluded || entry.manualWeight !== undefined || entry.comment !== undefined;
    if (!carriesOverride) continue;

    await updateComparable(
      userId,
      outcome.value.setId,
      entry.transaction.id,
      {
        excluded: entry.excluded,
        manualWeight: entry.manualWeight ?? null,
        comment: entry.comment ?? null,
      },
      now,
    );
  }
}

/**
 * L'unique point d'entrée en LECTURE : « voici ce que porte ce navigateur, que
 * porte mon compte ? »
 *
 * Rend `backed: false` dès qu'il n'y a pas de session utilisable, ce qui couvre
 * les quatre cas de `currentUserId` : pas d'authentification configurée, pas de
 * base, personne connectée, ou un jeton antérieur à l'arrivée de la base. Le
 * navigateur reste alors la source de vérité, ce qu'il était déjà.
 */
export async function syncComparablesAction(payload: unknown): Promise<CartSync> {
  const userId = await session();
  if (!userId) return NOT_BACKED;

  await importEntries(userId, parseComparableEntries(payload));

  const { readCurrentSet } = await db();
  const set = await readCurrentSet(userId);
  return { backed: true, items: set?.items ?? [], subject: set?.subject ?? null };
}

/**
 * Ajoute une mutation au panier du compte.
 *
 * Rend `false` quand rien n'a été écrit, pour que le magasin client puisse le
 * DIRE plutôt que d'afficher une sélection que personne n'a enregistrée.
 */
export async function addComparableAction(payload: unknown): Promise<boolean> {
  const userId = await session();
  if (!userId) return false;

  const entry = parseComparableEntry(payload);
  if (!entry) return false;

  const { addComparable } = await db();
  const outcome = await addComparable(userId, entry.transaction);
  return outcome.stored;
}

export async function removeComparableAction(transactionId: unknown): Promise<boolean> {
  const userId = await session();
  if (!userId || !isTransactionId(transactionId)) return false;

  const setId = await currentSetId(userId);
  // Pas de panier : l'état voulu est déjà atteint, il n'y a rien à retirer.
  if (!setId) return true;

  const { removeComparable } = await db();
  const outcome = await removeComparable(userId, setId, transactionId);
  return outcome.stored;
}

/**
 * Exclusion, pondération, commentaire.
 *
 * `manualWeight: null` REMET la pondération calculée, ce qui n'est pas
 * `manualWeight: 0`. Le premier dit « je ne me prononce pas », le second « ne
 * compte pas ce bien ». La distinction traverse donc le réseau intacte, et
 * `undefined` veut dire « ne touche pas à ce champ ».
 */
export async function updateComparableAction(
  transactionId: unknown,
  patch: { excluded?: boolean; manualWeight?: number | null; comment?: string | null },
): Promise<boolean> {
  const userId = await session();
  if (!userId || !isTransactionId(transactionId)) return false;

  const setId = await currentSetId(userId);
  if (!setId) return false;

  const { updateComparable } = await db();
  const outcome = await updateComparable(userId, setId, transactionId, {
    ...(typeof patch.excluded === "boolean" ? { excluded: patch.excluded } : {}),
    ...(patch.manualWeight === undefined
      ? {}
      : { manualWeight: patch.manualWeight === null ? null : clamp(patch.manualWeight) }),
    ...(patch.comment === undefined
      ? {}
      : { comment: typeof patch.comment === "string" ? patch.comment.slice(0, 2_000) : null }),
  });

  return outcome.stored;
}

/** Le contrat du moteur, revérifié au bord : une pondération vit dans [0, 3]. */
function clamp(weight: number): number | null {
  if (!Number.isFinite(weight)) return null;
  return Math.min(3, Math.max(0, Math.round(weight * 100) / 100));
}

/** Vide le panier sans le supprimer : la sélection repart de zéro, le panier reste. */
export async function clearComparablesAction(): Promise<boolean> {
  const userId = await session();
  if (!userId) return false;

  const setId = await currentSetId(userId);
  if (!setId) return true;

  const { clearComparableSet } = await db();
  const outcome = await clearComparableSet(userId, setId);
  return outcome.stored;
}

/**
 * Attache le bien de référence au panier du compte.
 *
 * Ne CRÉE pas de panier : tant que la personne n'a coché aucun comparable, il
 * n'y a rien à quoi rattacher un bien, et créer un panier vide à chaque adresse
 * saisie remplirait la table de coquilles. Le brouillon reste alors dans le
 * navigateur, et il montera au premier comparable coché.
 *
 * `propertyDraftSchema` est celui de `POST /api/estimation`, sans variante : le
 * bien envoyé au moteur et le bien rangé dans le panier sont le même objet, et
 * deux schémas pour une seule forme finiraient par diverger.
 */
export async function setComparableSubjectAction(payload: unknown): Promise<boolean> {
  const userId = await session();
  if (!userId) return false;

  const setId = await currentSetId(userId);
  if (!setId) return false;

  const { setComparableSubject } = await db();

  if (payload === null) {
    const cleared = await setComparableSubject(userId, setId, null);
    return cleared.stored;
  }

  const parsed = propertyDraftSchema.safeParse(payload);
  if (!parsed.success) return false;

  const outcome = await setComparableSubject(userId, setId, parsed.data);
  return outcome.stored;
}
