import "server-only";

/**
 * LE VERROU, VERSION BASE — la même règle, un autre carnet.
 *
 * `src/lib/access/ledger.ts` lit et écrit les déblocages dans un cookie signé.
 * Ce module fait exactement la même chose dans `tool_unlocks`. Les deux
 * appellent LES MÊMES fonctions de `src/lib/access/core.ts` :
 * `computeQuota` pour l'état, `applyGrant` pour la décision. Rien de la règle
 * n'est réécrit ici, et c'est délibéré : le quota est ce à quoi l'utilisateur
 * tient le plus, et deux implémentations d'une même règle finissent toujours
 * par diverger sur un cas limite — le septième jour, la réouverture d'un outil
 * déjà obtenu, le crédit qui se libère.
 *
 * CE QUE CE MODULE APPORTE, ET C'EST TOUT : la persistance. Le cookie perd les
 * déblocages au changement d'appareil et se plafonne à quarante entrées
 * (`MAX_GRANTS`, une contrainte de taille d'en-tête HTTP). La table ne connaît
 * ni l'un ni l'autre. On lit donc TOUS les déblocages de la personne et on les
 * passe tels quels à `applyGrant`, sans les tronquer : sa troncature à
 * quarante ne concerne que le tableau qu'il RENVOIE, destiné au cookie, et ce
 * tableau est ici jeté.
 *
 * UNE PANNE DE BASE N'OUVRE PAS LA BIBLIOTHÈQUE. C'est l'unique endroit du
 * dossier où l'erreur n'est PAS rattrapée. Ailleurs, ne pas pouvoir écrire
 * coûte une ligne d'historique ; ici, ne pas pouvoir lire les déblocages
 * passés, puis conclure « aucun déblocage, donc deux crédits disponibles »,
 * distribuerait des outils à volonté à chaque hoquet du réseau. L'appelant doit
 * voir l'erreur et refuser, pas hériter d'un quota vide.
 *
 * L'ABSENCE DE BASE, elle, est un cas NORMAL et distinct : `configured: false`
 * dit à l'appelant de se rabattre sur le cookie signé, qui reste la source de
 * vérité tant que `DATABASE_URL` n'est pas posé.
 *
 * LA COURSE QUI RESTE. Deux déblocages simultanés du dernier crédit peuvent
 * passer tous les deux : la décision est prise en TypeScript entre une lecture
 * et une écriture, et le pilote HTTP de Neon ne fait pas de transaction. Le
 * coût maximal est un outil offert, une fois, à quelqu'un qui a cliqué deux
 * fois. Le prix de l'éviter serait de recoder la fenêtre glissante en SQL,
 * c'est-à-dire précisément la divergence qu'on refuse. Le choix est assumé et
 * documenté dans `docs/database.md`.
 */

import { desc } from "drizzle-orm";

import {
  applyGrant,
  computeQuota,
  WEEKLY_LIMIT,
  type Grant,
  type Quota,
} from "@/lib/access/core";

import { getDb, isDatabaseConfigured } from "../client";
import { unlocksToGrants } from "../mappers";
import { toolUnlocks } from "../schema/unlocks";
import { unlocksOfUser } from "../scopes";

export { WEEKLY_LIMIT, type Grant, type Quota } from "@/lib/access/core";

/** L'état du verrou pour une personne, lu en base. */
export interface StoredAccessState {
  /** Les outils obtenus, du plus récent au plus ancien. */
  unlocked: Grant[];
  quota: Quota;
  /** Faux quand il n'y a pas de base : l'appelant doit se rabattre ailleurs. */
  configured: boolean;
}

const NO_DATABASE: StoredAccessState = {
  unlocked: [],
  quota: { limit: WEEKLY_LIMIT, used: 0, remaining: WEEKLY_LIMIT, renewsAt: null },
  configured: false,
};

/** Les déblocages bruts d'une personne, du plus récent au plus ancien. */
async function readGrants(userId: string): Promise<Grant[]> {
  const rows = await getDb()
    .select({ toolSlug: toolUnlocks.toolSlug, unlockedAt: toolUnlocks.unlockedAt })
    .from(toolUnlocks)
    .where(unlocksOfUser(userId))
    .orderBy(desc(toolUnlocks.unlockedAt));

  return unlocksToGrants(rows);
}

