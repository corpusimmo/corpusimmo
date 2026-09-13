import { describe, expect, it } from "vitest";

import reference from "./reference/arbitrage-fiscal.json";
import { MEUBLES, arbitrageFiscal, simuler, surtaxe, verdict } from "./arbitrage-fiscal";

const ref = reference as Record<string, Record<string, unknown>>;
const hyp = ref["Hypothèses"]!;
const comp = ref["Comparateur"]!;
const plur = ref["Pluriannuel"]!;
const n = (o: Record<string, unknown>, k: string) => o[k] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const s of arbitrageFiscal.sections)
    for (const f of s.fields) {
      if ("options" in f) c[f.id] = f.value;
      else v[f.id] = f.value;
    }
  for (const p of arbitrageFiscal.params) v[p.id] = p.value;
  return { v, c };
}

const COLONNES = ["C", "D", "E", "F", "G"];
/** Colonne de l'année k dans le Pluriannuel : D pour l'année 1. */
const colAnnee = (k: number) => {
  const i = 3 + k; // D = 4e lettre
  return i <= 26 ? String.fromCharCode(64 + i) : "A" + String.fromCharCode(64 + i - 26);
};

describe("arbitrage fiscal, contre les valeurs calculées par Excel", () => {
  const { v, c } = saisies();
  const s = simuler(v, c);

  it("reprend l'exemple du classeur", () => {
    expect(v.prix).toBe(n(hyp, "C7"));
    expect(c.mode).toBe(hyp["C8"]);
    expect(v.loyer).toBe(n(hyp, "C16"));
    expect(v.emprunt).toBe(n(hyp, "C26"));
    expect(v.detention).toBe(n(hyp, "C41"));
    expect(c.meuble).toBe(hyp["C49"]);
    expect(c.fraisAcquisition).toBe(hyp["C51"]);
    expect(s.apport).toBeCloseTo(n(hyp, "C30"), 6);
    expect(s.cession).toBeCloseTo(n(hyp, "C45"), 6);
    expect(MEUBLES[0].nom).toBe(hyp["C49"]);
  });

  it.each(COLONNES.map((col, i) => [col, i] as const))("régime en colonne %s : année 1, cumuls, revente, total, TRI", (col, i) => {
    const r = s.regimes[i]!;
    expect(r.eligible).toBe(comp[`${col}8`] === "Éligible");
    expect(r.base1).toBeCloseTo(n(comp, `${col}9`), 6);
    expect(r.impot1).toBeCloseTo(n(comp, `${col}10`), 6);
    expect(r.flux1).toBeCloseTo(n(comp, `${col}11`), 6);
    expect(r.impotsCumules).toBeCloseTo(n(comp, `${col}14`), 6);
    expect(r.fluxCumules).toBeCloseTo(n(comp, `${col}15`), 6);
    expect(r.reports).toBeCloseTo(n(comp, `${col}16`), 6);
    expect(r.acquisitionRetenue).toBeCloseTo(n(comp, `${col}21`), 6);
    expect(r.plusValue).toBeCloseTo(n(comp, `${col}23`), 6);
    expect(r.impotRevente).toBeCloseTo(n(comp, `${col}30`), 6);
    expect(r.netRevente).toBeCloseTo(n(comp, `${col}31`), 6);
    expect(r.total).toBeCloseTo(n(comp, `${col}34`), 6);
    expect(r.gain).toBeCloseTo(n(comp, `${col}35`), 6);
    expect(r.tri / 100).toBeCloseTo(n(comp, `${col}36`), 8);
  });

  it("déroule les flux année par année comme le Pluriannuel", () => {
    const lignes = [28, 44, 50, 66, 86];
    s.regimes.forEach((r, i) => {
      r.flux.forEach((f, k) => {
        expect(f).toBeCloseTo(n(plur, `${colAnnee(k + 1)}${lignes[i]}`), 6);
      });
    });
  });

  it("rend le même verdict", () => {
    expect(verdict(v, c).meilleur).toBe(comp["C41"]);
    expect(verdict(v, c).ecart).toBeCloseTo(n(comp, "C42"), 6);
    expect(s.tresorerieSci).toBeCloseTo(n(comp, "G17"), 6);
  });
});

describe("les branches que l'exemple ne couvre pas", () => {
  it("la surtaxe se lisse entre 50 000 et 60 000 €", () => {
    expect(surtaxe(50000)).toBe(0);
    expect(surtaxe(55000)).toBeCloseTo(0.02 * 55000 - 0.05 * 5000, 6);
    expect(surtaxe(80000)).toBeCloseTo(0.02 * 80000, 6);
  });

  it("un meublé de tourisme non classé au-delà de 15 000 € n'est pas éligible au micro-BIC", () => {
    const { v, c } = saisies();
    const s = simuler({ ...v, loyer: 16000 }, { ...c, meuble: MEUBLES[2].nom });
    expect(s.regimes[2]!.eligible).toBe(false);
    expect(s.regimes[0]!.eligible).toBe(false);
    expect(Number.isNaN(s.regimes[2]!.total)).toBe(true);
  });

  it("la distribution annuelle de la SCI verse un dividende quand la trésorerie le permet", () => {
    const { v, c } = saisies();
    const s = simuler({ ...v, emprunt: 0 }, { ...c, distribution: "Oui" });
    expect(s.regimes[4]!.impotsCumules).toBeGreaterThan(0);
  });
});
