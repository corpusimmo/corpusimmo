/**
 * La fabrique de métadonnées, une seule pour tout le site.
 *
 * POURQUOI UNE FABRIQUE PLUTÔT QUE DIX OBJETS `Metadata`
 *   Une balise `og:` oubliée ne casse rien, ne lève aucune erreur, et ne se
 *   voit qu'au moment où quelqu'un partage le lien. C'est exactement le genre
 *   d'omission qu'un objet recopié de page en page produit, et exactement ce
 *   qu'une fonction empêche : ici, une page qui déclare un titre et une
 *   description obtient d'office la canonique, l'Open Graph complet et la carte
 *   Twitter, ou rien du tout.
 *
 * LA TYPOGRAPHIE EST NORMALISÉE ICI, ET NULLE PART AILLEURS
 *   Une chaîne de métadonnée n'est pas du JSX : `&nbsp;` y serait affiché tel
 *   quel dans l'onglet du navigateur et dans le résultat de recherche. Les
 *   espaces insécables sont donc posés en U+00A0 par `polishMetaText`, à partir
 *   d'un texte écrit avec des espaces ordinaires. On écrit du français normal,
 *   la fabrique se charge de la typographie.
 */

import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

/* -------------------------------------------------------------- typographie */

/**
 * La toilette d'une chaîne destinée à `<title>`, à `og:` ou à une méta-description.
 *
 * Deux corrections, et rien d'autre.
 *
 * 1. LE TIRET CADRATIN DISPARAÎT. Consigne éditoriale du propriétaire : il le
 *    tient pour la signature typique d'un texte produit par une machine. Les
 *    résumés d'outils, eux, sont écrits pour l'écran et en contiennent encore
 *    (voir `src/lib/tools/definitions.ts`) ; les recopier tels quels dans une
 *    description ferait entrer le tiret là où il est proscrit. On le remplace
 *    par la virgule, qui rend la même pause sans la même signature.
 *
 * 2. L'ESPACE AVANT LA PONCTUATION DOUBLE DEVIENT INSÉCABLE. C'est la règle
 *    française, et un `:` rejeté seul en début de ligne dans un extrait de
 *    résultat de recherche se remarque.
 */
const NBSP = "\u00a0";

export function polishMetaText(text: string): string {
  return (
    text
      .replace(/\s*[\u2014\u2013]\s*/g, ", ")
      // Le remplacement ci-dessus peut coller une virgule à une virgule déjà là.
      .replace(/,[ \u00a0]*,/g, ",")
      // L'espace insécable de la ponctuation double, posée en U+00A0 : une entité
      // HTML serait affichée telle quelle dans un onglet et dans un extrait de
      // résultat de recherche.
      .replace(/[ \u00a0]+([:;!?])/g, `${NBSP}$1`)
      .replace(/ {2,}/g, " ")
      .trim()
  );
}

/* ---------------------------------------------------------------- canoniques */

/**
 * L'URL absolue d'un chemin, sur le domaine canonique.
 *
 * L'apex `https://corpus.immo` fait foi, sans `www`, et il n'est jamais écrit
 * en dur ici : `siteConfig.url` le porte, et lui seul.
 */
export function canonicalUrl(path: string): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  return path === "/" ? `${base}/` : `${base}${path}`;
}

/* ------------------------------------------------------------------- titres */

/**
 * LE TITRE DE LA MARQUE, celui que porte l'accueil.
 *
 * Il vit ici plutôt que dans `layout.tsx` parce que deux fichiers en ont besoin
 * et doivent dire la même chose : le gabarit de titres de la mise en page
 * racine, et la page d'accueil elle-même. Écrit une fois, lu deux fois.
 *
 * Il tient sous soixante signes, ce qui est la seule contrainte réelle : un
 * titre plus long est coupé dans les résultats, et c'est toujours la fin qui
 * saute.
 */
export const SITE_TITLE = `${siteConfig.name}, estimation immobilière sur les ventes réelles`;

/**
 * La description de l'accueil.
 *
 * `siteConfig.description` fait plus de deux cents signes : c'est le bon texte
 * pour une carte de partage ou un pied de page, pas pour une méta-description,
 * qui est coupée autour de 160. Celle-ci dit la même chose, en plus court.
 */
export const SITE_DESCRIPTION =
  "Estimez un logement ou un local professionnel à partir des ventes réellement " +
  "enregistrées par la DGFiP, et explorez la carte des mutations DVF en France.";

/* ------------------------------------------------------------------ fabrique */

export interface PageMetaInput {
  /** Le titre de page, sans la marque : le gabarit de `layout.tsx` l'ajoute. */
  title: string;
  /** 150 à 160 signes, écrits pour une personne. Jamais une liste de mots-clés. */
  description: string;
  /** Chemin servi, sans domaine. « / » pour l'accueil. */
  path: string;
  /**
   * Le titre des partages sociaux. Par défaut, le titre de page suivi de la
   * marque : hors du site, « Estimer un bien immobilier » ne dit pas chez qui.
   */
  socialTitle?: string;
  /** Une description de partage plus courte, quand la méta-description est technique. */
  socialDescription?: string;
  /** `false` sort la page de l'index. Le sitemap le relit (voir `src/lib/seo/routes.ts`). */
  index?: boolean;
  /** `false` coupe aussi le suivi des liens. Réservé aux écrans d'authentification. */
  follow?: boolean;
  /**
   * `true` court-circuite le gabarit « %s · CorpusImmo ». Une seule page en a
   * besoin, l'accueil, dont le titre porte déjà la marque en tête.
   */
  absoluteTitle?: boolean;
}

/**
 * Les métadonnées complètes d'une page publique.
 *
 * `openGraph.images` n'est délibérément PAS renseigné : les images sociales
 * viennent de la convention de fichier (`opengraph-image.tsx`), et Next ne les
 * fusionne que si la page ne déclare pas ses propres images. En poser une ici
 * reviendrait à désactiver silencieusement l'image générée de la section.
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const title = polishMetaText(input.title);
  const description = polishMetaText(input.description);
  const socialTitle = polishMetaText(input.socialTitle ?? `${input.title} · ${siteConfig.name}`);
  const socialDescription = polishMetaText(input.socialDescription ?? input.description);
  const url = canonicalUrl(input.path);

  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: input.path },
    robots: { index: input.index ?? true, follow: input.follow ?? true },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      url,
      title: socialTitle,
      description: socialDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
    },
  };
}
