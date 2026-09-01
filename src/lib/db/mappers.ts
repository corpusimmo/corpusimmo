/**
 * LES TRADUCTIONS entre la forme rangée en base et la forme dont le produit
 * parle.
 *
 * POURQUOI UNE COUCHE DE PLUS. Une ligne de table n'est pas un objet du
 * domaine : elle porte des `null` là où le domaine a des `undefined`, des
 * `Date` là où le navigateur compte en millisecondes, et des colonnes plates là
 * où le produit voit une fourchette. Rendre les lignes telles quelles ferait
 * remonter le schéma jusque dans les composants, et la moindre colonne renommée
 * deviendrait une modification d'interface.
 *
 * POURQUOI ICI ET NON DANS `queries/`. Ces fonctions sont pures : pas de
 * réseau, pas de `server-only`, aucune dépendance à Drizzle au-delà des types
 * de ligne. C'est ce qui les rend éprouvables sous Vitest, et c'est là que se
 * vérifie la seule chose qui compte vraiment ici : que la base retienne d'une
 * estimation EXACTEMENT ce que `summarise()` en retient aujourd'hui côté
 * navigateur, et d'un comparable exactement ce que le panier local en retient.
 * Deux formes divergentes de la même donnée, et la bascule du navigateur vers
 * la base ferait perdre des champs sans que rien n'échoue.
 *
 * LE SENS DES DATES. En base, `timestamptz` et donc `Date`. Dans le domaine,
 * `EstimationRecord.at` est en MILLISECONDES Unix et `Grant.at` en SECONDES
 * Unix — ce n'est pas une incohérence à corriger au passage : `Grant.at` est en
 * secondes parce qu'il transitait par un cookie signé qu'on avait intérêt à
 * garder court, et `computeQuota` compte en secondes. Traduire, c'est respecter
 * les deux, pas les uniformiser en douce.
 */

import type { Grant } from "@/lib/access/core";
import type { DvfTransaction } from "@/types/dvf";
import type { PropertyType } from "@/types/property";
import type { ValuationResult } from "@/types/valuation";

import type { ComparableItemInsert, ComparableItemRow } from "./schema/comparables";
import type { EstimationInsert, EstimationRow } from "./schema/estimations";
import type { ToolUnlockRow } from "./schema/unlocks";

// ---------------------------------------------------------------------------
// Déblocages d'outils
// ---------------------------------------------------------------------------

/**
 * Les lignes de `tool_unlocks` sous la forme que `computeQuota` et `applyGrant`
 * attendent.
 *
 * C'est le point de jonction de tout le dispositif : la règle du quota ne sait
 * rien de la base, elle ne connaît que des `Grant`. Changer le stockage revient
 * donc à changer cette fonction, et rien d'autre.
 */
export function unlocksToGrants(
  rows: readonly Pick<ToolUnlockRow, "toolSlug" | "unlockedAt">[],
): Grant[] {
  return rows.map((row) => ({
    slug: row.toolSlug,
    // Secondes, pas millisecondes : c'est l'unité de `Grant.at` et de
    // `WINDOW_SECONDS`. Un facteur mille ici rendrait tous les déblocages
    // éternellement récents.
    at: Math.floor(row.unlockedAt.getTime() / 1000),
  }));
}

// ---------------------------------------------------------------------------
// Estimations
// ---------------------------------------------------------------------------

/**
 * Le résumé d'une estimation, tel que la liste l'affiche.
 *
 * Volontairement un SUR-ENSEMBLE de `EstimationRecord`
 * (`src/lib/history/estimations.ts`) : mêmes noms, mêmes types, plus deux
 * champs que seule la base peut porter. Un composant écrit pour l'historique
 * local consomme donc cet objet sans une ligne de changement, ce que
 * `mappers.test.ts` vérifie au niveau des types.
 */
export interface EstimationSummary {
  /** NOTRE identifiant de ligne. C'est lui, et lui seul, qui va dans une URL. */
  id: string;
  /** L'identifiant rendu par le moteur, celui que le client a déjà en main. */
  engineId: string;
  /** Millisecondes Unix, comme `EstimationRecord.at`. */
  at: number;
  address: string;
  city: string;
  postcode: string;
  propertyType: PropertyType;
  /** Surface retenue, en m². Zéro quand le type de bien n'en a pas. */
  surface: number;
  /** Absent quand le moteur n'a pas conclu : l'échec se garde aussi. */
  value: { low: number; central: number; high: number } | null;
  pricePerSqm: number | null;
  /** 0 à 100. */
  confidence: number;
  /** Nombre de ventes retenues. */
  comparables: number;
  /** Nul tant que personne n'a demandé de lien partageable. */
  shareToken: string | null;
}

/**
 * Ce qu'on écrit d'un résultat de moteur dans la table des résumés.
 *
 * La correspondance avec `summarise()` est intentionnelle, champ par champ,
 * y compris les replis : `valuation.id || …` parce qu'un moteur qui n'a pas
 * conclu peut rendre un identifiant vide, et `Date.parse(...) || now` parce
 * qu'une date illisible ne doit pas produire un `NaN` en base.
 */
