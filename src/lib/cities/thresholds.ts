/**
 * LES SEUILS. C'est ici que se décide ce qui a le droit d'être écrit.
 *
 * Ce module ne calcule aucune statistique : il en REFUSE. Toutes les fonctions
 * de ce fichier répondent à la même question, posée sur des objets différents :
 * l'effectif derrière ce chiffre est-il suffisant pour qu'un lecteur puisse s'y
 * fier ? Quand la réponse est non, elles rendent un refus explicite, jamais une
 * valeur dégradée. Une médiane approximative ressemble exactement à une médiane
 * juste, et c'est bien le problème.
 *
 * POURQUOI LES SEUILS SONT PLUS HAUTS QUE LE PLANCHER DU RESTE DU PRODUIT
 *   `src/lib/dvf/aggregate.ts` retient cinq mutations : c'est le plancher de
 *   secret statistique, le minimum en dessous duquel un agrégat identifierait
 *   presque une vente. Il répond à une question juridique, pas éditoriale.
 *   Une page qui prétend décrire le marché d'une commune répond à une autre
 *   question, et cinq ventes n'y suffisent pas.
 *
 * D'OÙ VIENNENT LES NOMBRES CI-DESSOUS
 *   L'intervalle de confiance à 95 % d'une médiane vaut environ
 *   ±1,58 × IQR / √n (la formule des encoches de boîtes à moustaches). Sur le
 *   prix au m² d'un type de logement dans une commune, l'écart interquartile
 *   relatif tourne autour de 0,35. On en tire directement :
 *
 *     n = 5   →  ±25 %   : une fourchette plus large que l'écart entre deux
 *                          communes voisines. Le chiffre ne dit rien.
 *     n = 30  →  ±10 %   : l'ordre de grandeur de la fourchette que publie
 *                          l'estimateur. En dessous, la médiane communale
 *                          serait plus bruitée que l'estimation qu'elle est
 *                          censée éclairer.
 *     n = 60  →  ±7 %
 *
 *   Un ÉCART entre deux millésimes est une différence de deux médianes : son
 *   incertitude vaut √2 fois celle d'une seule. Pour retrouver la précision
 *   d'un niveau à n = 30, il faut donc environ 60 mutations de chaque côté.
 *   D'où les deux seuils, et leur rapport du simple au double.
 */

import type {
  CityAggregate,
  CityFigure,
  CityPropertyType,
  CitySector,
  CityYearFigure,
} from "./types";

/* --------------------------------------------------------- publier une page */

/**
 * Mutations de logement (vente de gré à gré, lot unique) exigées pour qu'une
 * commune ait une page.
 *
 * 250 sur cinq millésimes, soit une cinquantaine de ventes par an. C'est le
 * volume à partir duquel au moins un type de bien atteint les 30 mutations
 * annuelles nécessaires à une médiane lisible, et à partir duquel une page a
 * quelque chose à raconter d'autre qu'un seul chiffre. En dessous, la commune
 * n'a pas de page : ni page vide, ni page « données insuffisantes » qui
 * capterait la requête sans y répondre.
 */
export const MIN_CITY_DWELLING_SALES = 250;

/** Effectif minimal pour publier une médiane au m². Voir l'en-tête. */
export const MIN_FIGURE_SAMPLE = 30;

/**
 * Effectif minimal pour publier les déciles.
 *
 * Un décile calculé sur 30 valeurs repose sur trois observations : il bouge
 * d'une vente à l'autre. Les quartiles, eux, tiennent dès 30.
 */
export const MIN_DECILE_SAMPLE = 100;

/** Effectif minimal, de CHAQUE côté, pour comparer deux millésimes. */
export const MIN_EVOLUTION_SAMPLE = 60;

/** Effectif minimal d'un secteur pour qu'il figure au découpage. */
export const MIN_SECTOR_SAMPLE = 40;

/** En dessous de trois secteurs, un « découpage » est une opposition. */
export const MIN_SECTOR_COUNT = 3;

/**
 * Part des ventes de la commune que les secteurs retenus doivent couvrir.
 *
 * Un découpage qui laisse 60 % des ventes hors cadre ne décrit pas la commune :
 * il décrit trois quartiers, et le lecteur croira lire la commune.
 */
export const MIN_SECTOR_COVERAGE = 0.6;

/** Le facteur des encoches : demi-largeur ≈ 1,58 × IQR / √n. */
const MEDIAN_CI_FACTOR = 1.58;

/* ------------------------------------------------------ une page existe-t-elle */

