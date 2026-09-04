"use client";

/**
 * TRACÉS PRÉCIS ET COLORÉS DES LIGNES DE TRAM, MÉTRO ET FUNICULAIRE.
 *
 * Ce calque répond à la question que les deux autres laissaient ouverte.
 * `transports.ts` peint la voie exacte lue dans les tuiles vectorielles, mais
 * le schéma OpenMapTiles ne porte NI numéro NI couleur : tous les trams d'une
 * agglomération sortent de la même teinte. `transports-gtfs.ts` porte la
 * couleur officielle de l'exploitant, mais son tracé est schématique — 112 des
 * 123 lignes ont plus de 200 m entre deux points, médiane 344 m — au point que
 * `COARSE_LINE_LAYERS` le laisse éteint. Ici, géométrie exacte ET couleur.
 *
 * ── LA SOURCE, ET SA LICENCE ───────────────────────────────────────────────
 * `public/geo/transports-lignes-osm.geojson`, figé hors ligne par
 * `scripts/agreger-lignes-osm.mjs` depuis les relations d'itinéraire
 * d'OpenStreetMap. Ce sont elles qui ont à la fois la géométrie de voie et les
 * tags `ref` et `colour`.
 *
 * Le fichier est donc une base DÉRIVÉE d'OSM : il est sous ODbL 1.0, et
 * l'attribution ci-dessous n'est pas décorative, elle est la condition de son
 * affichage. C'est aussi pourquoi il reste une source MapLibre à part, jamais
 * fusionnée avec les données DVF : deux bases côte à côte forment une base
 * collective, que le partage à l'identique ne contamine pas.
 *
 * ── POURQUOI CE CALQUE EST FRÈRE, ET NON SUCCESSEUR ────────────────────────
 * Il ne dessine que le tracé et son numéro. Les ARRÊTS restent au GTFS, qui
 * les tient d'un horaire publié plutôt que d'une contribution ; et les
 * emprises ferroviaires restent aux tuiles. Superposer ce calque au tracé des
 * tuiles ferait deux traits pour une même voie, l'un gris l'autre coloré :
 * l'articulation appartient à l'appelant, ce module ne décide de rien.
 *
 * ── LA PASTILLE, ET POURQUOI ELLE EST FAITE D'UN HALO ──────────────────────
 * Même compromis que dans `transports-gtfs.ts`, et pour la même raison : un
 * vrai fond de pastille réclamerait une image de sprite, que le style du fond
 * de carte ne fournit pas. Un halo épais à la couleur de la ligne cerne le
 * numéro exactement comme un fond plein, sans un octet de plus. La pastille
 * est arrondie par le halo, pas parfaitement circulaire.
 *
 * ── LES COULEURS ───────────────────────────────────────────────────────────
 * Elles ne sont PAS littérales ici, contrairement à `zoning.ts` : chaque
 * entité porte la sienne, et `["get", "couleur"]` la lit. Le script privilégie
 * la couleur du GTFS, renseignée par l'exploitant, sur le tag `colour` d'OSM
 * contribué à la main. Seul le liseré est fixe, pour que la couleur de la
 * ligne reste la seule variable que l'œil suive.
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { FONT_BOLD } from "./map-style";

type LayerSpec = StyleSpecification["layers"][number];

/**
 * Attribution à porter dans le crédit de la carte.
 *
 * L'ODbL impose de citer la source de toute base dérivée. Le calque ne
 * s'affiche pas sans elle : elle est passée à la source MapLibre, qui
 * l'ajoute au contrôle d'attribution tant que la source est chargée.
 */
export const OSM_LINES_ATTRIBUTION =
  "Tracés des lignes : © les contributeurs OpenStreetMap, ODbL";

export const OSM_LINES_SOURCE_ID = "transports-osm-lignes";

const OSM_LINES_URL = "/geo/transports-lignes-osm.geojson";

export const OSM_LINE_CASING_LAYER = "transports-osm-liseré";
export const OSM_LINE_LAYER = "transports-osm-ligne";
export const OSM_LINE_BADGE_LAYER = "transports-osm-pastille";

/**
 * L'ordre compte : c'est l'ordre de dessin.
 *
 * Le liseré passe SOUS le trait coloré, la pastille par-dessus les deux pour
 * n'être jamais recouverte par une ligne voisine.
 */
