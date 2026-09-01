/**
 * LE GARDE-FOU DU SITEMAP.
 *
 * Sans ces assertions, le sitemap automatique serait un pari : il échoue en
 * SILENCE. Une page qui sort de l'index ne provoque aucune erreur, aucun test
 * rouge, aucun log ; elle disparaît, et on l'apprend six mois plus tard en
 * regardant la Search Console. C'est ce test, et lui seul, qui rend
 * l'automatisme digne de confiance.
 *
 * Il vérifie donc les propriétés qui ne doivent JAMAIS être fausses, et il les
 * vérifie sur la sortie réelle de `sitemap()`, pas sur une reconstitution.
 */

import { describe, expect, it } from "vitest";

import { unpublishedNav } from "@/config/navigation";
import { BLOG_IS_PUBLIC } from "@/lib/blog";
import { toolCatalogue } from "@/data/tools-catalogue";
import { canonicalUrl } from "@/lib/seo/metadata";
import { discoverPages, noindexPatterns, unresolvedDynamicPatterns } from "@/lib/seo/routes";

import sitemap from "./sitemap";

const entries = sitemap();
const urls = entries.map((entry) => entry.url);

/** Le chemin d'une entrée, domaine retiré. */
function pathOf(url: string): string {
  return url.replace(canonicalUrl("/").replace(/\/$/, ""), "") || "/";
}

