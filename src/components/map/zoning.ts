"use client";

/**
 * ZONAGE — à quoi sert le sol, par-dessus les ventes.
 *
 * DVF dit ce qui s'est vendu et à quel prix. Il ne dit pas dans quel tissu :
 * un même prix au m² ne veut pas dire la même chose au cœur d'un centre-ville,
 * dans une zone d'activité ou au bord d'une parcelle agricole. Ce calque
 * colorie les emprises d'usage pour que le contexte se lise sans quitter la
 * carte.
 *
 * ── LA SOURCE ──────────────────────────────────────────────────────────────
 * Les polygones viennent des tuiles vectorielles déjà chargées pour le fond de
 * carte (`landuse`, `landcover`, schéma OpenMapTiles). Aucune requête de plus,
 * aucune dépendance de plus, aucun quota : les octets sont sur le réseau de
 * toute façon, nous ne faisons que les peindre autrement.
 *
 * C'est aussi la seule approche compatible avec la ligne tenue en tête de
 * `map-style.ts` : les données OSM sont sous ODbL, et sa clause de partage à
 * l'identique contaminerait notre base si nous en persistions les géométries.
 * Ici rien n'est extrait ni stocké — on change une couleur de remplissage.
 *
 * ── CE QUE ÇA DIT, ET CE QUE ÇA NE DIT PAS ─────────────────────────────────
 * OSM décrit un usage OBSERVÉ, contribué à la main, à l'échelle de la ZONE.
 * Trois limites à ne jamais masquer derrière une belle couleur :
 *
 *   · absence ≠ absence d'usage. Une commune où personne n'a contribué reste
 *     blanche ; elle n'est pas « sans affectation ». D'où la mention portée
 *     par la légende plutôt qu'une teinte « inconnu » qui ferait donnée.
 *   · le schéma OpenMapTiles ne porte AUCUN usage sur la couche `building` :
 *     on colorie des emprises, jamais un bâtiment isolé. Le bâti par bâti
 *     demandera une autre source.
 *   · l'observé n'est ni le déclaré ni l'autorisé. C'est précisément pour ça
 *     que `ZoningSource` existe déjà comme type : la BDNB (usage déclaré) et
 *     le PLU (règle applicable) viendront s'y ajouter comme des calques
 *     FRÈRES, un seul actif à la fois. Les empiler produirait des couleurs
 *     qui se recouvrent sans que personne puisse dire laquelle répond à
 *     quelle question.
 *
 * ── LES COULEURS ───────────────────────────────────────────────────────────
 * Littérales ici, comme dans `base-palette.ts` et pour la même raison : un
 * style MapLibre est un document JSON, il ne sait pas lire une variable CSS.
 * Ce sont six teintes catégorielles — elles ne portent aucun ordre, aucune
 * intensité, contrairement à l'échelle de prix des pastilles.
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { OFM_SOURCE_ID } from "./map-style";

type LayerSpec = StyleSpecification["layers"][number];

/**
 * D'où vient l'affectation affichée.
 *
 * Une seule valeur aujourd'hui. Le type existe pour que l'ajout de la BDNB et
 * du PLU soit une entrée de plus dans un sélecteur, et non une réécriture.
 */
export type ZoningSource = "osm";

export interface ZoningCategory {
  id: string;
  /** Libellé de légende. Le vocabulaire du métier, pas celui d'OSM. */
  label: string;
  color: string;
  /** Couche de tuile qui porte ces polygones. */
  sourceLayer: "landuse" | "landcover";
  /** Valeurs de `class` retenues, schéma OpenMapTiles. */
  classes: readonly string[];
}

/**
 * L'ordre compte deux fois : c'est celui de la légende, ET l'ordre de dessin.
 * Les emprises se chevauchent dans OSM (un lycée est souvent posé dans un
 * quartier résidentiel) ; la dernière peinte gagne, donc les affectations les
 * plus spécifiques passent en dernier.
 */
export const ZONING_CATEGORIES: readonly ZoningCategory[] = [
  {
    id: "agricole",
    label: "Agricole et naturel",
    color: "#8fa758",
    sourceLayer: "landcover",
    classes: ["farmland", "wood", "grass", "wetland"],
  },
  {
    id: "habitation",
    label: "Habitation",
    color: "#d9a441",
    sourceLayer: "landuse",
    classes: ["residential", "suburb", "quarter", "neighbourhood"],
  },
  {
    id: "tertiaire",
    label: "Tertiaire et commerce",
    color: "#3e7cb1",
    sourceLayer: "landuse",
    classes: ["commercial", "retail"],
  },
  {
    id: "industriel",
    label: "Industriel et logistique",
    color: "#7a6ba8",
    sourceLayer: "landuse",
    classes: ["industrial", "garages", "quarry"],
  },
  {
    id: "equipement",
    label: "Équipements publics",
    color: "#4f9d8b",
    sourceLayer: "landuse",
    classes: [
      "hospital",
      "school",
      "university",
      "college",
      "kindergarten",
      "library",
      "stadium",
      "cemetery",
      "military",
    ],
  },
  {
    id: "transport",
    label: "Emprises de transport",
    color: "#9a8c7a",
    sourceLayer: "landuse",
    classes: ["railway", "bus_station"],
  },
] as const;

const LAYER_PREFIX = "zoning-";

export const ZONING_LAYER_IDS: readonly string[] = ZONING_CATEGORIES.map(
  (category) => `${LAYER_PREFIX}${category.id}`,
);

/** Le remplissage reste transparent : la trame du fond doit rester lisible. */
const FILL_OPACITY = 0.42;

/**
 * Les couches, dans l'ordre de dessin.
 *
 * Un contour à la même teinte, plus opaque que le remplissage, sauve les
 * petites emprises : à z13 une zone d'activité fait quelques pixels, et un
 * aplat à 42 % s'y confond avec le fond.
 */
export function zoningLayers(): LayerSpec[] {
  return ZONING_CATEGORIES.map(
    (category) =>
      ({
        id: `${LAYER_PREFIX}${category.id}`,
        type: "fill",
        source: OFM_SOURCE_ID,
        "source-layer": category.sourceLayer,
        // Caché à l'installation : le calque s'allume à la demande.
        layout: { visibility: "none" },
        filter: [
          "match",
          ["get", "class"],
          [...category.classes],
          true,
          false,
        ],
        paint: {
          "fill-color": category.color,
          "fill-opacity": FILL_OPACITY,
          "fill-outline-color": category.color,
        },
      }) as LayerSpec,
  );
}

/**
 * Installe les couches sous `beforeId`, une seule fois.
 *
 * Renvoie `false` quand la source du fond de carte n'est pas la nôtre — cas de
 * `NEXT_PUBLIC_MAP_STYLE_URL`, où le schéma des tuiles est inconnu. L'appelant
 * cache alors la commande au lieu de proposer un bouton qui ne peindrait rien.
 */
export function installZoningLayers(
  map: MapLibreMap,
  beforeId?: string,
): boolean {
  if (!map.getSource(OFM_SOURCE_ID)) return false;

  const layers = zoningLayers();
  const first = layers[0];
  if (!first) return false;
  // Déjà posées : `ensureDvfLayers` repasse à chaque `styledata`.
  if (map.getLayer(first.id)) return true;

  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  for (const layer of layers) map.addLayer(layer, before);
  return true;
}

export function setZoningVisibility(map: MapLibreMap, visible: boolean): void {
  for (const id of ZONING_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
