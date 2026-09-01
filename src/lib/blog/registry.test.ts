/**
 * La lecture du dossier d'articles, éprouvée sur de vrais fichiers temporaires.
 *
 * Ce que l'on cherche ici n'est pas le chemin nominal, couvert ailleurs, mais
 * les deux situations où un build peut tomber&nbsp;: le dossier absent, et deux
 * fichiers qui revendiquent la même URL.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BlogContentError } from "./post";
import { blogSitemapEntries, loadBlogPosts } from "./registry";
import { BLOG_IS_PUBLIC } from "./visibility";

function article(title: string, extra: string[] = []): string {
  return [
    "---",
    `title: ${title}`,
    "excerpt: Un chapeau.",
    "category: methode",
    "publishedAt: 2026-05-05",
    "author: Rédaction CorpusImmo",
    ...extra,
    "---",
    "",
    "Un corps d'article.",
  ].join("\n");
}

describe("loadBlogPosts", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "corpusimmo-blog-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rend une liste vide quand le dossier n'existe pas", () => {
    expect(loadBlogPosts(join(dir, "absent"))).toEqual([]);
  });

  it("rend une liste vide quand le dossier est vide", () => {
    expect(loadBlogPosts(dir)).toEqual([]);
  });

  it("ne lit que les fichiers Markdown", () => {
    writeFileSync(join(dir, "un-article.md"), article("Un article"));
    writeFileSync(join(dir, "README.txt"), "Une note pour l'équipe.");
    writeFileSync(join(dir, ".DS_Store"), "");

    expect(loadBlogPosts(dir).map((post) => post.slug)).toEqual(["un-article"]);
  });

  it("rend le catalogue trié, du plus récent au plus ancien", () => {
    writeFileSync(join(dir, "ancien.md"), article("Ancien", ["publishedAt: 2025-01-01"]));
    writeFileSync(join(dir, "recent.md"), article("Récent", ["publishedAt: 2026-08-08"]));

    expect(loadBlogPosts(dir).map((post) => post.slug)).toEqual(["recent", "ancien"]);
  });

  it("refuse deux fichiers qui revendiquent la même URL", () => {
    writeFileSync(join(dir, "un-article.md"), article("Un article"));
    writeFileSync(join(dir, "autre-fichier.md"), article("Autre", ["slug: un-article"]));

    expect(() => loadBlogPosts(dir)).toThrow(BlogContentError);
    expect(() => loadBlogPosts(dir)).toThrow(/déjà pris/);
  });

  it("nomme le fichier fautif quand un en-tête est incomplet", () => {
    writeFileSync(join(dir, "casse.md"), "---\ntitle: Sans rien d'autre\n---\n\nUn corps.");
    expect(() => loadBlogPosts(dir)).toThrow(/casse\.md/);
  });
});

describe("blogSitemapEntries", () => {
  it("n'expose rien tant que le journal n'est pas ouvert", () => {
    // Ce test change de sens le jour de l'ouverture : voir `docs/blog.md`.
    expect(BLOG_IS_PUBLIC).toBe(false);
    expect(blogSitemapEntries()).toEqual([]);
  });
});
