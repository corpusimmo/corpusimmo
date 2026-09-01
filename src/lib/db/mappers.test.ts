/**
 * LA COHÉRENCE ENTRE LA BASE ET CE QUI EXISTE DÉJÀ.
 *
 * Le risque de ce chantier n'est pas d'écrire une requête fausse : c'est de
 * livrer une couche de persistance qui retient d'une estimation ou d'un
 * comparable *presque* la même chose que le navigateur, à un champ près, et de
 * ne s'en apercevoir qu'après la bascule, quand les anciennes données seront
 * devenues illisibles.
 *
 * D'où trois familles de vérifications, et elles portent toutes sur des
 * fonctions PURES — c'est le seul moyen d'éprouver une couche de base de
 * données sans base :
 *
 *   1. LA RÈGLE DU QUOTA appliquée à des lignes de table. On ne re-teste pas
 *      `computeQuota`, `core.test.ts` s'en charge : on prouve que la traduction
 *      des lignes en `Grant` conserve exactement ce dont la règle a besoin,
 *      unité de temps comprise.
 *   2. LE RÉSUMÉ D'ESTIMATION comparé, champ par champ, à ce que `summarise()`
 *      produit aujourd'hui dans `localStorage`.
 *   3. LA CONFORMITÉ DE TYPE avec `EstimationRecord` et `ComparableEntry`,
 *      vérifiée à la compilation par des affectations qui échoueraient si les
 *      formes divergeaient.
 */

import { describe, expect, it } from "vitest";

import { applyGrant, computeQuota, WEEKLY_LIMIT, WINDOW_SECONDS } from "@/lib/access/core";
import { summarise, type EstimationRecord } from "@/lib/history/estimations";
import type { ComparableEntry } from "@/components/observatoire/comparables-store";
import type { DvfTransaction } from "@/types/dvf";
import type { ValuationResult } from "@/types/valuation";

import {
  comparableItemToSaved,
  estimationRowToSummary,
  savedComparableToInsert,
  transactionToInsert,
  unlocksToGrants,
  valuationToEstimationInsert,
  type EstimationSummary,
  type SavedComparable,
} from "./mappers";
import type { ComparableItemRow } from "./schema/comparables";
import type { EstimationRow } from "./schema/estimations";

