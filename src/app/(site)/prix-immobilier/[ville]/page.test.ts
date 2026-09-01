/**
 * LE CONTRÔLE DE LA ROUTE ELLE-MÊME.
 *
 * Ce que ce fichier attrape et qu'aucun autre ne peut attraper : une erreur
 * dans le graphe d'imports de la page (un cycle, un module client tiré côté
 * serveur), une commune énumérée qui n'aurait pas de données, et une
 * métadonnée qui déborde des longueurs utiles en résultat de recherche.
 *
 * Ces défauts-là ne se voient ni au typage, ni à l'exécution locale : ils se
 * voient au build, ou six mois plus tard dans la Search Console.
 */

import { describe, expect, it } from "vitest";

import { cityPath, publishedCities } from "@/lib/cities";

import { dynamicParams, generateMetadata, generateStaticParams } from "./page";

const cities = publishedCities();

describe("generateStaticParams", () => {
  it("énumère exactement les communes publiées", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(cities.length);
    expect(params.map((entry) => entry.ville).sort()).toEqual(
      cities.map((city) => city.slug).sort(),
    );
  });

  it("ne produit aucun doublon", () => {
    const slugs = generateStaticParams().map((entry) => entry.ville);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("ferme la porte aux slugs non énumérés", () => {
    // Sans ce `false`, une URL inventée déclencherait un rendu à la volée et
    // pourrait entrer dans l'index sous une forme à moitié vide.
    expect(dynamicParams).toBe(false);
  });
});

describe("generateMetadata", () => {
  it("rend un titre, une description et une canonique pour chaque commune", async () => {
    for (const city of cities) {
      const meta = await generateMetadata({ params: Promise.resolve({ ville: city.slug }) });
      expect(meta.title, city.slug).toBe(`Prix immobilier à ${city.name}`);
      expect(meta.alternates?.canonical, city.slug).toBe(cityPath(city.slug));
      expect(typeof meta.description).toBe("string");
      expect(meta.description ?? "", city.slug).toContain("ventes");
    }
  });

  it("garde les descriptions dans les longueurs utiles d'un extrait de résultat", () => {
    // En deçà de 120 signes, l'extrait est complété par le moteur avec ce
    // qu'il trouve ; au-delà de 165, il est coupé, et c'est toujours la fin.
    return Promise.all(
      cities.map(async (city) => {
        const meta = await generateMetadata({ params: Promise.resolve({ ville: city.slug }) });
        const description = meta.description ?? "";
        expect(description.length, `${city.slug} : ${description}`).toBeGreaterThanOrEqual(120);
        expect(description.length, `${city.slug} : ${description}`).toBeLessThanOrEqual(165);
      }),
    );
  });

  it("n'écrit ni tiret cadratin ni espace ordinaire devant la ponctuation double", async () => {
    for (const city of cities.slice(0, 25)) {
      const meta = await generateMetadata({ params: Promise.resolve({ ville: city.slug }) });
      const description = meta.description ?? "";
      expect(description, city.slug).not.toMatch(/[—–]/);
      expect(description, city.slug).not.toMatch(/ [:;!?]/);
    }
  });

  it("répond sobrement sur un slug inconnu, sans jeter", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ ville: "trifouillis" }) });
    expect(meta.title).toBe("Commune introuvable");
  });
});
