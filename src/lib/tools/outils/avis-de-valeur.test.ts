import { describe, expect, it } from "vitest";

import reference from "./reference/avis-de-valeur.json";
import { avisDeValeur, comparables, panel } from "./avis-de-valeur";

const ref = reference as Record<string, Record<string, unknown>>;
const av = ref["Avis de valeur"]!;
const n = (k: string) => av[k] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const s of avisDeValeur.sections)
    for (const f of s.fields) {
      if ("options" in f) c[f.id] = f.value;
      else v[f.id] = f.value;
    }
  for (const p of avisDeValeur.params) v[p.id] = p.value;
  return { v, c, t: { comparables: avisDeValeur.tables![0]!.rows.map((r) => [...r]) } };
}

describe("avis de valeur, contre les valeurs calculées par Excel", () => {
  it("reprend l'exemple du classeur", () => {
    const { v, c, t } = saisies();
    expect(v.surface).toBe(n("C10"));
    expect(c.etat).toBe(av["C11"]);
    expect(c.dpe).toBe(av["C14"]);
    t.comparables.forEach((r, i) => {
      expect(r[1]).toBe(n(`D${23 + i}`));
      expect(r[8]).toBe(n(`K${23 + i}`));
    });
  });

  it("chaque comparable", () => {
    const { v, c, t } = saisies();
    comparables(v, c, t).forEach((l, i) => {
      const r = 23 + i;
      expect(l.prixM2, `L${r}`).toBeCloseTo(n(`L${r}`), 9);
      expect(l.ajustement, `M${r}`).toBeCloseTo(n(`M${r}`), 12);
      expect(l.prixM2Ajuste, `N${r}`).toBeCloseTo(n(`N${r}`), 8);
      expect(l.poids, `O${r}`).toBe(n(`O${r}`));
      expect(l.statut, `P${r}`).toBe(av[`P${r}`]);
    });
  });

  it("panel, dispersion et fourchette", () => {
    const { v, c, t } = saisies();
    const p = panel(v, c, t);
    const paires: [number, string][] = [
      [p.renseignes, "C33"], [p.retenus, "C34"], [p.aCompleter.length, "C35"], [p.ecartes, "C36"],
      [p.moyenneSimple, "C39"], [p.ecartMax, "C40"], [p.dominant, "C43"], [p.prixRetenu, "C46"],
      [p.min, "C47"], [p.max, "C48"], [p.ecartType, "C49"], [p.cv, "C50"], [p.demi, "C51"],
      [p.centrale, "C56"], [p.bas, "C57"], [p.haut, "C58"],
    ];
    for (const [valeur, cellule] of paires) expect(valeur, cellule).toBeCloseTo(n(cellule), 8);
    expect(String(avisDeValeur.headlines[0]!.compute(v, c, t)).replace(/\s/g, " ")).toBe(av["C59"]);
  });

  it("sans ascenseur, l'étage change de sens", () => {
    const { v, c, t } = saisies();
    const avec = comparables(v, c, t)[0]!.ajustement;
    const sans = comparables(v, { ...c, ascenseur: "Non" }, t)[0]!.ajustement;
    expect(avec - sans).toBeCloseTo(2 * (2 - 3) * 0.012, 12);
  });

  it("trop peu de comparables : verrou", () => {
    const { v, c, t } = saisies();
    t.comparables = t.comparables.slice(0, 4);
    expect(avisDeValeur.headlines[0]!.compute(v, c, t)).toBe("Trop peu de comparables");
  });
});
