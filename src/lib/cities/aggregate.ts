/**
 * Le calcul des agrégats d'une commune, à partir de mutations DVF normalisées.
 *
 * CE MODULE NE TÉLÉCHARGE RIEN. Il prend des `DvfTransaction[]` et rend un
 * `CityAggregate`. C'est ce qui le rend testable sur des lots fabriqués, et
 * c'est ce qui permet au script de régénération de n'être qu'une boucle de
 * téléchargement autour de lui.
 *
 * LA SÉLECTION EST CELLE DU MOTEUR D'ESTIMATION, DÉLIBÉRÉMENT
 *   Une page ville et l'estimateur doivent répondre le même prix pour le même
 *   secteur, sinon l'un des deux ment. On applique donc exactement les règles
 *   de `src/lib/valuation/comparables.ts` :
 *     · vente de gré à gré seulement. Une adjudication, une expropriation, un
 *       échange ou une VEFA ne sont pas des prix de marché négociés ;
 *     · lot unique. Une mutation qui empaquette trois appartements divise un
 *       prix par un lot de surfaces : son prix au m² est un artefact ;
 *     · garde-fous absolus en €/m², repris tels quels
 *       (`PRICE_PER_SQM_GUARDS`), qui attrapent les accidents d'encodage.
 *
 *   Ce qui est délibérément ABSENT ici, en revanche : le filtre d'écart de
 *   surface et le filtre de Tukey du moteur. Le moteur cherche des biens
 *   COMPARABLES à un bien donné ; une page ville décrit un MARCHÉ. Écarter les
 *   ventes atypiques d'une commune reviendrait à décrire une commune dont on
 *   aurait retiré ce qui la rend chère ou bon marché. La dispersion est ici le
 *   sujet, pas le bruit.
 */

import { median, quantile } from "@/lib/valuation/stats";
import { PRICE_PER_SQM_GUARDS } from "@/lib/valuation/comparables";
import { isPartialYear } from "@/lib/dvf/coverage";
import type { DvfTransaction } from "@/types/dvf";

import type { CityCommune } from "@/data/cities/communes";

import type {
  CityAggregate,
  CityFigure,
  CityHistogram,
  CityPropertyType,
  CitySector,
  CitySectorKind,
  CitySectors,
  CityYearFigure,
} from "./types";

export const CITY_PROPERTY_TYPES: readonly CityPropertyType[] = ["apartment", "house"];

/** Nombre de tranches de l'histogramme. Huit : lisible, et étiquetable. */
const HISTOGRAM_BINS = 8;

/**
 * Sous ce volume, un millésime est réputé partiel quel que soit le calendrier.
 *
 * DVF publie deux fois par an, et le millésime en cours est donc toujours
 * incomplet. Mais le calendrier ne dit pas tout : il arrive qu'un millésime
 * publié reste amputé. On compare donc le volume de chaque année à la MÉDIANE
 * des autres : en dessous de 60 %, l'année n'est pas comparable aux autres,
 * quoi qu'en dise la date.
 */
const PARTIAL_VOLUME_RATIO = 0.6;

/** Une vente de logement de gré à gré, portant sur un lot unique. */
export function isCityDwellingSale(tx: DvfTransaction): boolean {
  return (
    tx.nature === "sale" &&
    !tx.isMultiLot &&
    (tx.propertyType === "apartment" || tx.propertyType === "house")
  );
}

/** Toutes les ventes de gré à gré d'un type, lots multiples compris. */
export function isCityDwellingSaleOfType(tx: DvfTransaction, type: CityPropertyType): boolean {
  return tx.nature === "sale" && tx.propertyType === type;
}

/**
 * Le prix au m² exploitable d'une mutation, ou `undefined`.
 *
 * `pricePerSqm` est déjà calculé par le normaliseur ; on le recalcule pas, on
 * le VÉRIFIE contre les garde-fous du moteur. Une valeur hors rails n'est pas
 * corrigée : elle est écartée, et l'écart se lit dans `sample` face à `total`.
 */
