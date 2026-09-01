/**
 * Un flux part et ne revient pas&nbsp;: il est copié, mis en cache, rediffusé.
 * Deux choses sont donc vérifiées ici avant tout&nbsp;: aucun brouillon n'y
 * entre, et le document reste valide même quand il est vide.
 */

import { describe, expect, it } from "vitest";

import { blogRssFeed, escapeXml } from "./rss";
import type { BlogPost } from "@/types/blog";

function post(overrides: Partial<BlogPost> & { slug: string }): BlogPost {
  return {
    title: `Titre de ${overrides.slug}`,
    excerpt: "Un chapeau.",
    publishedAt: "2026-04-10",
    updatedAt: "2026-04-10",
    author: { name: "Rédaction CorpusImmo" },
    category: "methode",
    tags: [],
    readingMinutes: 4,
    status: "published",
    related: [],
    body: "Un corps.",
    sourceFile: `${overrides.slug}.md`,
    ...overrides,
  };
}

const FEED = {
  baseUrl: "https://corpus.immo",
  title: "Le journal CorpusImmo",
  description: "Méthode et données publiques.",
};

describe("escapeXml", () => {
  it("échappe les cinq caractères réservés, et rien d'autre", () => {
    expect(escapeXml(`Prix & "valeur" <b> l'acte`)).toBe(
      "Prix &amp; &quot;valeur&quot; &lt;b&gt; l&apos;acte",
    );
    expect(escapeXml("Données à jour, m² compris")).toBe("Données à jour, m² compris");
  });
});

describe("blogRssFeed", () => {
  it("n'expose que les articles publiés", () => {
    const xml = blogRssFeed({
      ...FEED,
      posts: [
        post({ slug: "publie", title: "Article publié" }),
        post({ slug: "brouillon", title: "Article en brouillon", status: "draft" }),
      ],
    });

    expect(xml).toContain("https://corpus.immo/blog/publie");
    expect(xml).not.toContain("brouillon");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("range les articles du plus récent au plus ancien", () => {
    const xml = blogRssFeed({
      ...FEED,
      posts: [
        post({ slug: "ancien", publishedAt: "2025-01-01" }),
        post({ slug: "recent", publishedAt: "2026-07-07" }),
      ],
    });

    expect(xml.indexOf("/blog/recent")).toBeLessThan(xml.indexOf("/blog/ancien"));
  });

  it("date le flux du dernier article, jamais de l'instant du build", () => {
    const xml = blogRssFeed({
      ...FEED,
      posts: [post({ slug: "a", publishedAt: "2026-04-10", updatedAt: "2026-05-02" })],
    });

    expect(xml).toContain("<lastBuildDate>Sat, 02 May 2026 00:00:00 GMT</lastBuildDate>");
    expect(xml).toContain("<pubDate>Fri, 10 Apr 2026 00:00:00 GMT</pubDate>");
  });

  it("reste un document valide quand rien n'est publié", () => {
    const xml = blogRssFeed({ ...FEED, posts: [] });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("</rss>");
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("<lastBuildDate>");
  });

  it("échappe le contenu des articles", () => {
    const xml = blogRssFeed({
      ...FEED,
      posts: [post({ slug: "a", title: "Prix & valeur", excerpt: "Lire <ceci>" })],
    });

    expect(xml).toContain("<title>Prix &amp; valeur</title>");
    expect(xml).toContain("<description>Lire &lt;ceci&gt;</description>");
  });

  it("déclare son propre emplacement et ne double pas la barre oblique", () => {
    const xml = blogRssFeed({ ...FEED, baseUrl: "https://corpus.immo/", posts: [] });

    expect(xml).toContain('href="https://corpus.immo/blog/rss.xml"');
    expect(xml).toContain("<link>https://corpus.immo/blog</link>");
  });

  it("nomme la rubrique en clair, pas par son identifiant", () => {
    const xml = blogRssFeed({ ...FEED, posts: [post({ slug: "a", category: "donnees" })] });
    expect(xml).toContain("<category>Données publiques</category>");
  });
});
