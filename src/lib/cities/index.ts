/**
 * La surface publique des pages villes.
 *
 * Tout ce qui vit hors de `src/lib/cities` passe par ici : les pages, le plan
 * de site et les tests. `regenerate.test.ts` fait exception et importe les
 * modules directement, parce qu'il est l'outil qui FABRIQUE le jeu de données
 * plutôt qu'un consommateur de celui-ci.
 */

export {
  CITY_PROPERTY_TYPES,
  arrondissementLabel,
  buildCityAggregate,
  buildFigure,
  buildHistogram,
  buildSectors,
  buildVolumeByYear,
  buildYearFigures,
  detectPartialYears,
  isCityDwellingSale,
  postcodeLabel,
  usableUnitPrice,
} from "./aggregate";

export {
  DATASET_PATH,
  DATASET_VERSION,
  cityDataset,
  distanceBetweenCitiesKm,
  findCity,
  isDatasetUsable,
  neighbourCities,
  publishedCities,
  refusedCities,
} from "./dataset";

export {
  MIN_CITY_DWELLING_SALES,
  MIN_DECILE_SAMPLE,
  MIN_EVOLUTION_SAMPLE,
  MIN_FIGURE_SAMPLE,
  MIN_SECTOR_COUNT,
  MIN_SECTOR_COVERAGE,
  MIN_SECTOR_SAMPLE,
  MIN_SERIES_POINTS,
  canPublishDeciles,
  canPublishFigure,
  canPublishQuartiles,
  cityRefusal,
  evolutionOf,
  isPublishableCity,
  plottableYears,
  publishableSectors,
  sectorCoverage,
} from "./thresholds";
export type { CityEvolution, CityRefusal, EvolutionRefusal } from "./thresholds";

export {
  TYPE_LABELS,
  comparisonSentence,
  coverageParagraph,
  dispersionBand,
  dispersionParagraph,
  evolutionParagraph,
  formatIsoDay,
  marketParagraph,
  marketShape,
  metaDescription,
  ofPlural,
  pageTitle,
  periodLabel,
  polish,
  relativeSpread,
  sectorParagraph,
} from "./copy";

export {
  CITIES_ROOT,
  cityBreadcrumb,
  cityPath,
  cityTools,
  estimatorHref,
  mapHref,
  transactionsHref,
} from "./links";

export { ambiguousBaseSlugs, expectedSlug, slugifyCommuneName } from "./slug";

export { citiesSitemapEntries } from "./sitemap";
export type { CitySitemapEntry } from "./sitemap";

export type {
  CityAggregate,
  CityDataset,
  CityFigure,
  CityHistogram,
  CityHistogramBin,
  CityPropertyType,
  CitySector,
  CitySectorKind,
  CitySectors,
  CityYearFigure,
} from "./types";