const NOW = new Date("2026-09-01T12:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Déblocages
// ---------------------------------------------------------------------------

function unlock(slug: string, joursAvant: number) {
  return { toolSlug: slug, unlockedAt: new Date(NOW.getTime() - joursAvant * JOUR) };
}

describe("lignes de déblocage traduites en `Grant`", () => {
  it("compte en SECONDES, l'unité de `Grant.at` et de `WINDOW_SECONDS`", () => {
    const [grant] = unlocksToGrants([unlock("dcf", 0)]);

    // Un facteur mille ici rendrait tous les déblocages éternellement récents,
    // et le quota ne se libérerait jamais.
    expect(grant?.at).toBe(Math.floor(NOW.getTime() / 1000));
    expect(grant?.slug).toBe("dcf");
  });

  it("laisse `computeQuota` voir la fenêtre glissante telle qu'elle est", () => {
    const grants = unlocksToGrants([unlock("dcf", 1), unlock("wault", 2)]);
    const quota = computeQuota(grants, NOW);

    expect(quota.limit).toBe(WEEKLY_LIMIT);
    expect(quota.used).toBe(2);
    expect(quota.remaining).toBe(0);
    // Le crédit se libère sept jours après le PLUS ANCIEN déblocage compté.
    expect(quota.renewsAt?.getTime()).toBe(NOW.getTime() - 2 * JOUR + WINDOW_SECONDS * 1000);
  });

  it("ne compte plus un déblocage sorti de la fenêtre", () => {
    const grants = unlocksToGrants([unlock("dcf", 8), unlock("wault", 30)]);
    const quota = computeQuota(grants, NOW);

    expect(quota.used).toBe(0);
    expect(quota.remaining).toBe(WEEKLY_LIMIT);
  });

  it("rend gratuite la réouverture d'un outil sorti de la fenêtre", () => {
    // Le cas qui distingue « compter les déblocages » de « compter les usages » :
    // l'outil a été obtenu il y a un mois, le quota est épuisé cette semaine, et
    // le rouvrir ne doit RIEN coûter.
    const grants = unlocksToGrants([unlock("dcf", 40), unlock("a", 1), unlock("b", 2)]);
    const outcome = applyGrant(grants, "dcf", NOW);

    expect(outcome.granted).toBe(true);
    expect(outcome.granted && outcome.alreadyOwned).toBe(true);
  });

  it("refuse un outil NEUF quand la semaine est pleine", () => {
    const grants = unlocksToGrants([unlock("a", 1), unlock("b", 2)]);
    const outcome = applyGrant(grants, "c", NOW);

    expect(outcome.granted).toBe(false);
    expect(!outcome.granted && outcome.reason).toBe("quota_exhausted");
  });

  it("ne perd pas la propriété d'un outil au-delà de quarante déblocages", () => {
    // Le cookie tronque à `MAX_GRANTS` faute de place dans un en-tête HTTP. La
    // base ne tronque pas, et `applyGrant` n'applique sa troncature qu'au
    // tableau qu'il RENVOIE — celui que ce module jette.
    const anciens = Array.from({ length: 45 }, (_, i) => unlock(`outil-${i}`, 100 + i));
    const grants = unlocksToGrants([...anciens, unlock("dcf", 200)]);
    const outcome = applyGrant(grants, "dcf", NOW);

    expect(outcome.granted && outcome.alreadyOwned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Estimations
// ---------------------------------------------------------------------------

function valuation(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    id: "val-1",
    method: "comparison",
    status: "computed",
    createdAt: "2026-03-02T10:00:00.000Z",
    subject: {
      type: "apartment",
      address: {
        id: "75102_7098_00012",
        label: "12 rue de la Paix, 75002 Paris",
        kind: "housenumber",
        city: "Paris",
        cityCode: "75102",
        postcode: "75002",
        departmentCode: "75",
        coordinates: { lat: 48.869, lng: 2.331 },
        score: 0.97,
      },
      features: { livingArea: 68 },
    },
    value: { low: 610_000, central: 665_000, high: 720_000 },
    pricePerSqm: 9779,
    confidence: { score: 74, level: "moderate", factors: [] },
    comparables: [],
    diagnostics: { radiusUsed: 500, candidatesFound: 120, rejected: [], retained: 0 },
    ...overrides,
  };
}

describe("résumé d'estimation", () => {
  it("retient EXACTEMENT ce que `summarise()` retient déjà", () => {
    const source = valuation();
    const insert = valuationToEstimationInsert(source, null, NOW);
    const record = summarise(source, NOW);

    // Le seul contrat qui compte : basculer du navigateur vers la base ne doit
    // faire perdre aucun champ de l'historique.
    expect(insert.engineId).toBe(record.id);
    expect(insert.computedAt.getTime()).toBe(record.at);
    expect(insert.addressLabel).toBe(record.address);
    expect(insert.city).toBe(record.city);
    expect(insert.postcode).toBe(record.postcode);
    expect(insert.propertyType).toBe(record.propertyType);
    expect(insert.surface).toBe(record.surface);
    expect(insert.valueLow).toBe(record.value?.low);
    expect(insert.valueCentral).toBe(record.value?.central);
    expect(insert.valueHigh).toBe(record.value?.high);
    expect(insert.pricePerSqm).toBe(record.pricePerSqm);
    expect(insert.confidence).toBe(record.confidence);
    expect(insert.comparablesCount).toBe(record.comparables);
  });

  it("garde une estimation qui a ÉCHOUÉ, sans valeur", () => {
    const echec = valuation({ status: "failed", value: undefined, pricePerSqm: undefined });
    const insert = valuationToEstimationInsert(echec, null, NOW);

    expect(insert.status).toBe("failed");
    expect(insert.valueLow).toBeNull();
    expect(insert.valueCentral).toBeNull();
    expect(insert.valueHigh).toBeNull();
    expect(insert.pricePerSqm).toBeNull();
  });

  it("retombe sur la surface de terrain quand il n'y a pas de surface habitable", () => {
    const terrain = valuation({
      subject: { ...valuation().subject, type: "land", features: { landArea: 450 } },
    });
    expect(valuationToEstimationInsert(terrain, null, NOW).surface).toBe(450);
  });

  it("ne produit jamais de date illisible", () => {
    const cassee = valuation({ createdAt: "pas une date" });
    const insert = valuationToEstimationInsert(cassee, null, NOW);

    expect(Number.isNaN(insert.computedAt.getTime())).toBe(false);
    expect(insert.computedAt.getTime()).toBe(NOW.getTime());
  });

  it("se donne un identifiant de moteur même quand le moteur n'en rend pas", () => {
    const sansId = valuation({ id: "" });
    expect(valuationToEstimationInsert(sansId, null, NOW).engineId).toBe(`local-${NOW.getTime()}`);
  });

  it("rattache l'estimation à la personne quand elle est connectée", () => {
    const insert = valuationToEstimationInsert(valuation(), "3f2a...-user", NOW);
    expect(insert.userId).toBe("3f2a...-user");
  });
});

function estimationRow(overrides: Partial<EstimationRow> = {}): EstimationRow {
  return {
    id: "9f0a-ligne",
    userId: "3f2a-user",
    engineId: "val-1",
    method: "comparison",
    status: "computed",
    computedAt: new Date("2026-03-02T10:00:00.000Z"),
    createdAt: NOW,
    addressLabel: "12 rue de la Paix, 75002 Paris",
    city: "Paris",
    postcode: "75002",
    cityCode: "75102",
    departmentCode: "75",
    propertyType: "apartment",
    surface: 68,
    valueLow: 610_000,
    valueCentral: 665_000,
    valueHigh: 720_000,
    pricePerSqm: 9779,
    confidence: 74,
    comparablesCount: 12,
    shareToken: null,
    ...overrides,
  };
}

describe("ligne d'estimation rendue au produit", () => {
  it("rend un objet directement consommable comme `EstimationRecord`", () => {
    const summary: EstimationSummary = estimationRowToSummary(estimationRow());

    // Affectation vérifiée À LA COMPILATION : si la forme du résumé de base
    // divergeait de celle de l'historique local, `pnpm typecheck` échouerait.
    const record: EstimationRecord = summary;

    expect(record.address).toBe("12 rue de la Paix, 75002 Paris");
    expect(record.value).toEqual({ low: 610_000, central: 665_000, high: 720_000 });
  });

  it("expose NOTRE identifiant de ligne, pas celui du moteur", () => {
    // C'est `id` qui ira dans une URL : l'identifiant du moteur n'a aucune
    // garantie d'unicité entre deux personnes.
    const summary = estimationRowToSummary(estimationRow());
    expect(summary.id).toBe("9f0a-ligne");
    expect(summary.engineId).toBe("val-1");
  });

  it("rend une absence de valeur, pas une fourchette partielle", () => {
    const summary = estimationRowToSummary(
      estimationRow({ valueLow: 610_000, valueCentral: null, valueHigh: null }),
    );
    expect(summary.value).toBeNull();
  });

  it("traduit un code postal absent en chaîne vide, comme l'historique local", () => {
    expect(estimationRowToSummary(estimationRow({ postcode: null })).postcode).toBe("");
  });

  it("rend la date en millisecondes, l'unité de `EstimationRecord.at`", () => {
    expect(estimationRowToSummary(estimationRow()).at).toBe(
      Date.parse("2026-03-02T10:00:00.000Z"),
    );
  });
});

// ---------------------------------------------------------------------------
// Comparables
// ---------------------------------------------------------------------------

function transaction(overrides: Partial<DvfTransaction> = {}): DvfTransaction {
  return {
    id: "geodvf:2024-532458",
    date: "2024-06-14",
    year: 2024,
    nature: "sale",
    price: 412_000,
    propertyType: "apartment",
    builtArea: 62,
    city: "Nantes",
    cityCode: "44109",
    departmentCode: "44",
    coordinates: { lat: 47.218, lng: -1.553 },
    pricePerSqm: 6645,
    isMultiLot: false,
    source: "geodvf",
    ...overrides,
  };
}

function itemRow(overrides: Partial<ComparableItemRow> = {}): ComparableItemRow {
  return {
    id: "item-1",
    setId: "set-1",
    transactionId: "geodvf:2024-532458",
    transaction: transaction(),
    addedAt: NOW,
    excluded: false,
    manualWeight: null,
    comment: null,
    ...overrides,
  };
}

describe("lignes de panier", () => {
  it("rend un objet directement consommable comme `ComparableEntry`", () => {
    const saved: SavedComparable = comparableItemToSaved(itemRow());

    // Même garantie qu'au-dessus, à la compilation : le panier local et le
    // panier persisté parlent la même langue.
    const entry: ComparableEntry = saved;

    expect(entry.transaction.id).toBe("geodvf:2024-532458");
    expect(entry.addedAt).toBe(NOW.toISOString());
    expect(entry.excluded).toBe(false);
  });

  it("distingue « pas de pondération imposée » de « pondération à zéro »", () => {
    // La confusion changerait le résultat du moteur : `undefined` veut dire
    // « utilise le poids calculé », zéro veut dire « ne compte pas ce bien ».
    expect(comparableItemToSaved(itemRow({ manualWeight: null })).manualWeight).toBeUndefined();
    expect(comparableItemToSaved(itemRow({ manualWeight: 0 })).manualWeight).toBe(0);
  });

  it("omet le commentaire absent plutôt que de rendre `null`", () => {
    expect("comment" in comparableItemToSaved(itemRow({ comment: null }))).toBe(false);
    expect(comparableItemToSaved(itemRow({ comment: "vue dégagée" })).comment).toBe(
      "vue dégagée",
    );
  });

  it("ramène une pondération hors bornes dans le contrat du moteur", () => {
    const horsBornes = savedComparableToInsert("set-1", {
      transaction: transaction(),
      addedAt: NOW.toISOString(),
      excluded: false,
      manualWeight: 47,
    });
    expect(horsBornes.manualWeight).toBe(3);

    const negative = savedComparableToInsert("set-1", {
      transaction: transaction(),
      addedAt: NOW.toISOString(),
      excluded: false,
      manualWeight: -2,
    });
    expect(negative.manualWeight).toBe(0);
  });

  it("recopie la mutation entière, pas seulement son identifiant", () => {
    // Une ligne DVF est un fait historique immuable : le panier la porte, il ne
    // la référence pas.
    const insert = transactionToInsert("set-1", transaction(), NOW);

    expect(insert.transactionId).toBe("geodvf:2024-532458");
    expect(insert.transaction).toEqual(transaction());
    expect(insert.excluded).toBe(false);
    expect(insert.manualWeight).toBeNull();
  });

  it("ne produit jamais de date d'ajout illisible", () => {
    const insert = savedComparableToInsert("set-1", {
      transaction: transaction(),
      addedAt: "pas une date",
      excluded: false,
    });
    expect(Number.isNaN(insert.addedAt?.getTime() ?? NaN)).toBe(false);
  });
});
