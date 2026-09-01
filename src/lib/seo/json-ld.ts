/**
 * Les données structurées, typées et bornées à ce que le site montre vraiment.
 *
 * LA RÈGLE, ET ELLE EST SIMPLE
 *   Un balisage décrit ce qui est À L'ÉCRAN. Déclarer une FAQ qu'aucun visiteur
 *   ne voit, une note moyenne que personne n'a donnée ou un jeu de données que
 *   la page ne publie pas, c'est se faire retirer les résultats enrichis, et
 *   c'est surtout dire à Google l'inverse de ce qu'on dit à ses lecteurs. Ce
 *   projet s'interdit les fausses promesses sur les prix ; la même règle vaut
 *   ici.
 *
 * CE QUI EST DÉLIBÉRÉMENT ABSENT
 *   · `SearchAction` sur `WebSite`. Il n'y a AUCUNE recherche à l'échelle du
 *     site : le champ de la bibliothèque d'outils filtre dix cartes dans le
 *     navigateur, sans URL de résultats. Déclarer un point d'entrée de
 *     recherche qui n'existe pas ne produit rien de bon.
 *   · `Dataset` sur l'observatoire. La page rend un OUTIL, pas un jeu de
 *     données : côté serveur, elle n'affiche aucune mutation (voir
 *     `docs/routes.md`). Le jeu de données, lui, appartient à la DGFiP et vit
 *     sur data.gouv.fr. Le revendiquer serait faux deux fois.
 *   · `AggregateRating` et `Review`. Personne n'a noté quoi que ce soit.
 *   · `FAQPage` sur les pages actuelles : aucune ne présente de questions et
 *     de réponses visibles. Le constructeur existe (`faqNode`) pour le jour où
 *     une page en affichera réellement, et pas avant.
 */

import { siteConfig } from "@/config/site";

import { canonicalUrl } from "./metadata";

/* ------------------------------------------------------------------- typage */

export type JsonLdPrimitive = string | number | boolean | null;

export type JsonLdValue = JsonLdPrimitive | readonly JsonLdValue[] | JsonLdObject;

export interface JsonLdObject {
  readonly [key: string]: JsonLdValue | undefined;
}

/** Un nœud schema.org. `@type` est obligatoire : sans lui, rien n'est lu. */
export interface JsonLdNode extends JsonLdObject {
  readonly "@type": string | readonly string[];
}

/* ------------------------------------------------------------ sérialisation */

/**
 * Le JSON, rendu sûr à l'intérieur d'une balise `<script>`.
 *
 * Une chaîne contenant `</script>` refermerait la balise et le reste
 * deviendrait du HTML exécutable. `JSON.stringify` ne protège pas de ça : c'est
 * du JSON valide, mais du HTML dangereux. On échappe donc `<`, `>` et `&` en
 * séquences `\uXXXX`, qui restent du JSON strictement équivalent, ainsi que les
 * séparateurs de ligne U+2028 et U+2029 qu'un analyseur JavaScript refuse.
 */
export function serializeJsonLd(value: JsonLdValue): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Un document JSON-LD à partir d'un ou plusieurs nœuds.
 *
 * Plusieurs nœuds sont réunis dans un `@graph` plutôt que dans autant de
 * balises `<script>` : c'est ce qui permet à un nœud d'en référencer un autre
 * par son `@id` sans le redécrire.
 */
export function jsonLdDocument(nodes: readonly JsonLdNode[]): JsonLdObject {
  const [only] = nodes;
  if (nodes.length === 1 && only) {
    return { "@context": "https://schema.org", ...only };
  }
  return { "@context": "https://schema.org", "@graph": nodes };
}

/* ---------------------------------------------------------------- identités */

/** Les deux `@id` stables du site. Tout le reste s'y rattache. */
export const ORGANIZATION_ID = `${canonicalUrl("/")}#organization`;
export const WEBSITE_ID = `${canonicalUrl("/")}#website`;

/**
 * L'éditeur.
 *
 * Ni adresse postale, ni numéro de téléphone, ni identifiant d'entreprise : ils
 * ne figurent pas non plus sur la page des mentions légales, et un balisage ne
 * doit rien affirmer que le site ne dit pas.
 */
