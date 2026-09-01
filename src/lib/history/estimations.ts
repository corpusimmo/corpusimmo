"use client";

/**
 * L'HISTORIQUE DES ESTIMATIONS.
 *
 * Une estimation coûte une adresse, cinq minutes et six écrans. La perdre parce
 * qu'on a fermé l'onglet est le genre de détail qui décide si l'on revient.
 *
 * CE QUI EST GARDÉ, ET CE QUI NE L'EST PAS. On enregistre le RÉSUMÉ : où,
 * quoi, combien, avec quelle confiance. Pas les comparables, pas le détail du
 * calcul, pas les coordonnées saisies. Deux raisons : un résumé tient dans
 * `localStorage` quand un résultat complet, avec ses cent mutations, ne tient
 * pas ; et un historique n'a pas à recopier des données personnelles que la
 * page n'affichera jamais.
 *
 * CE N'EST PAS UNE SAUVEGARDE. La liste vit dans CE navigateur : elle ne suit
 * pas d'un appareil à l'autre, et un nettoyage de l'historique l'efface. La
 * page le dit en toutes lettres plutôt que de laisser croire à un compte. Le
 * jour où une base existe, ce module devient la couche « visiteur anonyme » et
 * le reste du site n'a pas à changer.
 *
 * IL N'Y A PAS DE LIEN PARTAGEABLE, pour la même raison qu'ailleurs : rien
 * n'est stocké côté serveur, donc une URL permanente serait une promesse que
 * le rechargement casserait.
 */

import { useCallback, useSyncExternalStore } from "react";

import { createLocalStore, useHydrated } from "@/lib/browser/local-store";
import type { PropertyType } from "@/types/property";
import { PROPERTY_TYPE_LABELS } from "@/types/property";
import type { ValuationResult } from "@/types/valuation";

/** Assez pour retrouver une estimation d'il y a trois mois, pas assez pour peser. */
export const MAX_ESTIMATIONS = 30;

export interface EstimationRecord {
  /** L'identifiant rendu par le moteur, ou un repli horodaté. */
  id: string;
  /** Millisecondes Unix. */
  at: number;
  address: string;
  city: string;
  postcode: string;
  propertyType: PropertyType;
  /** Surface retenue, en m². Zéro quand le type n'en a pas. */
  surface: number;
  /** Absent quand le moteur n'a pas conclu : l'échec se garde aussi. */
  value: { low: number; central: number; high: number } | null;
  pricePerSqm: number | null;
  /** 0 à 100. */
  confidence: number;
  /** Nombre de ventes retenues, ce qui dit le poids réel du chiffre. */
  comparables: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function parseRecord(raw: unknown): EstimationRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<EstimationRecord>;
  if (typeof r.id !== "string" || !isFiniteNumber(r.at)) return null;
  if (typeof r.address !== "string" || typeof r.propertyType !== "string") return null;
  if (!(r.propertyType in PROPERTY_TYPE_LABELS)) return null;

  const value =
    r.value &&
    isFiniteNumber(r.value.low) &&
    isFiniteNumber(r.value.central) &&
    isFiniteNumber(r.value.high)
      ? { low: r.value.low, central: r.value.central, high: r.value.high }
      : null;

  return {
    id: r.id,
    at: r.at,
    address: r.address,
    city: typeof r.city === "string" ? r.city : "",
    postcode: typeof r.postcode === "string" ? r.postcode : "",
    propertyType: r.propertyType,
    surface: isFiniteNumber(r.surface) ? r.surface : 0,
    value,
    pricePerSqm: isFiniteNumber(r.pricePerSqm) ? r.pricePerSqm : null,
    confidence: isFiniteNumber(r.confidence) ? r.confidence : 0,
    comparables: isFiniteNumber(r.comparables) ? r.comparables : 0,
  };
}

/** Du plus récent au plus ancien, doublons d'identifiant écartés. */
export function normalise(records: EstimationRecord[]): EstimationRecord[] {
  const seen = new Set<string>();
  return [...records]
    .sort((a, b) => b.at - a.at)
    .filter((record) => {
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    })
    .slice(0, MAX_ESTIMATIONS);
}

/** Le résumé qu'on garde d'un résultat complet. */
export function summarise(valuation: ValuationResult, now: Date = new Date()): EstimationRecord {
  const { subject } = valuation;
  const surface =
    subject.features.livingArea ?? subject.features.landArea ?? 0;

  return {
    id: valuation.id || `local-${now.getTime()}`,
    at: Date.parse(valuation.createdAt) || now.getTime(),
    address: subject.address.label,
    city: subject.address.city,
    postcode: subject.address.postcode ?? "",
    propertyType: subject.type,
    surface,
    value: valuation.value
      ? {
          low: valuation.value.low,
          central: valuation.value.central,
          high: valuation.value.high,
        }
      : null,
    pricePerSqm: valuation.pricePerSqm ?? null,
    confidence: valuation.confidence.score,
    comparables: valuation.comparables.filter((comparable) => !comparable.excluded).length,
  };
}

const store = createLocalStore<EstimationRecord[]>({
  key: "corpusimmo.estimations.v1",
  empty: [],
  parse: (raw) =>
    Array.isArray(raw)
      ? normalise(
          raw
            .map(parseRecord)
            .filter((record): record is EstimationRecord => record !== null),
        )
      : [],
});

/**
 * Enregistre une estimation terminée. Hors React : appelable depuis le
 * gestionnaire qui reçoit le résultat, sans monter de composant.
 */
export function recordEstimation(valuation: ValuationResult, now: Date = new Date()): void {
  try {
    store.write(normalise([summarise(valuation, now), ...store.read()]));
  } catch {
    // Perdre une ligne d'historique ne doit jamais coûter son résultat à la
    // personne : l'échec est silencieux, par construction.
  }
}

export interface EstimationHistoryApi {
  estimations: EstimationRecord[];
  forget: (id: string) => void;
  clear: () => void;
  /** Faux tant que `localStorage` n'a pas été lu. */
  hydrated: boolean;
}

export function useEstimationHistory(): EstimationHistoryApi {
  const hydrated = useHydrated();
  const estimations = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const forget = useCallback((id: string) => {
    store.write(store.getSnapshot().filter((record) => record.id !== id));
  }, []);

  const clear = useCallback(() => {
    store.write([]);
  }, []);

  return { estimations, forget, clear, hydrated };
}
