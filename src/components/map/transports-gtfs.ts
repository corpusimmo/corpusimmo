"use client";

/**
 * LIGNES DE TRAM ET DE MÉTRO, AUX COULEURS DE L'EXPLOITANT.
 *
 * `transports.ts` peint déjà les lignes structurantes lues dans les tuiles
 * vectorielles du fond de carte. Il a une limite qu'aucun filtre ne lèvera :
 * le schéma OpenMapTiles ne porte NI le numéro de la ligne NI sa couleur. À
 * Nantes, les trois trams sortent donc du même bleu, alors que l'habitant ne
 * dit pas « la ligne 1 » mais reconnaît le vert. Or la couleur d'une ligne
 * fait partie de l'adresse : « à deux pas du 2 » situe un bien mieux qu'une
 * distance en mètres.
 *
 * ── LA SOURCE ──────────────────────────────────────────────────────────────
 * Deux GeoJSON figés dans `public/geo/`, produits hors ligne par
 * `scripts/agreger-transports.mjs` depuis les GTFS que les exploitants
 * publient sur transport.data.gouv.fr. Ce sont eux qui renseignent
 * `route_color` et `route_text_color` : la couleur affichée ici est la couleur
 * OFFICIELLE, pas une teinte que nous aurions choisie.
 *
 * Le fichier est figé plutôt que reconstruit à la volée parce qu'un GTFS
 * national pèse plusieurs gigaoctets et que rien de tout cela ne bouge d'un
 * jour à l'autre : relancer le script une fois par an suffit.
 *
 * ── POURQUOI CE CALQUE EST FRÈRE, ET NON SUCCESSEUR ────────────────────────
 * Il ne couvre que le tram, le métro et le funiculaire, et seulement là où
 * l'autorité organisatrice publie sous licence ouverte. Le calque OSM, lui,
 * couvre toute la France, y compris le train et les emprises. Les deux
 * répondent à des questions différentes et s'allument séparément : les
 * superposer ferait apparaître deux traits parallèles pour la même voie.
 * L'articulation appartient à l'appelant, ce module ne décide de rien.
 *
 * ── LA PASTILLE, ET POURQUOI ELLE EST FAITE D'UN HALO ──────────────────────
 * Un numéro de ligne se lit dans une pastille à la couleur de la ligne. Un
 * fond de pastille réclamerait une image de sprite ; le style du fond de carte
 * n'en fournit pas, et en embarquer une pour trois chiffres serait cher payé.
 * Un halo de texte épais à la couleur de la ligne produit exactement la même
 * lecture — chiffre clair cerné de la teinte officielle — sans un octet de
 * plus. C'est un compromis assumé : la pastille est arrondie par le halo, pas
 * parfaitement circulaire.
 *
 * ── CE QUI EST ÉCARTÉ, ET POURQUOI ─────────────────────────────────────────
 *   · les bus et le train régional. Le volume les rendrait illisibles à
 *     l'échelle où on regarde un prix au m², et le poids du fichier ferait
 *     payer le téléchargement à tout le monde.
 *   · le NOM des arrêts. Comme dans `transports.ts` : les pastilles de prix
 *     sont la donnée de l'écran, et MapLibre masquerait les unes ou les autres
 *     selon la place. Les points situent, le numéro de ligne identifie, le nom
 *     appartient à l'infobulle.
 *
 * ── LES COULEURS ───────────────────────────────────────────────────────────
 * Elles ne sont PAS littérales ici, contrairement à `zoning.ts` et
 * `base-palette.ts` : chaque entité porte la sienne, et l'expression
 * `["get", "couleur"]` la lit. Seuls le liseré et le remplissage des arrêts
 * sont fixes, parce qu'ils doivent rester les mêmes sur tout le réseau pour
 * que la couleur de la ligne soit la seule variable que l'œil suive.
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { FONT_BOLD } from "./map-style";

type LayerSpec = StyleSpecification["layers"][number];

/**
 * Attribution à porter dans le crédit de la carte.
 *
 * Les GTFS retenus sont sous Licence Ouverte, ODbL ou Licence Mobilités : les
 * deux dernières imposent la citation de la source. Le calque ne s'affiche pas
 * sans elle.
 */
export const GTFS_ATTRIBUTION =
  "Lignes de tram et métro : GTFS des exploitants, transport.data.gouv.fr";

export const GTFS_LINES_SOURCE_ID = "transports-gtfs-lignes";
export const GTFS_STOPS_SOURCE_ID = "transports-gtfs-arrets";

const GTFS_LINES_URL = "/geo/transports-lignes.geojson";
const GTFS_STOPS_URL = "/geo/transports-arrets.geojson";

export const GTFS_LINE_CASING_LAYER = "transports-gtfs-liseré";
export const GTFS_LINE_LAYER = "transports-gtfs-ligne";
export const GTFS_STOP_LAYER = "transports-gtfs-arret";
export const GTFS_LINE_BADGE_LAYER = "transports-gtfs-pastille";

/**
 * L'ordre compte : c'est l'ordre de dessin.
 *
 * Le liseré passe SOUS le trait coloré, les arrêts par-dessus les deux, et la
 * pastille en dernier pour n'être jamais recouverte par un arrêt.
 */