export type CityRefusal =
  | { kind: "too_few_sales"; sales: number; required: number }
  | { kind: "no_publishable_type" };

/**
 * Pourquoi cette commune n'a pas de page, ou `null` si elle en a une.
 *
 * Deux conditions, et les deux comptent : assez de ventes en tout, ET au moins
 * un type de bien dont la médiane tienne. Une commune de 300 ventes réparties
 * en 150 appartements et 150 maisons publie deux médianes ; une commune de 300
 * ventes dont 280 dépendances n'en publie aucune, et n'a donc rien à dire.
 */
export function cityRefusal(city: CityAggregate): CityRefusal | null {
  if (city.dwellingSales < MIN_CITY_DWELLING_SALES) {
    return {
      kind: "too_few_sales",
      sales: city.dwellingSales,
      required: MIN_CITY_DWELLING_SALES,
    };
  }
  const types: CityPropertyType[] = ["apartment", "house"];
  if (!types.some((type) => canPublishFigure(city.byType[type]))) {
    return { kind: "no_publishable_type" };
  }
  return null;
}

export function isPublishableCity(city: CityAggregate): boolean {
  return cityRefusal(city) === null;
}

/* ------------------------------------------------------------- les chiffres */

export function canPublishFigure(figure: CityFigure | undefined): boolean {
  return (
    figure !== undefined && figure.sample >= MIN_FIGURE_SAMPLE && figure.median !== undefined
  );
}

export function canPublishQuartiles(figure: CityFigure | undefined): boolean {
  return canPublishFigure(figure) && figure?.q1 !== undefined && figure?.q3 !== undefined;
}

export function canPublishDeciles(figure: CityFigure | undefined): boolean {
  return (
    figure !== undefined &&
    figure.sample >= MIN_DECILE_SAMPLE &&
    figure.d1 !== undefined &&
    figure.d9 !== undefined
  );
}

/* ------------------------------------------------------------- l'évolution */

export type EvolutionRefusal =
  | "no_complete_pair" // moins de deux millésimes complets
  | "sample" // au moins un des deux millésimes est trop mince
  | "no_median"; // une médiane manque

export interface EvolutionPeriod {
  year: number;
  sample: number;
  median: number;
}

export type CityEvolution =
  | { status: "unavailable"; reason: EvolutionRefusal }
  /**
   * L'écart existe mais ne dépasse pas l'incertitude des deux médianes. On
   * l'affiche quand même, avec sa marge, et on écrit qu'on ne conclut pas.
   * Le taire serait aussi malhonnête que de le présenter comme une tendance.
   */
  | {
      status: "inconclusive";
      from: EvolutionPeriod;
      to: EvolutionPeriod;
      changePercent: number;
      marginPercent: number;
    }
  | {
      status: "conclusive";
      from: EvolutionPeriod;
      to: EvolutionPeriod;
      changePercent: number;
      marginPercent: number;
      direction: "up" | "down";
    };

/**
 * L'évolution entre les DEUX DERNIERS MILLÉSIMES COMPLETS.
 *
 * Trois refus, dans cet ordre :
 *   1. il faut deux millésimes complets. Le millésime en cours est toujours
 *      partiel (DVF publie deux fois par an avec six mois de retard) : le
 *      comparer à une année pleine ferait apparaître un effondrement du marché
 *      qui n'est qu'un calendrier de publication ;
 *   2. il faut `MIN_EVOLUTION_SAMPLE` mutations de chaque côté ;
 *   3. l'écart doit dépasser l'incertitude combinée des deux médianes.
 *      Sinon la variation est publiée comme non concluante, avec sa marge.
 *
 * Aucune projection, aucune extrapolation, aucun « + 3,2 % sur un an » calculé
 * sur autre chose que deux millésimes complets réellement observés.
 */
export function evolutionOf(years: readonly CityYearFigure[]): CityEvolution {
  const complete = years
    .filter((entry) => !entry.partial)
    .sort((a, b) => a.year - b.year);

  const to = complete[complete.length - 1];
  const from = complete[complete.length - 2];
  if (!from || !to) return { status: "unavailable", reason: "no_complete_pair" };

  if (from.sample < MIN_EVOLUTION_SAMPLE || to.sample < MIN_EVOLUTION_SAMPLE) {
    return { status: "unavailable", reason: "sample" };
  }
  if (from.median === undefined || to.median === undefined || from.median <= 0) {
    return { status: "unavailable", reason: "no_median" };
  }

  const changePercent = ((to.median - from.median) / from.median) * 100;
  const marginPercent = combinedMarginPercent(from, to);

  const periods = {
    from: { year: from.year, sample: from.sample, median: from.median },
    to: { year: to.year, sample: to.sample, median: to.median },
  };

  if (Math.abs(changePercent) <= marginPercent) {
    return { status: "inconclusive", ...periods, changePercent, marginPercent };
  }

  return {
    status: "conclusive",
    ...periods,
    changePercent,
    marginPercent,
    direction: changePercent > 0 ? "up" : "down",
  };
}