describe("sitemap", () => {
  it("ne contient aucune URL relative ni hors du domaine canonique", () => {
    const base = canonicalUrl("/").replace(/\/$/, "");
    for (const url of urls) {
      expect(url.startsWith(`${base}/`), `URL hors domaine ou relative : ${url}`).toBe(true);
      // `new URL` lèverait sur une URL relative : la vérification est donc
      // faite deux fois, par deux mécanismes différents.
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it("ne contient aucun doublon", () => {
    expect(urls).toHaveLength(new Set(urls).size);
  });

  it("contient les dix fiches outils", () => {
    expect(toolCatalogue).toHaveLength(10);
    for (const tool of toolCatalogue) {
      expect(urls, `fiche absente du sitemap : ${tool.id}`).toContain(
        canonicalUrl(`/outils/${tool.id}`),
      );
    }
  });

  it("n'expose aucune page qui se déclare hors index", () => {
    // Les motifs viennent des pages elles-mêmes : le sitemap ne peut pas
    // contredire une métadonnée, puisqu'il la lit.
    for (const pattern of noindexPatterns()) {
      const concrete = pattern.replace("[slug]", toolCatalogue[0]?.id ?? "");
      expect(urls, `page hors index présente : ${pattern}`).not.toContain(canonicalUrl(concrete));
    }
  });

  /**
   * LES PAGES QUI DOIVENT ÊTRE INDEXÉES LE SONT.
   *
   * C'est la moitié du garde-fou que l'automatisme ne peut pas fournir : la
   * découverte sait dire ce qu'elle a trouvé, elle ne sait pas dire ce qui
   * MANQUE. Cette liste est donc écrite à la main, et c'est ici sa place. Un
   * faux positif du détecteur de `noindex` (une phrase de commentaire citant le
   * jeton, par exemple) la fait tomber immédiatement.
   */
  it("indexe toutes les pages publiques du site", () => {
    for (const path of [
      "/",
      "/estimer",
      "/carte",
      "/observatoire",
      "/observatoire/transactions",
      "/outils",
      "/a-propos",
      "/mentions-legales",
      "/confidentialite",
    ]) {
      expect(urls, `page publique absente du sitemap : ${path}`).toContain(canonicalUrl(path));
    }
  });

  /**
   * Et l'autre moitié : les écrans de service restent dehors.
   *
   * L'assertion est une INCLUSION et non une égalité : une page hors index
   * ajoutée demain par ailleurs (un écran de repli, une page de service) est
   * légitime et ne doit pas faire échouer ce test. Ce qui doit échouer, c'est
   * qu'une de ces huit-là revienne dans l'index.
   */
  it("tient hors index les écrans qui n'ont rien à y faire", () => {
    const patterns = noindexPatterns();
    for (const pattern of [
      "/connexion",
      "/mon-espace",
      "/observatoire/comparables",
      "/outils/[slug]/calculer",
      "/solutions",
      "/solutions/automatisation",
      "/solutions/formation",
      "/solutions/leads-vendeurs",
    ]) {
      expect(patterns, `page de service redevenue indexable : ${pattern}`).toContain(pattern);
    }
  });

  it("n'expose aucune page non publiée", () => {
    // La liste est LUE dans la navigation : le jour où « Solutions » remonte
    // dans `mainNav`, ce test cesse tout seul de l'interdire.
    const unpublished = unpublishedNav.flatMap((entry) => [
      entry.href,
      ...(entry.children ?? []).map((child) => child.href),
    ]);
    expect(unpublished.length).toBeGreaterThan(0);

    for (const href of unpublished) {
      const leaked = urls.filter((url) => pathOf(url) === href || pathOf(url).startsWith(`${href}/`));
      expect(leaked, `page non publiée dans le sitemap : ${href}`).toEqual([]);
    }
  });

  it("couvre toutes les pages indexables découvertes", () => {
    const missing = discoverPages()
      .filter((page) => !page.noindex && !page.pattern.includes("["))
      .map((page) => page.pattern)
      .filter((pattern) => !urls.includes(canonicalUrl(pattern)));

    expect(missing, "pages indexables absentes du sitemap").toEqual([]);
  });

  it("sait énumérer tous ses segments dynamiques", () => {
    // Si quelqu'un ajoute `/guides/[slug]` sans dire comment l'énumérer, la
    // page n'entrerait pas dans l'index et personne ne le verrait. Ici, si.
    expect(unresolvedDynamicPatterns()).toEqual([]);
    expect(urls.some((url) => url.includes("["))).toBe(false);
  });

  it("donne à chaque entrée une date, une cadence et une priorité tenables", () => {
    const cadences = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
    const now = Date.now();

    for (const entry of entries) {
      expect(entry.lastModified, `date manquante : ${entry.url}`).toBeInstanceOf(Date);
      const date = entry.lastModified as Date;
      expect(Number.isNaN(date.getTime())).toBe(false);
      // Une date de dernière modification dans le futur discrédite tout le
      // fichier aux yeux d'un moteur.
      expect(date.getTime(), `date future : ${entry.url}`).toBeLessThanOrEqual(now + 1000);

      expect(cadences).toContain(entry.changeFrequency);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });

  it("réserve la priorité maximale à la seule page d'accueil", () => {
    const top = entries.filter((entry) => entry.priority === 1);
    expect(top.map((entry) => entry.url)).toEqual([canonicalUrl("/")]);
  });

  /**
   * LE JOURNAL, PAS ENCORE BRANCHÉ.
   *
   * `src/lib/blog/` existe désormais et expose `blogSitemapEntries()`, mais le
   * branchement n'est pas de cette livraison (voir le commentaire dans
   * `src/app/sitemap.ts`). Ce test fige l'état actuel plutôt que de le laisser
   * implicite.
   *
   * AU BRANCHEMENT : remplacer cette assertion par la vérification que les
   * articles publiés sont là et les brouillons non, et ajouter l'index `/blog`,
   * que `blogSitemapEntries()` ne rend pas. Les autres tests de ce fichier
   * couvriront le reste sans une ligne de plus.
   */
  it("n'annonce aucune URL de journal tant que celui-ci n'est pas ouvert", () => {
    // Le module EST branché : ce silence est celui de `BLOG_IS_PUBLIC`, pas
    // d'un import oublié. Le jour de l'ouverture, ce test s'inverse.
    expect(BLOG_IS_PUBLIC).toBe(false);
    expect(urls.filter((url) => pathOf(url).startsWith("/blog"))).toEqual([]);
  });
});
