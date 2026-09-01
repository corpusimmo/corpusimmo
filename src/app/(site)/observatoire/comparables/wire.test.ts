import { describe, expect, it } from "vitest";

import type { DvfTransaction } from "@/types/dvf";

import {
  addedAtDate,
  isTransactionId,
  MAX_ITEMS,
  newEntry,
  normaliseWeight,
  parseComparableEntries,
  parseComparableEntry,
  type ComparableEntry,
} from "./wire";

/**
 * LA GARDE DE FORME, éprouvée des deux côtés à la fois.
 *
 * Ce module est la seule barrière entre le réseau et une colonne `jsonb` : ce
 * qu'il laisse passer sera écrit tel quel en base. Les cas ci-dessous sont donc
 * autant des cas de sécurité que des cas de compatibilité avec les paniers déjà
 * rangés dans les navigateurs.
 */

const TRANSACTION: DvfTransaction = {
  id: "geodvf:2024-532458",
  date: "2024-03-12",
  year: 2024,
  nature: "sale",
  price: 320_000,
  propertyType: "apartment",
  builtArea: 64,
  addressLabel: "8 Rue de la Paix",
  postcode: "44000",
  city: "Nantes",
  cityCode: "44109",
  departmentCode: "44",
  coordinates: { lat: 47.21, lng: -1.55 },
  pricePerSqm: 5_000,
  isMultiLot: false,
  source: "geodvf",
};

function entry(overrides: Partial<ComparableEntry> = {}): ComparableEntry {
  return { transaction: TRANSACTION, addedAt: "2024-05-01T10:00:00.000Z", excluded: false, ...overrides };
}

describe("parseComparableEntry", () => {
  it("garde une ligne complète telle quelle", () => {
    const parsed = parseComparableEntry(entry({ manualWeight: 1.5, comment: "Vue dégagée" }));

    expect(parsed).not.toBeNull();
    expect(parsed?.transaction.id).toBe("geodvf:2024-532458");
    expect(parsed?.transaction.pricePerSqm).toBe(5_000);
    expect(parsed?.manualWeight).toBe(1.5);
    expect(parsed?.comment).toBe("Vue dégagée");
    expect(parsed?.addedAt).toBe("2024-05-01T10:00:00.000Z");
  });

  it("laisse ABSENTS les champs que la donnée ouverte ne porte pas", () => {
    const { builtArea: _a, addressLabel: _b, pricePerSqm: _c, ...nu } = TRANSACTION;
    const parsed = parseComparableEntry(entry({ transaction: nu as DvfTransaction }));

    // Absents, et non présents à `undefined` : `JSON.stringify` écrirait
    // autrement des clés vides dans la colonne `jsonb`.
    expect(parsed).not.toBeNull();
    expect("builtArea" in (parsed?.transaction ?? {})).toBe(false);
    expect("pricePerSqm" in (parsed?.transaction ?? {})).toBe(false);
  });

  it("refuse ce qui n'a pas la forme d'une mutation", () => {
    expect(parseComparableEntry(null)).toBeNull();
    expect(parseComparableEntry("geodvf:1")).toBeNull();
    expect(parseComparableEntry({ transaction: {} })).toBeNull();
    expect(parseComparableEntry(entry({ transaction: { ...TRANSACTION, id: "" } }))).toBeNull();
    expect(
      parseComparableEntry(entry({ transaction: { ...TRANSACTION, price: -1 } })),
    ).toBeNull();
    expect(
      parseComparableEntry(
        entry({ transaction: { ...TRANSACTION, coordinates: { lat: 999, lng: 0 } } }),
      ),
    ).toBeNull();
  });

  it("refuse une provenance inconnue plutôt que de lui inventer un repli", () => {
    const parsed = parseComparableEntry(
      entry({ transaction: { ...TRANSACTION, source: "inventé" } as unknown as DvfTransaction }),
    );
    expect(parsed).toBeNull();
  });

  it("rabat une nature ou un type inconnus sur « other », qui existe pour cela", () => {
    const parsed = parseComparableEntry(
      entry({
        transaction: {
          ...TRANSACTION,
          nature: "donation",
          propertyType: "chateau",
        } as unknown as DvfTransaction,
      }),
    );

    expect(parsed?.transaction.nature).toBe("other");
    expect(parsed?.transaction.propertyType).toBe("other");
  });

  it("borne les chaînes et laisse tomber celles qui débordent", () => {
    const parsed = parseComparableEntry(
      entry({ transaction: { ...TRANSACTION, addressLabel: "x".repeat(5_000) } }),
    );

    expect(parsed).not.toBeNull();
    expect("addressLabel" in (parsed?.transaction ?? {})).toBe(false);
  });

  it("répare une date d'ajout illisible plutôt que de perdre la ligne", () => {
    const now = new Date("2025-01-02T03:04:05.000Z");
    const parsed = parseComparableEntry(entry({ addedAt: "hier" }), now);

    expect(parsed?.addedAt).toBe(now.toISOString());
  });

  it("ramène une pondération hors bornes dans [0, 3]", () => {
    expect(parseComparableEntry(entry({ manualWeight: 47 }))?.manualWeight).toBe(3);
    expect(parseComparableEntry(entry({ manualWeight: -2 }))?.manualWeight).toBe(0);
    expect(parseComparableEntry(entry({ manualWeight: Number.NaN }))?.manualWeight).toBeUndefined();
  });

  it("distingue « pas de pondération » de « pondération nulle »", () => {
    // Zéro veut dire « ne compte pas ce bien », l'absence veut dire « utilise
    // le poids calculé ». Les confondre changerait le résultat du moteur.
    expect(parseComparableEntry(entry({ manualWeight: 0 }))?.manualWeight).toBe(0);
    expect(parseComparableEntry(entry())?.manualWeight).toBeUndefined();
  });
});

