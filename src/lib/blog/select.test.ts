/**
 * Ce qui est éprouvé ici est la seule chose qui puisse faire du tort&nbsp;:
 * qu'un brouillon sorte.
 *
 * Le reste (tri, rapprochement, plan du site) est vérifié dans la foulée, parce
 * qu'un journal dont l'ordre change d'un build à l'autre produit un plan de
 * site et un flux qui bougent sans raison, ce qu'aucun moteur n'apprécie.
 */

import { describe, expect, it } from "vitest";

import type { BlogPost } from "@/types/blog";

import {
  byCategory,
  byTag,
  draftsOnly,
  publishedOnly,
  relatedTo,
  sitemapEntriesFor,
  sortPosts,
  tagCounts,
} from "./select";

function post(overrides: Partial<BlogPost> & { slug: string }): BlogPost {
  return {
    title: `Titre de ${overrides.slug}`,
    excerpt: "Un chapeau.",
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    author: { name: "Rédaction CorpusImmo" },
    category: "methode",
    tags: [],
    readingMinutes: 3,
    status: "published",
    related: [],
    body: "Un corps.",
    sourceFile: `${overrides.slug}.md`,
    ...overrides,
  };
}

describe("sortPosts", () => {
  it("range du plus récent au plus ancien", () => {
    const sorted = sortPosts([
      post({ slug: "vieux", publishedAt: "2025-03-04" }),
      post({ slug: "recent", publishedAt: "2026-05-20" }),
      post({ slug: "median", publishedAt: "2026-01-09" }),
    ]);

    expect(sorted.map((entry) => entry.slug)).toEqual(["recent", "median", "vieux"]);
  });

  it("départage deux articles du même jour par slug, pour rester reproductible", () => {
    const sorted = sortPosts([
      post({ slug: "zeta", publishedAt: "2026-02-02" }),
      post({ slug: "alpha", publishedAt: "2026-02-02" }),
    ]);

    expect(sorted.map((entry) => entry.slug)).toEqual(["alpha", "zeta"]);
  });

  it("ne réordonne pas le tableau reçu", () => {
    const posts = [
      post({ slug: "a", publishedAt: "2025-01-01" }),
      post({ slug: "b", publishedAt: "2026-01-01" }),
    ];

    sortPosts(posts);

    expect(posts.map((entry) => entry.slug)).toEqual(["a", "b"]);
  });
});

describe("publishedOnly", () => {
  it("écarte les brouillons", () => {
    const posts = [
      post({ slug: "publie" }),
      post({ slug: "brouillon", status: "draft" }),
      post({ slug: "publie-2" }),
    ];

    expect(publishedOnly(posts).map((entry) => entry.slug)).toEqual(["publie", "publie-2"]);
    expect(draftsOnly(posts).map((entry) => entry.slug)).toEqual(["brouillon"]);
  });

  it("rend une liste vide quand tout est en brouillon", () => {
    expect(publishedOnly([post({ slug: "a", status: "draft" })])).toEqual([]);
  });
});

describe("filtrage", () => {
  const posts = [
    post({ slug: "a", category: "donnees", tags: ["dvf", "méthode"] }),
    post({ slug: "b", category: "methode", tags: ["méthode"] }),
    post({ slug: "c", category: "donnees", tags: ["open data"] }),
  ];

  it("filtre par rubrique", () => {
    expect(byCategory(posts, "donnees").map((entry) => entry.slug)).toEqual(["a", "c"]);
    expect(byCategory(posts, "marche")).toEqual([]);
  });

  it("filtre par étiquette, sans se soucier de la casse ni des espaces", () => {
    expect(byTag(posts, "Méthode").map((entry) => entry.slug)).toEqual(["a", "b"]);
    expect(byTag(posts, "  dvf ").map((entry) => entry.slug)).toEqual(["a"]);
  });

  it("ne rend rien pour une étiquette vide", () => {
    expect(byTag(posts, "   ")).toEqual([]);
  });

  it("compte les étiquettes, de la plus portée à la moins portée", () => {
    expect(tagCounts(posts)).toEqual([
      { tag: "méthode", count: 2 },
      { tag: "dvf", count: 1 },
      { tag: "open data", count: 1 },
    ]);
  });
});

describe("relatedTo", () => {
  const sujet = post({
    slug: "sujet",
    category: "methode",
    tags: ["estimation", "dvf"],
    related: ["choisi", "inconnu"],
  });

  const pool = [
    sujet,
    post({ slug: "choisi", category: "marche", tags: [], publishedAt: "2024-01-01" }),
    post({ slug: "meme-rubrique", category: "methode", publishedAt: "2026-01-01" }),
    post({ slug: "une-etiquette", category: "marche", tags: ["dvf"], publishedAt: "2026-06-01" }),
    post({ slug: "sans-rapport", category: "pratique", tags: ["fiscalite"] }),
  ];

  it("met l'intention éditoriale devant le rapprochement automatique", () => {
    const related = relatedTo(sujet, pool, 3);
    expect(related[0]?.slug).toBe("choisi");
  });

  it("ignore un lien déclaré introuvable au lieu d'échouer", () => {
    expect(relatedTo(sujet, pool, 3).map((entry) => entry.slug)).not.toContain("inconnu");
  });

  it("classe ensuite par affinité de rubrique puis d'étiquette", () => {
    expect(relatedTo(sujet, pool, 3).map((entry) => entry.slug)).toEqual([
      "choisi",
      "meme-rubrique",
      "une-etiquette",
    ]);
  });

  it("n'inclut jamais l'article lui-même, ni ce qui n'a aucun rapport", () => {
    const related = relatedTo(sujet, pool, 10).map((entry) => entry.slug);
    expect(related).not.toContain("sujet");
    expect(related).not.toContain("sans-rapport");
  });

  it("respecte la limite demandée", () => {
    expect(relatedTo(sujet, pool, 1)).toHaveLength(1);
    expect(relatedTo(sujet, pool, 0)).toEqual([]);
  });

  it("ne propose rien quand rien ne se rapproche", () => {
    const isole = post({ slug: "isole", category: "pratique", tags: ["unique"] });
    expect(relatedTo(isole, [post({ slug: "autre", category: "marche", tags: [] })])).toEqual([]);
  });
});

describe("sitemapEntriesFor", () => {
  const posts = [
    post({ slug: "publie", publishedAt: "2026-02-01", updatedAt: "2026-03-15" }),
    post({ slug: "brouillon", status: "draft", publishedAt: "2026-04-01" }),
    post({ slug: "ancien", publishedAt: "2025-11-11" }),
  ];

  it("n'expose que les articles publiés", () => {
    const urls = sitemapEntriesFor(posts, "https://corpus.immo").map((entry) => entry.url);

    expect(urls).toEqual([
      "https://corpus.immo/blog/publie",
      "https://corpus.immo/blog/ancien",
    ]);
    expect(urls.join(" ")).not.toContain("brouillon");
  });

  it("date l'entrée de la MISE À JOUR, pas de la publication", () => {
    const entry = sitemapEntriesFor(posts, "https://corpus.immo")[0];
    expect(entry?.lastModified.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("ne double pas la barre oblique de fin d'origine", () => {
    const entry = sitemapEntriesFor([post({ slug: "a" })], "https://corpus.immo/")[0];
    expect(entry?.url).toBe("https://corpus.immo/blog/a");
  });

  it("rend une liste vide quand rien n'est publié", () => {
    expect(sitemapEntriesFor([post({ slug: "a", status: "draft" })], "https://corpus.immo")).toEqual(
      [],
    );
  });
});