export function usableUnitPrice(tx: DvfTransaction): number | undefined {
  const value = tx.pricePerSqm;
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const { min, max } = PRICE_PER_SQM_GUARDS.built;
  if (value < min || value > max) return undefined;
  return value;
}

/* ------------------------------------------------------------- un indicateur */

export function buildFigure(rows: readonly DvfTransaction[], type: CityPropertyType): CityFigure {
  const sales = rows.filter((tx) => isCityDwellingSaleOfType(tx, type));
  const retained = sales.filter((tx) => !tx.isMultiLot && usableUnitPrice(tx) !== undefined);

  const unitPrices: number[] = [];
  const prices: number[] = [];
  const areas: number[] = [];
  for (const tx of retained) {
    const unit = usableUnitPrice(tx);
    if (unit !== undefined) unitPrices.push(unit);
    prices.push(tx.price);
    if (tx.builtArea !== undefined) areas.push(tx.builtArea);
  }

  const figure: CityFigure = { sample: retained.length, total: sales.length };
  if (unitPrices.length === 0) return figure;

  figure.median = roundTo(median(unitPrices), 10);
  figure.q1 = roundTo(quantile(unitPrices, 0.25), 10);
  figure.q3 = roundTo(quantile(unitPrices, 0.75), 10);
  figure.d1 = roundTo(quantile(unitPrices, 0.1), 10);
  figure.d9 = roundTo(quantile(unitPrices, 0.9), 10);
  figure.medianPrice = roundTo(median(prices), 500);
  figure.medianArea = roundTo(median(areas), 1);

  const histogram = buildHistogram(unitPrices);
  if (histogram) figure.histogram = histogram;

  return figure;
}

/**
 * L'histogramme des prix au m², borné aux déciles.
 *
 * Les ventes situées hors de [D1, D9] ne sont pas jetées : elles sont comptées
 * dans `below` et `above`, et la page les annonce. Les cacher donnerait à voir
 * un marché plus resserré qu'il ne l'est.
 */
export function buildHistogram(values: readonly number[]): CityHistogram | undefined {
  if (values.length < 10) return undefined;
  const low = quantile(values, 0.1);
  const high = quantile(values, 0.9);
  if (low === undefined || high === undefined || high <= low) return undefined;

  const width = (high - low) / HISTOGRAM_BINS;
  // Les bornes affichées sont arrondies à la dizaine d'euros, comme les
  // quantiles : voir `roundTo`. Sans cet arrondi, la première tranche
  // annoncerait « 2 431 » à côté d'un premier décile publié à « 2 430 », et
  // le lecteur chercherait l'erreur qui n'existe pas. Le CLASSEMENT des
  // valeurs, lui, se fait sur les bornes exactes : ce sont les étiquettes que
  // l'on arrondit, pas les comptages.
  const bins = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
    from: roundTo(low + index * width, 10) ?? 0,
    to: roundTo(low + (index + 1) * width, 10) ?? 0,
    count: 0,
  }));

  let below = 0;
  let above = 0;
  for (const value of values) {
    if (value < low) {
      below += 1;
      continue;
    }
    if (value > high) {
      above += 1;
      continue;
    }
    const index = Math.min(HISTOGRAM_BINS - 1, Math.floor((value - low) / width));
    const bin = bins[index];
    if (bin) bin.count += 1;
  }

  return { bins, below, above };
}

/* ---------------------------------------------------------------- les années */

export function buildYearFigures(
  rows: readonly DvfTransaction[],
  years: readonly number[],
  type: CityPropertyType,
): CityYearFigure[] {
  return years.map((year) => {
    const ofYear = rows.filter((tx) => tx.year === year);
    const sales = ofYear.filter((tx) => isCityDwellingSaleOfType(tx, type));
    const unitPrices = sales
      .filter((tx) => !tx.isMultiLot)
      .map(usableUnitPrice)
      .filter((value): value is number => value !== undefined);

    return {
      year,
      sample: unitPrices.length,
      total: sales.length,
      median: roundTo(median(unitPrices), 10),
      q1: roundTo(quantile(unitPrices, 0.25), 10),
      q3: roundTo(quantile(unitPrices, 0.75), 10),
      partial: false,
    };
  });
}

