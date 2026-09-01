import "server-only";

/**
 * L'HISTORIQUE DES ESTIMATIONS, côté serveur.
 *
 * Ce que `src/lib/history/estimations.ts` fait dans `localStorage`, en levant
 * les deux limites que ce fichier annonce lui-même : « la liste vit dans CE
 * navigateur : elle ne suit pas d'un appareil à l'autre » et « il n'y a pas de
 * lien partageable ».
 *
 * TROIS DIFFÉRENCES DE COMPORTEMENT, TOUTES VOULUES
 *
 *  1. LA LISTE N'EST PLUS PLAFONNÉE À TRENTE. `MAX_ESTIMATIONS` existait parce
 *     qu'un tableau doit tenir dans `localStorage` ; une table n'a pas ce
 *     problème. Ce qui reste plafonné est la PAGE, pour ne pas rendre huit cents
 *     lignes à une interface qui en montre dix.
 *
 *  2. LE RÉSULTAT COMPLET EST GARDÉ, dans sa propre table, et il n'est JAMAIS
 *     lu par la liste. Voir l'en-tête de `schema/estimations.ts`.
 *
 *  3. ENREGISTRER NE PEUT PAS COÛTER SON RÉSULTAT À LA PERSONNE. C'est déjà la
 *     règle côté navigateur (« l'échec est silencieux, par construction ») et
 *     elle vaut à plus forte raison ici : une base indisponible ne doit pas
 *     transformer une estimation réussie en erreur affichée.
 *
 * DEUX ÉCRITURES SANS TRANSACTION. Le résumé et le résultat complet partent en
 * deux instructions, et le pilote HTTP de Neon n'offre pas de transaction (voir
 * `client.ts`). Si la seconde échoue, il reste un résumé sans résultat complet :
 * la liste fonctionne, le détail manque, et `readEstimation` rend `result:
 * null` sans broncher. C'est la dégradation la moins mauvaise ; l'inverse
 * (résultat orphelin) est impossible, la clé étrangère l'interdit.
 */

import { and, desc, eq, isNotNull, type SQL } from "drizzle-orm";

import type { ValuationResult } from "@/types/valuation";

import { getDb, isDatabaseConfigured } from "../client";
import { estimationRowToSummary, valuationToEstimationInsert, type EstimationSummary } from "../mappers";
import { NOT_CONFIGURED, writeFailed, type WriteOutcome } from "../outcome";
import { estimationResults, estimations } from "../schema/estimations";
import { estimationByShareToken, estimationOwnedBy, estimationsOfUser } from "../scopes";
import { newShareToken } from "../tokens";

export type { EstimationSummary } from "../mappers";

/**
 * Combien de lignes une page rend au plus.
 *
 * Trente, comme `MAX_ESTIMATIONS` — non par mimétisme, mais parce que c'est le
 * volume qu'une page « mes estimations » peut afficher sans pagination, et que
 * la personne qui en a davantage cherche de toute façon par la recherche, pas
 * en déroulant.
 */
export const DEFAULT_PAGE_SIZE = 30;

/** Une estimation avec son résultat complet, quand il a pu être écrit. */
export interface StoredEstimation {
  summary: EstimationSummary;
  /** Nul si le résultat complet n'a pas été enregistré. Voir l'en-tête. */
  result: ValuationResult | null;
}

/**
 * L'historique d'une personne, du plus récent au plus ancien.
 *
 * Ne rend QUE des résumés : le résultat complet n'est jamais joint ici, sans
 * quoi afficher une liste coûterait trente documents JSON.
 */
export async function listEstimations(
  userId: string,
  limit: number = DEFAULT_PAGE_SIZE,
): Promise<EstimationSummary[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select()
    .from(estimations)
    .where(estimationsOfUser(userId))
    .orderBy(desc(estimations.computedAt))
    .limit(Math.max(1, Math.min(limit, 200)));

  return rows.map(estimationRowToSummary);
}

/**
 * Enregistre une estimation terminée.
 *
 * Réenregistrer la MÊME estimation (même identifiant de moteur, même personne)
 * met la ligne à jour au lieu d'en créer une seconde. C'est ce que
 * `normalise()` obtient côté navigateur en écartant les doublons après coup ;
 * l'index unique l'obtient avant, ce qui est plus sûr et moins cher.
 */
