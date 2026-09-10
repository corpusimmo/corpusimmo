import { describe, expect, it } from "vitest";

import {
  CALIBRATION_LOYERS,
  facteurLoyer,
  loyerHorsCharges,
  type CalibrationLoyers,
} from "./calibration";

const jeu: CalibrationLoyers = {
  generatedAt: "2026-09-10",
  ancrages: [
    { niveau: 10, facteur: 0.9, zones: 10 },
    { niveau: 20, facteur: 0.8, zones: 10 },
  ],
  global: 0.85,
  dispersion: { q10: 0.75, q25: 0.8, q75: 0.88, q90: 0.94 },
  appariement: { zones: 20, communes: 200 },
  controle: { agglomerations: 20, ecartMedian: 0.03, ecartAbsMedian: 0.05 },
  precautions: [],
};

describe("facteurLoyer", () => {
  it("interpole entre deux ancrages", () => {
    expect(facteurLoyer(15, jeu)).toBeCloseTo(0.85, 6);
  });

  it("n'extrapole pas sous le premier ancrage ni au-dessus du dernier", () => {
    expect(facteurLoyer(4, jeu)).toBe(0.9);
    expect(facteurLoyer(40, jeu)).toBe(0.8);
  });

  it("décroît avec le niveau de loyer, comme la mesure", () => {
    expect(facteurLoyer(12, jeu)).toBeGreaterThan(facteurLoyer(18, jeu));
  });
});

describe("loyerHorsCharges", () => {
  it("abaisse le loyer d'annonce", () => {
    expect(loyerHorsCharges(20, jeu)).toBeCloseTo(16, 6);
  });

  it("reste monotone : un loyer plus cher ne devient jamais moins cher", () => {
    let precedent = 0;
    for (let v = 5; v <= 40; v += 0.5) {
      const corrige = loyerHorsCharges(v, jeu) ?? 0;
      expect(corrige).toBeGreaterThan(precedent);
      precedent = corrige;
    }
  });

  it("rend null sur une absence de mesure, jamais zéro", () => {
    expect(loyerHorsCharges(null, jeu)).toBeNull();
    expect(loyerHorsCharges(0, jeu)).toBeNull();
    expect(loyerHorsCharges(Number.NaN, jeu)).toBeNull();
  });
});

describe("le fichier de calibration versionné", () => {
  it("porte des ancrages décroissants et plausibles", () => {
    const { ancrages } = CALIBRATION_LOYERS;
    expect(ancrages.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < ancrages.length; i += 1) {
      expect(ancrages[i]!.niveau).toBeGreaterThan(ancrages[i - 1]!.niveau);
      expect(ancrages[i]!.facteur).toBeLessThanOrEqual(ancrages[i - 1]!.facteur);
    }
    for (const point of ancrages) {
      expect(point.facteur).toBeGreaterThan(0.5);
      expect(point.facteur).toBeLessThan(1);
    }
  });

  it("se vérifie sur la source de contrôle à moins de dix pour cent", () => {
    const controle = CALIBRATION_LOYERS.controle;
    expect(controle).not.toBeNull();
    expect(Math.abs(controle!.ecartMedian)).toBeLessThan(0.1);
  });
});