/** Le volume de ventes de logement par millésime, tous types confondus. */
export function buildVolumeByYear(
  rows: readonly DvfTransaction[],
  years: readonly number[],
): CityYearFigure[] {
  return years.map((year) => {
    const sales = rows.filter((tx) => tx.year === year && isCityDwellingSale(tx));
    const unitPrices = sales
      .map(usableUnitPrice)
      .filter((value): value is number => value !== undefined);
    return {
      year,
      sample: unitPrices.length,
      total: sales.length,
      median: roundTo(median(unitPrices), 10),
      q1: roundTo(quantile(unitPrices, 0.25), 10),
      q3: roundTo(quantile(unitPrices, 0.75), 10),
      partial: false,
    };
  });
}

/**
 * Les millésimes incomplets, désignés par le calendrier ET par le volume.
 *
 * Le calendrier seul se trompe dans un sens (il ignore une publication
 * amputée) ; le volume seul se trompe dans l'autre (une commune peut vraiment
 * avoir vendu deux fois moins). Les deux ensemble ne laissent passer qu'une
 * erreur prudente : au pire, un millésime complet est traité comme partiel, et
 * l'on s'interdit une comparaison qu'on aurait pu faire.
 */
export function detectPartialYears(
  volume: readonly CityYearFigure[],
  now: Date = new Date(),
): number[] {
  const partial = new Set<number>();
  for (const entry of volume) {
    if (isPartialYear(entry.year, now)) partial.add(entry.year);
  }

  const totals = volume.map((entry) => entry.total).filter((value) => value > 0);
  const reference = median(totals);
  if (reference !== undefined && reference > 0) {
    for (const entry of volume) {
      if (entry.total < reference * PARTIAL_VOLUME_RATIO) partial.add(entry.year);
    }
  }

  return [...partial].sort((a, b) => a - b);
}

/* --------------------------------------------------------------- les secteurs */

/**
 * Le découpage infra-communal, quand la donnée en porte un.
 *
 * DVF NE PUBLIE PAS DE QUARTIERS. Il publie une adresse, un code postal et un
 * code commune. Inventer des quartiers à partir des noms de voies serait une
 * cartographie de notre fabrication présentée comme une donnée publique. Deux
 * découpages seulement sont donc admis, parce que ce sont les seuls que la
 * source contient réellement :
 *
 *   · l'ARRONDISSEMENT, pour Paris, Lyon et Marseille, où DVF publie un
 *     fichier distinct par arrondissement. Le découpage est exact ;
 *   · le CODE POSTAL ailleurs, qui n'est pas un quartier mais un secteur de
 *     distribution. La page le dit ainsi, sans jamais l'appeler « quartier ».
 */
