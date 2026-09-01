import { describe, expect, it } from "vitest";

import { toolCatalogue } from "@/data/tools-catalogue";

import { relatedTools } from "./related-tools";

describe("relatedTools", () => {
  it("sort chaque fiche de son cul-de-sac", () => {
    // C'est la seule propriété qui compte vraiment : aucune fiche ne doit
    // rester sans lien latéral, sans quoi l'autorité entre par le sommaire et
    // n'en ressort jamais.
    for (const tool of toolCatalogue) {
      expect(relatedTools(tool.id).length, `${tool.id} n'a aucun voisin`).toBeGreaterThan(0);
    }
  });

  it("ne se propose jamais lui-même, et pas plus de trois voisins", () => {
    for (const tool of toolCatalogue) {
      const neighbours = relatedTools(tool.id);
      expect(neighbours.length).toBeLessThanOrEqual(3);
      expect(neighbours.map((entry) => entry.id)).not.toContain(tool.id);
      expect(new Set(neighbours.map((entry) => entry.id)).size).toBe(neighbours.length);
    }
  });

  it("rapproche les outils qui partagent un usage et un type d'actif", () => {
    // Le DCF et le WAULT partagent trois types d'actifs et la valorisation :
    // s'ils cessaient d'être voisins, la pondération serait cassée.
    expect(relatedTools("dcf").map((entry) => entry.id)).toContain("wault");
    expect(relatedTools("wault").map((entry) => entry.id)).toContain("dcf");
  });

  it("est déterministe, pour que le HTML ne change pas sans raison", () => {
    expect(relatedTools("rentabilite-locative").map((entry) => entry.id)).toEqual(
      relatedTools("rentabilite-locative").map((entry) => entry.id),
    );
  });

  it("ignore un identifiant inconnu plutôt que de lever", () => {
    expect(relatedTools("outil-qui-n-existe-pas")).toEqual([]);
  });
});
