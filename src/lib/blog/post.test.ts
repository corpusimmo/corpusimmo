/**
 * La lecture d'un en-tête d'article est la seule frontière entre un fichier
 * écrit à la main et une page en ligne. Ce qui est éprouvé ici&nbsp;: elle
 * refuse ce qui est incomplet, et elle le dit avec le nom du fichier.
 */

import { describe, expect, it } from "vitest";

import { splitFrontMatter } from "./front-matter";
import { BlogContentError, parseBlogPost, slugFromFileName } from "./post";

const HEADER = [
  "---",
  "title: Un titre d'article",
  "excerpt: Un chapeau qui tient en une phrase.",
  "category: methode",
  "publishedAt: 2026-03-04",
  "author: Rédaction CorpusImmo",
  "---",
].join("\n");

function file(header: string[], body = "Un paragraphe de corps."): string {
  return `---\n${header.join("\n")}\n---\n\n${body}`;
}

describe("splitFrontMatter", () => {
  it("sépare l'en-tête du corps", () => {
    const { data, body } = splitFrontMatter(`${HEADER}\n\nLe corps.\n`);

    expect(data["title"]).toBe("Un titre d'article");
    expect(data["category"]).toBe("methode");
    expect(body).toBe("Le corps.");
  });

  it("garde les deux-points qui suivent le premier", () => {
    const { data } = splitFrontMatter(file(["title: Estimer : mode d'emploi"]));
    expect(data["title"]).toBe("Estimer : mode d'emploi");
  });

  it("lit une liste en ligne comme une liste à tirets", () => {
    const inline = splitFrontMatter(file(["tags: [dvf, méthode]"]));
    const dashed = splitFrontMatter(file(["tags:", "  - dvf", "  - méthode"]));

    expect(inline.data["tags"]).toEqual(["dvf", "méthode"]);
    expect(dashed.data["tags"]).toEqual(["dvf", "méthode"]);
  });

  it("retire les guillemets qui encadrent toute la valeur, et eux seuls", () => {
    const { data } = splitFrontMatter(file(['title: "Un « titre » cité"']));
    expect(data["title"]).toBe("Un « titre » cité");
  });

  it("traite un en-tête jamais refermé comme un fichier sans en-tête", () => {
    const { data, body } = splitFrontMatter("---\ntitle: Perdu\n\nDu texte.");
    expect(data).toEqual({});
    expect(body).toContain("title: Perdu");
  });
});

describe("parseBlogPost", () => {
  it("lit un article complet", () => {
    const post = parseBlogPost(
      "mon-article.md",
      file(
        [
          "title: Un titre",
          "excerpt: Un chapeau.",
          "category: donnees",
          "publishedAt: 2026-03-04",
          "updatedAt: 2026-04-01",
          "author: Rédaction CorpusImmo",
          "authorRole: Analyse de données",
          "status: published",
          "tags: [DVF, Méthode, dvf]",
          "socialImage: /og/blog/article.png",
          "related: [autre-article, mon-article]",
        ],
        "Un corps d'article suffisamment long pour être compté.",
      ),
    );

    expect(post).toMatchObject({
      slug: "mon-article",
      title: "Un titre",
      category: "donnees",
      publishedAt: "2026-03-04",
      updatedAt: "2026-04-01",
      status: "published",
      socialImage: "/og/blog/article.png",
      sourceFile: "mon-article.md",
    });
    expect(post.author).toEqual({ name: "Rédaction CorpusImmo", role: "Analyse de données" });
  });

  it("normalise les étiquettes en minuscules et les dédoublonne", () => {
    const post = parseBlogPost("a.md", file([...HEADER.split("\n").slice(1, -1), "tags: [DVF, dvf, Méthode]"]));
    expect(post.tags).toEqual(["dvf", "méthode"]);
  });

  it("écarte un article qui se cite lui-même dans ses liés", () => {
    const post = parseBlogPost("a.md", file([...HEADER.split("\n").slice(1, -1), "related: [a, b]"]));
    expect(post.related).toEqual(["b"]);
  });

  it("calcule le temps de lecture au lieu de le lire", () => {
    const court = parseBlogPost("court.md", file(HEADER.split("\n").slice(1, -1), "Trois mots ici."));
    const long = parseBlogPost(
      "long.md",
      file(HEADER.split("\n").slice(1, -1), "mot ".repeat(1000)),
    );

    expect(court.readingMinutes).toBe(1);
    expect(long.readingMinutes).toBe(5);
  });

  it("aligne la mise à jour sur la publication quand elle n'est pas déclarée", () => {
    const post = parseBlogPost("a.md", `${HEADER}\n\nUn corps.`);
    expect(post.updatedAt).toBe(post.publishedAt);
  });

  it("considère qu'un statut absent vaut brouillon", () => {
    const post = parseBlogPost("a.md", `${HEADER}\n\nUn corps.`);
    expect(post.status).toBe("draft");
  });

  it("prend le slug du nom de fichier, et laisse l'en-tête le remplacer", () => {
    expect(slugFromFileName("ce-que-dvf-dit.md")).toBe("ce-que-dvf-dit");
    const post = parseBlogPost("ancien-nom.md", file([...HEADER.split("\n").slice(1, -1), "slug: nouveau-nom"]));
    expect(post.slug).toBe("nouveau-nom");
  });
});