/**
 * Lecture seule : ce que la personne possède, et où en est son quota.
 *
 * `now` est un paramètre et non `new Date()` figé dans le corps, pour la même
 * raison que dans `ledger.ts` : la fenêtre glissante ne se teste pas si l'on ne
 * peut pas déplacer l'instant présent.
 */
export async function readStoredAccess(
  userId: string,
  now: Date = new Date(),
): Promise<StoredAccessState> {
  if (!isDatabaseConfigured()) return NO_DATABASE;

  const grants = await readGrants(userId);

  return {
    // `readGrants` trie déjà par date décroissante côté SQL ; le tri du domaine
    // est refait ici pour ne pas dépendre de l'ordre d'une requête qu'on
    // pourrait modifier un jour.
    unlocked: [...grants].sort((a, b) => b.at - a.at),
    quota: computeQuota(grants, now),
    configured: true,
  };
}

/** Cette personne possède-t-elle cet outil ? Rien à voir avec le quota. */
export async function hasStoredAccess(userId: string, slug: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const grants = await readGrants(userId);
  return grants.some((grant) => grant.slug === slug);
}

export type StoredGrantResult =
  | { granted: true; alreadyOwned: boolean; quota: Quota }
  | { granted: false; reason: "quota_exhausted"; quota: Quota }
  | { granted: false; reason: "not_configured" };

/**
 * Débloque un outil, ou explique pourquoi non.
 *
 * La décision entière vient d'`applyGrant`. Ce qui suit n'est qu'une écriture
 * conditionnelle : une seule ligne, et seulement quand l'outil n'était pas déjà
 * possédé — ce qui est exactement la définition de « rouvrir ne consomme rien ».
 *
 * `onConflictDoNothing` couvre le double clic : l'index unique
 * `(user_id, tool_slug)` rend le doublon impossible, et l'ignorer plutôt que
 * lever évite de transformer une impatience en erreur 500.
 */
export async function grantStoredAccess(
  userId: string,
  slug: string,
  now: Date = new Date(),
): Promise<StoredGrantResult> {
  if (!isDatabaseConfigured()) return { granted: false, reason: "not_configured" };

  const outcome = applyGrant(await readGrants(userId), slug, now);

  if (!outcome.granted) {
    return { granted: false, reason: outcome.reason, quota: outcome.quota };
  }

  if (!outcome.alreadyOwned) {
    await getDb()
      .insert(toolUnlocks)
      .values({ userId, toolSlug: slug, unlockedAt: now })
      .onConflictDoNothing();
  }

  return { granted: true, alreadyOwned: outcome.alreadyOwned, quota: outcome.quota };
}

/**
 * REPREND LES DÉBLOCAGES OBTENUS AVANT LA CONNEXION.
 *
 * Quelqu'un débloque deux outils sans compte, le cookie signé les porte. Il se
 * connecte ensuite : sans cette fonction, la base ne saurait rien de ces deux
 * outils et la personne les perdrait au moment même où elle nous fait confiance
 * assez pour créer un compte. C'est exactement le genre de perte silencieuse
 * qui fait partir quelqu'un sans un mot.
 *
 * ON N'APPLIQUE PAS LE QUOTA ICI, et c'est délibéré. Ces déblocages ont déjà été
 * accordés, dans les règles, par le registre du cookie. Les repasser par
 * `applyGrant` reviendrait à reprendre ce qui a été donné parce que la personne
 * s'est connectée. Leur horodatage d'origine est conservé, donc la fenêtre
 * glissante les compte à leur vraie date : on n'offre rien non plus.
 *
 * `onConflictDoNothing` rend l'appel idempotent, ce qui permet de le faire à
 * chaque lecture sans se demander s'il a déjà eu lieu.
 */
export async function importGrants(userId: string, grants: readonly Grant[]): Promise<number> {
  if (!isDatabaseConfigured() || grants.length === 0) return 0;

  const rows = grants.map((grant) => ({
    userId,
    toolSlug: grant.slug,
    unlockedAt: new Date(grant.at * 1000),
  }));

  const inserted = await getDb()
    .insert(toolUnlocks)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: toolUnlocks.id });

  return inserted.length;
}
