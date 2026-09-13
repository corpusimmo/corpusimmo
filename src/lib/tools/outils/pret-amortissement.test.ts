import { describe, expect, it } from "vitest";

import reference from "./reference/pret-amortissement.json";
import {
  ASSIETTE_RESTANT,
  arrondi2,
  echeancier,
  mensualitePret,
  pretAmortissement,
  taeg,
} from "./pret-amortissement";

const ref = reference as Record<string, Record<string, unknown>>;
const monPret = ref["Mon prêt"]!;
const ech = ref["Échéancier"]!;
const comp = ref["Comparateur"]!;
const det = ref["Détail des offres"]!;
const n = (onglet: Record<string, unknown>, cellule: string) => onglet[cellule] as number;

function saisies() {
  const v: Record<string, number> = {};
  const c: Record<string, string> = {};
  for (const section of pretAmortissement.sections)
    for (const champ of section.fields) {
      if ("options" in champ) c[champ.id] = champ.value;
      else v[champ.id] = champ.value;
    }
  for (const p of pretAmortissement.params) v[p.id] = p.value;
  const t = { offres: pretAmortissement.tables![0]!.rows };
  return { v, c, t };
}

const sortie = (id: string) => {
  const { v, c, t } = saisies();
  return pretAmortissement.outputs.find((o) => o.id === id)!.compute(v, c, t);
};

describe("Mon prêt, contre les valeurs calculées par Excel", () => {
  it("reprend l'exemple du classeur", () => {
    const { v, c } = saisies();
    expect(v.capital).toBe(n(monPret, "C7"));
    expect(v.taux! / 100).toBeCloseTo(n(monPret, "C8"), 10);
    expect(v.mois).toBe(n(monPret, "C9"));
    expect(v.assurance! / 100).toBeCloseTo(n(monPret, "C13"), 10);
    expect(c.assiette === "initial").toBe(monPret["C12"] === "Capital initial");
    expect(v.fmg).toBe(n(monPret, "C16"));
    expect(v.moisAnticipe).toBe(n(monPret, "C47"));
  });

  it("déroule les trois cents échéances au centime près", () => {
    const lignes = echeancier({ capital: 180000, taux: 3.35, mois: 300, differe: 0, assurance: 0.28, surRestantDu: false });
    expect(lignes).toHaveLength(300);
    lignes.forEach((l, i) => {
      const r = 8 + i;
      expect(l.interets).toBeCloseTo(n(ech, `E${r}`), 6);
      expect(l.capital).toBeCloseTo(n(ech, `F${r}`), 6);
      expect(l.assurance).toBeCloseTo(n(ech, `G${r}`), 6);
      expect(l.restantDu).toBeCloseTo(n(ech, `J${r}`), 6);
    });
  });

  it.each([
    ["mensualite", "C22", 1],
    ["interets", "C26", 1],
    ["totalAssurance", "C27", 1],
    ["cout", "C28", 1],
    ["restitution", "C30", 1],
    ["coutNet", "C31", 1],
    ["taegHors", "C35", 100],
    ["taea", "C36", 100],
    ["usure", "C37", 100],
    ["effort", "C42", 100],
    ["crdAnticipe", "C48", 1],
    ["ira", "C49", 1],
    ["solde", "C50", 1],
  ])("%s = %s", (id, cellule, echelle) => {
    expect(sortie(id) as number).toBeCloseTo(n(monPret, cellule) * echelle, 6);
  });

  it("TAEG et mensualité totale", () => {
    const { v, c } = saisies();
    const h = pretAmortissement.headlines;
    expect(h[0]!.compute(v, c, {}) as number).toBeCloseTo(n(monPret, "C25"), 6);
    expect(h[1]!.compute(v, c, {}) as number).toBeCloseTo(n(monPret, "C34") * 100, 6);
  });

  it("contrôles au vert, comme le classeur", () => {
    expect(sortie("controle")).toBe("OK");
    expect(sortie("usureOk")).toBe("OK");
    expect(sortie("effortOk")).toBe("OK");
    expect(sortie("dureeOk")).toBe("OK");
  });
});

