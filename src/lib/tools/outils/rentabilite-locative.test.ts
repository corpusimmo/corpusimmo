import { describe, expect, it } from "vitest";

import reference from "./reference/rentabilite-locative.json";
import {
  REGIMES,
  amortissementAnnuel,
  deficitImpute,
  impotAnnee1,
  regimeAutorise,
  rentabiliteLocative,
  reporte,
  resultatFiscal,
} from "./rentabilite-locative";

/** Les saisies et paramètres par défaut, résolus comme le fait le simulateur. */
function valeursParDefaut() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const section of rentabiliteLocative.sections) {
    for (const champ of section.fields) {
      if ("options" in champ) c[champ.id] = champ.value;
      else v[champ.id] = champ.value;
    }
  }
  for (const p of rentabiliteLocative.params) v[p.id] = p.value;
  return { v, c };
}

const calc = (reference as Record<string, Record<string, unknown>>)["Calculateur"]!;
const excel = (cellule: string) => calc[cellule] as number;
const sortie = (id: string, v: Record<string, number>, c: Record<string, string>) =>
  rentabiliteLocative.outputs.find((o) => o.id === id)!.compute(v, c, {}) as number;

describe("rentabilité locative, contre les valeurs calculées par Excel", () => {
  const { v, c } = valeursParDefaut();

  it("reprend l'exemple livré dans le classeur", () => {
    expect(v.prix).toBe(excel("C7"));
    expect(v.notaire).toBe(excel("C9"));
    expect(v.comptabilite).toBe(excel("C26"));
    expect(c.regime).toBe(calc["C47"]);
    expect(Number(c.tmi) / 100).toBeCloseTo(excel("C48"), 10);
  });

  it.each([
    ["cout", "C13", 1],
    ["revient", "C14", 1],
    ["loyerAn", "C19", 1],
    ["loyerM2", "C20", 1],
    ["charges", "C29", 1],
    ["netCharges", "C30", 1],
    ["emprunt", "C37", 1],
    ["mensualite", "C40", 1],
    ["interets", "C41", 1],
    ["amortissement", "C52", 1],
    ["resultat", "C53", 1],
    ["deficit", "C55", 1],
    ["reporte", "C56", 1],
    ["impot", "C57", 1],
    ["brut", "C61", 100],
    ["brutAffiche", "C62", 100],
    ["net", "C63", 100],
    ["cfAn", "C65", 1],
    ["effort", "C67", 1],
    ["partLoyer", "C68", 100],
  ])("%s = %s", (id, cellule, echelle) => {
    expect(sortie(id, v, c)).toBeCloseTo(excel(cellule) * echelle, 6);
  });

  it("rend le contrôle global au vert, comme le classeur", () => {
    expect(sortie("controle", v, c)).toBe("OK");
    expect(calc["C60"]).toBe("OK");
  });
});

describe("les branches que l'exemple ne couvre pas", () => {
  const { v, c } = valeursParDefaut();

  it("réel foncier : impute le déficit hors intérêts, plafonné, et reporte le reste", () => {
    const cc = { ...c, regime: REGIMES.reelFoncier };
    const res = resultatFiscal(v, cc);
    // loyer − (TF + PNO + copro + gestion) − (intérêts + assurance) − travaux déductibles
    expect(res).toBeLessThan(0);
    const imp = deficitImpute(v, cc);
    expect(imp).toBeGreaterThan(0);
    expect(imp).toBeLessThanOrEqual(10700);
    expect(reporte(v, cc)).toBeCloseTo(-res - imp, 6);
    // L'impôt devient une économie : − déficit imputé × TMI.
    expect(impotAnnee1(v, cc)).toBeCloseTo(-imp * 0.3, 6);
  });

  it("micro-foncier : abattement de 30 % et prélèvements sociaux fonciers", () => {
    const cc = { ...c, regime: REGIMES.microFoncier };
    const loyer = 950 * 12 * (1 - 3 / 52);
    expect(resultatFiscal(v, cc)).toBeCloseTo(loyer * 0.7, 6);
    expect(impotAnnee1(v, cc)).toBeCloseTo(loyer * 0.7 * (0.3 + 0.172), 6);
  });

  it("micro-BIC : prélèvements sociaux du meublé, 18,6 %", () => {
    const cc = { ...c, regime: REGIMES.microBic };
    const loyer = 950 * 12 * (1 - 3 / 52);
    expect(impotAnnee1(v, cc)).toBeCloseTo(loyer * 0.5 * (0.3 + 0.186), 6);
  });

  it("un micro dont le plafond est dépassé n'est pas applicable, et ne calcule rien", () => {
    const vv = { ...v, loyer: 1300 }; // 15 600 € par an > 15 000 €
    const cc = { ...c, regime: REGIMES.microFoncier };
    expect(regimeAutorise(vv, cc)).toBe(false);
    expect(Number.isNaN(impotAnnee1(vv, cc))).toBe(true);
  });

  it("l'amortissement ne vaut que pour le LMNP réel", () => {
    expect(amortissementAnnuel(v, { ...c, regime: REGIMES.microBic })).toBe(0);
  });

  it("un taux saisi en fraction fait passer le contrôle au rouge", () => {
    expect(sortie("controle", { ...v, taux: 0.034 }, c)).toBe("À corriger");
    expect(sortie("controle", { ...v, taux: 0 }, c)).toBe("OK");
  });
});