export function valuationToEstimationInsert(
  valuation: ValuationResult,
  userId: string | null,
  now: Date = new Date(),
): EstimationInsert {
  const { subject } = valuation;
  const surface = subject.features.livingArea ?? subject.features.landArea ?? 0;
  const computedAt = new Date(Date.parse(valuation.createdAt) || now.getTime());

  return {
    userId,
    engineId: valuation.id || `local-${now.getTime()}`,
    method: valuation.method,
    status: valuation.status,
    computedAt,
    addressLabel: subject.address.label,
    city: subject.address.city,
    postcode: subject.address.postcode ?? null,
    cityCode: subject.address.cityCode,
    departmentCode: subject.address.departmentCode,
    propertyType: subject.type,
    surface,
    // Des euros entiers. Le moteur rend déjà des valeurs arrondies ; l'arrondi
    // ici protège d'un flottant qui aurait traîné, plutôt que d'échouer à
    // l'insertion sur une colonne `integer`.
    valueLow: valuation.value ? Math.round(valuation.value.low) : null,
    valueCentral: valuation.value ? Math.round(valuation.value.central) : null,
    valueHigh: valuation.value ? Math.round(valuation.value.high) : null,
    pricePerSqm: valuation.pricePerSqm === undefined ? null : Math.round(valuation.pricePerSqm),
    confidence: Math.round(valuation.confidence.score),
    comparablesCount: valuation.comparables.filter((comparable) => !comparable.excluded).length,
  };
}

/** Une ligne de résumé rendue au produit. */
export function estimationRowToSummary(row: EstimationRow): EstimationSummary {
  const value =
    row.valueLow !== null && row.valueCentral !== null && row.valueHigh !== null
      ? { low: row.valueLow, central: row.valueCentral, high: row.valueHigh }
      : null;

  return {
    id: row.id,
    engineId: row.engineId,
    at: row.computedAt.getTime(),
    address: row.addressLabel,
    city: row.city,
    // Chaîne vide et non `null` : c'est la forme qu'attend `EstimationRecord`,
    // et un code postal manquant s'affiche comme une absence, pas comme un mot.
    postcode: row.postcode ?? "",
    propertyType: row.propertyType,
    surface: row.surface,
    value,
    pricePerSqm: row.pricePerSqm,
    confidence: row.confidence,
    comparables: row.comparablesCount,
    shareToken: row.shareToken,
  };
}

// ---------------------------------------------------------------------------
// Comparables
// ---------------------------------------------------------------------------

/**
 * Une ligne de panier, sous la forme exacte de `ComparableEntry`
 * (`src/components/observatoire/comparables-store.tsx`).
 *
 * Le type n'est pas importé du composant : une couche serveur ne dépend pas
 * d'un module `"use client"`. La conformité est vérifiée dans le test, qui lui
 * peut se permettre l'import de type.
 */
export interface SavedComparable {
  transaction: DvfTransaction;
  /** ISO, comme dans le panier local : c'est l'ordre d'affichage par défaut. */
  addedAt: string;
  /** Gardé dans le panier mais hors du calcul. */
  excluded: boolean;
  /** Pondération imposée, 0 à 3. Absente = utiliser le poids calculé. */
  manualWeight?: number;
  comment?: string;
}

/**
 * Le contrat du moteur : une pondération manuelle vit dans [0, 3].
 *
 * Même normalisation que `normaliseWeight()` côté panier local. Ce n'est pas
 * une règle métier dupliquée mais une validation de bord : ce qui entre en base
 * doit déjà être dans les clous, sans quoi le moteur recevra un jour un poids
 * de 47 lu depuis une ligne écrite par une version antérieure.
 */
function clampWeight(weight: number | undefined | null): number | null {
  if (weight === undefined || weight === null || !Number.isFinite(weight)) return null;
  return Math.min(3, Math.max(0, Math.round(weight * 100) / 100));
}

export function comparableItemToSaved(row: ComparableItemRow): SavedComparable {
  return {
    transaction: row.transaction,
    addedAt: row.addedAt.toISOString(),
    excluded: row.excluded,
    // `undefined` et non `null` : dans le domaine, l'absence de pondération
    // manuelle veut dire « utilise le poids calculé », alors que zéro veut dire
    // « compte pour rien ». Les confondre changerait le résultat.
    ...(row.manualWeight === null ? {} : { manualWeight: row.manualWeight }),
    ...(row.comment === null ? {} : { comment: row.comment }),
  };
}

export function savedComparableToInsert(
  setId: string,
  entry: SavedComparable,
): ComparableItemInsert {
  return {
    setId,
    transactionId: entry.transaction.id,
    transaction: entry.transaction,
    addedAt: new Date(Date.parse(entry.addedAt) || Date.now()),
    excluded: entry.excluded,
    manualWeight: clampWeight(entry.manualWeight),
    comment: entry.comment ?? null,
  };
}

/** Une mutation DVF fraîchement cochée dans l'observatoire. */
export function transactionToInsert(
  setId: string,
  transaction: DvfTransaction,
  now: Date = new Date(),
): ComparableItemInsert {
  return {
    setId,
    transactionId: transaction.id,
    transaction,
    addedAt: now,
    excluded: false,
    manualWeight: null,
    comment: null,
  };
}
