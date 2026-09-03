"use client";

/**
 * TRANSPORTS ET COMMODITÉS — ce qu'il y a autour du bien, par-dessus les ventes.
 *
 * Le zonage dit dans quel tissu on se trouve. Il ne dit pas si on est à trois
 * minutes d'un tram, d'une école et d'une supérette, ou à vingt minutes de
 * tout. C'est pourtant la variable qui explique le mieux qu'une même surface
 * ne vaille pas le même prix à deux rues d'écart. Ce calque dessine les lignes
 * structurantes, les points d'accès au réseau, et quatre familles
 * d'équipements du quotidien.
 *
 * ── LA SOURCE, ET POURQUOI ELLE SUFFIT ─────────────────────────────────────
 * Tout vient des tuiles vectorielles DÉJÀ chargées pour le fond de carte
 * (schéma OpenMapTiles, servies par OpenFreeMap). Aucune requête de plus,
 * aucun quota, aucune clé : les octets transitent de toute façon.
 *
 * C'est la seule approche compatible avec la ligne tenue en tête de
 * `map-style.ts` : les données OSM sont sous ODbL et sa clause de partage à
 * l'identique contaminerait notre base si nous en persistions les géométries.
 * Rien n'est extrait, rien n'est stocké, rien n'est agrégé côté serveur : on
 * repeint des tuiles.
 *
 * ── CE QUI EST RÉELLEMENT DANS LES TUILES ──────────────────────────────────
 * Vérifié en décodant des tuiles z14 réelles (Nantes, Paris, Lyon, Bordeaux),
 * et non déduit de la documentation, qui est en retard sur le schéma servi :
 *
 *   · couche `transportation` (z4→14). Les classes `rail` et `transit`
 *     existent bel et bien, alors que la page publique du schéma ne les liste
 *     plus. `rail` porte les sous-classes rail et funicular ; `transit` porte
 *     subway et tram (light_rail et monorail sont au schéma mais n'ont pas été
 *     observés en France : le filtre porte donc sur `class`, qui les couvre
 *     sans que nous ayons à parier sur une sous-classe).
 *   · couche `poi` (z11→14). Elle EST dans les tuiles — c'est notre style qui
 *     ne la dessine jamais, volontairement, pour ne pas encombrer la carte de
 *     POI commerciaux. La rallumer ici, à la demande et cadrée, ne contredit
 *     pas ce choix : elle reste éteinte tant que personne ne la demande.
 *     Géométrie toujours ponctuelle (aucun polygone), champs `class`,
 *     `subclass`, `rank`.
 *
 * ── CE QUE NOUS AVONS ÉCARTÉ, ET POURQUOI ──────────────────────────────────
 *   · la couche `park`. Son nom ment : elle ne porte pas les parcs urbains
 *     mais les aires protégées (class `protected_area`, `nature_reserve`,
 *     `historic`). Les jardins publics sont dans `landcover` (grass/park), que
 *     le calque de zonage peint déjà en vert : les redessiner ici ferait
 *     doublon. D'où des parcs traités en POINTS, comme les autres commodités.
 *   · le champ `agg_stop`, qui devrait marquer un arrêt représentatif par
 *     grappe de quais. Il est VIDE dans les tuiles servies. Conséquence
 *     assumée et annoncée par la légende : un même arrêt apparaît plusieurs
 *     fois, une fois par quai. Dédoublonner demanderait de regrouper des
 *     géométries OSM, donc de les manipuler hors du rendu — exactement ce que
 *     la règle ODbL ci-dessus nous interdit de prendre à la légère.
 *   · les classes fourre-tout `shop` et `office`. `shop` couvre la supérette
 *     ET le salon de tatouage, `office` couvre l'agence immobilière ET
 *     l'avocat : les faire entrer dans « Alimentation » ou « Commerces »
 *     rendrait la légende fausse. Les commerces alimentaires retenus sont donc
 *     ceux qui ont leur propre `class` (grocery, bakery, butcher), au prix
 *     d'oublier les épiceries taguées `shop=convenience`.
 *   · la classe `entrance` (subway_entrance, train_station_entrance), qui
 *     ferait apparaître cinq points là où il y a une gare.
 *   · toute ÉTIQUETTE de texte. Les pastilles de prix sont la donnée
 *     principale de l'écran ; ajouter des noms d'équipements ferait
 *     concurrence directe à ce que l'utilisateur est venu lire, et MapLibre
 *     masquerait les unes ou les autres selon la place disponible. Les points
 *     situent, ils ne nomment pas.
 *
 * ── LES CLASSES `poi` ET LEUR FRAGILITÉ ────────────────────────────────────
 * OpenMapTiles ne documente qu'une trentaine de valeurs de `class`, mais les
 * tuiles servies en contiennent bien plus (`pharmacy`, `doctors`, `dentist`,
 * `bakery`, `butcher`, `playground`…) : quand une valeur n'est pas dans la
 * table de correspondance, la sous-classe est recopiée telle quelle dans
 * `class`. Ces valeurs-là sont donc OBSERVÉES, pas garanties. Si une montée de
 * version les déplace, le filtre ne trouve rien et la famille concernée cesse
 * d'apparaître : le calque se vide, il ne casse pas. C'est le comportement
 * qu'on veut d'un calque optionnel.
 *
 * ── LES COULEURS ───────────────────────────────────────────────────────────
 * Littérales, comme dans `base-palette.ts` et `zoning.ts`, pour la même
 * raison : un style MapLibre est un document JSON, il ne sait pas lire une
 * variable CSS. Teintes catégorielles, saturées, et choisies distinctes de
 * celles du zonage pour que les deux calques restent lisibles allumés
 * ensemble.
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { OFM_SOURCE_ID } from "./map-style";

type LayerSpec = StyleSpecification["layers"][number];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Seuils de zoom                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Les lignes structurent la lecture d'une agglomération entière : elles
 * peuvent apparaître tôt. Sous z11 la couche `poi` n'existe pas dans les
 * tuiles, et de toute façon un point d'école à l'échelle d'un département ne
 * dit rien.
 */
