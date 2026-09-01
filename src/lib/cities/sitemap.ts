/**
 * LES ENTRÉES DE PLAN DE SITE DES PAGES VILLES.
 *
 * POURQUOI CETTE FONCTION EXISTE AU LIEU D'UNE DÉCOUVERTE AUTOMATIQUE
 *   `src/lib/seo/routes.ts` dresse l'inventaire des routes en lisant
 *   `src/app/**`. Il sait voir qu'un motif `/prix-immobilier/[ville]` existe ;
 *   il ne sait PAS énumérer les communes, et il le dit : un motif dynamique
 *   qu'il ne sait pas résoudre est signalé par `unresolvedDynamicPatterns()` et
 *   fait échouer `src/app/sitemap.test.ts`. C'est exactement le garde-fou
 *   voulu, et c'est le même chemin que celui du journal
 *   (`blogSitemapEntries()`).
 *
 *   Le branchement se fait donc en deux endroits, tous deux hors de cette
 *   livraison et documentés dans `docs/pages-villes.md` :
 *     · `EXCLUDED_PREFIXES` dans `src/lib/seo/routes.ts`, pour que la
 *       découverte laisse le préfixe tranquille ;
 *     · `src/app/sitemap.ts`, qui pousse le résultat de cette fonction.
 *
 * LE SOMMAIRE EST INCLUS ICI, DÉLIBÉRÉMENT
 *   `blogSitemapEntries()` ne rend que les articles, ce qui a obligé à traiter
 *   l'index `/blog` à part et a été noté comme un piège dans `sitemap.ts`. On
 *   ne refait pas la même chose : `citiesSitemapEntries()` rend le sommaire ET
 *   les communes, de sorte qu'un seul `push` suffise et qu'aucune page ne
 *   puisse être oubliée au branchement.
 */

import { canonicalUrl } from "@/lib/seo/metadata";

import { cityDataset, publishedCities } from "./dataset";
import { CITIES_ROOT, cityPath } from "./links";

export interface CitySitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
}

/**
 * La date de dernière modification, commune à toutes les entrées.
 *
 * Ce qui change sur ces pages, c'est le jeu de données ; il est régénéré d'un
 * bloc, deux fois par an, au rythme des publications DVF. Dater chaque page à
 * l'heure du build annoncerait aux moteurs cent modifications quotidiennes qui
 * n'ont pas lieu, et c'est le genre de mensonge qui fait cesser de croire un
 * plan de site en entier.
 */
function datasetDate(generatedAt: string): Date {
  const parsed = new Date(`${generatedAt}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * Le sommaire et les pages villes publiées, prêts pour `src/app/sitemap.ts`.
 *
 * Les deux paramètres n'existent que pour les tests, qui doivent pouvoir
 * fabriquer un domaine et une date. Le branchement réel tient donc en une
 * ligne, sans argument :
 *
 *     routes.push(...citiesSitemapEntries());
 */
export function citiesSitemapEntries(
  absoluteUrl: (path: string) => string = canonicalUrl,
  generatedAt: string = cityDataset().generatedAt,
): CitySitemapEntry[] {
  const cities = publishedCities();
  if (cities.length === 0) return [];

  const lastModified = datasetDate(generatedAt);

  const entries: CitySitemapEntry[] = [
    {
      url: absoluteUrl(CITIES_ROOT),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  for (const city of cities) {
    entries.push({
      url: absoluteUrl(cityPath(city.slug)),
      lastModified,
      // Deux publications DVF par an : « monthly » est déjà généreux, et
      // « weekly » serait une invitation à recrawler pour rien.
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
