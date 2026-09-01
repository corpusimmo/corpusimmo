import { describe, expect, it } from "vitest";

import { cityMatches, foldForSearch, startsAWord } from "./search";

const niort = { name: "Niort", departmentName: "Deux-Sèvres", departmentCode: "79" };
const saintDenis = { name: "Saint-Denis", departmentName: "La Réunion", departmentCode: "974" };
const saintEtienne = { name: "Saint-Étienne", departmentName: "Loire", departmentCode: "42" };
const nantes = { name: "Nantes", departmentName: "Loire-Atlantique", departmentCode: "44" };

describe("foldForSearch", () => {
  it("retire les accents, la casse, les tirets et les apostrophes", () => {
    expect(foldForSearch("Saint-Étienne")).toBe("saint etienne");
    expect(foldForSearch("L'Haÿ-les-Roses")).toBe("l hay les roses");
    expect(foldForSearch("  Deux-Sèvres ")).toBe("deux sevres");
  });
});

describe("startsAWord", () => {
  it("accepte le début du premier mot et de tout mot suivant", () => {
    expect(startsAWord("saint etienne", "saint")).toBe(true);
    expect(startsAWord("saint etienne", "eti")).toBe(true);
  });

  it("refuse une sous-chaîne au milieu d'un mot", () => {
    expect(startsAWord("la reunion", "nio")).toBe(false);
    expect(startsAWord("niort", "ort")).toBe(false);
  });
});

describe("cityMatches", () => {
  it("trouve Niort avec « nio », et pas La Réunion", () => {
    expect(cityMatches(niort, "nio")).toBe(true);
    expect(cityMatches(saintDenis, "nio")).toBe(false);
  });

  it("ignore les accents et les tirets dans les deux sens", () => {
    expect(cityMatches(saintEtienne, "etienne")).toBe(true);
    expect(cityMatches(saintEtienne, "saint étienne")).toBe(true);
    expect(cityMatches(saintEtienne, "Saint-Etienne")).toBe(true);
  });

  it("cherche aussi dans le nom et le numéro du département", () => {
    expect(cityMatches(nantes, "loire")).toBe(true);
    expect(cityMatches(nantes, "atlantique")).toBe(true);
    expect(cityMatches(nantes, "44")).toBe(true);
    expect(cityMatches(nantes, "4")).toBe(true);
    expect(cityMatches(nantes, "45")).toBe(false);
  });

  it("répond oui à une saisie vide ou blanche", () => {
    expect(cityMatches(nantes, "")).toBe(true);
    expect(cityMatches(nantes, "   ")).toBe(true);
  });
});
