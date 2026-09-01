/**
 * LES TESTS DE LA RÉDACTION.
 *
 * Deux choses seulement, mais elles portent sur les cent pages à la fois.
 *
 *   1. LA TYPOGRAPHIE. Le tiret cadratin est proscrit sur ce site, et
 *      l'espace insécable est obligatoire devant la ponctuation double. Une
 *      phrase générée échappe à toute relecture humaine : seul un test peut
 *      tenir la règle.
 *
 *   2. LA NON-DUPLICATION. C'est le risque propre aux pages programmatiques :
 *      cent pages identiques à un nom près sont traitées comme du contenu
 *      dupliqué, et l'échec est invisible depuis le dépôt. On vérifie donc que
 *      les paragraphes produits pour deux communes différentes le sont
 *      vraiment, et que les branches rédactionnelles sont toutes empruntées.
 */

import { describe, expect, it } from "vitest";

import {
  comparisonSentence,
  coverageParagraph,
  dispersionBand,
  dispersionParagraph,
  evolutionParagraph,
  marketParagraph,
  marketShape,
  metaDescription,
  pageTitle,
  polish,
  sectorParagraph,
} from "./copy";
import { cityDataset, neighbourCities, publishedCities } from "./dataset";
import { evolutionOf, publishableSectors, sectorCoverage } from "./thresholds";
import type { CityAggregate, CityPropertyType } from "./types";

const cities = publishedCities();
const dataset = cityDataset();
const TYPES: CityPropertyType[] = ["apartment", "house"];

/** Tout ce qui est écrit pour une commune, mis bout à bout. */
function allCopy(city: CityAggregate): string[] {
  const neighbours = neighbourCities(city);
  const out = [
    pageTitle(city),
    polish(metaDescription(city)),
    marketParagraph(city),
    coverageParagraph(city, dataset.generatedAt),
  ];
  const sectors = publishableSectors(city);
  if (sectors) out.push(sectorParagraph(city, sectors, sectorCoverage(city)));
  for (const type of TYPES) {
    const dispersion = dispersionParagraph(city, type);
    if (dispersion) out.push(dispersion);
    out.push(evolutionParagraph(city, type, evolutionOf(city.yearlyByType[type])));
    const comparison = comparisonSentence(city, neighbours, type);
    if (comparison) out.push(comparison);
  }
  return out;
}

describe("typographie", () => {
  it("n'écrit jamais de tiret cadratin ni de tiret demi-cadratin", () => {
    for (const city of cities) {
      for (const sentence of allCopy(city)) {
        expect(sentence, `${city.slug} : ${sentence}`).not.toMatch(/[—–]/);
      }
    }
  });

  it("pose l'espace insécable devant la ponctuation double et le pourcent", () => {
    // Une espace ORDINAIRE devant « : » « ; » « ! » « ? » ou « % » est le
    // défaut à attraper ; l'insécable, elle, est attendue.
    for (const city of cities) {
      for (const sentence of allCopy(city)) {
        expect(sentence, `${city.slug} : ${sentence}`).not.toMatch(/ [:;!?%]/);
      }
    }
  });

  it("ne laisse ni double espace ni espace en bord de phrase", () => {
    for (const city of cities) {
      for (const sentence of allCopy(city)) {
        expect(sentence).not.toMatch(/ {2}/);
        expect(sentence).toBe(sentence.trim());
      }
    }
  });

  it("ne tutoie pas", () => {
    for (const city of cities) {
      for (const sentence of allCopy(city)) {
        expect(sentence, `${city.slug} : ${sentence}`).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
      }
    }
  });
});

describe("non-duplication", () => {
  it("écrit un paragraphe d'ouverture différent pour chaque commune", () => {
    const paragraphs = cities.map(marketParagraph);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });

  it("emprunte réellement les trois formes de marché", () => {
    const shapes = new Set(cities.map(marketShape));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it("emprunte plusieurs bandes de dispersion", () => {
    const bands = new Set(
      cities.flatMap((city) => TYPES.map((type) => dispersionBand(city.byType[type]))),
    );
    expect(bands.size).toBeGreaterThanOrEqual(2);
  });

  it("emprunte plusieurs branches d'évolution, dont au moins un refus", () => {
    const statuses = new Set(
      cities.flatMap((city) =>
        TYPES.map((type) => {
          const evolution = evolutionOf(city.yearlyByType[type]);
          return evolution.status === "unavailable"
            ? `unavailable:${evolution.reason}`
            : evolution.status;
        }),
      ),
    );
    expect(statuses.size).toBeGreaterThanOrEqual(3);
    expect([...statuses].some((status) => status.startsWith("unavailable"))).toBe(true);
    expect(statuses.has("inconclusive")).toBe(true);
  });

  it("écrit des descriptions de recherche distinctes", () => {
    const descriptions = cities.map(metaDescription);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe("l'évolution est dite pour ce qu'elle est", () => {
  it("refuse de conclure quand l'écart tient dans la marge", () => {
    const subject = cities.find(
      (city) => evolutionOf(city.yearlyByType.apartment).status === "inconclusive",
    );
    expect(subject, "aucune évolution non concluante dans le jeu de données").toBeDefined();
    if (!subject) return;
    const sentence = evolutionParagraph(
      subject,
      "apartment",
      evolutionOf(subject.yearlyByType.apartment),
    );
    expect(sentence).toContain("Nous n'en tirons aucune tendance");
    expect(sentence).toMatch(/marge d'incertitude/);
  });

  it("annonce l'absence d'évolution plutôt que de laisser un blanc", () => {
    const sentence = evolutionParagraph(cities[0] as CityAggregate, "apartment", {
      status: "unavailable",
      reason: "sample",
    });
    expect(sentence).toContain("Aucune évolution n'est publiée");
    expect(sentence).toContain("60 ventes");
  });

  it("ne promet jamais l'avenir", () => {
    for (const city of cities) {
      for (const type of TYPES) {
        const sentence = evolutionParagraph(city, type, evolutionOf(city.yearlyByType[type]));
        expect(sentence, city.slug).not.toMatch(/prévision|prévoit|d'ici (?:à )?\d{4}|devrait/i);
      }
    }
  });
});

describe("chaque chiffre porte son effectif", () => {
  it("cite un nombre de ventes dans la description de recherche", () => {
    for (const city of cities) {
      expect(metaDescription(city), city.slug).toMatch(/ventes/);
    }
  });

  it("dit combien de mutations ont été écartées à la normalisation", () => {
    for (const city of cities.slice(0, 20)) {
      const paragraph = coverageParagraph(city, dataset.generatedAt);
      expect(paragraph).toContain("exploitables");
      expect(paragraph).toContain("mutations");
    }
  });
});
