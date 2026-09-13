import { describe, expect, it } from "vitest";

import reference from "./reference/net-vendeur.json";
import { CAS, EXONERATIONS, TERRAIN, netVendeur, verdictMandat } from "./net-vendeur";

const ref = reference as Record<string, Record<string, unknown>>;
const nv = ref["Net vendeur"]!;
const mandat = ref["Qualifier le mandat"]!;
const n = (o: Record<string, unknown>, k: string) => o[k] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const s of netVendeur.sections)
    for (const f of s.fields) {
      if ("options" in f) c[f.id] = f.value;
      else v[f.id] = f.value;
    }
  for (const p of netVendeur.params) v[p.id] = p.value;
  const t = { criteres: netVendeur.tables![0]!.rows };
  return { v, c, t };
}
const sortie = (id: string, s = saisies()) =>
  netVendeur.outputs.find((o) => o.id === id)!.compute(s.v, s.c, s.t);

describe("net vendeur, contre les valeurs calculées par Excel", () => {
  it("reprend l'exemple du classeur", () => {
    const { v, c, t } = saisies();
    expect(v.prixAffiche).toBe(n(nv, "C7"));
    expect(c.charge).toBe(nv["C9"]);
    expect(v.restantDu).toBe(n(nv, "C15"));
    expect(c.nature).toBe(nv["C24"]);
    expect(c.mode).toBe(nv["C25"]);
    expect(c.fraisRetenus).toBe(nv["C30"]);
    expect(c.travauxRetenus).toBe(nv["C32"]);
    expect(t.criteres.map((r) => r[0])).toEqual(["C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15"].map((k) => n(mandat, k)));
  });

  it.each([
    ["honoraires", "C10", 1],
    ["prixNetVendeur", "C11", 1],
    ["plafondIra", "C17", 1],
    ["detention", "C29", 1],
    ["acquisitionMajoree", "C47", 1],
    ["plusValue", "C48", 1],
    ["abtIr", "C49", 100],
    ["abtPs", "C50", 100],
    ["baseIr", "C52", 1],
    ["basePs", "C53", 1],
    ["ir", "C56", 1],
    ["ps", "C57", 1],
    ["surtaxe", "C58", 1],
    ["impot", "C59", 1],
    ["partAffiche", "C63", 100],
    ["partApresImpot", "C64", 100],
  ])("%s = %s", (id, cellule, echelle) => {
    expect(sortie(id) as number).toBeCloseTo(n(nv, cellule) * echelle, 6);
  });

  it("net en poche et textes", () => {
    const s = saisies();
    expect(netVendeur.headlines[0]!.compute(s.v, s.c, s.t) as number).toBeCloseTo(n(nv, "C62"), 6);
    expect(sortie("exoneration")).toBe(nv["C51"]);
    expect(sortie("controle")).toBe("OK");
  });

  it("qualification du mandat", () => {
    const s = saisies();
    expect(sortie("score") as number).toBeCloseTo(n(mandat, "C23") * 100, 8);
    expect(netVendeur.headlines[1]!.compute(s.v, s.c, s.t)).toBe(mandat["C24"]);
    expect(verdictMandat(s.t, { ...s.v, ecartPrix: 16 })).toMatch(/^Éliminatoire/);
  });

  it("forfait travaux : strictement plus de cinq ans", () => {
    const s = saisies();
    const pile = { ...s.v, dateAcquisition: Date.UTC(2021, 8, 4), dateVente: Date.UTC(2026, 8, 4) };
    expect(sortie("controle", { ...s, v: pile })).toBe("À corriger");
    const lendemain = { ...pile, dateVente: Date.UTC(2026, 8, 5) };
    expect(sortie("controle", { ...s, v: lendemain })).toBe("OK");
  });

  it("exonérations et cas hors périmètre", () => {
    const s = saisies();
    expect(sortie("impot", { ...s, c: { ...s.c, residencePrincipale: "Oui" } })).toBe(0);
    expect(sortie("exoneration", { ...s, v: { ...s.v, dateAcquisition: Date.UTC(2000, 0, 1) } })).toBe(EXONERATIONS.vingtDeux);
    expect(Number.isNaN(sortie("impot", { ...s, c: { ...s.c, cas: CAS[1] } }))).toBe(true);
    expect(sortie("surtaxe", { ...s, v: { ...s.v, prixAcquisition: 100000 }, c: { ...s.c, nature: TERRAIN, travauxRetenus: "Aucun travaux" } })).toBe(0);
  });
});
