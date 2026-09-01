import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRows } from "./csv";
import { DvfParseError, mapLocalType, mapMutationNature, parseGeoDvfCsv } from "./normalize";
import { computeMarketStats, MIN_STATISTICAL_SAMPLE } from "./aggregate";
import type { DvfTransaction } from "@/types/dvf";

const HEADER =
  "id_mutation,date_mutation,numero_disposition,nature_mutation,valeur_fonciere,adresse_numero,adresse_suffixe,adresse_nom_voie,adresse_code_voie,code_postal,code_commune,nom_commune,code_departement,ancien_code_commune,ancien_nom_commune,id_parcelle,ancien_id_parcelle,numero_volume,lot1_numero,lot1_surface_carrez,lot2_numero,lot2_surface_carrez,lot3_numero,lot3_surface_carrez,lot4_numero,lot4_surface_carrez,lot5_numero,lot5_surface_carrez,nombre_lots,code_type_local,type_local,surface_reelle_bati,nombre_pieces_principales,code_nature_culture,nature_culture,code_nature_culture_speciale,nature_culture_speciale,surface_terrain,longitude,latitude";

/** Builds one geo-DVF line from the fields a test actually cares about. */
function line(fields: Partial<Record<string, string>>): string {
  const columns = HEADER.split(",");
  return columns.map((name) => fields[name] ?? "").join(",");
}

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

const BASE = {
  id_mutation: "2024-000001",
  date_mutation: "2024-03-12",
  nature_mutation: "Vente",
  valeur_fonciere: "363000",
  code_commune: "44109",
  nom_commune: "Nantes",
  code_departement: "44",
  code_postal: "44000",
  longitude: "-1.55",
  latitude: "47.21",
};

