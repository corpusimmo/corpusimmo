/**
 * LE GARDE-FOU DES ENTRÉES DE PLAN DE SITE.
 *
 * Les mêmes propriétés que celles que `src/app/sitemap.test.ts` vérifie sur le
 * plan de site entier, vérifiées ici sur la contribution des pages villes, et
 * AVANT le branchement. Un doublon ou une URL relative qui n'apparaîtrait
 * qu'une fois branché coûterait un aller-retour ; ici, il se voit tout de
 * suite.
 */

import { describe, expect, it } from "vitest";

import { canonicalUrl } from "@/lib/seo/metadata";

import { publishedCities } from "./dataset";
import { CITIES_ROOT, cityPath } from "./links";
import { citiesSitemapEntries } from "./sitemap";

const entries = citiesSitemapEntries();
const urls = entries.map((entry) => entry.url);

describe("citiesSitemapEntries", () => {
  it("annonce le sommaire et une entrée par commune publiée, sans rien de plus", () => {
    const cities = publishedCities();
    expect(entries).toHaveLength(cities.length + 1);
    expect(urls).toContain(canonicalUrl(CITIES_ROOT));
    for (const city of cities) {
      expect(urls, `commune absente : ${city.slug}`).toContain(canonicalUrl(cityPath(city.slug)));
    }
  });

  it("ne contient aucun doublon", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("n'expose que des URL absolues du domaine canonique", () => {
    const base = canonicalUrl("/").replace(/\/$/, "");
    for (const url of urls) {
      expect(url.startsWith(`${base}/`), `URL hors domaine : ${url}`).toBe(true);
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it("n'expose aucun segment dynamique non résolu", () => {
    expect(urls.some((url) => url.includes("["))).toBe(false);
  });

  it("date chaque entrée du jeu de données, jamais du build", () => {
    // Dater du build annoncerait cent modifications par jour qui n'ont pas
    // lieu : les agrégats ne bougent qu'à la régénération.
    const dates = new Set(entries.map((entry) => entry.lastModified.getTime()));
    expect(dates.size).toBe(1);
    for (const entry of entries) {
      expect(Number.isNaN(entry.lastModified.getTime())).toBe(false);
      expect(entry.lastModified.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it("donne à chaque entrée une priorité tenable, jamais la priorité maximale", () => {
    // La priorité 1 est réservée à l'accueil : `src/app/sitemap.test.ts` le
    // vérifie sur le plan complet, et une page ville qui la revendiquerait
    // ferait tomber ce test-là, loin d'ici.
    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThan(1);
    }
  });

  it("annonce une cadence compatible avec le rythme réel de publication DVF", () => {
    // Deux millésimes par an : rien ici ne change chaque semaine.
    for (const entry of entries) {
      expect(["monthly", "yearly"]).toContain(entry.changeFrequency);
    }
  });

  it("accepte un fabricant d'URL de test sans en changer la structure", () => {
    const fake = citiesSitemapEntries((path) => `https://exemple.test${path}`, "2026-01-15");
    expect(fake[0]?.url).toBe(`https://exemple.test${CITIES_ROOT}`);
    expect(fake[0]?.lastModified.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(fake).toHaveLength(entries.length);
  });
});