export const GTFS_LAYER_IDS: readonly string[] = [
  GTFS_LINE_CASING_LAYER,
  GTFS_LINE_LAYER,
  GTFS_STOP_LAYER,
  GTFS_LINE_BADGE_LAYER,
];

/**
 * Zoom d'apparition des arrêts et des pastilles.
 *
 * En dessous, une ligne de tram tient dans un centimètre : y poser des points
 * et des numéros produirait une grappe illisible, et masquerait le tracé qui
 * est la seule chose qu'on cherche à cette échelle.
 */
const DETAIL_MIN_ZOOM = 11;

/** Liseré blanc translucide : sans lui, une ligne foncée disparaît sur une
 *  zone urbaine dense, et deux lignes voisines se confondent en un seul trait
 *  épais. */
const CASING_COLOR = "rgba(255,255,255,0.85)";

export function gtfsLayers(): LayerSpec[] {
  /**
   * La largeur suit le zoom, pas le mode : un métro et un tram partagent
   * souvent le même axe, leur donner deux épaisseurs ferait croire à une
   * hiérarchie qui n'existe pas pour l'acheteur.
   */
  const width: unknown[] = [
    "interpolate",
    ["exponential", 1.4],
    ["zoom"],
    8,
    1.2,
    12,
    2.4,
    16,
    5,
  ];

  return [
    {
      id: GTFS_LINE_CASING_LAYER,
      type: "line",
      source: GTFS_LINES_SOURCE_ID,
      // Caché à l'installation : le calque s'allume à la demande.
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": CASING_COLOR,
        "line-width": ["+", width, 2.4],
      },
    },
    {
      id: GTFS_LINE_LAYER,
      type: "line",
      source: GTFS_LINES_SOURCE_ID,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "couleur"],
        "line-width": width,
        // Pas de `line-dasharray` pour distinguer le funiculaire : cette
        // propriété n'accepte AUCUNE expression liée à l'entité, seulement le
        // zoom. Il faudrait une couche de plus pour six lignes en France ; la
        // couleur officielle suffit à les séparer.
      },
    },
    {
      id: GTFS_STOP_LAYER,
      type: "circle",
      source: GTFS_STOPS_SOURCE_ID,
      minzoom: DETAIL_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        // Fond blanc cerné de la couleur de la ligne : c'est la convention de
        // tous les plans de réseau, l'œil la lit sans légende.
        "circle-color": "#ffffff",
        "circle-stroke-color": ["get", "couleur"],
        "circle-stroke-width": 1.6,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DETAIL_MIN_ZOOM,
          2,
          14,
          3.5,
          17,
          5.5,
        ],
      },
    },
    {
      id: GTFS_LINE_BADGE_LAYER,
      type: "symbol",
      source: GTFS_LINES_SOURCE_ID,
      minzoom: DETAIL_MIN_ZOOM,
      layout: {
        visibility: "none",
        "text-field": ["get", "ref"],
        "text-font": FONT_BOLD,
        "text-size": 11,
        // Le long du tracé, et répétée : une seule pastille par ligne serait
        // invisible dès que l'utilisateur s'éloigne de son milieu.
        "symbol-placement": "line",
        "symbol-spacing": 220,
        "text-rotation-alignment": "viewport",
        "text-pitch-alignment": "viewport",
        "text-padding": 6,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": ["get", "couleurTexte"],
        // C'est le halo qui FAIT la pastille : épais, à la couleur de la
        // ligne, il cerne le numéro comme un fond plein le ferait.
        "text-halo-color": ["get", "couleur"],
        "text-halo-width": 2.6,
        "text-halo-blur": 0,
      },
    },
  ] as LayerSpec[];
}

/**
 * Installe sources et couches sous `beforeId`, une seule fois.
 *
 * Renvoie `false` si les couches sont déjà là ou si rien n'a pu être posé —
 * l'appelant sait alors qu'il n'a pas à refaire son câblage d'événements.
 * Contrairement à `installZoningLayers`, aucune dépendance au schéma du fond
 * de carte : les données sont les nôtres, un style tiers ne change rien.
 *
 * `beforeId` doit désigner la première couche de l'overlay DVF, pour que les
 * pastilles de prix restent au-dessus de tout ce qui est posé ici.
 */
export function installGtfsLayers(map: MapLibreMap, beforeId?: string): boolean {
  const layers = gtfsLayers();
  const first = layers[0];
  if (!first) return false;
  // Déjà posées : l'installation repasse à chaque `styledata`.
  if (map.getLayer(first.id)) return true;

  if (!map.getSource(GTFS_LINES_SOURCE_ID)) {
    map.addSource(GTFS_LINES_SOURCE_ID, {
      type: "geojson",
      data: GTFS_LINES_URL,
      attribution: GTFS_ATTRIBUTION,
    });
  }
  if (!map.getSource(GTFS_STOPS_SOURCE_ID)) {
    map.addSource(GTFS_STOPS_SOURCE_ID, {
      type: "geojson",
      data: GTFS_STOPS_URL,
      attribution: GTFS_ATTRIBUTION,
    });
  }

  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  for (const layer of layers) map.addLayer(layer, before);
  return true;
}

export function setGtfsVisibility(map: MapLibreMap, visible: boolean): void {
  for (const id of GTFS_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
