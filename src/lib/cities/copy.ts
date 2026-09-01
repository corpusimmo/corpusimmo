/**
 * LA RÉDACTION DES PAGES VILLES.
 *
 * CE QUE CE MODULE N'EST PAS
 *   Ce n'est pas un gabarit à trous. Un gabarit produit cent pages identiques à
 *   un nom et trois nombres près, et Google les traite pour ce qu'elles sont :
 *   du contenu dupliqué. Chaque fonction ci-dessous branche sur ce que les
 *   chiffres DISENT, et chaque branche est une phrase écrite pour ce cas-là.
 *
 *   Une commune où il ne se vend que des appartements, un marché resserré et
 *   une baisse mesurée n'obtient pas les mêmes phrases qu'une commune de
 *   maisons, très dispersée, sur laquelle on refuse de conclure. Trois axes à
 *   trois ou quatre branches suffisent à ce qu'aucune paire de pages ne se
 *   ressemble, sans jamais écrire une phrase que les chiffres ne portent pas.
 *
 * LA TYPOGRAPHIE EST APPLIQUÉE ICI, PAS DANS LE JSX
 *   `polish()` pose les espaces insécables et interdit le tiret cadratin, en
 *   réutilisant la normalisation déjà écrite pour les métadonnées. Une phrase
 *   qui sort d'ici est prête à être rendue telle quelle.
 */

import { polishMetaText } from "@/lib/seo/metadata";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";

import { canPublishFigure, type CityEvolution } from "./thresholds";
import type { CityAggregate, CityFigure, CityPropertyType, CitySector } from "./types";

const NBSP = "\u00a0";

/**
 * La toilette d'une phrase destinée à l'écran.
 *
 * Elle réutilise `polishMetaText` (tiret cadratin proscrit, insécable avant la
 * ponctuation double) et ajoute l'insécable avant le signe pourcent, que les
 * métadonnées n'emploient pas.
 */
export function polish(text: string): string {
  return polishMetaText(text).replace(/[ \u00a0\u202f]+%/g, `${NBSP}%`);
}

export const TYPE_LABELS: Record<CityPropertyType, { singular: string; plural: string }> = {
  apartment: { singular: "appartement", plural: "appartements" },
  house: { singular: "maison", plural: "maisons" },
};

/**
 * « d'appartements » ou « de maisons ».
 *
 * L'élision n'est pas un détail de style : « ventes de appartements » est la
 * signature d'un gabarit à trous, et c'est exactement ce que ces pages
 * s'interdisent d'avoir l'air d'être.
 */
export function ofPlural(type: CityPropertyType): string {
  const plural = TYPE_LABELS[type].plural;
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(plural) ? `d'${plural}` : `de ${plural}`;
}

/** « de 2021 à 2025 », ou « en 2024 » quand un seul millésime est couvert. */
export function periodLabel(city: CityAggregate): string {
  const first = city.years[0];
  const last = city.years[city.years.length - 1];
  if (first === undefined || last === undefined) return "sur la période couverte";
  return first === last ? `en ${first}` : `de ${first} à ${last}`;
}

/* ------------------------------------------------------------ le marché */

type MarketShape = "apartment_led" | "house_led" | "mixed";

export function marketShape(city: CityAggregate): MarketShape {
  const flats = city.byType.apartment.total;
  const houses = city.byType.house.total;
  const total = flats + houses;
  if (total === 0) return "mixed";
  const share = flats / total;
  if (share >= 0.7) return "apartment_led";
  if (share <= 0.3) return "house_led";
  return "mixed";
}

/**
 * Le paragraphe d'ouverture. Trois rédactions, selon ce que la commune vend.
 *
 * Le nombre de ventes y figure avant le prix, et c'est délibéré : c'est lui qui
 * dit au lecteur quel crédit accorder à ce qui suit.
 */
export function marketParagraph(city: CityAggregate): string {
  const flats = city.byType.apartment;
  const houses = city.byType.house;
  const period = periodLabel(city);
  const total = formatNumber(city.dwellingSales);

  switch (marketShape(city)) {
    case "apartment_led":
      return polish(
        `${city.name} vend des appartements : ${formatNumber(flats.total)} des ` +
          `${total} ventes de logement enregistrées ${period} portent sur un appartement, ` +
          `contre ${formatNumber(houses.total)} sur une maison. Ce que dit cette page vaut ` +
          `donc d'abord pour le collectif ; la maison y reste un marché de report, et ses ` +
          `chiffres sont à lire avec l'effectif qui les accompagne.`,
      );
    case "house_led":
      return polish(
        `À ${city.name}, le logement se vend surtout en maison : ` +
          `${formatNumber(houses.total)} ventes sur ${total} enregistrées ${period}, contre ` +
          `${formatNumber(flats.total)} appartements. Un prix au m² y recouvre des biens très ` +
          `différents, du pavillon de lotissement à la maison de bourg, et la dispersion ` +
          `plus bas en dit davantage que la seule médiane.`,
      );
    default:
      return polish(
        `${city.name} a deux marchés du logement plutôt qu'un : ` +
          `${formatNumber(flats.total)} ventes d'appartements et ` +
          `${formatNumber(houses.total)} ventes de maisons enregistrées ${period}. ` +
          `Les deux se comportent rarement pareil, et cette page les tient séparés : ` +
          `mélanger un studio et un pavillon dans une même médiane ne décrit ni l'un ni ` +
          `l'autre.`,
      );
  }
}

