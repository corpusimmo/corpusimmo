import { describe, expect, it } from "vitest";

import { familyForNaf } from "./naf";
import { summarise } from "./sirene";

function site(naf: string, open = true) {
  return {
    activite_principale: naf,
    etat_administratif: open ? "A" : "C",
    date_fermeture: open ? null : "2023-04-01",
  };
}

function company(nom: string, ...nafs: string[]) {
  return { nom_complet: nom, matching_etablissements: nafs.map((n) => site(n)) };
}

describe("familyForNaf", () => {
  it("classe sur la division, quel que soit le format du code", () => {
    for (const code of ["68.20B", "6820B", "68"]) {
      expect(familyForNaf(code)).toBe("bureaux");
    }
  });

  it("sépare les trois familles que DVF confond", () => {
    expect(familyForNaf("70.10Z")).toBe("bureaux"); // sièges sociaux
    expect(familyForNaf("47.11D")).toBe("commerce"); // supermarché
    expect(familyForNaf("52.10B")).toBe("entrepot"); // entreposage
    expect(familyForNaf("25.62B")).toBe("industrie"); // mécanique
  });

  it("refuse de classer ce qui n'est pas un code NAF", () => {
    // `null` n'est pas `autre` : « je ne sais pas » ne doit pas peser dans les
    // totaux comme une observation.
    for (const bad of [null, undefined, "", "x"]) {
      expect(familyForNaf(bad)).toBeNull();
    }
  });
});

describe("summarise", () => {
  it("se tait quand il n'y a pas de quoi parler", () => {
    expect(summarise([])).toBeNull();
    expect(summarise([company("Seule SARL", "70.10Z")])).toBeNull();
  });

  it("ignore les établissements fermés", () => {
    // Trois inscriptions, dont deux fermées : il n'en reste qu'une, donc rien
    // à dire. Une boutique disparue ne raconte plus l'usage du local.
    const results = [
      {
        nom_complet: "Ancienne Boutique",
        matching_etablissements: [site("47.11D", false), site("47.11D", false)],
      },
      company("Cabinet Actif", "69.20Z"),
    ];
    expect(summarise(results)).toBeNull();
  });

  it("conclut quand une famille domine nettement", () => {
    const hint = summarise([
      company("Conseil & Associés", "70.22Z"),
      company("Agence Média", "73.11Z"),
      company("Presse-café", "47.62Z"),
    ]);

    expect(hint).toMatchObject({
      family: "bureaux",
      count: 3,
      familyCount: 2,
      conclusive: true,
    });
    expect(hint?.examples).toContain("Conseil & Associés");
  });

  it("refuse de trancher sur une adresse mixte", () => {
    // Deux bureaux, deux commerces : annoncer l'un des deux serait tirer à
    // pile ou face. On compte, mais on ne conclut pas.
    const hint = summarise([
      company("Bureau A", "70.10Z"),
      company("Bureau B", "69.10Z"),
      company("Boutique A", "47.71Z"),
      company("Boutique B", "47.72B"),
    ]);

    expect(hint?.count).toBe(4);
    expect(hint?.conclusive).toBe(false);
  });

  it("ne conclut jamais sur la famille fourre-tout", () => {
    // 90 et 93 sont trop hétérogènes pour dire quoi que ce soit d'un local,
    // même quand ils sont seuls à l'adresse.
    const hint = summarise([
      company("Compagnie X", "90.01Z"),
      company("Club Y", "93.13Z"),
    ]);

    expect(hint?.family).toBe("autre");
    expect(hint?.conclusive).toBe(false);
  });
});
