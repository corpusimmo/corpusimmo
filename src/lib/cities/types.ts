/**
 * Le contrat du jeu de données des pages villes.
 *
 * PRINCIPE QUI GOUVERNE TOUT CE FICHIER : LE JEU DE DONNÉES NE PORTE QUE DES
 * FAITS, LE CODE PORTE LES REFUS.
 *
 * On ne stocke jamais « cette évolution est publiable » ni « ce secteur est
 * affichable ». On stocke des effectifs et des médianes ; ce sont les seuils de
 * `thresholds.ts` qui décident, à la lecture, de ce qui a le droit d'être
 * montré. La conséquence est celle qu'on cherche : durcir un seuil ne demande
 * PAS de retélécharger 500 fichiers DVF, et un fichier d'agrégats vieux de six
 * mois ne peut pas transporter une règle éditoriale périmée.
 *
 * Second principe : AUCUN CHIFFRE SANS SON EFFECTIF. Chaque médiane de ce
 * fichier voyage avec le nombre de mutations qui la produit, dans la même
 * structure, et il n'existe aucun moyen de rendre l'une sans l'autre.
 */

/** Les deux familles de logement que DVF distingue et que ces pages traitent. */
export type CityPropertyType = "apartment" | "house";

/** Une tranche d'un histogramme de prix au m². */
export interface CityHistogramBin {
  /** Bornes en €/m², incluses à gauche, exclues à droite (sauf la dernière). */
  from: number;
  to: number;
  count: number;
}

/**
 * L'histogramme des prix au m², borné aux déciles.
 *
 * Les tranches couvrent D1 à D9 et non le minimum au maximum : une seule vente
 * à 40 000 €/m² écraserait toutes les autres barres contre l'axe et donnerait à
 * lire un marché parfaitement homogène, ce qui serait l'inverse de la vérité.
 * Les ventes rejetées hors cadre sont COMPTÉES (`below`, `above`) et affichées :
 * elles ne disparaissent pas, elles sont dites.
 */
export interface CityHistogram {
  bins: CityHistogramBin[];
  below: number;
  above: number;
}

/**
 * Un indicateur de prix et l'effectif qui le fonde.
 *
 * `sample` compte les mutations réellement retenues dans le calcul (vente de
 * gré à gré, lot unique, surface exploitable) ; `total` compte toutes les
 * mutations de ce type, y compris celles qu'on a écartées. Publier les deux est
 * la seule façon honnête de dire « 1 240 ventes d'appartements, dont 890
 * exploitables au m² ».
 *
 * Toutes les valeurs monétaires sont indéfinies quand l'effectif ne les porte
 * pas. Un `undefined` oblige l'appelant à décider ; un zéro se serait affiché.
 */
export interface CityFigure {
  sample: number;
  total: number;
  /** €/m² : médiane, quartiles, déciles. */
  median?: number;
  q1?: number;
  q3?: number;
  d1?: number;
  d9?: number;
  /** Prix de vente médian, en euros. */
  medianPrice?: number;
  /** Surface médiane, en m². */
  medianArea?: number;
  histogram?: CityHistogram;
}

/** Un millésime, pour un type de bien. */
export interface CityYearFigure {
  year: number;
  sample: number;
  total: number;
  median?: number;
  /**
   * Quartiles du millésime. Ils ne sont PAS décoratifs : c'est avec eux que
   * `thresholds.ts` calcule la marge d'incertitude d'une médiane annuelle, et
   * donc qu'il décide si un écart entre deux millésimes vaut d'être publié.
   */
  q1?: number;
  q3?: number;
  /**
   * Millésime incomplet. Vrai soit parce que le calendrier de publication DVF
   * le dit (deux publications par an, six mois de décalage), soit parce que le
   * volume observé s'effondre par rapport aux millésimes précédents.
   */
  partial: boolean;
}

/** Un secteur infra-communal, quand la donnée en distingue honnêtement. */
export interface CitySector {
  /** Code INSEE d'arrondissement, ou code postal. */
  code: string;
  label: string;
  sample: number;
  total: number;
  median?: number;
}

export type CitySectorKind = "arrondissement" | "postcode";

export interface CitySectors {
  kind: CitySectorKind;
  entries: CitySector[];
  /**
   * Effectif de logements de la commune servant de dénominateur à la
   * couverture. Le TAUX de couverture n'est pas stocké : il dépend des secteurs
   * effectivement retenus, donc des seuils, donc du code (voir l'en-tête).
   */
  dwellingSample: number;
}

/** Les agrégats d'une commune, tels que le script de régénération les écrit. */
export interface CityAggregate {
  insee: string;
  slug: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  population: number;
  center: { lat: number; lng: number };
  postcodes: string[];

  /**
   * Les codes de fichiers DVF réellement consultés. Pour Paris, Lyon et
   * Marseille, ce sont les arrondissements : la commune entière n'a pas de
   * fichier.
   */
  sourceCodes: string[];

  years: number[];
  latestYear: number;
  partialYears: number[];

  /** Mutations distinctes lues dans les fichiers, toutes natures confondues. */
  mutationsFound: number;
  /** Celles qui survivent à la normalisation (prix, date, coordonnées, type). */
  mutationsKept: number;

  /** Ventes de gré à gré, lot unique, toutes surfaces : le socle des pages. */
  dwellingSales: number;

  byType: Record<CityPropertyType, CityFigure>;
  yearlyByType: Record<CityPropertyType, CityYearFigure[]>;
  /** Volume de ventes de logements par millésime, tous types confondus. */
  volumeByYear: CityYearFigure[];

  sectors: CitySectors | null;
}

export interface CityDataset {
  /** Version de format. Un lecteur qui ne la reconnaît pas doit refuser. */
  version: 1;
  /** Jour de génération, sans heure : une heure ferait un diff à chaque run. */
  generatedAt: string;
  source: "geodvf";
  /** Millésimes DVF consultés, du plus ancien au plus récent. */
  years: number[];
  cities: CityAggregate[];
}
