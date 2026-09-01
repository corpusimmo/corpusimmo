import "server-only";

/**
 * LE PANIER DE COMPARABLES, côté serveur.
 *
 * `src/components/observatoire/comparables-store.tsx` tient aujourd'hui la
 * sélection dans `localStorage`, sous une clé partagée entre l'observatoire
 * public et l'espace professionnel. Ce module offre le même jeu d'opérations
 * (`add`, `remove`, `setExcluded`, `setWeight`, `setComment`, `clear`) contre
 * une table, pour que la bascule soit un remplacement d'implémentation et non
 * une réécriture d'interface.
 *
 * LA VÉRIFICATION D'APPARTENANCE SE FAIT SUR LE PANIER, UNE FOIS.
 *   `scopes.ts` explique que `comparableItemsOfSet` n'est pas bornée au
 *   propriétaire. La discipline qui rend cela sûr est ICI, et nulle part
 *   ailleurs : aucune fonction de ce fichier ne touche `comparable_items` sans
 *   avoir d'abord établi, par `comparableSetOwnedBy`, que le panier appartient
 *   bien à l'appelant. Ajouter une fonction qui prendrait un `setId` sans
 *   `userId` romprait cette garantie en silence.
 *
 * LE PLAFOND DE CINQUANTE LIGNES est repris du panier local, avec sa raison :
 * « au-delà, une "sélection" devient un jeu de données, et la pondération ne
 * veut plus rien dire ». Ce n'est pas une limite technique, c'est une limite de
 * sens, elle vaut donc aussi en base.
 *
 * LE PANIER COURANT est le dernier touché. Le magasin local n'a qu'un panier
 * parce qu'une clé de `localStorage` n'en porte qu'un ; la table en accepte
 * plusieurs, ce qui permettra de nommer et de conserver des sélections. En
 * attendant, `readCurrentSet` rend le plus récent, et l'interface actuelle ne
 * voit aucune différence.
 */

import { asc, desc, eq } from "drizzle-orm";

import type { DvfTransaction } from "@/types/dvf";
import type { PropertyDraft } from "@/types/property";

import { getDb, isDatabaseConfigured } from "../client";
import { comparableItemToSaved, transactionToInsert, type SavedComparable } from "../mappers";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { comparableItems, comparableSets } from "../schema/comparables";
import {
  comparableItemOfSet,
  comparableItemsOfSet,
  comparableSetOwnedBy,
  comparableSetsOfUser,
} from "../scopes";

/** Au-delà, ce n'est plus une sélection. Voir l'en-tête. */
export const MAX_ITEMS = 50;

export interface StoredComparableSet {
  id: string;
  name: string | null;
  /** Le bien de référence, quand il y en a un. */
  subject: PropertyDraft | null;
  estimationId: string | null;
  updatedAt: Date;
  items: SavedComparable[];
}

/** Le panier appartient-il bien à cette personne ? Rend son identifiant ou nul. */
async function assertOwnedSet(setId: string, userId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ id: comparableSets.id })
    .from(comparableSets)
    .where(comparableSetOwnedBy(setId, userId))
    .limit(1);

  return rows[0]?.id ?? null;
}

async function readItems(setId: string): Promise<SavedComparable[]> {
  const rows = await getDb()
    .select()
    .from(comparableItems)
    .where(comparableItemsOfSet(setId))
    .orderBy(asc(comparableItems.addedAt))
    .limit(MAX_ITEMS);

  return rows.map(comparableItemToSaved);
}

/** Les paniers d'une personne, sans leur contenu : le plus récent en premier. */
export async function listComparableSets(
  userId: string,
): Promise<Omit<StoredComparableSet, "items">[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select()
    .from(comparableSets)
    .where(comparableSetsOfUser(userId))
    .orderBy(desc(comparableSets.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    estimationId: row.estimationId,
    updatedAt: row.updatedAt,
  }));
}

/** Un panier avec son contenu, borné au propriétaire. */
export async function readComparableSet(
  setId: string,
  userId: string,
): Promise<StoredComparableSet | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await getDb()
    .select()
    .from(comparableSets)
    .where(comparableSetOwnedBy(setId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    estimationId: row.estimationId,
    updatedAt: row.updatedAt,
    items: await readItems(row.id),
  };
}

/**
 * Le panier courant : le dernier touché, ou rien.
 *
 * Ne crée RIEN. Une lecture qui crée une ligne rendrait une simple visite de
 * l'observatoire coûteuse en écritures, et remplirait la table de paniers vides.
 */
export async function readCurrentSet(userId: string): Promise<StoredComparableSet | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await getDb()
    .select({ id: comparableSets.id })
    .from(comparableSets)
    .where(comparableSetsOfUser(userId))
    .orderBy(desc(comparableSets.updatedAt))
    .limit(1);

  const id = rows[0]?.id;
  return id ? readComparableSet(id, userId) : null;
}

/** Crée un panier. Le nom et le bien de référence sont facultatifs. */
export async function createComparableSet(
  userId: string,
  input: { name?: string; subject?: PropertyDraft; estimationId?: string } = {},
  now: Date = new Date(),
): Promise<WriteOutcome<string>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    const [row] = await getDb()
      .insert(comparableSets)
      .values({
        userId,
        name: input.name ?? null,
        subject: input.subject ?? null,
        estimationId: input.estimationId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: comparableSets.id });

    if (!row) return writeFailed("createComparableSet", new Error("aucune ligne rendue"));
    return { stored: true, value: row.id };
  } catch (error) {
    return writeFailed("createComparableSet", error);
  }
}

