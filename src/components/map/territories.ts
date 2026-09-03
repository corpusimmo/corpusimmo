"use client";

/**
 * LA FRANCE AVANT LES VENTES — régions, puis départements, puis les bulles.
 *
 * ── LE PROBLÈME ────────────────────────────────────────────────────────────
 * Sous le zoom 13, la carte refuse d'interroger DVF : une emprise plus large
 * couvre des départements entiers, et le fournisseur télécharge des fichiers
 * par commune. Jusqu'ici ces zooms-là ne montraient donc RIEN qu'un fond de
 * carte et un message « zoomez ». Un observatoire national qui ne dit rien de
 * la France tant qu'on n'a pas choisi une rue est un observatoire à moitié
 * fait.
 *
 * ── D'OÙ VIENNENT CES CHIFFRES ─────────────────────────────────────────────
 * Pas d'un échantillon : d'un calcul complet, fait hors ligne par
 * `scripts/agreger-territoires.mjs` sur les fichiers DÉPARTEMENTAUX de DVF,
 * avec la règle de regroupement par mutation du reste du produit. Le résultat
 * voyage dans les propriétés du GeoJSON, ce qui évite toute jointure à
 * l'exécution.
 *
 * Ils sont donc FIGÉS au jour de la génération, contrairement aux pastilles
 * qui suivent la vue. La légende le dit, parce que deux chiffres qui ne
 * couvrent pas la même période ne se comparent pas.
 *
 * ── CE QUI N'EST PAS COLORIÉ ───────────────────────────────────────────────
 * Un territoire sous le seuil d'effectif garde son contour et reste sans
 * remplissage. Le secret statistique n'est pas une limite technique qu'on
 * contourne : une médiane tirée de quelques mutations revient à les
 * republier. Le vide est ici une réponse.
 */

import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

export const SOURCE_REGIONS = "corpusimmo-regions";
export const SOURCE_DEPARTMENTS = "corpusimmo-departements";
/**
 * Sources d'ANCRAGE des libellés, distinctes des contours.
 *
 * MapLibre pose une étiquette sur chaque polygone d'un multi-polygone : la
 * Bretagne s'écrivait deux fois, une pour le continent et une pour ses îles.
 * Les libellés lisent donc un point par territoire, calculé au moment de la
 * génération (centroïde d'aire du morceau principal).
 */
export const SOURCE_REGION_POINTS = "corpusimmo-regions-points";
export const SOURCE_DEPARTMENT_POINTS = "corpusimmo-departements-points";

export const LAYER_REGION_FILL = "corpusimmo-region-fill";
export const LAYER_REGION_LINE = "corpusimmo-region-line";
export const LAYER_REGION_LABEL = "corpusimmo-region-label";
export const LAYER_DEPARTMENT_FILL = "corpusimmo-departement-fill";
export const LAYER_DEPARTMENT_LINE = "corpusimmo-departement-line";
export const LAYER_DEPARTMENT_LABEL = "corpusimmo-departement-label";

export const TERRITORY_LAYERS = [
  LAYER_REGION_FILL,
  LAYER_REGION_LINE,
  LAYER_REGION_LABEL,
  LAYER_DEPARTMENT_FILL,
  LAYER_DEPARTMENT_LINE,
  LAYER_DEPARTMENT_LABEL,
] as const;

/**
 * Les deux bascules.
 *
 * `REGION_MAX` : au-delà, une région couvre plusieurs écrans et sa médiane
 * unique devient trompeuse — le département prend le relais.
 * `DEPARTMENT_MAX` vaut `MIN_DATA_ZOOM` : les aplats s'effacent exactement là
 * où les ventes réelles apparaissent, sans recouvrement ni trou.
 */
export const REGION_MAX_ZOOM = 6.5;
export const DEPARTMENT_MAX_ZOOM = 13;

/** Chevauchement du fondu, pour que la bascule ne « claque » pas. */
const FADE = 0.5;

/**
 * Rampe séquentielle, du plus abordable au plus cher.
 *
 * Distincte de celle des pastilles à dessein : celle-ci porte une lecture
 * NATIONALE et figée, l'autre suit la vue. Deux échelles qui ne disent pas la
 * même chose ne doivent pas se ressembler.
 */
export const TERRITORY_RAMP = [
  "#e8eef2",
  "#b9cfdc",
  "#7fa8c4",
  "#4b7fa6",
  "#2c5a7f",
] as const;

/** Ce qu'on peint quand la donnée manque : rien, mais visiblement rien. */
export const NO_DATA_FILL = "rgba(0,0,0,0)";

export interface TerritoryScale {
  breaks: number[];
  colors: readonly string[];
  /** Territoires ayant servi à caler l'échelle. */
  sample: number;
}

/**
 * Quintiles des médianes DÉPARTEMENTALES, appliqués aussi aux régions.
 *
 * Une échelle par échelon donnerait deux lectures incomparables : la même
 * teinte ne voudrait plus dire le même prix selon le zoom. Le département est
 * la maille la plus fine des deux, donc celle qui porte le plus de contraste.
 */
