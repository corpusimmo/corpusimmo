/**
 * LE MAILLAGE : ce vers quoi une page ville envoie, et pourquoi.
 *
 * Une page programmatique sans liens sortants est un cul-de-sac : on y arrive
 * par une requête, on en repart par le bouton retour, et elle ne transmet
 * aucune autorité au reste du site. Les liens sont donc CALCULÉS et non
 * recopiés, pour qu'ils restent justes quand la sélection de communes change.
 */

import { getToolCard } from "@/data/tools-catalogue";
import type { ToolCard, ToolId } from "@/types/tool";

import type { CityAggregate } from "./types";

/** La racine des pages villes. Écrite ici, jamais ailleurs. */
export const CITIES_ROOT = "/prix-immobilier";

export function cityPath(slug: string): string {
  return `${CITIES_ROOT}/${slug}`;
}

/**
 * LE LIEN VERS L'ESTIMATEUR, ET CE QU'IL NE PRÉ-REMPLIT PAS.
 *
 * Le parcours d'estimation sait recevoir une adresse complète par l'URL
 * (`buildEstimatorHref`, dans `components/estimation/wizard-state.ts`) : la
 * barre de recherche de l'accueil s'en sert. Il serait techniquement facile de
 * lui passer ICI le centre de la commune comme adresse.
 *
 * On s'y refuse, et c'est la décision la plus importante de ce fichier.
 * Une adresse transmise par ce canal est marquée VALIDÉE : le parcours saute
 * l'étape d'adresse et calcule autour du point reçu. Passer le centroïde de la
 * commune reviendrait donc à estimer tous les biens de Nantes depuis la place
 * du Commerce. Or la page elle-même démontre l'inverse : la dispersion
 * intra-communale y est presque toujours plus large que l'écart entre deux
 * communes voisines. On enverrait le lecteur vers un chiffre que la page qu'il
 * vient de lire contredit.
 *
 * Le lien ne transmet donc que l'USAGE, qui est la première question du
 * parcours et la seule à laquelle une page « prix du logement » réponde
 * réellement. L'adresse exacte reste demandée, et la page le dit.
 */
export function estimatorHref(): string {
  return "/estimer?usage=residential";
}

/**
 * La carte des ventes.
 *
 * Elle ne lit aujourd'hui aucun paramètre d'URL : le centrage se fait par son
 * champ de recherche d'adresse. Le lien est donc nu, et le libellé de la page
 * ne promet pas un centrage qui n'aurait pas lieu.
 */
/**
 * La carte, centrée sur la commune quand on en a une.
 *
 * `/carte` lit `?commune=<code INSEE>` côté client après montage, et retrouve
 * le centre dans le référentiel figé des pages villes, sans appel réseau. Un
 * code inconnu est ignoré et la carte s'ouvre sur la France entière : mieux
 * vaut ça qu'un centre inventé. Sans code, le lien mène à la carte nue.
 */
export function mapHref(insee?: string): string {
  return insee ? `/carte?commune=${encodeURIComponent(insee)}` : "/carte";
}

/** La recherche tabulaire, pour qui veut les ventes ligne à ligne. */
export function transactionsHref(): string {
  return "/observatoire/transactions";
}

/**
 * LES TROIS OUTILS, LES MÊMES PARTOUT.
 *
 * On ne fait PAS varier cette liste selon la commune. Proposer le chiffrage de
 * travaux aux communes de maisons et la rentabilité locative aux communes
 * d'appartements aurait l'air fin et serait une recommandation que rien ne
 * fonde : DVF ne dit ni l'état des biens, ni l'intention des acheteurs. La
 * question posée par un lecteur de page ville est la même partout — que vaut
 * mon bien, combien me restera-t-il, qu'est-ce que ça rapporte — et ces trois
 * outils y répondent.
 */
const CITY_TOOL_IDS: readonly ToolId[] = ["avis-de-valeur", "net-vendeur", "rentabilite-locative"];

export function cityTools(): ToolCard[] {
  return CITY_TOOL_IDS.map((id) => getToolCard(id)).filter(
    (tool): tool is ToolCard => tool !== undefined,
  );
}

/** Le fil d'Ariane d'une page ville, sans niveau inventé. */
export function cityBreadcrumb(city: CityAggregate): { name: string; path: string }[] {
  return [
    { name: "Accueil", path: "/" },
    { name: "Prix immobilier", path: CITIES_ROOT },
    { name: city.name, path: cityPath(city.slug) },
  ];
}