export function buildSectors(
  rows: readonly DvfTransaction[],
  kind: CitySectorKind,
  labelOf: (code: string) => string,
): CitySectors | null {
  const dwellings = rows.filter(isCityDwellingSale);
  const usable = dwellings.filter((tx) => usableUnitPrice(tx) !== undefined);
  if (usable.length === 0) return null;

  const groups = new Map<string, { sales: number; unitPrices: number[] }>();
  for (const tx of dwellings) {
    const code = kind === "arrondissement" ? tx.cityCode : tx.postcode;
    if (!code) continue;
    const group = groups.get(code) ?? { sales: 0, unitPrices: [] };
    group.sales += 1;
    const unit = usableUnitPrice(tx);
    if (unit !== undefined) group.unitPrices.push(unit);
    groups.set(code, group);
  }
  if (groups.size < 2) return null;

  const entries: CitySector[] = [...groups.entries()]
    .map(([code, group]) => ({
      code,
      label: labelOf(code),
      sample: group.unitPrices.length,
      total: group.sales,
      median: roundTo(median(group.unitPrices), 10),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { kind, entries, dwellingSample: usable.length };
}

/* ----------------------------------------------------------------- arrondis */

/**
 * Arrondit à un pas, ou rend `undefined`.
 *
 * Le pas n'est pas cosmétique : publier « 3 427 €/m² » sur un échantillon dont
 * l'intervalle de confiance fait ±10 % afficherait quatre chiffres
 * significatifs pour une précision qui en porte deux. On arrondit donc à la
 * dizaine d'euros au m², au demi-millier sur un prix de vente.
 */
export function roundTo(value: number | undefined, step: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.round(value / step) * step;
}

/* ------------------------------------------------------- étiquettes de secteur */

/**
 * `75111` → « Paris 11e ». Rendu `undefined` hors Paris, Lyon et Marseille.
 *
 * Ces trois communes sont les seules que DVF publie par arrondissement : c'est
 * ce qui rend leur découpage exact plutôt qu'approché.
 */
export function arrondissementLabel(cityCode: string): string | undefined {
  const rank = arrondissementRank(cityCode);
  if (rank === undefined) return undefined;
  const city = cityCode.startsWith("751")
    ? "Paris"
    : cityCode.startsWith("693")
      ? "Lyon"
      : "Marseille";
  return `${city} ${rank}${rank === 1 ? "er" : "e"}`;
}

function arrondissementRank(cityCode: string): number | undefined {
  if (/^751\d{2}$/.test(cityCode)) return Number(cityCode.slice(3));
  if (/^132\d{2}$/.test(cityCode)) return Number(cityCode.slice(3));
  if (/^693(8[1-9])$/.test(cityCode)) return Number(cityCode.slice(3)) - 80;
  return undefined;
}

/**
 * `44100` → « Code postal 44100 ».
 *
 * Volontairement littéral. Un code postal n'est pas un quartier, il n'a ni nom
 * ni frontière administrative, et lui en donner un ferait passer une commodité
 * de tri postal pour une géographie.
 */
export function postcodeLabel(code: string): string {
  return `Code postal ${code}`;
}

/* ------------------------------------------------------------ l'assemblage */

export interface BuildCityInput {
  commune: CityCommune;
  /** Codes de fichiers DVF réellement consultés (arrondissements pour PLM). */
  sourceCodes: string[];
  years: number[];
  transactions: readonly DvfTransaction[];
  /** Mutations distinctes vues par le normaliseur, avant tout rejet. */
  mutationsFound: number;
  /** Mutations retenues par le normaliseur. */
  mutationsKept: number;
  now?: Date;
}

/**
 * Assemble les agrégats d'une commune. Aucune règle éditoriale ici : ce qui est
 * publiable ou non se décide à la lecture, dans `thresholds.ts`.
 */
export function buildCityAggregate(input: BuildCityInput): CityAggregate {
  const { commune, transactions, years } = input;
  const now = input.now ?? new Date();

  const volumeByYear = buildVolumeByYear(transactions, years);
  const partialYears = detectPartialYears(volumeByYear, now);
  const partialSet = new Set(partialYears);
  const withPartial = (entries: CityYearFigure[]): CityYearFigure[] =>
    entries.map((entry) => ({ ...entry, partial: partialSet.has(entry.year) }));

  const usesArrondissements = input.sourceCodes.length > 1;
  const sectors = usesArrondissements
    ? buildSectors(transactions, "arrondissement", (code) => arrondissementLabel(code) ?? code)
    : buildSectors(transactions, "postcode", postcodeLabel);

  const byType = {
    apartment: buildFigure(transactions, "apartment"),
    house: buildFigure(transactions, "house"),
  };

  return {
    insee: commune.insee,
    slug: commune.slug,
    name: commune.name,
    departmentCode: commune.departmentCode,
    departmentName: commune.departmentName,
    population: commune.population,
    center: commune.center,
    postcodes: commune.postcodes,
    sourceCodes: input.sourceCodes,
    years: [...years].sort((a, b) => a - b),
    latestYear: years.reduce((max, year) => (year > max ? year : max), years[0] ?? 0),
    partialYears,
    mutationsFound: input.mutationsFound,
    mutationsKept: input.mutationsKept,
    dwellingSales: byType.apartment.total + byType.house.total,
    byType,
    yearlyByType: {
      apartment: withPartial(buildYearFigures(transactions, years, "apartment")),
      house: withPartial(buildYearFigures(transactions, years, "house")),
    },
    volumeByYear: withPartial(volumeByYear),
    sectors,
  };
}
