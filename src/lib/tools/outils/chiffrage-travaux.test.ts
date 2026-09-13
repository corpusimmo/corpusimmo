import { describe, expect, it } from "vitest";

import reference from "./reference/chiffrage-travaux.json";
import { POSTES, chiffrageTravaux, famille, lignes, recapitulatif, secondOeuvreChiffre } from "./chiffrage-travaux";

const ref = reference as Record<string, Record<string, unknown>>;
const ch = ref["Chiffrage"]!;
const n = (k: string) => ch[k] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const s of chiffrageTravaux.sections)
    for (const f of s.fields) {
      if ("options" in f) c[f.id] = f.value;
      else v[f.id] = f.value;
    }
  for (const p of chiffrageTravaux.params) v[p.id] = p.value;
  const t = { postes: chiffrageTravaux.tables![0]!.rows };
  return { v, c, t };
}
const sortie = (id: string, s = saisies()) =>
  chiffrageTravaux.outputs.find((o) => o.id === id)!.compute(s.v, s.c, s.t);

describe("chiffrage de travaux, contre les valeurs calculées par Excel", () => {
  it("reprend le référentiel et l'exemple du classeur", () => {
    const { v, c } = saisies();
    expect(v.surface).toBe(n("D7"));
    expect(v.curseur! / 100).toBe(n("D14"));
    expect(c.nature).toBe(ch["D62"]);
    POSTES.forEach((p, i) => {
      expect(p.prestation).toBe(ch[`C${29 + i}`]);
      expect(p.lot).toBe(ch[`B${29 + i}`]);
      expect(p.bas).toBe(n(`H${29 + i}`));
      expect(p.haut).toBe(n(`I${29 + i}`));
    });
  });

  it("chaque ligne : quantité, prix, total, taux", () => {
    const { v, c, t } = saisies();
    lignes(v, c, t).forEach((l, i) => {
      const r = 29 + i;
      expect(l.quantite, `G${r}`).toBe(n(`G${r}`));
      expect(l.puRetenu, `K${r}`).toBeCloseTo(n(`K${r}`), 9);
      expect(l.totalHT, `L${r}`).toBeCloseTo(n(`L${r}`), 6);
      expect(l.tva / 100, `M${r}`).toBeCloseTo(n(`M${r}`), 9);
      expect(l.totalTTC, `N${r}`).toBeCloseTo(n(`N${r}`), 6);
    });
  });

  it.each([
    ["emprise", "D19"],
    ["perimetre", "D20"],
    ["murs", "D21"],
    ["toit", "D23"],
    ["ttcLignes", "E96"],
  ])("%s = %s", (id, cellule) => {
    expect(sortie(id) as number).toBeCloseTo(n(cellule), 6);
  });

  it.each([
    ["bas", "D"],
    ["retenu", "E"],
    ["haut", "F"],
  ] as const)("récapitulatif %s", (scenario, col) => {
    const { v, c, t } = saisies();
    const r = recapitulatif(scenario, v, c, t);
    expect(r.lots).toBeCloseTo(n(`${col}87`), 6);
    expect(r.aleas).toBeCloseTo(n(`${col}88`), 6);
    expect(r.honoraires).toBeCloseTo(n(`${col}89`), 6);
    expect(r.ht).toBeCloseTo(n(`${col}90`), 6);
    expect(r.tva55).toBeCloseTo(n(`${col}91`), 6);
    expect(r.tva10).toBeCloseTo(n(`${col}92`), 6);
    expect(r.tva20).toBeCloseTo(n(`${col}93`), 6);
    expect(r.ttc).toBeCloseTo(n(`${col}95`), 6);
    expect(r.ttc / v.surface!).toBeCloseTo(n(`${col}99`), 6);
  });

  it("niveau, TVA et familles", () => {
    const s = saisies();
    expect(sortie("niveau")).toBe(ch["E100"]);
    expect(sortie("regime")).toBe(ch["D76"]);
    expect(sortie("secondDeclare")).toBe(n("D74"));
    expect(secondOeuvreChiffre(s.v, s.c, s.t)).toBe(n("D79"));
    for (let i = 0; i < 6; i += 1) {
      const f = famille(i, s.v, s.c, s.t);
      expect(f.montant).toBeCloseTo(n(`D${104 + i}`), 6);
      expect(f.part).toBeCloseTo(n(`E${104 + i}`), 9);
      expect(f.verdict).toBe(ch[`H${104 + i}`]);
    }
  });

  it("le sixième élément de second œuvre fait tout basculer à 20 %", () => {
    const s = saisies();
    const c = { ...s.c, planchers: "Oui" };
    expect(sortie("regime", { ...s, c })).toBe("TOUT À 20 %");
    const r = recapitulatif("retenu", s.v, c, s.t);
    expect(r.tva55 + r.tva10).toBe(0);
    expect(r.tva).toBeCloseTo(r.ht * 0.2, 6);
  });

  it("une quantité vide revient à l'automatique, un 0 désactive", () => {
    const s = saisies();
    const postes = s.t.postes.map((r) => [...r]);
    postes[4] = [Number.NaN, Number.NaN];
    expect(lignes(s.v, s.c, { postes })[4]!.quantite).toBe(n("E33"));
    postes[4] = [null as unknown as number, 100];
    expect(lignes(s.v, s.c, { postes })[4]!.totalHT).toBe(n("E33") * 100);
  });
});