describe("Comparateur, contre les valeurs calculées par Excel", () => {
  const offres = [
    { col: "C", det: ["C", "E"] },
    { col: "D", det: ["I", "K"] },
    { col: "E", det: ["O", "Q"] },
  ];

  it.each(offres.map((o, i) => [i, o] as const))("offre %i : saisies, mensualité, coût et TAEG", (i, o) => {
    const ligne = pretAmortissement.tables![0]!.rows[i]!;
    const [capital, taux, mois, assiette, assurance, dossier, garantie, fmg] = ligne as number[];
    expect(capital).toBe(n(comp, `${o.col}9`));
    expect(taux! / 100).toBeCloseTo(n(comp, `${o.col}10`), 10);
    expect(mois).toBe(n(comp, `${o.col}11`));
    expect(assiette === ASSIETTE_RESTANT).toBe(comp[`${o.col}12`] === "Capital restant dû");
    expect(assurance! / 100).toBeCloseTo(n(comp, `${o.col}13`), 10);
    expect(dossier).toBe(n(comp, `${o.col}14`));
    expect(garantie).toBe(n(comp, `${o.col}15`));
    expect(fmg).toBe(n(comp, `${o.col}16`));

    const pret = { capital: capital!, taux: taux!, mois: mois!, differe: 0, assurance: assurance!, surRestantDu: assiette === ASSIETTE_RESTANT };
    expect(mensualitePret(pret)).toBeCloseTo(n(comp, `${o.col}20`), 6);
    const lignes = echeancier(pret);
    const interets = lignes.reduce((s, l) => s + l.interets, 0);
    const ass = lignes.reduce((s, l) => s + l.assurance, 0);
    expect(interets).toBeCloseTo(n(comp, `${o.col}23`), 6);
    expect(ass).toBeCloseTo(n(comp, `${o.col}24`), 6);
    expect(interets + ass + dossier! + garantie!).toBeCloseTo(n(comp, `${o.col}25`), 6);
    expect(taeg(pret, dossier! + garantie!, true)).toBeCloseTo(n(comp, `${o.col}28`) * 100, 6);
    expect(taeg(pret, dossier! + garantie!, false)).toBeCloseTo(n(comp, `${o.col}29`) * 100, 6);
    // Et l'échéancier de l'offre, ligne par ligne, sur la colonne d'intérêts.
    lignes.slice(0, 60).forEach((l, k) => {
      expect(l.interets).toBeCloseTo(n(det, `${o.det[0]}${8 + k}`), 6);
      expect(l.assurance).toBeCloseTo(n(det, `${o.det[1]}${8 + k}`), 6);
    });
  });

  it("rend le même verdict que le classeur", () => {
    expect(sortie("meilleureTaeg")).toBe(String(comp["C44"]).split(" : ")[0]);
    expect(sortie("moinsChere")).toBe(String(comp["C45"]).split(" : ")[0]);
    expect(sortie("ecartCout") as number).toBeCloseTo(n(comp, "C46"), 6);
  });
});

describe("les branches que l'exemple ne couvre pas", () => {
  it("le différé ne paie que les intérêts, puis amortit sur la durée restante", () => {
    const pret = { capital: 100000, taux: 3, mois: 240, differe: 24, assurance: 0.3, surRestantDu: false };
    const lignes = echeancier(pret);
    expect(lignes[0]!.capital).toBe(0);
    expect(lignes[23]!.restantDu).toBe(100000);
    expect(lignes[24]!.echeance).toBe(mensualitePret(pret));
    expect(lignes.at(-1)!.restantDu).toBeCloseTo(0, 6);
  });

  it("l'arrondi suit Excel sur les demi-centimes mal représentés en binaire", () => {
    expect(arrondi2(1.005)).toBe(1.01);
    expect(arrondi2(502.495)).toBe(502.5);
  });

  it("à durées différentes, le coût total ne départage plus", () => {
    const { v, c, t } = saisies();
    const offres = t.offres.map((r, i) => (i === 2 ? [r[0]!, r[1]!, 240, ...r.slice(3)] : r));
    const o = pretAmortissement.outputs.find((x) => x.id === "moinsChere")!;
    expect(o.compute(v, c, { offres })).toBe("Durées différentes : comparez le TAEG");
  });
});