/**
 * La marge d'incertitude de l'écart, en pourcentage de la médiane de départ.
 *
 * Demi-largeur de l'intervalle à 95 % d'une médiane : 1,58 × IQR / √n. Les deux
 * millésimes étant indépendants, les incertitudes se composent en racine de la
 * somme des carrés, et non en somme.
 *
 * Quand les quartiles manquent, on retombe sur une marge forfaitaire de 5 % :
 * assumer une incertitude nulle serait le seul choix vraiment faux.
 */
function combinedMarginPercent(from: CityYearFigure, to: CityYearFigure): number {
  const base = from.median;
  if (base === undefined || base <= 0) return Number.POSITIVE_INFINITY;

  const half = (entry: CityYearFigure): number | undefined => {
    if (entry.q1 === undefined || entry.q3 === undefined || entry.sample <= 0) return undefined;
    return (MEDIAN_CI_FACTOR * (entry.q3 - entry.q1)) / Math.sqrt(entry.sample);
  };

  const halfFrom = half(from);
  const halfTo = half(to);
  if (halfFrom === undefined || halfTo === undefined) return 5;

  return (Math.sqrt(halfFrom * halfFrom + halfTo * halfTo) / base) * 100;
}

/* ---------------------------------------------------------------- secteurs */

/**
 * Les secteurs affichables, ou `null` quand le découpage ne tient pas.
 *
 * Trois conditions cumulatives : chaque secteur retenu porte au moins
 * `MIN_SECTOR_SAMPLE` mutations, il en reste au moins `MIN_SECTOR_COUNT`, et
 * l'ensemble couvre au moins `MIN_SECTOR_COVERAGE` des ventes de la commune.
 * La troisième est la moins évidente et la plus importante : trois quartiers
 * denses dans une commune étalée donneraient à lire « les prix à Untel » alors
 * qu'ils ne parlent que du centre.
 */
export function publishableSectors(city: CityAggregate): CitySector[] | null {
  const sectors = city.sectors;
  if (!sectors) return null;

  const kept = sectors.entries.filter(
    (entry) => entry.sample >= MIN_SECTOR_SAMPLE && entry.median !== undefined,
  );
  if (kept.length < MIN_SECTOR_COUNT) return null;
  if (sectorCoverage(city) < MIN_SECTOR_COVERAGE) return null;

  return [...kept].sort((a, b) => (b.median ?? 0) - (a.median ?? 0));
}

/**
 * La part des ventes de logement que couvrent les secteurs RETENUS.
 *
 * Recalculée ici plutôt que stockée : elle dépend de `MIN_SECTOR_SAMPLE`, donc
 * d'une règle éditoriale, et une règle éditoriale ne se fige pas dans un
 * fichier de données (voir l'en-tête de `types.ts`).
 */
export function sectorCoverage(city: CityAggregate): number {
  const sectors = city.sectors;
  if (!sectors || sectors.dwellingSample <= 0) return 0;
  const covered = sectors.entries
    .filter((entry) => entry.sample >= MIN_SECTOR_SAMPLE && entry.median !== undefined)
    .reduce((sum, entry) => sum + entry.sample, 0);
  return covered / sectors.dwellingSample;
}

/* ------------------------------------------------------------- les séries */

/** Points minimaux pour qu'une courbe annuelle vaille d'être tracée. */
export const MIN_SERIES_POINTS = 3;

/**
 * Les millésimes traçables : complets, et assez fournis pour porter une
 * médiane.
 *
 * Une courbe est plus persuasive qu'un tableau, et c'est précisément le
 * problème : un point calculé sur douze ventes se lit comme les autres, alors
 * qu'il bouge de plusieurs centaines d'euros au m² pour une vente de plus. On
 * ne trace donc que les années qui franchissent le même seuil qu'une médiane
 * publiée, et l'appelant n'affiche rien en dessous de `MIN_SERIES_POINTS`.
 */
export function plottableYears(years: readonly CityYearFigure[]): CityYearFigure[] {
  return years.filter(
    (entry) => !entry.partial && entry.sample >= MIN_FIGURE_SAMPLE && entry.median !== undefined,
  );
}
