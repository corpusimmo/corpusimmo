/**
 * `robots.txt` et le sitemap doivent dire la MÊME chose.
 *
 * La contradiction classique est celle-ci : une page interdite d'exploration et
 * pourtant annoncée dans le sitemap. Google la signale comme une erreur, et
 * elle ne coûte rien à commettre puisque les deux fichiers sont écrits
 * séparément. Ce test la rend impossible.
 */

import { describe, expect, it } from "vitest";

import { unpublishedNav } from "@/config/navigation";
import { canonicalUrl } from "@/lib/seo/metadata";

import robots from "./robots";
import sitemap from "./sitemap";

const rules = robots().rules;
const rule = Array.isArray(rules) ? rules[0] : rules;
const disallow = (() => {
  const raw = rule?.disallow ?? [];
  return Array.isArray(raw) ? raw : [raw];
})();

describe("robots", () => {
  it("laisse le site explorable", () => {
    expect(rule?.userAgent).toBe("*");
    expect(rule?.allow).toBe("/");
  });

  it("ferme les routes de service et les données détaillées", () => {
    for (const path of [
      "/api/",
      "/observatoire/comparables",
      "/outils/*/calculer",
    ]) {
      expect(disallow, `règle manquante : ${path}`).toContain(path);
    }
  });

  it("ferme ce qui n'est pas publié, en le lisant dans la navigation", () => {
    for (const entry of unpublishedNav) {
      expect(disallow, `section non publiée ouverte : ${entry.href}`).toContain(entry.href);
    }
  });

  it("laisse les fiches outils explorables", () => {
    // La fiche est ce qui travaille pour le référencement ; seul le calculateur
    // est fermé. Une règle `/outils` tout court casserait tout le segment.
    expect(disallow).not.toContain("/outils");
    expect(disallow).not.toContain("/outils/");
  });

  it("déclare le sitemap et l'hôte canonique, sur l'apex", () => {
    const { sitemap: declared, host } = robots();
    expect(declared).toBe(canonicalUrl("/sitemap.xml"));
    expect(host).not.toContain("www.");
  });

  it("n'interdit aucune URL que le sitemap annonce", () => {
    const base = canonicalUrl("/").replace(/\/$/, "");
    const paths = sitemap().map((entry) => entry.url.replace(base, "") || "/");

    for (const path of paths) {
      for (const pattern of disallow) {
        // Les règles `robots.txt` sont des préfixes, avec `*` pour joker.
        const matcher = new RegExp(
          `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`,
        );
        expect(
          matcher.test(path),
          `« ${path} » est dans le sitemap mais interdit par « ${pattern} »`,
        ).toBe(false);
      }
    }
  });
});