export const OSM_LINE_LAYER_IDS: readonly string[] = [
  OSM_LINE_CASING_LAYER,
  OSM_LINE_LAYER,
  OSM_LINE_BADGE_LAYER,
];

/**
 * Zoom d'apparition des pastilles.
 *
 * En dessous, une ligne de tram tient dans un centimètre : y poser des numéros
 * produirait une grappe illisible, et masquerait le tracé qui est la seule
 * chose qu'on cherche à cette échelle.
 */
const BADGE_MIN_ZOOM = 11;

/** Liseré blanc translucide : sans lui, une ligne foncée disparaît sur une
 *  zone urbaine dense, et deux lignes voisines se confondent en un seul trait
 *  épais. */
const CASING_COLOR = "rgba(255,255,255,0.85)";

export function osmLineLayers(): LayerSpec[] {
  /**
   * La largeur suit le zoom, pas le mode : un métro et un tram partagent
   * souvent le même axe, leur donner deux épaisseurs ferait croire à une
   * hiérarchie qui n'existe pas pour l'acheteur.
   *
   * Le liseré reçoit sa PROPRE interpolation, décalée, plutôt que l'épaisseur
   * du trait augmentée d'une constante. MapLibre n'admet `["zoom"]` qu'en
   * entrée DIRECTE d'un `interpolate` ou d'un `step` : un `["+", 2.4, [...]]`
   * autour passe le compilateur TypeScript et fait rejeter le style ENTIER au
   * chargement, en silence, sans rien dans la console.
   */
  const width = (extra: number): unknown[] => [
    "interpolate",
    ["exponential", 1.4],
    ["zoom"],
    8,
    1.2 + extra,
    12,
    2.4 + extra,
    16,
    5 + extra,
  ];

  return [
    {
      id: OSM_LINE_CASING_LAYER,
      type: "line",
      source: OSM_LINES_SOURCE_ID,
      // Caché à l'installation : le calque s'allume à la demande.
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": CASING_COLOR,
        "line-width": width(2.4),
      },
    },
    {
      id: OSM_LINE_LAYER,
      type: "line",
      source: OSM_LINES_SOURCE_ID,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "couleur"],
        "line-width": width(0),
      },
    },
    {
      id: OSM_LINE_BADGE_LAYER,
      type: "symbol",
      source: OSM_LINES_SOURCE_ID,
      minzoom: BADGE_MIN_ZOOM,
      layout: {
        visibility: "none",
        "text-field": ["get", "ref"],
        "text-font": FONT_BOLD,
        "text-size": 11,
        // Le long du tracé, et répétée : une seule pastille par ligne serait
        // invisible dès que l'utilisateur s'éloigne de son milieu.
        "symbol-placement": "line",
        "symbol-spacing": 220,
        // Le numéro reste droit quand la carte tourne ou s'incline : une
        // pastille couchée sur le tracé ne se lit plus.
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
 * Installe source et couches sous `beforeId`, une seule fois.
 *
 * Renvoie `false` quand rien n'a pu être posé. Contrairement à
 * `installZoningLayers`, aucune dépendance au schéma du fond de carte : les
 * données sont les nôtres, un style tiers ne change rien.
 *
 * `beforeId` doit désigner la première couche de l'overlay DVF, pour que les
 * pastilles de prix restent au-dessus de tout ce qui est posé ici.
 */
export function installOsmLineLayers(
  map: MapLibreMap,
  beforeId?: string,
): boolean {
  const layers = osmLineLayers();
  const first = layers[0];
  if (!first) return false;
  // Déjà posées : l'installation repasse à chaque `styledata`.
  if (map.getLayer(first.id)) return true;

  if (!map.getSource(OSM_LINES_SOURCE_ID)) {
    map.addSource(OSM_LINES_SOURCE_ID, {
      type: "geojson",
      data: OSM_LINES_URL,
      attribution: OSM_LINES_ATTRIBUTION,
    });
  }

  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  for (const layer of layers) map.addLayer(layer, before);
  return true;
}

export function setOsmLineVisibility(
  map: MapLibreMap,
  visible: boolean,
): void {
  for (const id of OSM_LINE_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
