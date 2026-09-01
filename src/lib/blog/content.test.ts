/**
 * LE TEST DES ARTICLES RÉELS, celui qui garde la rubrique invisible.
 *
 * Les autres tests éprouvent des objets fabriqués&nbsp;; celui-ci lit les
 * fichiers du dépôt et vérifie trois choses que rien d'autre ne vérifie&nbsp;:
 *
 *   · chaque fichier se lit sans erreur, donc le build ne tombera pas&nbsp;;
 *   · rien n'est publié, donc rien n'est indexable ni diffusé&nbsp;;
 *   · aucun texte visible ne contient de tiret cadratin, consigne éditoriale du
 *     propriétaire du projet.
 *
 * Le jour où un article passe en `published`, le deuxième bloc échouera. C'est
 * voulu&nbsp;: la mise en visibilité doit être une décision, pas une dérive. La
 * marche à suivre est dans `docs/blog.md`.
 */

import { describe, expect, it } from "vitest";

import { blogCategories } from "./taxonomy";
import { loadBlogPosts } from "./registry";
import { publishedOnly, sitemapEntriesFor } from "./select";

const posts = loadBlogPosts();

/** Cadratin U+2014 et demi-cadratin U+2013, tous deux proscrits du texte visible. */
const DASHES = /[—–]/;

describe("les articles du dépôt", () => {
  it("se lisent tous, et il y en a", () => {
    expect(posts.length).toBeGreaterThanOrEqual(3);
  });

  it("portent un slug unique", () => {
    const slugs = posts.map((post) => post.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("annoncent un temps de lecture crédible", () => {
    for (const post of posts) {
      expect(post.readingMinutes, post.sourceFile).toBeGreaterThanOrEqual(1);
      expect(post.readingMinutes, post.sourceFile).toBeLessThan(30);
    }
  });

  it("ne renvoient qu'à des articles qui existent", () => {
    const slugs = new Set(posts.map((post) => post.slug));
    for (const post of posts) {
      for (const related of post.related) {
        expect(slugs.has(related), `${post.sourceFile} renvoie à « ${related} »`).toBe(true);
      }
    }
  });

  it("se rangent dans une rubrique déclarée", () => {
    const ids = new Set(blogCategories.map((entry) => entry.id));
    for (const post of posts) {
      expect(ids.has(post.category), post.sourceFile).toBe(true);
    }
  });
});

describe("le journal n'est pas encore ouvert", () => {
  it("ne contient aucun article publié", () => {
    expect(publishedOnly(posts)).toEqual([]);
  });

  it("ne produit donc aucune entrée de plan de site", () => {
    expect(sitemapEntriesFor(posts, "https://corpus.immo")).toEqual([]);
  });
});

describe("la consigne typographique", () => {
  it("proscrit le tiret cadratin de tout texte visible", () => {
    for (const post of posts) {
      expect(DASHES.test(post.title), `${post.sourceFile} (titre)`).toBe(false);
      expect(DASHES.test(post.excerpt), `${post.sourceFile} (chapeau)`).toBe(false);
      expect(DASHES.test(post.body), `${post.sourceFile} (corps)`).toBe(false);
    }
  });

  it("vaut aussi pour les libellés de rubriques", () => {
    for (const category of blogCategories) {
      expect(DASHES.test(category.label), category.id).toBe(false);
      expect(DASHES.test(category.description), category.id).toBe(false);
    }
  });
});