export async function saveEstimation(
  valuation: ValuationResult,
  userId: string | null,
  now: Date = new Date(),
): Promise<WriteOutcome<StoredEstimation>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  const values = valuationToEstimationInsert(valuation, userId, now);

  try {
    const db = getDb();
    const [row] = await db
      .insert(estimations)
      .values(values)
      .onConflictDoUpdate({
        target: [estimations.userId, estimations.engineId],
        set: {
          method: values.method,
          status: values.status,
          computedAt: values.computedAt,
          addressLabel: values.addressLabel,
          city: values.city,
          postcode: values.postcode,
          cityCode: values.cityCode,
          departmentCode: values.departmentCode,
          propertyType: values.propertyType,
          surface: values.surface,
          valueLow: values.valueLow,
          valueCentral: values.valueCentral,
          valueHigh: values.valueHigh,
          pricePerSqm: values.pricePerSqm,
          confidence: values.confidence,
          comparablesCount: values.comparablesCount,
        },
      })
      .returning();

    if (!row) return writeFailed("saveEstimation", new Error("aucune ligne rendue"));

    await db
      .insert(estimationResults)
      .values({ estimationId: row.id, payload: valuation, storedAt: now })
      .onConflictDoUpdate({
        target: estimationResults.estimationId,
        set: { payload: valuation, storedAt: now },
      });

    return { stored: true, value: { summary: estimationRowToSummary(row), result: valuation } };
  } catch (error) {
    return writeFailed("saveEstimation", error);
  }
}

/** Une estimation et son détail, bornée au propriétaire. */
export async function readEstimation(
  estimationId: string,
  userId: string,
): Promise<StoredEstimation | null> {
  if (!isDatabaseConfigured()) return null;
  return readOne(estimationOwnedBy(estimationId, userId));
}

/**
 * Une estimation par son jeton de partage.
 *
 * Aucune notion de propriétaire ici, et c'est le principe même du partage : le
 * jeton EST le droit d'accès. Il n'est posé que sur demande explicite, si bien
 * qu'une estimation jamais partagée reste inatteignable par cette porte.
 */
export async function readSharedEstimation(shareToken: string): Promise<StoredEstimation | null> {
  if (!isDatabaseConfigured()) return null;
  return readOne(estimationByShareToken(shareToken));
}

/**
 * La lecture d'UNE estimation avec son détail, quelle que soit la clause qui la
 * désigne. La jointure est à gauche : une estimation dont le résultat complet
 * n'a pas pu être écrit doit rester lisible.
 */
async function readOne(where: SQL): Promise<StoredEstimation | null> {
  const rows = await getDb()
    .select({ estimation: estimations, payload: estimationResults.payload })
    .from(estimations)
    .leftJoin(estimationResults, eq(estimationResults.estimationId, estimations.id))
    .where(where)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return { summary: estimationRowToSummary(row.estimation), result: row.payload };
}

/**
 * Rend l'estimation partageable et renvoie son jeton.
 *
 * Idempotent : une estimation déjà partagée garde SON jeton. En tirer un
 * nouveau à chaque appel casserait les liens déjà envoyés, ce qui est
 * exactement ce qu'un lien partagé ne doit pas faire.
 */
export async function shareEstimation(
  estimationId: string,
  userId: string,
): Promise<WriteOutcome<string>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    const db = getDb();
    const existing = await db
      .select({ shareToken: estimations.shareToken })
      .from(estimations)
      .where(estimationOwnedBy(estimationId, userId))
      .limit(1);

    const current = existing[0];
    if (!current) return writeFailed("shareEstimation", new Error("estimation introuvable"));
    if (current.shareToken) return { stored: true, value: current.shareToken };

    const token = newShareToken();
    await db
      .update(estimations)
      .set({ shareToken: token })
      .where(estimationOwnedBy(estimationId, userId));

    return { stored: true, value: token };
  } catch (error) {
    return writeFailed("shareEstimation", error);
  }
}

/** Retire le partage. L'estimation reste, le lien meurt. */
export async function unshareEstimation(
  estimationId: string,
  userId: string,
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getDb()
      .update(estimations)
      .set({ shareToken: null })
      .where(estimationOwnedBy(estimationId, userId));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("unshareEstimation", error);
  }
}

/** Oublie UNE estimation. Le résultat complet part avec, par cascade. */
export async function forgetEstimation(
  estimationId: string,
  userId: string,
): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getDb().delete(estimations).where(estimationOwnedBy(estimationId, userId));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("forgetEstimation", error);
  }
}

/** Vide l'historique d'une personne, comme le bouton « tout effacer ». */
export async function clearEstimations(userId: string): Promise<WriteOutcome<null>> {
  if (!isDatabaseConfigured()) return NOT_CONFIGURED;

  try {
    await getDb().delete(estimations).where(estimationsOfUser(userId));
    return { stored: true, value: null };
  } catch (error) {
    return writeFailed("clearEstimations", error);
  }
}

/**
 * Combien d'estimations sont partagées, pour une personne.
 *
 * Utile à une page de compte qui doit dire « trois de vos estimations ont un
 * lien public » : une promesse de confidentialité ne vaut que si l'on peut
 * vérifier ce qui est ouvert.
 */
export async function listSharedEstimations(userId: string): Promise<EstimationSummary[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await getDb()
    .select()
    .from(estimations)
    .where(and(estimationsOfUser(userId), isNotNull(estimations.shareToken)))
    .orderBy(desc(estimations.computedAt));

  return rows.map(estimationRowToSummary);
}