/* --------------------------------------------------------- la dispersion */

export type DispersionBand = "tight" | "moderate" | "wide" | "unknown";

/**
 * L'écart interquartile RELATIF : (Q3 − Q1) / médiane.
 *
 * Sans dénominateur, un écart de 900 €/m² ne veut rien dire : c'est énorme à
 * Saint-Étienne, c'est étroit à Paris. Le rapport, lui, se compare d'une
 * commune à l'autre.
 */
export function relativeSpread(figure: CityFigure): number | undefined {
  if (figure.q1 === undefined || figure.q3 === undefined) return undefined;
  if (figure.median === undefined || figure.median <= 0) return undefined;
  return (figure.q3 - figure.q1) / figure.median;
}

export function dispersionBand(figure: CityFigure): DispersionBand {
  const spread = relativeSpread(figure);
  if (spread === undefined) return "unknown";
  if (spread < 0.25) return "tight";
  if (spread < 0.45) return "moderate";
  return "wide";
}

/**
 * Ce que la dispersion dit du marché. Trois rédactions, plus un refus.
 *
 * C'est la phrase la plus utile de la page, et celle qu'aucun agrégateur
 * n'écrit : une médiane seule laisse croire que la moitié des biens vaut à peu
 * près ce prix, alors qu'elle dit seulement qu'une vente sur deux est passée
 * au-dessus.
 */
