import { describe, expect, it } from "vitest";

import { formatNumber } from "@/lib/utils/format";

import { buildPriceScale, byPriceClass, priceClass, scaleLabels } from "./price-scale";

const RAMP = ["a", "b", "c", "d", "e"];

describe("buildPriceScale", () => {
  it("refuse un effectif trop faible", () => {
    expect(buildPriceScale([1000, 2000, 3000], RAMP)).toBeNull();
  });

  it("ignore les prix inconnus, nuls ou négatifs", () => {
    const values = [undefined, 0, -5, ...Array.from({ length: 12 }, (_, i) => 1000 + i * 300)];
    const scale = buildPriceScale(values, RAMP);
    expect(scale?.sample).toBe(12);
  });

  it("pose quatre bornes croissantes arrondies à cinquante", () => {
    const values = Array.from({ length: 100 }, (_, i) => 2000 + i * 37);
    const scale = buildPriceScale(values, RAMP);
    expect(scale).not.toBeNull();
    expect(scale?.breaks).toHaveLength(4);
    for (const boundary of scale?.breaks ?? []) expect(boundary % 50).toBe(0);
    const sorted = [...(scale?.breaks ?? [])].sort((a, b) => a - b);
    expect(scale?.breaks).toEqual(sorted);
    expect(scale?.colors).toEqual(RAMP);
  });

  it("fusionne les classes quand les prix sont serrés, et garde les couleurs extrêmes", () => {
    const values = [...Array.from({ length: 30 }, () => 3000), ...Array.from({ length: 10 }, () => 4000)];
    const scale = buildPriceScale(values, RAMP);
    expect(scale?.breaks).toEqual([4000]);
    expect(scale?.colors).toEqual(["a", "e"]);
  });

  it("rend null quand toutes les ventes ont le même prix", () => {
    expect(buildPriceScale(Array.from({ length: 20 }, () => 3000), RAMP)).toBeNull();
  });
});

describe("priceClass", () => {
  const scale = { breaks: [2000, 3000, 4000, 5000], colors: RAMP, sample: 50 };

  it("classe par paliers, borne incluse à droite", () => {
    expect(priceClass(scale, 1500)).toBe(0);
    expect(priceClass(scale, 2000)).toBe(1);
    expect(priceClass(scale, 3999)).toBe(2);
    expect(priceClass(scale, 9000)).toBe(4);
  });

  it("renvoie -1 pour un prix inconnu", () => {
    expect(priceClass(scale, undefined)).toBe(-1);
    expect(priceClass(scale, 0)).toBe(-1);
  });
});

describe("byPriceClass", () => {
  it("produit un palier MapLibre avec repli sur l'inconnu", () => {
    const scale = { breaks: [2000, 3000], colors: ["a", "b", "c"], sample: 50 };
    expect(byPriceClass(scale, ["get", "ppsm"], ["a", "b", "c"], "x")).toEqual([
      "case",
      ["<", ["get", "ppsm"], 0],
      "x",
      ["step", ["get", "ppsm"], "a", 2000, "b", 3000, "c"],
    ]);
  });
});

describe("scaleLabels", () => {
  it("écrit une étiquette par classe", () => {
    const scale = { breaks: [2000, 3000, 4000], colors: ["a", "b", "c", "d"], sample: 50 };
    const n = formatNumber;
    expect(scaleLabels(scale)).toEqual([
      `moins de ${n(2000)}`,
      `${n(2000)} à ${n(3000)}`,
      `${n(3000)} à ${n(4000)}`,
      `${n(4000)} et plus`,
    ]);
  });
});
