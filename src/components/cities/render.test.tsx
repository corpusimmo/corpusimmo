/**
 * LE CONTRÔLE DU RENDU, SUR LE HTML RÉELLEMENT PRODUIT.
 *
 * Les règles d'honnêteté de ces pages vivent dans `src/lib/cities`, et elles y
 * sont testées. Mais rien n'y garantit qu'une page les APPLIQUE : un composant
 * peut parfaitement afficher une médiane et oublier son effectif, ou rendre
 * lisible un chiffre que les seuils refusaient. Ce fichier vérifie donc la
 * sortie, pas les règles.
 *
 * Il remplace aussi, pour le peu qu'il peut, ce qu'un `pnpm build` dirait :
 * une erreur de rendu, un composant client tiré par erreur dans un arbre
 * serveur, une balise mal fermée.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import VillePage from "@/app/(site)/prix-immobilier/[ville]/page";
import PrixImmobilierPage from "@/app/(site)/prix-immobilier/page";
import { disclaimers } from "@/config/site";
import { canPublishFigure, publishedCities } from "@/lib/cities";
import { formatPricePerSqm } from "@/lib/utils/format";

/**
 * Un échantillon représentatif plutôt que les cent pages : Paris pour les
 * arrondissements, Nantes pour les codes postaux, Levallois pour un type de
 * bien à l'effectif limite, Saint-André pour la commune la moins fournie,
 * Pessac pour un marché à deux jambes.
 */
const SAMPLE = ["paris", "nantes", "levallois-perret", "saint-andre", "pessac"];

/**
 * Le texte visible, scripts et balises retirés.
 *
 * Toutes les espaces, insécables et fines comprises, sont ramenées à une espace
 * ordinaire : `Intl` sépare les milliers par une fine insécable (U+202F) et le
 * site pose des insécables devant la ponctuation double. Comparer des chaînes
 * sans cette normalisation ferait échouer le test sur une différence que
 * personne ne voit à l'écran. `normalize()` est donc appliqué DES DEUX CÔTÉS.
 */
function visibleText(html: string): string {
  return normalize(
    html
      .replace(/<script[^]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " "),
  );
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function renderCity(slug: string): Promise<string> {
  const element = await VillePage({ params: Promise.resolve({ ville: slug }) });
  return renderToStaticMarkup(element);
}

describe("la page d'une commune", () => {
  it("se rend sans erreur et nomme la commune", async () => {
    for (const slug of SAMPLE) {
      const html = await renderCity(slug);
      expect(html.length, slug).toBeGreaterThan(5000);
      expect(visibleText(html), slug).toContain("Prix immobilier à");
    }
  });

  it("affiche chaque médiane publiée, et l'effectif dans la même page", async () => {
    for (const slug of SAMPLE) {
      const city = publishedCities().find((entry) => entry.slug === slug);
      if (!city) throw new Error(`commune absente : ${slug}`);
      const text = visibleText(await renderCity(slug));

      for (const type of ["apartment", "house"] as const) {
        const figure = city.byType[type];
        if (canPublishFigure(figure)) {
          expect(text, `${slug}/${type}`).toContain(
            normalize(formatPricePerSqm(figure.median)),
          );
        } else {
          // Un type non publiable garde sa ligne, avec le motif du refus.
          expect(text, `${slug}/${type}`).toContain("Effectif insuffisant");
        }
      }
      expect(text, slug).toContain("ventes retenues");
    }
  });

  it("écrit toujours ce que la page ne dit pas", async () => {
    for (const slug of SAMPLE) {
      const text = visibleText(await renderCity(slug));
      expect(text, slug).toContain("Ce que cette page ne dit pas");
      expect(text, slug).toContain("hors Alsace-Moselle et Mayotte");
      expect(text, slug).toContain("ne constitue pas une expertise");
    }
  });

  it("n'écrit aucun tiret cadratin, hors la mention de source du site", async () => {
    // `disclaimers.dvfSource` en contient un et est repris tel quel, sur
    // consigne : c'est la seule exception, et elle est ici circonscrite.
    for (const slug of SAMPLE) {
      const text = visibleText(await renderCity(slug)).replace(
        normalize(disclaimers.dvfSource),
        " ",
      );
      const offenders = text.match(/.{40}[—–].{40}/g) ?? [];
      expect(offenders, slug).toEqual([]);
    }
  });

  it("ne laisse jamais un chiffre au m² sans le mot « ventes » à proximité", async () => {
    // Approximation volontaire : on ne peut pas prouver la proximité visuelle,
    // mais on peut refuser qu'un prix au m² apparaisse dans une phrase qui ne
    // parle d'aucun effectif. Le fenêtrage attrape le cas réel à craindre,
    // celui d'un bloc de chiffres nus ajouté plus tard.
    for (const slug of SAMPLE) {
      const text = visibleText(await renderCity(slug));
      const sentences = text.split(/(?<=[.!?]) /);
      const nakedFigures = sentences.filter(
        (sentence) => /€\/m²/.test(sentence) && !/vente|effectif|tranche|médian/i.test(sentence),
      );
      expect(nakedFigures, slug).toEqual([]);
    }
  });
});

describe("le sommaire", () => {
  const html = renderToStaticMarkup(PrixImmobilierPage());
  const text = visibleText(html);

  it("annonce chaque commune publiée avec un lien", () => {
    for (const city of publishedCities()) {
      expect(html, city.slug).toContain(`href="/prix-immobilier/${city.slug}"`);
      expect(text, city.slug).toContain(city.name);
    }
  });

  it("dit pourquoi certaines communes n'y sont pas", () => {
    expect(text).toContain("Strasbourg, Mulhouse et Metz");
    expect(text).toContain("livre foncier");
  });

  it("annonce les seuils plutôt que de les cacher", () => {
    expect(text).toContain("Un seuil, pas une page par commune");
    expect(text).toContain("Aucune prévision");
  });
});