export function dispersionParagraph(
  city: CityAggregate,
  type: CityPropertyType,
): string | null {
  const figure = city.byType[type];
  if (!canPublishFigure(figure) || figure.q1 === undefined || figure.q3 === undefined) {
    return null;
  }

  const label = TYPE_LABELS[type].plural;
  const of = ofPlural(type);
  const q1 = formatPricePerSqm(figure.q1);
  const q3 = formatPricePerSqm(figure.q3);
  const sample = formatNumber(figure.sample);

  switch (dispersionBand(figure)) {
    case "tight":
      return polish(
        `Le marché des ${label} est resserré : la moitié centrale des ` +
          `${sample} ventes retenues se situe entre ${q1} et ${q3}. Un écart aussi faible ` +
          `signale un parc homogène, où la médiane est effectivement représentative de ce ` +
          `qui se vend.`,
      );
    case "moderate":
      return polish(
        `La moitié centrale des ${sample} ventes ${of} se situe entre ${q1} et ` +
          `${q3}. L'écart est celui d'une commune où l'adresse et l'état du bien pèsent ` +
          `autant que la surface : deux biens de même taille peuvent légitimement se ` +
          `vendre à un tiers d'écart.`,
      );
    case "wide":
      return polish(
        `Le marché des ${label} est très étalé : entre ${q1} et ${q3} pour la moitié ` +
          `centrale des ${sample} ventes retenues, et davantage aux extrêmes. Une médiane ` +
          `communale n'y sert qu'à situer un ordre de grandeur ; à ce niveau de dispersion, ` +
          `le secteur et l'état du bien décident du prix bien plus que la commune.`,
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------- l'évolution */

/**
 * L'évolution, y compris quand il n'y en a pas à publier.
 *
 * Les quatre branches comptent autant l'une que l'autre : refuser de conclure
 * est un résultat, et l'écrire vaut mieux que laisser un blanc dans lequel le
 * lecteur mettra ce qu'il veut.
 */
export function evolutionParagraph(
  city: CityAggregate,
  type: CityPropertyType,
  evolution: CityEvolution,
): string {
  const label = TYPE_LABELS[type].plural;

  if (evolution.status === "unavailable") {
    switch (evolution.reason) {
      case "no_complete_pair":
        return polish(
          `Aucune évolution n'est publiée pour les ${label} de ${city.name} : il faut deux ` +
            `millésimes complets pour comparer deux médianes, et la couverture DVF ` +
            `disponible ici n'en offre pas deux.`,
        );
      case "sample":
        return polish(
          `Aucune évolution n'est publiée pour les ${label} de ${city.name}. Comparer deux ` +
            `médianes annuelles demande au moins 60 ventes de chaque côté ; en dessous, ` +
            `l'écart mesuré tient davantage à l'échantillon qu'au marché.`,
        );
      default:
        return polish(
          `Aucune évolution n'est publiée pour les ${label} de ${city.name} : l'un des deux ` +
            `millésimes comparés ne porte pas de médiane exploitable.`,
        );
    }
  }

  const from = `${formatPricePerSqm(evolution.from.median)} en ${evolution.from.year}`;
  const to = `${formatPricePerSqm(evolution.to.median)} en ${evolution.to.year}`;
  const counts =
    `${formatNumber(evolution.from.sample)} et ${formatNumber(evolution.to.sample)} ventes`;
  const change = signedPercent(evolution.changePercent);

  if (evolution.status === "inconclusive") {
    return polish(
      `La médiane des ${label} passe de ${from} à ${to}, soit ${change}. Nous n'en tirons ` +
        `aucune tendance : calculé sur ${counts}, l'écart reste dans la marge ` +
        `d'incertitude des deux médianes (± ${formatDecimal(evolution.marginPercent)} %). ` +
        `Un mouvement de cette taille peut n'être que la composition des biens vendus ` +
        `d'une année sur l'autre.`,
    );
  }

  if (evolution.direction === "down") {
    return polish(
      `La médiane des ${label} recule, de ${from} à ${to}, soit ${change}. L'écart est ` +
        `calculé sur ${counts}, et il dépasse la marge d'incertitude des deux médianes ` +
        `(± ${formatDecimal(evolution.marginPercent)} %) : le mouvement est mesuré, pas ` +
        `supposé. Il porte sur deux millésimes complets, et ne dit rien de l'année en cours.`,
    );
  }

  return polish(
    `La médiane des ${label} progresse, de ${from} à ${to}, soit ${change}. L'écart est ` +
      `calculé sur ${counts} et dépasse la marge d'incertitude des deux médianes ` +
      `(± ${formatDecimal(evolution.marginPercent)} %). Il décrit deux millésimes complets ` +
      `déjà enregistrés : nous ne prolongeons aucune courbe au-delà.`,
  );
}

/* ------------------------------------------------------------ la comparaison */

/**
 * La commune comparée à sa voisine la plus peuplée, sur le même type de bien.
 *
 * C'est la phrase qui rend chaque page singulière, et c'est aussi la seule
 * comparaison qu'on s'autorise : deux médianes calculées de la même façon, sur
 * la même période, avec les deux effectifs affichés. Aucun classement, aucun
 * palmarès, aucune moyenne départementale que nous n'avons pas calculée.
 */
export function comparisonSentence(
  city: CityAggregate,
  neighbours: readonly CityAggregate[],
  type: CityPropertyType,
): string | null {
  const own = city.byType[type];
  if (!canPublishFigure(own) || own.median === undefined) return null;

  const other = neighbours.find((candidate) => canPublishFigure(candidate.byType[type]));
  const otherFigure = other?.byType[type];
  if (!other || !otherFigure?.median) return null;

  const gap = ((own.median - otherFigure.median) / otherFigure.median) * 100;
  const label = TYPE_LABELS[type].plural;
  const ownText = `${formatPricePerSqm(own.median)} sur ${formatNumber(own.sample)} ventes`;
  const otherText =
    `${formatPricePerSqm(otherFigure.median)} sur ${formatNumber(otherFigure.sample)} ventes`;

  if (Math.abs(gap) < 3) {
    return polish(
      `Sur les ${label}, ${city.name} et ${other.name} se tiennent : ${ownText} contre ` +
        `${otherText}, soit un écart inférieur à 3 %.`,
    );
  }

  const direction = gap > 0 ? "au-dessus" : "en dessous";
  return polish(
    `Sur les ${label}, ${city.name} se situe ${formatDecimal(Math.abs(gap))} % ${direction} ` +
      `de ${other.name}, sa voisine la plus proche couverte ici : ${ownText}, contre ` +
      `${otherText}.`,
  );
}

/* --------------------------------------------------------------- secteurs */

export function sectorParagraph(
  city: CityAggregate,
  sectors: readonly CitySector[],
  coverage: number,
): string {
  const share = Math.round(coverage * 100);
  const highest = sectors[0];
  const lowest = sectors[sectors.length - 1];

  if (city.sectors?.kind === "arrondissement" && highest && lowest) {
    return polish(
      `DVF publie un fichier par arrondissement à ${city.name} : le découpage ci-dessous ` +
        `n'est donc pas une approximation, c'est la donnée elle-même. Le plus cher, ` +
        `${highest.label}, ressort à ${formatPricePerSqm(highest.median)} sur ` +
        `${formatNumber(highest.sample)} ventes ; le plus abordable, ${lowest.label}, à ` +
        `${formatPricePerSqm(lowest.median)} sur ${formatNumber(lowest.sample)} ventes. ` +
        `L'écart interne dépasse celui qui sépare beaucoup de communes voisines. Les ` +
        `arrondissements retenus couvrent ${share} % des ventes de logement exploitables.`,
    );
  }

  const range =
    highest && lowest
      ? `Le plus cher, ${highest.label}, ressort à ${formatPricePerSqm(highest.median)} sur ` +
        `${formatNumber(highest.sample)} ventes ; le plus abordable, ${lowest.label}, à ` +
        `${formatPricePerSqm(lowest.median)} sur ${formatNumber(lowest.sample)} ventes. `
      : "";

  return polish(
    `DVF ne publie pas de quartiers. Le seul découpage infra-communal que la donnée ` +
      `contient est le code postal, qui est un secteur de distribution du courrier et non ` +
      `un quartier : il ne suit ni les limites d'un centre-ville, ni celles d'un ` +
      `lotissement. Nous l'affichons pour ce qu'il est, faute de mieux, et sans lui donner ` +
      `de nom. ${range}Les secteurs retenus couvrent ${share} % des ventes de logement ` +
      `exploitables de ${city.name}.`,
  );
}

/* ------------------------------------------------------- couverture et limites */

/**
 * Ce que le chiffrage NE couvre PAS, dit sur la page plutôt que dans une note.
 *
 * Trois faits, tous vérifiables dans le jeu de données : le nombre de mutations
 * écartées à la normalisation, les millésimes incomplets, et la date de
 * régénération.
 */
export function coverageParagraph(city: CityAggregate, generatedAt: string): string {
  const dropped = Math.max(0, city.mutationsFound - city.mutationsKept);
  const partial =
    city.partialYears.length > 0
      ? `Le ou les millésimes ${city.partialYears.join(", ")} sont incomplets et sont ` +
        `écartés de toute comparaison d'une année sur l'autre. `
      : "";

  return polish(
    `Les fichiers DVF consultés pour ${city.name} contiennent ` +
      `${formatNumber(city.mutationsFound)} mutations ; ` +
      `${formatNumber(city.mutationsKept)} sont exploitables, ` +
      `${formatNumber(dropped)} ne le sont pas (coordonnées, prix, date ou type de bien ` +
      `manquants). ${partial}Les agrégats de cette page ont été calculés le ` +
      `${formatIsoDay(generatedAt)} et ne bougent pas entre deux régénérations.`,
  );
}

/* ------------------------------------------------------- titres et descriptions */

export function pageTitle(city: CityAggregate): string {
  return `Prix immobilier à ${city.name}`;
}

/**
 * La description de recherche : un chiffre, son effectif, sa période.
 *
 * Pas de « découvrez », pas de « le guide complet ». La description dit ce que
 * la page contient, et l'effectif y figure parce que c'est ce qui distingue
 * cette page-ci de celles qui extrapolent depuis des annonces.
 */
export function metaDescription(city: CityAggregate): string {
  const flats = city.byType.apartment;
  const houses = city.byType.house;
  const period = periodLabel(city);

  if (canPublishFigure(flats) && canPublishFigure(houses)) {
    return (
      `Prix au m² à ${city.name} : ${formatPricePerSqm(flats.median)} pour un appartement ` +
      `(${formatNumber(flats.sample)} ventes), ${formatPricePerSqm(houses.median)} pour une ` +
      `maison (${formatNumber(houses.sample)} ventes), ${period}. Données DVF.`
    );
  }
  const only = canPublishFigure(flats) ? flats : houses;
  const label = canPublishFigure(flats) ? "un appartement" : "une maison";
  return (
    `Prix au m² à ${city.name} : ${formatPricePerSqm(only.median)} pour ${label}, ` +
    `calculé sur ${formatNumber(only.sample)} ventes enregistrées ${period}. Données DVF.`
  );
}

/* -------------------------------------------------------------------- outils */

function signedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return polish(`${sign}${formatDecimal(Math.abs(value))} %`);
}

function formatDecimal(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** `2026-04-12` → `12 avril 2026`. Sans heure : le jour suffit. */
export function formatIsoDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const rendered = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  // « 1 septembre » n'existe pas en français : le premier du mois est ordinal.
  return rendered.startsWith("1 ") ? `1er ${rendered.slice(2)}` : rendered;
}