describe("parseComparableEntries", () => {
  it("dégrade vers un panier vide plutôt que de lever", () => {
    expect(parseComparableEntries(undefined)).toEqual([]);
    expect(parseComparableEntries("[]")).toEqual([]);
    expect(parseComparableEntries({ items: [] })).toEqual([]);
  });

  it("écarte les lignes illisibles et garde les autres", () => {
    const parsed = parseComparableEntries([entry(), null, { transaction: 3 }]);
    expect(parsed).toHaveLength(1);
  });

  it("dédoublonne : le même bien deux fois compterait double dans la moyenne", () => {
    const parsed = parseComparableEntries([entry(), entry()]);
    expect(parsed).toHaveLength(1);
  });

  it("plafonne à cinquante lignes, comme la base", () => {
    const many = Array.from({ length: MAX_ITEMS + 20 }, (_, index) =>
      entry({ transaction: { ...TRANSACTION, id: `geodvf:${index}` } }),
    );

    expect(parseComparableEntries(many)).toHaveLength(MAX_ITEMS);
  });
});

describe("les utilitaires de bord", () => {
  it("borne l'identifiant de mutation, qui sert de clé dans une clause where", () => {
    expect(isTransactionId("geodvf:2024-532458")).toBe(true);
    expect(isTransactionId("")).toBe(false);
    expect(isTransactionId("x".repeat(500))).toBe(false);
    expect(isTransactionId(42)).toBe(false);
  });

  it("rend une date utilisable même pour une ligne datée n'importe comment", () => {
    const now = new Date("2025-06-01T00:00:00.000Z");
    expect(addedAtDate(entry(), now).toISOString()).toBe("2024-05-01T10:00:00.000Z");
    expect(addedAtDate(entry({ addedAt: "n'importe quoi" }), now)).toEqual(now);
  });

  it("horodate un ajout et le laisse dans le calcul", () => {
    const fresh = newEntry(TRANSACTION, new Date("2025-06-01T00:00:00.000Z"));
    expect(fresh.excluded).toBe(false);
    expect(fresh.addedAt).toBe("2025-06-01T00:00:00.000Z");
  });

  it("arrondit la pondération au centième", () => {
    expect(normaliseWeight(1.23456)).toBe(1.23);
    expect(normaliseWeight(undefined)).toBeUndefined();
    expect(normaliseWeight(null)).toBeUndefined();
  });
});
