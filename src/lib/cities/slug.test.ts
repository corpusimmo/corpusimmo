import { describe, expect, it } from "vitest";

import { cityCommunes } from "@/data/cities/communes";

import { ambiguousBaseSlugs, expectedSlug, slugifyCommuneName } from "./slug";

describe("slugifyCommuneName", () => {
  it("retire les accents et l'apostrophe", () => {
    expect(slugifyCommuneName("Saint-Étienne")).toBe("saint-etienne");
    expect(slugifyCommuneName("Évry-Courcouronnes")).toBe("evry-courcouronnes");
    expect(slugifyCommuneName("Villeneuve-d'Ascq")).toBe("villeneuve-d-ascq");
    expect(slugifyCommuneName("Nîmes")).toBe("nimes");
    expect(slugifyCommuneName("Le Havre")).toBe("le-havre");
  });
});

describe("la sélection écrite dans src/data/cities/communes.ts", () => {
  const ambiguous = ambiguousBaseSlugs(cityCommunes);

  it("ne contient aucun slug en double", () => {
    const slugs = cityCommunes.map((commune) => commune.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("ne contient aucun code INSEE en double", () => {
    const codes = cityCommunes.map((commune) => commune.insee);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("respecte la règle de slug, suffixe d'homonymie compris", () => {
    for (const commune of cityCommunes) {
      expect(commune.slug, `slug inattendu pour ${commune.name}`).toBe(
        expectedSlug(commune, ambiguous),
      );
    }
  });

  it("désambiguïse les homonymes par le département", () => {
    // Deux Saint-Denis dans la sélection : le suffixe n'est pas décoratif.
    expect(ambiguous.has("saint-denis")).toBe(true);
    const slugs = cityCommunes
      .filter((commune) => commune.name === "Saint-Denis")
      .map((commune) => commune.slug)
      .sort();
    expect(slugs).toEqual(["saint-denis-93", "saint-denis-974"]);
  });

  it("n'inclut aucune commune d'un département absent de DVF", () => {
    const uncovered = ["57", "67", "68", "975", "976", "977", "978", "984", "986", "987", "988"];
    for (const commune of cityCommunes) {
      expect(uncovered, `commune hors DVF : ${commune.name}`).not.toContain(
        commune.departmentCode,
      );
    }
  });

  it("est ordonnée de la plus peuplée à la moins peuplée", () => {
    const populations = cityCommunes.map((commune) => commune.population);
    expect(populations).toEqual([...populations].sort((a, b) => b - a));
  });
});
