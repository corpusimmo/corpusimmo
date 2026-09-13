import { describe, expect, it } from "vitest";

import reference from "./reference/capacite-emprunt.json";
import { OBJET_LOCATIF, capaciteEmprunt, prixMaximal, revenusRetenus } from "./capacite-emprunt";

const ref = reference as Record<string, Record<string, unknown>>;
const cap = ref["Capacité d'emprunt"]!;
const bilan = ref["Bilan patrimonial"]!;
const n = (o: Record<string, unknown>, k: string) => o[k] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const s of capaciteEmprunt.sections)
    for (const f of s.fields) {
      if ("options" in f) c[f.id] = f.value;
      else v[f.id] = f.value;
    }
  for (const p of capaciteEmprunt.params) v[p.id] = p.value;
  return { v, c };
}
const sortie = (id: string, v = saisies().v, c = saisies().c) =>
  capaciteEmprunt.outputs.find((o) => o.id === id)!.compute(v, c, {});

describe("capacité d'emprunt, contre les valeurs calculées par Excel", () => {
  it("reprend l'exemple du classeur", () => {
    const { v, c } = saisies();
    expect(v.salaire1).toBe(n(cap, "C7"));
    expect(v.loyersActuels).toBe(n(cap, "C10"));
    expect(v.apport).toBe(n(cap, "C28"));
    expect(v.taux! / 100).toBeCloseTo(n(cap, "C29"), 10);
    expect(v.assurance! / 100).toBeCloseTo(n(cap, "C31"), 10);
    expect(c.objet).toBe(cap["C26"]);
    expect(c.neuf).toBe(cap["C32"]);
    expect(c.droitMajore).toBe(cap["C34"]);
  });

  it.each([
    ["revenusFoyer", "C12", 1],
    ["revenusRetenus", "C39", 1],
    ["chargesRetenues", "C41", 1],
    ["mensEffort", "C42", 1],
    ["ravMin", "C43", 1],
    ["mensRav", "C44", 1],
    ["rav", "C46", 1],
    ["effortStrict", "C48", 100],
    ["chargesToutCompris", "C49", 100],
    ["capital", "C53", 1],
    ["garantie", "C54", 1],
    ["dossier", "C55", 1],
    ["budget", "C56", 1],
    ["notaire", "C64", 1],
    ["notairePct", "C65", 100],
    ["frais", "C66", 1],
    ["saut", "C68", 1],
    ["coutCredit", "C69", 1],
  ])("%s = %s", (id, cellule, echelle) => {
    expect(sortie(id) as number).toBeCloseTo(n(cap, cellule) * echelle, 6);
  });

  it("prix maximal et mensualité tenable", () => {
    const { v, c } = saisies();
    expect(capaciteEmprunt.headlines[0]!.compute(v, c, {}) as number).toBeCloseTo(n(cap, "C63"), 6);
    expect(capaciteEmprunt.headlines[1]!.compute(v, c, {}) as number).toBeCloseTo(n(cap, "C45"), 6);
  });

  it("contrôles au vert, comme le classeur", () => {
    expect(sortie("apportOk")).toBe("OK");
    expect(sortie("dureeOk")).toBe("OK");
    expect(sortie("usureOk")).toBe("OK");
    expect(sortie("normeOk")).toBe("OK");
    expect(cap["C47"]).toBe("Taux d'effort");
  });
});

describe("bilan patrimonial, contre les valeurs calculées par Excel", () => {
  it.each([
    ["patrimoineNet", "C34", 1],
    ["ltv", "C36", 100],
    ["detteActif", "C37", 100],
    ["detteRevenus", "C38", 1],
    ["epargneResiduelle", "C42", 1],
    ["epargneMois", "C43", 1],
    ["patrimoineProForma", "C53", 1],
    ["variation", "C54", 1],
    ["ltvProForma", "C55", 100],
    ["detteActifProForma", "C56", 100],
  ])("%s = %s", (id, cellule, echelle) => {
    expect(sortie(id) as number).toBeCloseTo(n(bilan, cellule) * echelle, 6);
  });
});

describe("les branches que l'exemple ne couvre pas", () => {
  it("un investissement locatif garde le loyer actuel et compte le loyer attendu à 70 %", () => {
    const { v, c } = saisies();
    const cc = { ...c, objet: OBJET_LOCATIF };
    const vv = { ...v, loyerAttendu: 800 };
    expect(revenusRetenus(vv, cc) - revenusRetenus(v, c)).toBeCloseTo(560, 6);
    expect(sortie("chargesRetenues", vv, cc) as number).toBe(730 + 850);
    expect(Number.isNaN(sortie("saut", vv, cc) as number)).toBe(true);
  });

  it("dans le neuf, la taxe de publicité foncière remplace les droits de mutation", () => {
    const { v, c } = saisies();
    expect(prixMaximal(v, { ...c, neuf: "Oui" })).toBeGreaterThan(prixMaximal(v, c));
  });

  it("le reste à vivre limite une famille nombreuse avant le taux d'effort", () => {
    const { v, c } = saisies();
    const vv = { ...v, enfants: 9 };
    expect(capaciteEmprunt.headlines[1]!.caption!(vv, c, {})).toMatch(/reste à vivre/);
  });
});
