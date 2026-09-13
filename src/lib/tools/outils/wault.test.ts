import { describe, expect, it } from "vitest";

import reference from "./reference/wault.json";
import { echeancier, edate, lots, synthese, wault } from "./wault";

const ref = reference as Record<string, Record<string, unknown>>;
const rr = ref["Rent roll"]!;
const sy = ref["Synthèse"]!;
const ec = ref["Échéancier"]!;

function saisies() {
  const v: Record<string, number> = {};
  for (const s of wault.sections) for (const f of s.fields) if (!("options" in f)) v[f.id] = f.value;
  for (const p of wault.params) v[p.id] = p.value;
  return { v, t: { lots: wault.tables![0]!.rows.map((r) => [...r]) } };
}
const jour = (ts: number) => new Date(ts).toISOString().slice(0, 10);

describe("rent roll et WAULT, contre les valeurs calculées par Excel", () => {
  it("chaque lot", () => {
    const { v, t } = saisies();
    lots(v, t).forEach((l, i) => {
      const r = 11 + i;
      expect(l.loyerFacial, `H${r}`).toBe(rr[`H${r}`]);
      expect(l.vlm, `J${r}`).toBe(rr[`J${r}`]);
      expect(l.loyerEconomique, `S${r}`).toBeCloseTo(rr[`S${r}`] as number, 6);
      expect(l.dureeTerme, `T${r}`).toBeCloseTo(rr[`T${r}`] as number, 9);
      expect(l.dureeSortie, `U${r}`).toBeCloseTo(rr[`U${r}`] as number, 9);
      if (rr[`Q${r}`]) expect(jour(l.prochaineSortie), `Q${r}`).toBe(String(rr[`Q${r}`]).slice(0, 10));
      expect(l.ok).toBe(rr[`V${r}`] === "OK");
    });
  });

  it("synthèse", () => {
    const { v, t } = saisies();
    const s = synthese(v, t);
    const paires: [number, string][] = [
      [s.surfaceTotale, "C15"], [s.surfaceLouee, "C16"], [s.surfaceVacante, "C17"], [s.occupationPhysique, "C18"],
      [s.vlmTotale, "C19"], [s.vlmVacante, "C20"], [s.occupationFinanciere, "C21"], [s.facial, "C24"],
      [s.economique, "C25"], [s.effetFranchises, "C26"], [s.partFranchises, "C27"], [s.loyerM2, "C28"],
      [s.vlmLouee, "C29"], [s.reversion, "C30"], [s.partReversion, "C31"], [s.baux, "C34"], [s.aCorriger, "C35"],
      [s.echus, "C36"], [s.loyerEchus, "C37"], [s.wault, "C38"], [s.walb, "C39"], [s.waultEco, "C40"],
      [s.walbEco, "C41"], [s.locataires, "C45"], [s.poidsPremier, "C47"],
    ];
    for (const [valeur, cellule] of paires) expect(valeur, cellule).toBeCloseTo(sy[cellule] as number, 8);
    expect(s.exploitable).toBe(sy["C7"] === "OK");
  });

  it("échéancier", () => {
    const { v, t } = saisies();
    echeancier(v, t).forEach((p, i) => {
      const r = 10 + i;
      expect(p.auTerme, `C${r}`).toBe(ec[`C${r}`]);
      expect(p.bauxTerme, `E${r}`).toBe(ec[`E${r}`]);
      expect(p.aLaSortie, `F${r}`).toBe(ec[`F${r}`]);
      expect(p.bauxSortie, `H${r}`).toBe(ec[`H${r}`]);
    });
  });

  it("EDATE ramène au dernier jour du mois", () => {
    expect(jour(edate(Date.UTC(2024, 0, 31, 12), 1))).toBe("2024-02-29");
  });

  it("un lot vacant avec un loyer est à corriger", () => {
    const { v, t } = saisies();
    t.lots[3]![4] = 300;
    expect(lots(v, t)[3]!.motif).toBe("Lot vacant avec un loyer renseigné.");
    expect(synthese(v, t).exploitable).toBe(false);
  });
});
