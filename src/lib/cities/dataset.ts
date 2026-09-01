/**
 * L'ACCÈS AU JEU DE DONNÉES, et le seul endroit qui décide quelles communes ont
 * une page.
 *
 * Le fichier `aggregates.json` est produit par `regenerate.test.ts` et
 * versionné. Il n'est JAMAIS lu à la requête : les pages villes sont rendues au
 * build, `generateStaticParams` énumère `publishedCities()`, et rien de tout
 * ceci ne survit dans le navigateur.
 *
 * POURQUOI FILTRER ICI, ET PAS À LA GÉNÉRATION
 *   Le jeu de données contient les CENT communes candidates, y compris celles
 *   dont le volume ne permet pas d'écrire une page. C'est délibéré : le refus
 *   se relit, se teste sur les chiffres réels, et se documente. Une commune
 *   écartée à la génération ne laisserait aucune trace, et personne ne saurait
 *   dire six mois plus tard si elle a été refusée ou oubliée.
 */

import { haversineMeters } from "@/lib/geo/distance";

import raw from "@/data/cities/aggregates.json";
import { cityRefusal, isPublishableCity, type CityRefusal } from "./thresholds";
import type { CityAggregate, CityDataset } from "./types";

/** Version de format attendue. Un fichier d'une autre version est refusé. */
export const DATASET_VERSION = 1;

/** Chemin du fichier, relatif à la racine du dépôt. Lu par le script. */
export const DATASET_PATH = "src/data/cities/aggregates.json";

/**
 * Le `as unknown as` est assumé : un import JSON n'a pas de garantie de type,
 * et le vrai contrôle est ailleurs — `dataset.test.ts` vérifie la forme et la
 * cohérence du fichier réellement versionné, ce qu'aucune annotation ne fait.
 */
const dataset = raw as unknown as CityDataset;

export function cityDataset(): CityDataset {
  return dataset;
}

/** Vrai quand le fichier versionné est vide ou d'une version inconnue. */
export function isDatasetUsable(): boolean {
  return dataset.version === DATASET_VERSION && dataset.cities.length > 0;
}

/**
 * Les communes qui ont une page, de la plus peuplée à la moins peuplée.
 *
 * L'ordre suit la population et non le volume de ventes : c'est l'ordre dans
 * lequel un lecteur cherche une ville, et le sommaire est fait pour être
 * parcouru par un lecteur avant de l'être par un robot.
 */
export function publishedCities(): CityAggregate[] {
  if (!isDatasetUsable()) return [];
  return dataset.cities
    .filter(isPublishableCity)
    .sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug));
}

/** Les communes candidates écartées, et la raison de chaque refus. */
export function refusedCities(): { city: CityAggregate; refusal: CityRefusal }[] {
  if (!isDatasetUsable()) return [];
  const out: { city: CityAggregate; refusal: CityRefusal }[] = [];
  for (const city of dataset.cities) {
    const refusal = cityRefusal(city);
    if (refusal) out.push({ city, refusal });
  }
  return out;
}

/** Une commune publiée, par son slug. `undefined` si elle n'a pas de page. */
export function findCity(slug: string): CityAggregate | undefined {
  return publishedCities().find((city) => city.slug === slug);
}

/**
 * Les communes voisines publiées, par distance à vol d'oiseau.
 *
 * Le maillage se fait sur la GÉOGRAPHIE et non sur la population : quelqu'un
 * qui lit la page de Pessac cherche Mérignac et Bordeaux, pas Lille. La
 * distance est calculée entre centres de communes, ce qui suffit à ordonner
 * des voisines et ne prétend rien de plus.
 */
export function neighbourCities(city: CityAggregate, count = 5): CityAggregate[] {
  return publishedCities()
    .filter((other) => other.slug !== city.slug)
    .map((other) => ({ other, distance: haversineMeters(city.center, other.center) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((entry) => entry.other);
}

/** La distance à vol d'oiseau entre deux communes, en kilomètres. */
export function distanceBetweenCitiesKm(a: CityAggregate, b: CityAggregate): number {
  return haversineMeters(a.center, b.center) / 1000;
}
