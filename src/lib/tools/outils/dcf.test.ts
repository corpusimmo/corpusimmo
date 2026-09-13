import { describe, expect, it } from "vitest";

// Le classeur DCF est livré sans valeurs en cache : la référence est
// recalculée en ouvrant le classeur dans Numbers puis en l'exportant en .xlsx, et figée.
import reference from "./reference/dcf-numbers.json";
import { acquisition, dcf, flux, resultats } from "./dcf";

const ref = (reference as Record<string, Record<string, unknown>>)["DCF"]!;
const n = (k: string) => ref[k] as number;
const COLS = ["F", "G", "H", "I", "J", "K", "L"];

function saisies() {
  const v: Record<string, number> = {};
  for (const s of dcf.sections) for (const f of s.fields) if (!("options" in f)) v[f.id] = f.value;
  return { v, t: { calendrier: dcf.tables![0]!.rows.map((r) => [...r]) } };
}

describe("DCF, contre les valeurs recalculées du classeur", () => {
  it("reprend l'exemple", () => {
    const { v, t } = saisies();
    expect(v.prixAem).toBe(n("B5"));
    expect(v.loyer).toBe(n("B14"));
    t.calendrier.forEach((r, i) => {
      expect(r[0]! / 100).toBeCloseTo(n(`${COLS[i]}4`), 12);
      expect(r[1]! / 100).toBeCloseTo(n(`${COLS[i]}5`), 12);
    });
  });

  it("acquisition", () => {
    const { v } = saisies();
    const a = acquisition(v);
    expect(a.hd).toBeCloseTo(n("B7"), 6);
    expect(a.montantDroits).toBeCloseTo(n("B8"), 6);
    expect(a.hdM2).toBeCloseTo(n("B10"), 6);
    expect(a.capexTotal).toBeCloseTo(n("B28"), 6);
    expect(a.dette).toBeCloseTo(n("B37"), 6);
    expect(a.fondsPropres).toBeCloseTo(n("B38"), 6);
  });

  it("chaque période", () => {
    const { v, t } = saisies();
    flux(v, t).periodes.forEach((p, i) => {
      const c = COLS[i]!;
      const lignes: [number, number][] = [
        [p.relouee, 6], [p.cumul, 7], [p.restante, 8], [p.loyerEnPlace, 13], [p.loyerReloue, 14], [p.loyers, 15],
        [p.vacance, 16], [p.franchise, 17], [p.capex, 18], [p.honorairesLocation, 19], [p.interets, 20],
        [p.remboursement, 21], [p.cession, 22], [p.cashFlow, 23], [p.actualise, 24],
      ];
      for (const [valeur, ligne] of lignes) expect(valeur, `${c}${ligne}`).toBeCloseTo(n(`${c}${ligne}`), 4);
      expect(p.icr, `${c}25`).toBeCloseTo(n(`${c}25`), 8);
    });
  });

  it("VAN, TRI et rendements", () => {
    const { v, t } = saisies();
    const r = resultats(v, t);
    expect(r.zero).toBeCloseTo(n("E23"), 6);
    expect(r.van).toBeCloseTo(n("E27"), 4);
    expect(r.tri / 100).toBeCloseTo(n("E28"), 9);
    expect(r.rendementInitial).toBeCloseTo(n("B43"), 12);
    expect(r.rendementPotentiel).toBeCloseTo(n("B44"), 12);
    expect(r.sommeRelouee / 100).toBeCloseTo(n("E30"), 12);
    expect(r.sommeCapex / 100).toBeCloseTo(n("E31"), 12);
  });

  it("un horizon plus court cède plus tôt et coupe les flux ensuite", () => {
    const { v, t } = saisies();
    const p = flux({ ...v, horizon: 5 }, t).periodes;
    expect(p[4]!.cession).toBeGreaterThan(0);
    expect(p[5]!.cashFlow).toBe(0);
  });
});