export const TRANSPORT_LINE_MIN_ZOOM = 11;

/** Gares et stations : des repères d'agglomération, comme les lignes. */
export const STATION_MIN_ZOOM = 12;

/**
 * Arrêts et commodités : échelle du quartier. Deux crans plus tard, parce
 * qu'un arrêt de bus n'a de sens que quand on peut voir la rue qui le porte.
 */
export const NEIGHBOURHOOD_MIN_ZOOM = 14;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tables de lecture                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TransportLine {
  id: string;
  /** Libellé de légende. Le vocabulaire de l'usager, pas celui d'OSM. */
  label: string;
  color: string;
  /** Valeurs de `class`, couche `transportation`. */
  classes: readonly string[];
  /** Le train est pointillé, le tram est plein : deux réseaux, deux lectures. */
  dashed: boolean;
  /** Épaisseur du trait à z11 puis à z18, interpolée entre les deux. */
  width: readonly [number, number];
}

/**
 * Ordre de dessin : le train d'abord, le tram et le métro par-dessus. En ville
 * les deux se superposent souvent sur un même faisceau, et c'est le réseau
 * urbain qui intéresse l'évaluation.
 */
export const TRANSPORT_LINES: readonly TransportLine[] = [
  {
    id: "rail",
    label: "Voies ferrées",
    color: "#475569",
    classes: ["rail"],
    dashed: true,
    width: [0.8, 3],
  },
  {
    id: "transit",
    label: "Métro et tram",
    color: "#e11d48",
    classes: ["transit"],
    dashed: false,
    width: [1.4, 6],
  },
] as const;

export interface TransportStopGroup {
  id: string;
  label: string;
  color: string;
  /**
   * Filtre sur `subclass` et non sur `class` : la classe `railway` mélange la
   * gare SNCF et l'arrêt de tram, qui n'ont ni le même poids ni la même
   * échelle d'apparition.
   */
  subclasses: readonly string[];
  minzoom: number;
  /** Rayon du disque à `minzoom` puis à z18. */
  radius: readonly [number, number];
}