export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: canonicalUrl("/"),
    email: siteConfig.contactEmail,
    // Le logotype est servi par la convention de fichier de Next, à cette URL
    // exacte. C'est un SVG : certains agrégateurs préfèrent un bitmap, aucun ne
    // le refuse.
    logo: canonicalUrl("/icon.svg"),
    slogan: siteConfig.signature,
    description: siteConfig.description,
  };
}

export function webSiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteConfig.name,
    url: canonicalUrl("/"),
    inLanguage: "fr-FR",
    description: siteConfig.description,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/* ------------------------------------------------------------- applications */

export interface WebApplicationInput {
  name: string;
  description: string;
  /** Chemin de la page, sans domaine. */
  path: string;
  /**
   * Catégorie schema.org. `FinanceApplication` pour tout ce qui calcule de
   * l'argent, `BusinessApplication` pour les écrans d'analyse de marché.
   */
  category: "FinanceApplication" | "BusinessApplication";
  /**
   * `true` seulement si l'outil s'utilise SANS AUCUNE porte : ni compte, ni
   * quota. C'est le cas de l'estimateur, de la carte et de l'observatoire ; ce
   * n'est plus celui des dix calculateurs, qui demandent une connexion. Une
   * connexion gratuite reste gratuite, mais elle n'est pas un accès libre, et
   * la propriété est alors simplement OMISE plutôt que mise à `false` : `false`
   * signale un paywall, ce qui serait faux dans l'autre sens.
   */
  accessibleForFree?: boolean;
}

/**
 * Un outil, une carte, un estimateur : ce sont des applications web, pas des
 * articles.
 *
 * `offers` à zéro euro n'est pas un artifice de balisage : rien n'est vendu ici,
 * aucun paiement n'est demandé nulle part sur le site, et c'est vrai des dix
 * calculateurs comme du reste. `isAccessibleForFree` dit autre chose, et n'est
 * donc posé que là où c'est vrai (voir `accessibleForFree`).
 */
export function webApplicationNode(input: WebApplicationInput): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": `${canonicalUrl(input.path)}#application`,
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.path),
    applicationCategory: input.category,
    operatingSystem: "Web",
    browserRequirements: "JavaScript",
    inLanguage: "fr-FR",
    ...(input.accessibleForFree ? { isAccessibleForFree: true } : {}),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

/* ------------------------------------------------------------- fil d'Ariane */

export interface BreadcrumbItem {
  name: string;
  /** Chemin de la page, sans domaine. */
  path: string;
}

/**
 * Le fil d'Ariane des pages profondes.
 *
 * Il n'invente pas de niveau : chaque entrée correspond à une page qui existe
 * et vers laquelle la page courante propose réellement un lien, en haut de
 * l'écran (« Tous les outils », « Toutes les solutions »).
 */
export function breadcrumbNode(items: readonly BreadcrumbItem[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

/* -------------------------------------------------------------- liste d'outils */

export interface ItemListEntry {
  name: string;
  path: string;
  description: string;
}

/**
 * La bibliothèque d'outils, décrite comme la liste qu'elle est.
 *
 * `ItemList` ne produit pas de résultat enrichi à lui seul, et ce n'est pas ce
 * qu'on lui demande : il dit simplement à un moteur que cette page est un
 * sommaire et où mènent ses dix entrées.
 */
export function itemListNode(name: string, entries: readonly ItemListEntry[]): JsonLdNode {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      description: entry.description,
      url: canonicalUrl(entry.path),
    })),
  };
}

/* ------------------------------------------------------------------- la FAQ */

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * INUTILISÉ À CE JOUR, ET C'EST VOLONTAIRE.
 *
 * Aucune page du site n'affiche aujourd'hui de questions-réponses. Baliser une
 * FAQ absente de l'écran est une infraction explicite aux règles de Google, et
 * la sanction porte sur tout le domaine, pas sur la page.
 *
 * Le constructeur est là pour le jour où une page en affichera vraiment (le
 * blog en cours de livraison, par exemple). Règle d'emploi : les couples
 * passés ici doivent être EXACTEMENT ceux rendus dans le HTML de la page, mot
 * pour mot.
 */
export function faqNode(entries: readonly FaqEntry[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}