describe("parseBlogPost, ce qui est refusé", () => {
  const base = HEADER.split("\n").slice(1, -1);

  function withoutKey(key: string): string[] {
    return base.filter((line) => !line.startsWith(`${key}:`));
  }

  it("nomme le fichier ET la clé manquante", () => {
    expect(() => parseBlogPost("brouillon.md", file(withoutKey("title")))).toThrow(BlogContentError);
    expect(() => parseBlogPost("brouillon.md", file(withoutKey("title")))).toThrow(
      /brouillon\.md.+title/s,
    );
  });

  it("refuse un chapeau, une rubrique, une date ou un auteur absents", () => {
    for (const key of ["excerpt", "category", "publishedAt", "author"]) {
      expect(() => parseBlogPost("a.md", file(withoutKey(key)))).toThrow(BlogContentError);
    }
  });

  it("refuse une rubrique inventée, et énumère celles qui existent", () => {
    const lines = withoutKey("category").concat("category: divers");
    expect(() => parseBlogPost("a.md", file(lines))).toThrow(/methode/);
  });

  it("refuse une date qui n'existe pas au calendrier", () => {
    const lines = withoutKey("publishedAt").concat("publishedAt: 2026-02-31");
    expect(() => parseBlogPost("a.md", file(lines))).toThrow(/date réelle/);
  });

  it("refuse une date mal formée", () => {
    const lines = withoutKey("publishedAt").concat("publishedAt: 04/03/2026");
    expect(() => parseBlogPost("a.md", file(lines))).toThrow(/AAAA-MM-JJ/);
  });

  it("refuse une mise à jour antérieure à la publication", () => {
    expect(() => parseBlogPost("a.md", file(base.concat("updatedAt: 2025-01-01")))).toThrow(
      /précède la publication/,
    );
  });

  it("refuse un statut inconnu", () => {
    expect(() => parseBlogPost("a.md", file(base.concat("status: publié")))).toThrow(/status/);
  });

  it("refuse un slug inutilisable en URL", () => {
    expect(() => parseBlogPost("a.md", file(base.concat("slug: Mon Article !")))).toThrow(/slug/);
  });

  it("refuse une image sociale qui ne mène nulle part", () => {
    expect(() => parseBlogPost("a.md", file(base.concat("socialImage: og/image.png")))).toThrow(
      /socialImage/,
    );
  });

  it("refuse un corps vide", () => {
    expect(() => parseBlogPost("a.md", file(base, "   \n\n"))).toThrow(/corps/);
  });
});
