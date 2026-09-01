/**
 * LES TESTS DU JEU DE DONNÉES RÉELLEMENT VERSIONNÉ.
 *
 * Les autres fichiers de test vérifient des règles sur des lots fabriqués.
 * Celui-ci vérifie le FICHIER qui sera servi : sa forme, sa cohérence interne,
 * et le fait qu'aucune commune publiée ne franchisse une règle par accident.
 *
 * C'est le garde-fou d'une régénération : un fichier tronqué, un millésime
 * manquant ou un agrégat incohérent ne produisent aucune erreur au build, et
 * se voient seulement ici.
 */

import { describe, expect, it } from "vitest";

import { cityCommunes, findCommuneBySlug } from "@/data/cities/communes";

import {
  DATASET_VERSION,
  cityDataset,
  distanceBetweenCitiesKm,
  findCity,
  isDatasetUsable,
  neighbourCities,
  publishedCities,
  refusedCities,
} from "./dataset";
import {
  MIN_CITY_DWELLING_SALES,
  MIN_DECILE_SAMPLE,
  MIN_FIGURE_SAMPLE,
  canPublishDeciles,
  canPublishFigure,
  isPublishableCity,
} from "./thresholds";
import type { CityPropertyType } from "./types";

const dataset = cityDataset();
const cities = publishedCities();
const TYPES: CityPropertyType[] = ["apartment", "house"];

describe("le fichier versionné", () => {
  it("porte la version de format attendue et n'est pas vide", () => {
    expect(dataset.version).toBe(DATASET_VERSION);
    expect(dataset.source).toBe("geodvf");
    expect(isDatasetUsable()).toBe(true);
    expect(dataset.years.length).toBeGreaterThanOrEqual(2);
  });

  it("porte une date de génération lisible et jamais future", () => {
    expect(dataset.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const generated = new Date(`${dataset.generatedAt}T00:00:00Z`).getTime();
    expect(Number.isNaN(generated)).toBe(false);
    expect(generated).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
  });

  it("ne décrit que des communes de la sélection écrite", () => {
    for (const city of dataset.cities) {
      const commune = findCommuneBySlug(city.slug);
      expect(commune, `commune inconnue dans le jeu de données : ${city.slug}`).toBeDefined();
      expect(city.insee).toBe(commune?.insee);
      expect(city.name).toBe(commune?.name);
    }
  });

  it("couvre toute la sélection écrite", () => {
    const known = new Set(dataset.cities.map((city) => city.slug));
    const missing = cityCommunes.filter((commune) => !known.has(commune.slug));
    expect(missing.map((commune) => commune.slug)).toEqual([]);
  });
});

describe("les communes publiées", () => {
  it("franchissent toutes le seuil de publication", () => {
    expect(cities.length).toBeGreaterThan(0);
    for (const city of cities) {
      expect(isPublishableCity(city), `commune publiée sous le seuil : ${city.slug}`).toBe(true);
      expect(city.dwellingSales).toBeGreaterThanOrEqual(MIN_CITY_DWELLING_SALES);
    }
  });

  it("et les communes refusées ne sont jamais servies", () => {
    const published = new Set(cities.map((city) => city.slug));
    for (const { city } of refusedCities()) {
      expect(published.has(city.slug)).toBe(false);
      expect(findCity(city.slug)).toBeUndefined();
    }
  });

  it("n'exposent aucune médiane sous l'effectif minimal", () => {
    for (const city of cities) {
      for (const type of TYPES) {
        const figure = city.byType[type];
        if (canPublishFigure(figure)) {
          expect(figure.sample, `${city.slug}/${type}`).toBeGreaterThanOrEqual(MIN_FIGURE_SAMPLE);
        }
        if (canPublishDeciles(figure)) {
          expect(figure.sample, `${city.slug}/${type}`).toBeGreaterThanOrEqual(MIN_DECILE_SAMPLE);
        }
      }
    }
  });

  it("gardent un effectif retenu inférieur ou égal à l'effectif total", () => {
    for (const city of cities) {
      for (const type of TYPES) {
        const figure = city.byType[type];
        expect(figure.sample, `${city.slug}/${type}`).toBeLessThanOrEqual(figure.total);
      }
      expect(city.mutationsKept).toBeLessThanOrEqual(city.mutationsFound);
      expect(city.dwellingSales).toBeLessThanOrEqual(city.mutationsKept);
    }
  });

  it("ordonnent leurs quantiles, sans exception", () => {
    for (const city of cities) {
      for (const type of TYPES) {
        const f = city.byType[type];
        if (!canPublishFigure(f)) continue;
        const ordered = [f.d1, f.q1, f.median, f.q3, f.d9].filter(
          (value): value is number => value !== undefined,
        );
        expect(ordered, `${city.slug}/${type}`).toEqual([...ordered].sort((a, b) => a - b));
      }
    }
  });

  it("ne perdent aucune vente dans l'histogramme", () => {
    for (const city of cities) {
      for (const type of TYPES) {
        const histogram = city.byType[type].histogram;
        if (!histogram) continue;
        const inside = histogram.bins.reduce((sum, bin) => sum + bin.count, 0);
        expect(inside + histogram.below + histogram.above, `${city.slug}/${type}`).toBe(
          city.byType[type].sample,
        );
      }
    }
  });

  it("décrivent exactement les millésimes du jeu de données", () => {
    for (const city of cities) {
      expect(city.years, city.slug).toEqual(dataset.years);
      for (const type of TYPES) {
        expect(city.yearlyByType[type].map((entry) => entry.year), city.slug).toEqual(
          dataset.years,
        );
      }
      expect(city.volumeByYear.map((entry) => entry.year), city.slug).toEqual(dataset.years);
    }
  });

  it("téléchargent un fichier par arrondissement pour Paris, Lyon et Marseille", () => {
    // Ces trois communes n'ont pas de fichier DVF : ne pas les développer
    // produirait une page vide, ce qui est déjà arrivé ailleurs sur ce dépôt.
    const paris = findCity("paris");
    expect(paris?.sourceCodes).toHaveLength(20);
    expect(findCity("lyon")?.sourceCodes).toHaveLength(9);
    expect(findCity("marseille")?.sourceCodes).toHaveLength(16);
    expect(paris?.sectors?.kind).toBe("arrondissement");
  });
});

describe("les communes voisines", () => {
  const subject = cities[0];

  it("excluent la commune elle-même et ne se répètent pas", () => {
    if (!subject) throw new Error("jeu de données vide");
    const neighbours = neighbourCities(subject);
    const slugs = neighbours.map((city) => city.slug);
    expect(slugs).not.toContain(subject.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sont ordonnées par distance croissante", () => {
    if (!subject) throw new Error("jeu de données vide");
    const distances = neighbourCities(subject).map((city) =>
      distanceBetweenCitiesKm(subject, city),
    );
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("ne renvoient que des communes qui ont une page", () => {
    const published = new Set(cities.map((city) => city.slug));
    for (const city of cities.slice(0, 10)) {
      for (const neighbour of neighbourCities(city)) {
        expect(published.has(neighbour.slug)).toBe(true);
      }
    }
  });
});
