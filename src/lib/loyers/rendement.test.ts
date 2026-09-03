import { describe, expect, it } from "vitest";

import {
  OBS_MIN_FIABLE,
  RENDEMENT_MAX_PLAUSIBLE,
  RENDEMENT_MIN_PLAUSIBLE,
  fourchetteRendement,
  indicateurFragile,
  lireRendement,
  rendementBrut,
  rendementHorsNorme,
} from "./rendement";
import type { IndicateurLoyer } from "./types";

/**
 * Nantes, millésime 2025 de la carte des loyers croisé avec nos médianes DVF :
 * 14,50 €/m²/mois d'appartement pour 3 670 €/m² à la vente. C'est le cas de
 * référence du module, et le seul chiffre de ce fichier qui vienne des données
 * réelles plutôt que d'un exemple construit.
 */
const NANTES: IndicateurLoyer = {
  m2: 14.5,
  bas: 11.35,
  haut: 18.54,
  echelle: "commune",
  obs: 65568,
  r2: 0.855,
};

describe("rendementBrut", () => {
  it("calcule le brut annuel de Nantes à partir des données réelles", () => {
    // 14,50 × 12 / 3 670 = 4,74 %
    expect(rendementBrut(NANTES.m2, 3670)).toBe(4.74);
  });

  it("arrondit au centième et pas plus loin", () => {
    // 10 × 12 / 3 000 = 4 % exactement, sans traîne flottante.
    expect(rendementBrut(10, 3000)).toBe(4);
    // 14,5041… serait 4,7411 % : la précision de la source ne le porte pas.
    expect(rendementBrut(14.5041, 3670)).toBe(4.74);
  });

  describe("refuse plutôt que d'inventer", () => {
    it("rend null quand le loyer manque", () => {
      expect(rendementBrut(null, 3670)).toBeNull();
      expect(rendementBrut(undefined, 3670)).toBeNull();
    });

    it("rend null quand le prix manque", () => {
      expect(rendementBrut(14.5, null)).toBeNull();
      expect(rendementBrut(14.5, undefined)).toBeNull();
    });

    it("rend null quand les deux manquent", () => {
      expect(rendementBrut(null, null)).toBeNull();
    });

    it("rend null sur un zéro, des deux côtés", () => {
      // Le piège du dénominateur : sans ce refus, on rendrait Infinity.
      expect(rendementBrut(14.5, 0)).toBeNull();
      // Et un loyer nul n'est pas un rendement de 0 %, c'est une absence.
      expect(rendementBrut(0, 3670)).toBeNull();
    });

    it("rend null sur des valeurs négatives", () => {
      expect(rendementBrut(-14.5, 3670)).toBeNull();
      expect(rendementBrut(14.5, -3670)).toBeNull();
    });

    it("rend null sur NaN et Infinity", () => {
      expect(rendementBrut(Number.NaN, 3670)).toBeNull();
      expect(rendementBrut(14.5, Number.NaN)).toBeNull();
      expect(rendementBrut(Number.POSITIVE_INFINITY, 3670)).toBeNull();
      expect(rendementBrut(14.5, Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  it("rend la valeur aberrante telle quelle, sans la corriger", () => {
    // 30 €/m² de loyer pour 500 €/m² à la vente : 72 %. Le chiffre est absurde,
    // mais l'écraser ou le borner masquerait l'erreur de données qui le
    // produit. C'est rendementHorsNorme qui le signale, pas ce calcul.
    expect(rendementBrut(30, 500)).toBe(72);
    // Un rendement microscopique passe aussi : 0,12 % sur un marché de luxe.
    expect(rendementBrut(1, 10000)).toBe(0.12);
  });
});

describe("rendementHorsNorme", () => {
  it("laisse passer un rendement ordinaire", () => {
    expect(rendementHorsNorme(4.74)).toBe(false);
  });

  it("signale les deux extrêmes", () => {
    expect(rendementHorsNorme(72)).toBe(true);
    expect(rendementHorsNorme(0.12)).toBe(true);
  });

  it("inclut les bornes plutôt que de les exclure", () => {
    expect(rendementHorsNorme(RENDEMENT_MIN_PLAUSIBLE)).toBe(false);
    expect(rendementHorsNorme(RENDEMENT_MAX_PLAUSIBLE)).toBe(false);
    expect(rendementHorsNorme(RENDEMENT_MIN_PLAUSIBLE - 0.01)).toBe(true);
    expect(rendementHorsNorme(RENDEMENT_MAX_PLAUSIBLE + 0.01)).toBe(true);
  });

  it("ne confond pas une absence avec une anomalie", () => {
    // null n'est pas « suspect » : il n'y a rien à avertir sur rien.
    expect(rendementHorsNorme(null)).toBe(false);
  });
});

describe("fourchetteRendement", () => {
  it("traduit l'intervalle de prédiction du loyer en rendements", () => {
    expect(fourchetteRendement(NANTES, 3670)).toEqual({
      bas: 3.71, // 11,35 × 12 / 3 670
      haut: 6.06, // 18,54 × 12 / 3 670
    });
  });

  it("réordonne des bornes inversées plutôt que de les rendre telles quelles", () => {
    const inverse: IndicateurLoyer = { ...NANTES, bas: 18.54, haut: 11.35 };
    expect(fourchetteRendement(inverse, 3670)).toEqual({
      bas: 3.71,
      haut: 6.06,
    });
  });

  it("rend null quand une seule borne manque", () => {
    // Une demi-fourchette se lirait comme une fourchette complète.
    expect(fourchetteRendement({ ...NANTES, bas: null }, 3670)).toBeNull();
    expect(fourchetteRendement({ ...NANTES, haut: null }, 3670)).toBeNull();
  });

  it("rend null sans indicateur ou sans prix", () => {
    expect(fourchetteRendement(null, 3670)).toBeNull();
    expect(fourchetteRendement(undefined, 3670)).toBeNull();
    expect(fourchetteRendement(NANTES, null)).toBeNull();
    expect(fourchetteRendement(NANTES, 0)).toBeNull();
  });
});

describe("indicateurFragile", () => {
  it("accepte un indicateur communal, fourni et bien ajusté", () => {
    expect(indicateurFragile(NANTES)).toBe(false);
  });

  it("refuse une estimation faite ailleurs que sur la commune", () => {
    // Le cas majoritaire du jeu de données : plus de huit communes sur dix
    // héritent du loyer d'une maille de voisines.
    expect(indicateurFragile({ ...NANTES, echelle: "maille" })).toBe(true);
    expect(indicateurFragile({ ...NANTES, echelle: "epci" })).toBe(true);
    expect(indicateurFragile({ ...NANTES, echelle: null })).toBe(true);
  });

  it("refuse sous le seuil d'observations de l'ANIL", () => {
    expect(indicateurFragile({ ...NANTES, obs: OBS_MIN_FIABLE - 1 })).toBe(true);
    expect(indicateurFragile({ ...NANTES, obs: OBS_MIN_FIABLE })).toBe(false);
    expect(indicateurFragile({ ...NANTES, obs: 0 })).toBe(true);
  });

  it("refuse un modèle qui explique mal, ou qui ne dit pas s'il explique", () => {
    expect(indicateurFragile({ ...NANTES, r2: 0.49 })).toBe(true);
    expect(indicateurFragile({ ...NANTES, r2: 0.5 })).toBe(false);
    expect(indicateurFragile({ ...NANTES, r2: null })).toBe(true);
  });

  it("tient l'absence d'indicateur pour fragile", () => {
    expect(indicateurFragile(null)).toBe(true);
    expect(indicateurFragile(undefined)).toBe(true);
  });
});

describe("lireRendement", () => {
  it("rend le taux et ses réserves d'un seul tenant", () => {
    expect(lireRendement(NANTES, 3670)).toEqual({
      taux: 4.74,
      fourchette: { bas: 3.71, haut: 6.06 },
      fragile: false,
      horsNorme: false,
    });
  });

  it("garde le taux mais lève les réserves sur une commune de maille", () => {
    // La Bâtie-des-Fonds : aucune annonce sur place, valeur héritée du voisinage.
    const maille: IndicateurLoyer = {
      m2: 9.76,
      bas: 7.58,
      haut: 12.56,
      echelle: "maille",
      obs: 0,
      r2: 0.777,
    };
    const lecture = lireRendement(maille, 1200);
    expect(lecture.taux).toBe(9.76);
    expect(lecture.fragile).toBe(true);
    expect(lecture.horsNorme).toBe(false);
  });

  it("n'invente rien quand le prix DVF manque", () => {
    expect(lireRendement(NANTES, null)).toEqual({
      taux: null,
      fourchette: null,
      fragile: false,
      horsNorme: false,
    });
  });

  it("n'invente rien quand le loyer manque", () => {
    expect(lireRendement(null, 3670)).toEqual({
      taux: null,
      fourchette: null,
      fragile: true,
      horsNorme: false,
    });
  });

  it("signale un taux aberrant sans le retoucher", () => {
    const lecture = lireRendement({ ...NANTES, m2: 30 }, 500);
    expect(lecture.taux).toBe(72);
    expect(lecture.horsNorme).toBe(true);
  });
});