/** Les gares en dernier : au-dessus des arrêts, qui sont bien plus nombreux. */
export const TRANSPORT_STOPS: readonly TransportStopGroup[] = [
  {
    id: "arret",
    label: "Arrêts de bus et de tram",
    color: "#94a3b8",
    subclasses: ["bus_stop", "tram_stop"],
    minzoom: NEIGHBOURHOOD_MIN_ZOOM,
    radius: [2.2, 5],
  },
  {
    id: "gare",
    label: "Gares et stations",
    color: "#1e293b",
    subclasses: ["station", "halt", "subway", "bus_station", "ferry_terminal"],
    minzoom: STATION_MIN_ZOOM,
    radius: [3.4, 8],
  },
] as const;

export interface AmenityCategory {
  id: string;
  label: string;
  color: string;
  /** Valeurs de `class`, couche `poi`. */
  classes: readonly string[];
}

export const AMENITY_CATEGORIES: readonly AmenityCategory[] = [
  {
    id: "ecole",
    label: "Écoles et campus",
    color: "#2563eb",
    classes: ["school", "college"],
  },
  {
    id: "alimentation",
    label: "Alimentation",
    color: "#ea7317",
    classes: ["grocery", "bakery", "butcher"],
  },
  {
    id: "sante",
    label: "Santé",
    color: "#9333ea",
    classes: ["hospital", "pharmacy", "doctors", "dentist"],
  },
  {
    id: "parc",
    label: "Parcs et jeux",
    color: "#16a34a",
    classes: ["park", "playground"],
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Identifiants de couches                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const LINE_PREFIX = "transports-line-";
const CASING_SUFFIX = "-casing";
const STOP_PREFIX = "transports-stop-";
const AMENITY_PREFIX = "transports-amenity-";
const ICON_PREFIX = "transports-icon-";

/**
 * LES PICTOGRAMMES, PRIS DANS LE SPRITE DÉJÀ CHARGÉ.
 *
 * Le style maison déclare le sprite d'OpenFreeMap pour ses propres besoins :
 * ces icônes sont donc déjà sur le réseau, et les afficher ne coûte pas un
 * octet de plus. Aucun fichier à produire, aucune image à générer à
 * l'exécution comme le fait `addPillImages` pour les pastilles de prix.
 *
 * Les noms sont ceux du sprite `ofm_f384`, vérifiés un par un contre son
 * index : un `icon-image` inexistant ne lève RIEN chez MapLibre, il dessine
 * simplement le vide, et le défaut passerait inaperçu jusqu'en production.
 *
 * Le suffixe `_11` est la variante compacte (15 px). La grande, à 19 px,
 * écraserait les pastilles de prix qui restent la donnée principale.
 */
const STOP_ICONS: Record<string, string> = {
  bus_stop: "bus_11",
  bus_station: "bus_11",
  tram_stop: "railway_light_11",
  station: "railway_11",
  halt: "railway_11",
  subway: "railway_metro_11",
  ferry_terminal: "ferry_11",
};

const AMENITY_ICONS: Record<string, string> = {
  school: "school_11",
  college: "college_11",
  grocery: "grocery_11",
  bakery: "bakery_11",
  butcher: "grocery_11",
  hospital: "hospital_11",
  pharmacy: "pharmacy_11",
  doctors: "doctors_11",
  dentist: "dentist_11",
  park: "park_11",
  playground: "playground_11",
};

/**
 * `["match", ["get", champ], "bus_stop", "bus_11", …, repli]`.
 *
 * Une seule couche par groupe plutôt qu'une par valeur : c'est l'expression
 * qui choisit le pictogramme, donc MapLibre ne gère qu'un jeu de symboles à
 * dédoublonner et les arrêts ne se recouvrent pas entre couches sœurs.
 */
function iconExpression(
  field: string,
  values: readonly string[],
  table: Record<string, string>,
  fallback: string,
): unknown[] {
  const pairs = values.flatMap((value) =>
    table[value] ? [value, table[value]] : [],
  );
  if (pairs.length === 0) return [fallback];
  return ["match", ["get", field], ...pairs, fallback];
}

/**
 * Zoom à partir duquel le pictogramme remplace la pastille.
 *
 * Un point de 5 px accepte une couleur, pas un dessin. En dessous de ce zoom
 * les cercles restent seuls : mieux vaut un point lisible qu'une icône
 * illisible.
 */
const ICON_MIN_ZOOM = 15.5;

/**
 * Tous les identifiants posés, dans l'ordre de dessin. Exporté parce que
 * l'allumage du calque doit pouvoir les parcourir sans reconstruire les
 * couches.
 */
export const TRANSPORT_LAYER_IDS: readonly string[] = [
  ...TRANSPORT_LINES.flatMap((line) => [
    `${LINE_PREFIX}${line.id}${CASING_SUFFIX}`,
    `${LINE_PREFIX}${line.id}`,
  ]),
  ...AMENITY_CATEGORIES.map((a) => `${AMENITY_PREFIX}${a.id}`),
  ...TRANSPORT_STOPS.map((s) => `${STOP_PREFIX}${s.id}`),
  // L'ordre suit celui du dessin : les pictogrammes d'arrêts avant ceux des
  // commodités, comme dans `transportLayers()`. Une liste qui divergerait de
  // l'ordre réel casserait `setTransportVisibility` en silence le jour où
  // elle servirait à autre chose qu'à parcourir.
  ...TRANSPORT_STOPS.map((s) => `${ICON_PREFIX}${s.id}`),
  ...AMENITY_CATEGORIES.map((a) => `${ICON_PREFIX}${a.id}`),
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Expressions                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Le halo clair posé sous chaque ligne.
 *
 * Sans lui, un trait de tram se lit comme une rue de plus : le fond de carte
 * dessine déjà des dizaines de lignes, et une teinte vive ne suffit pas à
 * décoller du bruit. Le blanc semi-transparent sépare le réseau du tissu
 * viaire sur les cinq cartographies, la claire comme les sombres, parce qu'il
 * joue sur le contraste local et non sur la teinte.
 */
const CASING_COLOR = "#ffffff";
const CASING_OPACITY = 0.55;
const CASING_EXTRA_WIDTH = 2.4;

/** Assez opaque pour se voir, assez transparent pour ne rien effacer. */
const LINE_OPACITY = 0.9;

/**
 * `rank` est un classement LOCAL : OpenMapTiles le recalcule dans chaque
 * cellule d'une grille, il repart donc à 1 un peu partout et grimpe jusqu'à
 * plusieurs centaines dans une tuile dense. Ce n'est pas une importance
 * absolue, c'est un régulateur de densité — et c'est exactement l'usage qu'on
 * en fait : peu de points quand la vue est large, tout quand on est dans la
 * rue.
 *
 * La source plafonne à z14, donc au-delà MapLibre sur-zoome la même tuile :
 * sans ce desserrement progressif, un quartier vu à z18 resterait aussi vide
 * qu'à z14.
 */
export const RANK_LIMIT_STOPS: readonly (readonly [number, number])[] = [
  [NEIGHBOURHOOD_MIN_ZOOM, 12],
  [16, 40],
  [17, 10000],
];

export function rankLimitExpression(): unknown[] {
  const [first, ...rest] = RANK_LIMIT_STOPS;
  return [
    "step",
    ["zoom"],
    first?.[1] ?? 10000,
    ...rest.flatMap(([zoom, limit]) => [zoom, limit]),
  ];
}

/**
 * `rank` peut manquer sur un objet ; `["<", null, 12]` ferait une erreur de
 * type à l'évaluation. Le `coalesce` à 0 garde ces objets visibles, ce qui est
 * le bon défaut : une absence de classement ne doit pas valoir exclusion.
 */
function densityFilter(): unknown[] {
  return ["<", ["coalesce", ["get", "rank"], 0], rankLimitExpression()];
}

/**
 * `["all", …]` construit à part : écrit en littéral, TypeScript en fait un
 * tuple qu'il refuse ensuite de rapprocher de `FilterSpecification`. Le
 * retour élargi à `unknown[]` laisse passer l'assertion, comme dans `zoning.ts`
 * — un style MapLibre est de toute façon validé par la carte au chargement.
 */
function allOf(...parts: unknown[][]): unknown[] {
  return ["all", ...parts];
}

function matchClass(values: readonly string[]): unknown[] {
  return ["match", ["get", "class"], [...values], true, false];
}

function matchSubclass(values: readonly string[]): unknown[] {
  return ["match", ["get", "subclass"], [...values], true, false];
}

function lineWidth([atMin, atMax]: readonly [number, number], extra = 0) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    TRANSPORT_LINE_MIN_ZOOM,
    atMin + extra,
    18,
    atMax + extra,
  ];
}

function circleRadius(
  minzoom: number,
  [atMin, atMax]: readonly [number, number],
) {
  return ["interpolate", ["linear"], ["zoom"], minzoom, atMin, 18, atMax];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Couches                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Les couches, dans l'ordre de dessin : lignes, puis commodités, puis arrêts
 * et gares.
 *
 * Les points passent au-dessus des lignes parce qu'un arrêt posé sur sa propre
 * ligne doit rester visible ; les gares passent au-dessus des commodités parce
 * que c'est le repère, pas le décor. L'ensemble est inséré SOUS les pastilles
 * de prix par `installTransportLayers`, jamais au-dessus.
 */
export function transportLayers(): LayerSpec[] {
  const lines = TRANSPORT_LINES.flatMap((line) => {
    const filter = matchClass(line.classes);
    const layout = {
      visibility: "none",
      "line-cap": "round",
      "line-join": "round",
    };

    return [
      {
        id: `${LINE_PREFIX}${line.id}${CASING_SUFFIX}`,
        type: "line",
        source: OFM_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: TRANSPORT_LINE_MIN_ZOOM,
        layout,
        filter,
        paint: {
          "line-color": CASING_COLOR,
          "line-opacity": CASING_OPACITY,
          "line-width": lineWidth(line.width, CASING_EXTRA_WIDTH),
        },
      } as LayerSpec,
      {
        id: `${LINE_PREFIX}${line.id}`,
        type: "line",
        source: OFM_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: TRANSPORT_LINE_MIN_ZOOM,
        layout,
        filter,
        paint: {
          "line-color": line.color,
          "line-opacity": LINE_OPACITY,
          "line-width": lineWidth(line.width),
          // Le pointillé se lit comme « voie », pas comme « rue ».
          ...(line.dashed ? { "line-dasharray": [2.5, 1.8] } : {}),
        },
      } as LayerSpec,
    ];
  });

  const amenities = AMENITY_CATEGORIES.map(
    (category) =>
      ({
        id: `${AMENITY_PREFIX}${category.id}`,
        type: "circle",
        source: OFM_SOURCE_ID,
        "source-layer": "poi",
        minzoom: NEIGHBOURHOOD_MIN_ZOOM,
        layout: { visibility: "none" },
        filter: allOf(matchClass(category.classes), densityFilter()),
        paint: {
          "circle-color": category.color,
          "circle-radius": circleRadius(NEIGHBOURHOOD_MIN_ZOOM, [2.6, 6]),
          // Le liseré clair détache le point du bâti comme du parc.
          "circle-stroke-color": CASING_COLOR,
          "circle-stroke-width": 1.1,
          "circle-opacity": 0.95,
        },
      }) as LayerSpec,
  );

  const stops = TRANSPORT_STOPS.map(
    (group) =>
      ({
        id: `${STOP_PREFIX}${group.id}`,
        type: "circle",
        source: OFM_SOURCE_ID,
        "source-layer": "poi",
        minzoom: group.minzoom,
        layout: { visibility: "none" },
        filter: allOf(matchSubclass(group.subclasses), densityFilter()),
        paint: {
          "circle-color": group.color,
          "circle-radius": circleRadius(group.minzoom, group.radius),
          "circle-stroke-color": CASING_COLOR,
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.95,
        },
      }) as LayerSpec,
  );

  /**
   * Les pictogrammes, posés PAR-DESSUS les pastilles et non à leur place.
   *
   * La pastille garde le codage par couleur et reste lisible à tous les
   * zooms ; l'icône vient s'y superposer quand la place existe. Deux
   * conséquences voulues : rien ne disparaît au passage du seuil, et un
   * pictogramme absent du sprite laisse au moins un point coloré.
   *
   * `icon-allow-overlap: false` laisse MapLibre écarter les icônes qui se
   * chevauchent. Sans dédoublonnage possible des quais (`agg_stop` est vide
   * dans les tuiles servies), c'est ce qui évite une grappe illisible sur une
   * station à six quais.
   */
  const icons = [
    ...TRANSPORT_STOPS.map(
      (group) =>
        ({
          id: `${ICON_PREFIX}${group.id}`,
          type: "symbol",
          source: OFM_SOURCE_ID,
          "source-layer": "poi",
          minzoom: Math.max(group.minzoom, ICON_MIN_ZOOM),
          filter: allOf(matchSubclass(group.subclasses), densityFilter()),
          layout: {
            visibility: "none",
            "icon-image": iconExpression(
              "subclass",
              group.subclasses,
              STOP_ICONS,
              "bus_11",
            ),
            "icon-size": 0.9,
            "icon-allow-overlap": false,
            "icon-padding": 3,
          },
          paint: { "icon-opacity": 0.95 },
        }) as LayerSpec,
    ),
    ...AMENITY_CATEGORIES.map(
      (category) =>
        ({
          id: `${ICON_PREFIX}${category.id}`,
          type: "symbol",
          source: OFM_SOURCE_ID,
          "source-layer": "poi",
          minzoom: ICON_MIN_ZOOM,
          filter: allOf(matchClass(category.classes), densityFilter()),
          layout: {
            visibility: "none",
            "icon-image": iconExpression(
              "class",
              category.classes,
              AMENITY_ICONS,
              "commercial_11",
            ),
            "icon-size": 0.85,
            "icon-allow-overlap": false,
            "icon-padding": 3,
          },
          paint: { "icon-opacity": 0.9 },
        }) as LayerSpec,
    ),
  ];

  return [...lines, ...amenities, ...stops, ...icons];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Installation                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Installe les couches sous `beforeId`, une seule fois.
 *
 * Renvoie `false` quand la source du fond de carte n'est pas la nôtre — cas de
 * `NEXT_PUBLIC_MAP_STYLE_URL`, où le schéma des tuiles est inconnu : rien ne
 * garantit qu'il y ait une couche `poi`, ni que `class` y porte les mêmes
 * valeurs. L'appelant cache alors la commande plutôt que d'offrir un bouton
 * qui ne peindrait rien.
 *
 * `beforeId` doit désigner la première couche de l'overlay DVF : les pastilles
 * de prix restent ainsi au-dessus de tout ce qui est posé ici.
 */
export function installTransportLayers(
  map: MapLibreMap,
  beforeId?: string,
): boolean {
  if (!map.getSource(OFM_SOURCE_ID)) return false;

  const layers = transportLayers();
  const first = layers[0];
  if (!first) return false;
  // Déjà posées : l'installation repasse à chaque `styledata`.
  if (map.getLayer(first.id)) return true;

  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  for (const layer of layers) map.addLayer(layer, before);
  return true;
}

export function setTransportVisibility(
  map: MapLibreMap,
  visible: boolean,
): void {
  for (const id of TRANSPORT_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