describe("parseCsv", () => {
  it("handles quoted fields, escaped quotes, embedded separators and CRLF", () => {
    const table = parseCsv('a,b,c\r\n1,"deux, virgule","il dit ""oui"""\r\n');
    expect(table.header).toEqual(["a", "b", "c"]);
    expect(table.rows).toEqual([["1", "deux, virgule", 'il dit "oui"']]);
  });

  it("keeps empty fields as empty strings and drops the trailing newline row", () => {
    const rows = parseCsvRows("a,b,c\n1,,3\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });

  it("supports newlines inside quoted fields", () => {
    const rows = parseCsvRows('a,b\n"ligne\nsuivante",2\n');
    expect(rows[1]).toEqual(["ligne\nsuivante", "2"]);
  });

  it("strips a UTF-8 BOM from the first header cell", () => {
    expect(parseCsv("﻿id_mutation,x\n1,2\n").header[0]).toBe("id_mutation");
  });
});

describe("parseGeoDvfCsv — grouping by id_mutation", () => {
  it("counts the repeated valeur_fonciere ONCE and sums only dwelling surfaces", () => {
    // Real shape: one house + two outbuildings, 363 000 € repeated on all three
    // lines, and the 315 m² parcel repeated too.
    const source = csv(
      line({
        ...BASE,
        id_parcelle: "44109000NS0199",
        code_type_local: "1",
        type_local: "Maison",
        surface_reelle_bati: "50",
        nombre_pieces_principales: "3",
        surface_terrain: "315",
        adresse_numero: "12",
        adresse_nom_voie: "RUE DU COUDRAY",
      }),
      line({
        ...BASE,
        id_parcelle: "44109000NS0199",
        code_type_local: "3",
        type_local: "Dépendance",
        surface_terrain: "315",
      }),
      line({
        ...BASE,
        id_parcelle: "44109000NS0199",
        code_type_local: "3",
        type_local: "Dépendance",
        surface_terrain: "315",
      }),
    );

    const { transactions, report } = parseGeoDvfCsv(source);
    expect(report.sourceRows).toBe(3);
    expect(report.mutations).toBe(1);
    expect(transactions).toHaveLength(1);

    const row = transactions[0] as DvfTransaction;
    expect(row.price).toBe(363_000); // not 3 × 363 000
    expect(row.builtArea).toBe(50); // outbuildings carry no surface
    expect(row.landArea).toBe(315); // deduplicated by id_parcelle, not 945
    expect(row.propertyType).toBe("house");
    expect(row.rooms).toBe(3);
    expect(row.isMultiLot).toBe(false); // a single built local
    expect(row.addressLabel).toBe("12 Rue du Coudray");
    expect(row.id).toBe("geodvf:44109:2024-000001");
  });

  it("computes €/m² from the mutation total, not from one line", () => {
    const source = csv(
      line({
        ...BASE,
        valeur_fonciere: "300000",
        id_parcelle: "44109000AB0001",
        code_type_local: "2",
        type_local: "Appartement",
        surface_reelle_bati: "60",
        nombre_pieces_principales: "3",
      }),
    );
    const row = parseGeoDvfCsv(source).transactions[0] as DvfTransaction;
    expect(row.pricePerSqm).toBe(5000);
  });

  it("sums surfaces across several dwellings and flags the mutation multi-lot", () => {
    const source = csv(
      line({
        ...BASE,
        valeur_fonciere: "400000",
        id_parcelle: "44109000AB0001",
        code_type_local: "2",
        type_local: "Appartement",
        surface_reelle_bati: "40",
        nombre_pieces_principales: "2",
      }),
      line({
        ...BASE,
        valeur_fonciere: "400000",
        id_parcelle: "44109000AB0002",
        code_type_local: "2",
        type_local: "Appartement",
        surface_reelle_bati: "60",
        nombre_pieces_principales: "3",
      }),
    );
    const row = parseGeoDvfCsv(source).transactions[0] as DvfTransaction;
    expect(row.price).toBe(400_000);
    expect(row.builtArea).toBe(100);
    expect(row.pricePerSqm).toBe(4000);
    expect(row.rooms).toBe(5);
    expect(row.isMultiLot).toBe(true);
    expect(row.lotCount).toBe(2);
  });

  it("keeps mutations distinct when ids differ", () => {
    const source = csv(
      line({ ...BASE, id_mutation: "2024-1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "50" }),
      line({ ...BASE, id_mutation: "2024-2", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "50" }),
    );
    expect(parseGeoDvfCsv(source).transactions).toHaveLength(2);
  });
});

describe("parseGeoDvfCsv — rejections", () => {
  it("rejects a mutation without coordinates and reports it", () => {
    const source = csv(
      line({
        ...BASE,
        longitude: "",
        latitude: "",
        code_type_local: "2",
        type_local: "Appartement",
        surface_reelle_bati: "50",
      }),
    );
    const { transactions, report } = parseGeoDvfCsv(source);
    expect(transactions).toHaveLength(0);
    expect(report.mutations).toBe(1);
    expect(report.kept).toBe(0);
    expect(report.rejected).toContainEqual({ reason: "no_coordinates", count: 1 });
  });

  it("rejects the 0,0 island and out-of-range coordinates", () => {
    const source = csv(
      line({ ...BASE, longitude: "0", latitude: "0", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "50" }),
    );
    expect(parseGeoDvfCsv(source).transactions).toHaveLength(0);
  });

  it("rejects a symbolic 1 € mutation as having no usable price", () => {
    const source = csv(
      line({ ...BASE, valeur_fonciere: "1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "50" }),
    );
    const { report } = parseGeoDvfCsv(source);
    expect(report.rejected).toContainEqual({ reason: "no_price", count: 1 });
  });

  it("keeps going through a malformed CSV instead of throwing", () => {
    const malformed = [
      HEADER,
      "", // empty line
      "2024-000009", // ragged: only one column
      line({ ...BASE, id_mutation: "2024-000010", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "50" }),
      '2024-000011,2024-05-05,,"Vente",250000', // truncated but parseable
    ].join("\n");

    const { transactions, report } = parseGeoDvfCsv(malformed);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.id).toBe("geodvf:44109:2024-000010");
    // The one-column line has no code_commune, so it cannot be attributed.
    expect(report.rejected.some((r) => r.reason === "malformed_row")).toBe(true);
  });

  it("throws only when the document is not geo-DVF at all", () => {
    expect(() => parseGeoDvfCsv("foo,bar\n1,2\n")).toThrow(DvfParseError);
    expect(() => parseGeoDvfCsv("")).toThrow(DvfParseError);
  });
});

describe("type and nature mapping", () => {
  it("maps code_type_local to the normalised family", () => {
    expect(mapLocalType("1")).toBe("house");
    expect(mapLocalType("2")).toBe("apartment");
    expect(mapLocalType("3")).toBe("dependency");
    expect(mapLocalType("4")).toBe("commercial");
    expect(mapLocalType(undefined, "Appartement")).toBe("apartment");
    expect(mapLocalType(undefined, "Local industriel. commercial ou assimilé")).toBe("commercial");
    expect(mapLocalType(undefined)).toBeUndefined();
  });

  it("maps every nature_mutation seen in the real files", () => {
    expect(mapMutationNature("Vente")).toBe("sale");
    expect(mapMutationNature("Vente en l'état futur d'achèvement")).toBe("sale_off_plan");
    expect(mapMutationNature("Vente terrain à bâtir")).toBe("sale_land_to_build");
    expect(mapMutationNature("Echange")).toBe("exchange");
    expect(mapMutationNature("Adjudication")).toBe("auction");
    expect(mapMutationNature("Expropriation")).toBe("expropriation");
    expect(mapMutationNature("Quelque chose d'autre")).toBe("other");
  });

  it("classifies a land sale with no built local", () => {
    const source = csv(
      line({
        ...BASE,
        nature_mutation: "Vente terrain à bâtir",
        valeur_fonciere: "120000",
        id_parcelle: "44109000ZZ0001",
        surface_terrain: "640",
        nature_culture: "sols",
      }),
    );
    const row = parseGeoDvfCsv(source).transactions[0] as DvfTransaction;
    expect(row.propertyType).toBe("land");
    expect(row.nature).toBe("sale_land_to_build");
    expect(row.landArea).toBe(640);
    expect(row.builtArea).toBeUndefined();
    expect(row.pricePerSqm).toBeUndefined();
  });

  it("picks the dominant dwelling type by surface, not by line count", () => {
    const source = csv(
      line({ ...BASE, valeur_fonciere: "500000", id_parcelle: "P1", code_type_local: "1", type_local: "Maison", surface_reelle_bati: "150" }),
      line({ ...BASE, valeur_fonciere: "500000", id_parcelle: "P1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "20" }),
      line({ ...BASE, valeur_fonciere: "500000", id_parcelle: "P1", code_type_local: "2", type_local: "Appartement", surface_reelle_bati: "25" }),
    );
    const row = parseGeoDvfCsv(source).transactions[0] as DvfTransaction;
    expect(row.propertyType).toBe("house");
    expect(row.builtArea).toBe(195);
  });
});

describe("computeMarketStats", () => {
  const make = (overrides: Partial<DvfTransaction>): DvfTransaction => ({
    id: overrides.id ?? "geodvf:44109:2024-1",
    date: "2024-01-01",
    year: 2024,
    nature: "sale",
    price: 300_000,
    propertyType: "apartment",
    city: "Nantes",
    cityCode: "44109",
    departmentCode: "44",
    coordinates: { lat: 47.21, lng: -1.55 },
    isMultiLot: false,
    source: "geodvf",
    ...overrides,
  });

  it("returns no aggregate below the statistical-secrecy floor", () => {
    const rows = Array.from({ length: MIN_STATISTICAL_SAMPLE - 1 }, (_, i) =>
      make({ id: `geodvf:44109:2024-${i}`, pricePerSqm: 4000, builtArea: 75 }),
    );
    const stats = computeMarketStats(rows);

    expect(stats.count).toBe(MIN_STATISTICAL_SAMPLE - 1);
    expect(stats.sampleSufficient).toBe(false);
    expect(stats.medianPricePerSqm).toBeUndefined();
    expect(stats.medianPrice).toBeUndefined();
    expect(stats.averagePrice).toBeUndefined();
    // Counts and coverage remain, so the UI can explain the omission.
    expect(stats.byType.apartment).toBe(MIN_STATISTICAL_SAMPLE - 1);
    expect(stats.yearRange).toEqual([2024, 2024]);
  });

  it("publishes aggregates once the sample reaches the floor", () => {
    const unitPrices = [3000, 3200, 3400, 3600, 5000];
    const rows = unitPrices.map((unit, i) =>
      make({ id: `geodvf:44109:2024-${i}`, price: unit * 50, builtArea: 50, pricePerSqm: unit, year: 2020 + i }),
    );
    const stats = computeMarketStats(rows);

    expect(stats.sampleSufficient).toBe(true);
    expect(stats.count).toBe(5);
    expect(stats.medianPricePerSqm).toBe(3400);
    expect(stats.medianPrice).toBe(170_000);
    expect(stats.yearRange).toEqual([2020, 2024]);
  });

  it("ignores multi-lot unit prices when enough single-lot ones exist", () => {
    const single = [3000, 3100, 3200, 3300, 3400].map((unit, i) =>
      make({ id: `s${i}`, pricePerSqm: unit, builtArea: 50, price: unit * 50 }),
    );
    const noisy = [12000, 15000].map((unit, i) =>
      make({ id: `m${i}`, pricePerSqm: unit, builtArea: 50, price: unit * 50, isMultiLot: true }),
    );
    expect(computeMarketStats([...single, ...noisy]).medianPricePerSqm).toBe(3200);
  });

  it("is empty and insufficient for an empty set", () => {
    const stats = computeMarketStats([]);
    expect(stats.count).toBe(0);
    expect(stats.sampleSufficient).toBe(false);
    expect(stats.byType.house).toBe(0);
  });
});