/**
 * Le panier courant, créé s'il n'existe pas.
 *
 * Réservé aux CHEMINS D'ÉCRITURE : cocher un comparable doit aboutir même si
 * la personne n'a encore jamais rien coché. C'est le seul endroit qui a le
 * droit de créer un panier sans qu'on le lui ait demandé, et c'est parce qu'on
 * vient précisément de lui demander d'y mettre quelque chose.
 */
async function currentSetId(userId: string, now: Date): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: comparableSets.id })
    .from(comparableSets)
    .where(comparableSetsOfUser(userId))
    .orderBy(desc(comparableSets.updatedAt))
    .limit(1);

  const existing = rows[0]?.id;
  if (existing) return existing;

  const [created] = await db
    .insert(comparableSets)
    .values({ userId, createdAt: now, updatedAt: now })
    .returning({ id: comparableSets.id });

  return created?.id ?? null;
}

/** Marque le panier comme touché : c'est ce qui décide lequel est « courant ». */
async function touch(setId: string, now: Date): Promise<void> {
  await getDb().update(comparableSets).set({ updatedAt: now }).where(eq(comparableSets.id, setId));
}

/**
 * Ajoute une mutation au panier courant.
 *
 * `onConflictDoNothing` reproduit le comportement du panier local, qui ignore
 * un identifiant déjà présent : cocher deux fois n'ajoute pas deux lignes et ne
 * réinitialise pas la pondération manuelle déjà posée.
 */
export async function addComparable(
  userId: string,
  transaction: DvfTransaction,
  now: Date = new Date(),
): Promise<WriteOutcome<{ setId: string; added: boolean }>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    const setId = await currentSetId(userId, now);
    if (!setId) return writeFailed("addComparable", new Error("panier introuvable"));

    const existing = await getDb()
      .select({ id: comparableItems.id })
      .from(comparableItems)
      .where(comparableItemsOfSet(setId));

    // Le plafond est vérifié AVANT l'insertion, comme dans le réducteur local :
    // au-delà, l'ajout est ignoré en silence plutôt que refusé bruyamment.
    if (existing.length >= MAX_ITEMS) {
      return { stored: true, value: { setId, added: false } };
    }

    const inserted = await getDb()
      .insert(comparableItems)
      .values(transactionToInsert(setId, transaction, now))
      .onConflictDoNothing()
      .returning({ id: comparableItems.id });

    await touch(setId, now);
    return { stored: true, value: { setId, added: inserted.length > 0 } };
  } catch (error) {
    return writeFailed("addComparable", error);
  }
}

/** Retire une mutation du panier. */
export async function removeComparable(
  userId: string,
  setId: string,
  transactionId: string,
  now: Date = new Date(),
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    if (!(await assertOwnedSet(setId, userId))) {
      return writeFailed("removeComparable", new Error("panier introuvable"));
    }

    await getDb().delete(comparableItems).where(comparableItemOfSet(setId, transactionId));
    await touch(setId, now);
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("removeComparable", error);
  }
}

/**
 * Met à jour ce que le professionnel impose à une ligne : exclusion,
 * pondération, commentaire.
 *
 * `manualWeight: null` REMET la pondération calculée, ce qui n'est pas la même
 * chose que `manualWeight: 0`. Le premier dit « je ne me prononce pas », le
 * second « ne compte pas ce bien ». Confondre les deux changerait le résultat
 * du moteur sans que personne ne comprenne pourquoi.
 */
export async function updateComparable(
  userId: string,
  setId: string,
  transactionId: string,
  patch: { excluded?: boolean; manualWeight?: number | null; comment?: string | null },
  now: Date = new Date(),
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    if (!(await assertOwnedSet(setId, userId))) {
      return writeFailed("updateComparable", new Error("panier introuvable"));
    }

    await getDb()
      .update(comparableItems)
      .set({
        ...(patch.excluded === undefined ? {} : { excluded: patch.excluded }),
        ...(patch.manualWeight === undefined ? {} : { manualWeight: patch.manualWeight }),
        ...(patch.comment === undefined
          ? {}
          : { comment: patch.comment?.trim() ? patch.comment.trim() : null }),
      })
      .where(comparableItemOfSet(setId, transactionId));

    await touch(setId, now);
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("updateComparable", error);
  }
}

/** Vide le panier sans le supprimer : la sélection repart de zéro, le panier reste. */
export async function clearComparableSet(
  userId: string,
  setId: string,
  now: Date = new Date(),
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    if (!(await assertOwnedSet(setId, userId))) {
      return writeFailed("clearComparableSet", new Error("panier introuvable"));
    }

    await getDb().delete(comparableItems).where(comparableItemsOfSet(setId));
    await touch(setId, now);
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("clearComparableSet", error);
  }
}

/** Supprime le panier et son contenu, par cascade. */
export async function deleteComparableSet(
  userId: string,
  setId: string,
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getDb().delete(comparableSets).where(comparableSetOwnedBy(setId, userId));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("deleteComparableSet", error);
  }
}

/** Attache un bien de référence au panier, ou le remplace. */
export async function setComparableSubject(
  userId: string,
  setId: string,
  subject: PropertyDraft | null,
  now: Date = new Date(),
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getDb()
      .update(comparableSets)
      .set({ subject, updatedAt: now })
      .where(comparableSetOwnedBy(setId, userId));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("setComparableSubject", error);
  }
}