export function buildTerritoryScale(values: number[]): TerritoryScale | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < TERRITORY_RAMP.length) return null;

  const breaks: number[] = [];
  for (let i = 1; i < TERRITORY_RAMP.length; i += 1) {
    const index = Math.floor((sorted.length * i) / TERRITORY_RAMP.length);
    breaks.push(sorted[Math.min(index, sorted.length - 1)] ?? 0);
  }
  return { breaks, colors: TERRITORY_RAMP, sample: sorted.length };
}

/** `["step", ppsm, c0, b0, c1, …]`, avec le vide traité avant toute borne. */
function fillExpression(scale: TerritoryScale): ExpressionSpecification {
  const step: unknown[] = ["step", ["get", "ppsm"], scale.colors[0]];
  scale.breaks.forEach((bound, i) => step.push(bound, scale.colors[i + 1]));

  return [
    "case",
    // `ppsm` vaut `null` sous le seuil d'effectif. Sans ce test, `step`
    // rangerait le vide dans la première classe et peindrait « pas assez de
    // ventes » de la même couleur que « le moins cher de France ».
    ["==", ["get", "ppsm"], null],
    NO_DATA_FILL,
    step,
  ] as unknown as ExpressionSpecification;
}

interface TerritoryChrome {
  line: string;
  label: string;
  halo: string;
}

/**
 * Pose les six couches sous `beforeId`.
 *
 * Idempotent : `ensureDvfLayers` repasse à chaque changement de fond de carte.
 */
export function installTerritoryLayers(
  map: MapLibreMap,
  scale: TerritoryScale,
  chrome: TerritoryChrome,
  beforeId?: string,
): void {
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  const fill = fillExpression(scale);

  if (!map.getSource(SOURCE_REGIONS)) {
    map.addSource(SOURCE_REGIONS, { type: "geojson", data: "/geo/regions.geojson" });
  }
  if (!map.getSource(SOURCE_DEPARTMENTS)) {
    map.addSource(SOURCE_DEPARTMENTS, {
      type: "geojson",
      data: "/geo/departements.geojson",
    });
  }
  if (!map.getSource(SOURCE_REGION_POINTS)) {
    map.addSource(SOURCE_REGION_POINTS, {
      type: "geojson",
      data: "/geo/regions-points.geojson",
    });
  }
  if (!map.getSource(SOURCE_DEPARTMENT_POINTS)) {
    map.addSource(SOURCE_DEPARTMENT_POINTS, {
      type: "geojson",
      data: "/geo/departements-points.geojson",
    });
  }

  for (const [source, maxzoom, minzoom, ids] of [
    [SOURCE_REGIONS, REGION_MAX_ZOOM, 0, ["region"]],
    [SOURCE_DEPARTMENTS, DEPARTMENT_MAX_ZOOM, REGION_MAX_ZOOM - FADE, ["departement"]],
  ] as const) {
    const key = ids[0];
    const fillId = key === "region" ? LAYER_REGION_FILL : LAYER_DEPARTMENT_FILL;
    const lineId = key === "region" ? LAYER_REGION_LINE : LAYER_DEPARTMENT_LINE;
    const labelId = key === "region" ? LAYER_REGION_LABEL : LAYER_DEPARTMENT_LABEL;
    if (map.getLayer(fillId)) continue;

    // Le fondu se fait sur l'OPACITÉ et non sur `minzoom` / `maxzoom` seuls :
    // une couche qui disparaît d'un coup fait clignoter tout l'écran au
    // passage du seuil.
    const opacity: unknown[] = [
      "interpolate",
      ["linear"],
      ["zoom"],
      minzoom,
      key === "region" ? 0.85 : 0,
      minzoom + FADE,
      0.85,
      maxzoom - FADE,
      0.85,
      maxzoom,
      0,
    ];

    map.addLayer(
      {
        id: fillId,
        type: "fill",
        source,
        minzoom,
        maxzoom,
        paint: { "fill-color": fill, "fill-opacity": opacity },
      } as never,
      before,
    );
    map.addLayer(
      {
        id: lineId,
        type: "line",
        source,
        minzoom,
        maxzoom,
        paint: {
          "line-color": chrome.line,
          "line-width": key === "region" ? 1 : 0.6,
          "line-opacity": opacity,
        },
      } as never,
      before,
    );
    map.addLayer(
      {
        id: labelId,
        type: "symbol",
        source:
          key === "region" ? SOURCE_REGION_POINTS : SOURCE_DEPARTMENT_POINTS,
        minzoom: minzoom + FADE,
        maxzoom,
        layout: {
          "text-field": [
            "case",
            ["==", ["get", "ppsm"], null],
            ["get", "nom"],
            ["concat", ["get", "nom"], "\n", ["get", "ppsm"], " €/m²"],
          ],
          "text-size": key === "region" ? 12 : 11,
          "text-max-width": 9,
          "text-allow-overlap": false,
          "text-padding": 6,
        },
        paint: {
          "text-color": chrome.label,
          "text-halo-color": chrome.halo,
          "text-halo-width": 1.4,
          "text-opacity": opacity,
        },
      } as never,
      before,
    );
  }
}

export function setTerritoryVisibility(map: MapLibreMap, visible: boolean): void {
  for (const id of TERRITORY_LAYERS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
