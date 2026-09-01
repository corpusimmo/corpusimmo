import { describe, expect, it } from "vitest";

import { toolCatalogue } from "@/data/tools-catalogue";

import { toolMetaDescription } from "./tool-metadata";

describe("toolMetaDescription", () => {
  const descriptions = toolCatalogue.map((tool) => ({
    id: tool.id,
    text: toolMetaDescription(tool.summary),
  }));

  it("couvre les dix outils", () => {
    expect(descriptions).toHaveLength(10);
  });

  it("tient dans la fenêtre d'un extrait de résultat de recherche", () => {
    // En dessous de 145 signes, l'extrait laisse de la place vide ; au-dessus
    // de 170, il est coupé, et c'est toujours la fin qui saute.
    for (const { id, text } of descriptions) {
      expect(text.length, `${id} : ${text.length} signes`).toBeGreaterThanOrEqual(145);
      expect(text.length, `${id} : ${text.length} signes`).toBeLessThanOrEqual(170);
    }
  });

  it("n'écrit jamais de tiret cadratin", () => {
    for (const { id, text } of descriptions) {
      expect(text, `${id} porte un tiret cadratin`).not.toMatch(/[—–]/);
    }
  });

  it("ne promet plus un usage sans compte", () => {
    // Les calculateurs demandent une connexion depuis le changement de régime
    // d'accès. Une description qui dirait l'inverse mentirait à Google avant de
    // mentir au visiteur.
    for (const { id, text } of descriptions) {
      expect(text.toLowerCase(), `${id} promet un accès sans compte`).not.toContain("sans compte");
    }
  });

  it("sont toutes différentes les unes des autres", () => {
    // Dix descriptions identiques valent zéro : Google les traite comme du
    // contenu dupliqué et n'en garde qu'une.
    expect(new Set(descriptions.map((entry) => entry.text)).size).toBe(10);
  });
});
