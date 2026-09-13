import { describe, expect, it } from "vitest";

// Classeur livré sans valeurs en cache : référence recalculée par Numbers.
import reference from "./reference/bilan-promoteur-numbers.json";
import { bilanPromoteur, cascade, contreEpreuve, sensibilite } from "./bilan-promoteur";

const ref = reference as Record<string, Record<string, number>>;
const b = ref["Bilan"]!;
const s = ref["Sensibilité"]!;

function saisies() {
  const v: Record<string, number> = {};
  for (const sec of bilanPromoteur.sections) for (const f of sec.fields) if (!("options" in f)) v[f.id] = f.value;
  return v;
}

describe("bilan promoteur, contre les valeurs recalculées du classeur", () => {
  it("cascade", () => {
    const c = cascade(saisies());
    const paires: [number, string][] = [
      [c.ca, "C14"], [c.travaux, "F8"], [c.honoraires, "F9"], [c.assurances, "F10"], [c.aleas, "F11"],
      [c.technique, "F13"], [c.commercialisation, "F14"], [c.financiers, "F15"], [c.structure, "F16"],
      [c.horsFoncier, "F17"], [c.margeValeur, "F21"], [c.chargeFonciere, "F22"],
    ];
    for (const [valeur, cellule] of paires) expect(valeur, cellule).toBeCloseTo(b[cellule]!, 6);
  });

  it("contre-épreuve", () => {
    const e = contreEpreuve(saisies());
    expect(e.margeValeur).toBeCloseTo(b["F28"]!, 6);
    expect(e.margePct).toBeCloseTo(b["F29"]!, 9);
    expect(e.ecart).toBeCloseTo(b["F30"]!, 6);
  });

  it("grille de sensibilité", () => {
    sensibilite(saisies()).forEach((ligne, i) =>
      ligne.forEach((cf, j) => expect(cf, `${"CDEFG"[j]}${10 + i}`).toBeCloseTo(s[`${"CDEFG"[j]}${10 + i}`]!, 6)),
    );
  });
});
