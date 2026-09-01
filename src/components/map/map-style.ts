"use client";

/**
 * The basemap, and everything the DVF overlay needs that is *drawing*.
 *
 * ── BASEMAP ────────────────────────────────────────────────────────────────
 * We author our own MapLibre style against OpenFreeMap's OpenMapTiles vector
 * tiles (free, no API key, no quota) rather than loading a ready-made style and
 * repainting it. A generic OSM basemap is loud; ours is built to disappear
 * behind the transactions: hierarchised roads, flat buildings, barely-tinted
 * parks, few grey labels, no hillshade, and NO commercial POIs at all — the
 * `poi` source-layer is simply never drawn.
 *
 * Five cartographies exist, one per art direction, selectable INDEPENDENTLY of
 * the interface direction (`useMapStyleId()`), so one can pick the map of one
 * direction with the design of another. Their palettes live in
 * `base-palette.ts`.
 *
 * Tile URLs are never hardcoded: the source declares
 * `url: https://tiles.openfreemap.org/planet` and MapLibre resolves the
 * TileJSON, whose tile template carries a planet-version timestamp that changes
 * on every refresh. Source maxzoom is 14, so MapLibre overzooms past that
 * instead of requesting tiles that do not exist.
 *
 * `NEXT_PUBLIC_MAP_STYLE_URL` short-circuits all of this and loads that style
 * instead — the escape hatch to MapTiler, Protomaps or the IGN Géoplateforme
 * without touching a line of code.
 *
 * LICENCE — OpenStreetMap data under ODbL. Displaying the tiles is fine and
 * requires attribution (enforced by `AttributionControl`, never disabled).
 * Extracting or persisting OSM features into our own database is done NOWHERE
 * in this codebase: the share-alike clause would contaminate it.
 *
 * ── DVF OVERLAY ────────────────────────────────────────────────────────────
 * · Markers are MapLibre LAYERS, never DOM markers: a viewport over central
 *   Nantes carries several hundred sales, and that many absolutely-positioned
 *   nodes repositioned every frame would destroy the frame budget. The price
 *   "pills" are a `symbol` layer whose background is a 9-slice image generated
 *   at runtime with `addImage`.
 * · Overlay colours come from the CSS tokens through `getComputedStyle`, so the
 *   design tokens drive the overlay with no hex here. Only the BASEMAP carries
 *   literal colours, in `base-palette.ts`, because a style JSON cannot read CSS.
 *
 * The local GeoJSON types exist because `@types/geojson` is not in this
 * project's `compilerOptions.types`; declaring the two shapes we actually
 * produce beats widening the whole type surface.
 */

import type {
  Map as MapLibreMap,
  MapOptions,
  StyleImageMetadata,
  StyleSpecification,
} from "maplibre-gl";
import type { DvfTransaction } from "@/types/dvf";
import type { LatLng } from "@/types/geo";
import { geodesicCircleRing } from "@/lib/geo/distance";
import { formatPriceShort } from "@/lib/utils/format";
import { getCartoPalette, type CartoPalette } from "./base-palette";

/** Style object accepted by the `Map` constructor, whatever maplibre re-exports. */
export type MapStyle = Exclude<NonNullable<MapOptions["style"]>, string>;

/**
 * One entry of `style.layers`.
 *
 * Derived from `StyleSpecification` rather than imported: maplibre-gl consumes
 * `LayerSpecification` from `@maplibre/maplibre-gl-style-spec` without
 * re-exporting it, and that package is not a direct dependency here.
 */
type LayerSpec = StyleSpecification["layers"][number];

const OFM_TILEJSON = "https://tiles.openfreemap.org/planet";
const OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const OFM_SPRITE = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";

/** The glyph server serves single-family stacks only (`A,B` → 404). */
export const FONT_REGULAR = ["Noto Sans Regular"];
export const FONT_BOLD = ["Noto Sans Bold"];
export const FONT_ITALIC = ["Noto Sans Italic"];

/** Identifiant de la source du fond de carte, partagé avec `dvf-map`. */
export const SOURCE_BASEMAP = "openmaptiles";
const SRC = SOURCE_BASEMAP;

/**
 * Attribution is a licence condition, not decoration. It rides on the source
 * (so MapLibre surfaces it automatically) and is repeated on the control.
 */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · ' +
  '© les contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const DVF_ATTRIBUTION = "Ventes : DVF © DGFiP / Etalab";

/** Buildings only earn a third dimension once they are readable at all. */
export const BUILDING_3D_MIN_ZOOM = 15;

/** Source and layer of OUR style — known statically, no probing needed. */
export const OFM_SOURCE_ID = SRC;
export const OFM_BUILDING_LAYER = "building";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Basemap style                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BuildMapStyleOptions {
  /** Écrans d'analyse : mêmes couleurs, libellés plus discrets. */
  dense?: boolean;
}

export function buildMapStyle({ dense }: BuildMapStyleOptions = {}): MapStyle {
  const p = getCartoPalette(dense);
  const s = p.labelScale;

  const spec: StyleSpecification = {
    version: 8,
    name: "CorpusImmo",
    glyphs: OFM_GLYPHS,
    sprite: OFM_SPRITE,
    sources: {
      [SRC]: {
        type: "vector",
        url: OFM_TILEJSON,
        // Explicit so MapLibre overzooms past 14 instead of 404-ing.
        maxzoom: 14,
        attribution: BASEMAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": p.land } },

      vector("landuse-residential", "landuse", "fill", {
        filter: matchClass(["residential", "suburb", "quarter"]),
        paint: { "fill-color": p.landuseResidential, "fill-opacity": 0.75 },
      }),
      vector("landuse-industrial", "landuse", "fill", {
        filter: matchClass(["industrial", "commercial", "retail"]),
        paint: { "fill-color": p.landuseIndustrial, "fill-opacity": 0.7 },
      }),
      vector("landcover-green", "landcover", "fill", {
        filter: matchClass(["wood", "grass", "farmland"]),
        paint: { "fill-color": p.green, "fill-opacity": 0.55 },
      }),
      vector("park", "park", "fill", {
        paint: { "fill-color": p.green, "fill-opacity": 0.6 },
      }),

      vector("water", "water", "fill", {
        // Swimming pools are noise at every zoom this product uses.
        filter: ["!=", ["get", "class"], "swimming_pool"],
        paint: { "fill-color": p.water },
      }),
      vector("waterway", "waterway", "line", {
        minzoom: 9,
        paint: {
          "line-color": p.waterway,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 16, 2.4],
        },
      }),

      vector("building", "building", "fill", {
        minzoom: 14,
        paint: {
          "fill-color": p.building,
          "fill-outline-color": p.buildingOutline,
          // Fades in so the 14 → 15 handover never "pops".
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15.2,
            p.buildingOpacity,
          ],
        },
      }),

      // Roads: casing then fill, narrow families first so motorways stay on top
      // at every junction.
      ...roadPair(p, "minor", ["minor", "service", "track"], p.roadFillMinor, [
        [13, 1.5],
        [16, 4.5],
        [19, 20],
      ]),
      ...roadPair(p, "secondary", ["secondary", "tertiary"], p.roadFill, [
        [9, 0.7],
        [13, 2.8],
        [16, 7.5],
        [19, 28],
      ]),
      ...roadPair(p, "primary", ["primary"], p.roadFill, [
        [7, 0.8],
        [12, 3.2],
        [16, 9.5],
        [19, 32],
      ]),
      ...roadPair(
        p,
        "motorway",
        ["motorway", "trunk"],
        p.motorwayFill,
        [
          [5, 0.6],
          [10, 2.8],
          [14, 6.5],
          [16, 11],
          [19, 38],
        ],
        p.motorwayCasing,
      ),

      vector("rail", "transportation", "line", {
        minzoom: 12,
        filter: matchClass(["rail", "transit"]),
        paint: {
          "line-color": p.rail,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 18, 2.2],
        },
      }),

      vector("boundary", "boundary", "line", {
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": p.boundary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 12, 1.4],
          "line-dasharray": [3, 2],
          "line-opacity": 0.75,
        },
      }),

      /* Labels — few, quiet, haloed. The `poi` layer is deliberately absent. */
      vector("water-name", "water_name", "symbol", {
        minzoom: 10,
        layout: {
          "text-field": localName(),
          "text-font": FONT_ITALIC,
          "text-size": 11 * s,
          "text-max-width": 6,
        },
        paint: {
          "text-color": p.waterway,
          "text-halo-color": p.textHalo,
          "text-halo-width": 1,
        },
      }),
      vector("road-name", "transportation_name", "symbol", {
        minzoom: 15,
        layout: {
          "text-field": localName(),
          "text-font": FONT_REGULAR,
          "text-size": 10.5 * s,
          "symbol-placement": "line",
          "text-padding": 4,
          "text-letter-spacing": Math.max(0, p.letterSpacing) + 0.01,
        },
        paint: {
          "text-color": p.textSecondary,
          "text-halo-color": p.textHalo,
          "text-halo-width": 1.4,
        },
      }),
      vector("place-minor", "place", "symbol", {
        minzoom: 11,
        filter: matchClass(["village", "hamlet", "suburb", "neighbourhood", "quarter"]),
        layout: {
          "text-field": localName(),
          "text-font": FONT_REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10 * s, 16, 13 * s],
          "text-max-width": 8,
          "text-padding": 6,
          "text-letter-spacing": p.letterSpacing,
          ...(p.smallCaps ? { "text-transform": "uppercase" } : {}),
        },
        paint: {
          "text-color": p.textSecondary,
          "text-halo-color": p.textHalo,
          "text-halo-width": 1.6,
        },
      }),
      vector("place-major", "place", "symbol", {
        minzoom: 4,
        filter: matchClass(["city", "town"]),
        layout: {
          "text-field": localName(),
          "text-font": FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11 * s, 10, 15 * s, 14, 18 * s],
          "text-max-width": 8,
          "text-padding": 8,
          "text-letter-spacing": p.letterSpacing,
          ...(p.smallCaps ? { "text-transform": "uppercase" } : {}),
        },
        paint: {
          "text-color": p.textPrimary,
          "text-halo-color": p.textHalo,
          "text-halo-width": 1.8,
        },
      }),
    ],
  };

  return spec as MapStyle;
}

/** `name:fr` when OSM has it, the local name otherwise. */
function localName(): unknown[] {
  return ["coalesce", ["get", "name:fr"], ["get", "name"]];
}

function matchClass(values: string[]): unknown[] {
  return ["match", ["get", "class"], values, true, false];
}

type Stops = [number, number][];

function widthExpression(stops: Stops, factor = 1): unknown[] {
  const expression: unknown[] = ["interpolate", ["exponential", 1.4], ["zoom"]];
  for (const [zoom, width] of stops) {
    expression.push(zoom, Math.round(width * factor * 100) / 100);
  }
  return expression;
}

/**
 * Casing + fill for one road family.
 *
 * The casing is what makes a hierarchy readable at a glance. Signal inverts the
 * usual polarity — dark strokes on a pale ground — and the palette carries that
 * inversion, so the geometry code stays identical across the five maps.
 */
function roadPair(
  p: CartoPalette,
  key: string,
  classes: string[],
  fill: string,
  stops: Stops,
  casing = p.roadCasing,
): LayerSpec[] {
  const filter = matchClass(classes);
  const minzoom = stops[0]?.[0] ?? 5;
  const layout = { "line-cap": "round", "line-join": "round" };

  return [
    vector(`road-${key}-casing`, "transportation", "line", {
      minzoom,
      filter,
      layout,
      paint: { "line-color": casing, "line-width": widthExpression(stops, p.casingFactor) },
    }),
    vector(`road-${key}`, "transportation", "line", {
      minzoom,
      filter,
      layout,
      paint: { "line-color": fill, "line-width": widthExpression(stops) },
    }),
  ];
}

/**
 * One vector layer bound to our single source.
 *
 * `LayerSpec` is a discriminated union over a `type` this helper receives as a
 * plain string, so the compiler cannot pick the branch on its own; the
 * assertion is the price of authoring a style programmatically rather than as a
 * 400-line literal. Every call site below passes a valid `type` / `paint`
 * pair, and MapLibre validates the whole document at load time anyway.
 */
function vector(
  id: string,
  sourceLayer: string,
  type: LayerSpec["type"],
  rest: Record<string, unknown>,
): LayerSpec {
  return { id, type, source: SRC, "source-layer": sourceLayer, ...rest } as LayerSpec;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DVF overlay                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type PriceMode = "total" | "perSqm";

export interface PointProperties {
  id: string;
  label: string;
  price: number;
  type: string;
  multi: number;
}

export interface PointFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PointProperties;
}

export interface PointCollection {
  type: "FeatureCollection";
  features: PointFeature[];
}

export interface PolygonCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
    properties: Record<string, never>;
  }[];
}

/** Any MapLibre style expression: the style-spec types are not re-exported. */
export type StyleExpression = unknown[];

export interface MapTokens {
  marker: string;
  markerFg: string;
  cluster: string;
  selected: string;
  subject: string;
  surface: string;
  ink: string;
  inkInverted: string;
  border: string;
  accent: string;
  success: string;
}

/**
 * Repli codé dans le module, jamais dans le DOM.
 *
 * `readMapTokens` interroge des variables CSS personnalisées. Rien ne garantit
 * que la feuille de style du thème soit appliquée au moment où la carte se
 * monte (ordre de chargement du CSS, page rendue avant hydratation, thème
 * porté par un conteneur qui n'existe pas encore). Une couleur vide passée à
 * MapLibre rend le document de style INVALIDE, et un style invalide est rejeté
 * en silence : la carte reste blanche sans que rien ne le dise.
 *
 * Ces valeurs sont donc la vérité de dernier recours : une carte doit
 * s'afficher même si le thème n'est pas encore là. Elles reprennent la
 * direction par défaut (Clarté, univers particulier) ; le `MutationObserver`
 * de `dvf-map.tsx` repeint l'habillage dès que les vrais jetons arrivent.
 */
export const FALLBACK_MAP_TOKENS: MapTokens = {
  marker: "#2145e6",
  markerFg: "#ffffff",
  cluster: "#3a66f7",
  selected: "#0c1425",
  subject: "#cf3040",
  surface: "#ffffff",
  ink: "#0c1425",
  inkInverted: "#ffffff",
  border: "#e1e6f0",
  accent: "#3a66f7",
  success: "#0f8a5f",
};

const TOKEN_NAMES: Record<keyof MapTokens, string> = {
  marker: "--map-marker",
  markerFg: "--map-marker-fg",
  cluster: "--map-cluster",
  selected: "--map-selected",
  subject: "--map-subject",
  surface: "--surface",
  ink: "--ink",
  inkInverted: "--ink-inverted",
  border: "--border",
  accent: "--accent",
  success: "--success",
};

export function readMapTokens(element: Element): MapTokens {
  let computed: CSSStyleDeclaration | null = null;
  try {
    computed = getComputedStyle(element);
  } catch {
    // Élément détaché du document : aucune valeur à lire, le repli suffit.
    return { ...FALLBACK_MAP_TOKENS };
  }

  const tokens = { ...FALLBACK_MAP_TOKENS };
  for (const key of Object.keys(TOKEN_NAMES) as (keyof MapTokens)[]) {
    const value = computed.getPropertyValue(TOKEN_NAMES[key]).trim();
    if (value.length > 0) tokens[key] = value;
  }
  return tokens;
}

/**
 * Marker chrome must survive five very different grounds — including a night
 * blue and a cream paper. Pills therefore always carry a solid fill and a
 * contrasting outline taken from the theme, never a translucent one.
 */
export function markerChrome(tokens: MapTokens, dark: boolean): {
  pillFill: string;
  pillStroke: string;
  pillText: string;
  clusterStroke: string;
  dotStroke: string;
} {
  return dark
    ? {
        // On the night basemap a white chip is the strongest possible signal.
        pillFill: tokens.surface,
        pillStroke: tokens.marker,
        pillText: tokens.ink,
        clusterStroke: tokens.surface,
        dotStroke: tokens.surface,
      }
    : {
        pillFill: tokens.surface,
        pillStroke: tokens.border,
        pillText: tokens.ink,
        clusterStroke: tokens.surface,
        dotStroke: tokens.surface,
      };
}

export function toFeatureCollection(
  rows: readonly DvfTransaction[],
  mode: PriceMode,
): PointCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [row.coordinates.lng, row.coordinates.lat] as [number, number],
      },
      properties: {
        id: row.id,
        label: markerLabel(row, mode),
        price: row.price,
        type: row.propertyType,
        // MapLibre expressions handle numbers more predictably than booleans.
        multi: row.isMultiLot ? 1 : 0,
      },
    })),
  };
}

function markerLabel(row: DvfTransaction, mode: PriceMode): string {
  if (mode === "perSqm") {
    // No surface means no unit price: say so instead of falling back to the
    // total, which would silently mix two quantities on the same map.
    return row.pricePerSqm === undefined
      ? "n.c."
      : `${Math.round(row.pricePerSqm).toLocaleString("fr-FR")} €/m²`;
  }
  return formatPriceShort(row.price);
}

export function subjectCircleCollection(center: LatLng, radiusMeters: number): PolygonCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [geodesicCircleRing(center, radiusMeters, 128)] },
      },
    ],
  };
}

export const EMPTY_POINTS: PointCollection = { type: "FeatureCollection", features: [] };
export const EMPTY_POLYGONS: PolygonCollection = { type: "FeatureCollection", features: [] };

/* ── Runtime-generated marker chrome ─────────────────────────────────────── */

const PILL_W = 88;
const PILL_H = 46;

export interface GeneratedImage {
  data: ImageData;
  options: Partial<StyleImageMetadata>;
}

/**
 * A 9-slice rounded chip. `stretchX` marks the band MapLibre may repeat to fit
 * the label; `content` is where the text lands.
 */
export function createPillImage(fill: string, stroke: string): GeneratedImage | null {
  const canvas = document.createElement("canvas");
  canvas.width = PILL_W;
  canvas.height = PILL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const radius = (PILL_H - 8) / 2;
  ctx.clearRect(0, 0, PILL_W, PILL_H);

  // Soft drop shadow: the pills must float above the basemap, not sit in it.
  ctx.shadowColor = "rgba(8, 14, 26, 0.34)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  roundedRect(ctx, 4, 4, PILL_W - 8, PILL_H - 8, radius);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  return {
    data: ctx.getImageData(0, 0, PILL_W, PILL_H),
    options: {
      pixelRatio: 2,
      // Only the straight middle band may stretch, so the caps stay round.
      stretchX: [[radius + 6, PILL_W - radius - 6]],
      stretchY: [[PILL_H / 2 - 2, PILL_H / 2 + 2]],
      content: [14, 6, PILL_W - 14, PILL_H - 6],
    },
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* ── Style introspection ─────────────────────────────────────────────────── */

/**
 * Picks a font family the LOADED style already uses. Ours always offers Noto
 * Sans, but `NEXT_PUBLIC_MAP_STYLE_URL` may point at IGN, MapTiler or
 * Protomaps, whose glyph servers publish different families — and every one of
 * them 404s on a multi-family stack.
 */
export function resolveFontStack(style: StyleSpecification | undefined): string[] {
  const counts = new Map<string, number>();
  for (const styleLayer of style?.layers ?? []) {
    if (styleLayer.type !== "symbol") continue;
    const font: unknown = styleLayer.layout?.["text-font"];
    if (!Array.isArray(font)) continue;
    const first: unknown = font[0];
    if (typeof first !== "string") continue;
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  if (counts.size === 0) return FONT_BOLD;

  // Prefer a bold cut for numbers; otherwise the most-used family.
  const names = [...counts.keys()];
  const bold = names.find((n) => /bold|semibold|medium/i.test(n));
  if (bold) return [bold];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return [sorted[0]?.[0] ?? "Noto Sans Bold"];
}

export interface BuildingCapability {
  source: string;
  sourceLayer: string;
  /** Property carrying a height in metres, when the tiles have one. */
  heightProperty?: string;
  /** Property carrying the base height (bridges, elevated volumes). */
  baseProperty?: string;
  /** Property flagging volumes OSM asks not to extrude. */
  hide3dProperty?: string;
  /** Layer to insert the extrusion before, so labels stay on top. */
  beforeId?: string;
}

const HEIGHT_KEYS = ["render_height", "hauteur", "height", "HAUTEUR"];
const BASE_KEYS = ["render_min_height", "min_height"];

/**
 * Capability of OUR style, stated rather than probed.
 *
 * Probing right after `setStyle` is a race: the building tiles are usually not
 * parsed yet, `querySourceFeatures` returns nothing, and the extrusion would be
 * stuck on the flat 6 m fallback for the rest of the session. We know exactly
 * what OpenFreeMap publishes, so we say so.
 */
export function defaultBuildingCapability(map: MapLibreMap): BuildingCapability {
  return {
    source: OFM_SOURCE_ID,
    sourceLayer: OFM_BUILDING_LAYER,
    heightProperty: "render_height",
    baseProperty: "render_min_height",
    hide3dProperty: "hide_3d",
    beforeId: firstSymbolLayerId(map),
  };
}

function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  for (const styleLayer of map.getStyle()?.layers ?? []) {
    if (styleLayer.type === "symbol") return styleLayer.id;
  }
  return undefined;
}

/**
 * Finds a building polygon layer in whatever style is loaded, then probes real
 * features for a usable height.
 *
 * Our own style always satisfies this: OpenMapTiles' `building` layer publishes
 * `render_height`, `render_min_height` and `hide_3d`. The probe exists for
 * substituted styles — the IGN "PLAN.IGN" tiles, for instance, expose
 * `bati_surf` with a `hauteur` in metres (409/409 buildings over central
 * Nantes, median 14,7 m). A style with buildings but no height falls back to a
 * low constant volume rather than inventing storeys.
 */
export function detectBuildingCapability(map: MapLibreMap): BuildingCapability | null {
  const style = map.getStyle();
  if (!style) return null;

  let match: { source: string; sourceLayer: string } | null = null;
  let firstSymbolId: string | undefined;

  for (const styleLayer of style.layers) {
    if (!firstSymbolId && styleLayer.type === "symbol") firstSymbolId = styleLayer.id;
    if (match) continue;
    if (styleLayer.type !== "fill") continue;
    const sourceLayer: unknown =
      "source-layer" in styleLayer ? styleLayer["source-layer"] : undefined;
    const source: unknown = "source" in styleLayer ? styleLayer.source : undefined;
    if (typeof sourceLayer !== "string" || typeof source !== "string") continue;
    if (!/^building|bati_surf/i.test(sourceLayer)) continue;
    match = { source, sourceLayer };
  }

  if (!match) return null;

  let heightProperty: string | undefined;
  let baseProperty: string | undefined;
  let hide3dProperty: string | undefined;

  try {
    const features = map.querySourceFeatures(match.source, { sourceLayer: match.sourceLayer });
    for (const feature of features.slice(0, 80)) {
      const props: Record<string, unknown> = feature.properties ?? {};
      heightProperty ??= HEIGHT_KEYS.find(
        (key) => typeof props[key] === "number" && (props[key] as number) > 0,
      );
      baseProperty ??= BASE_KEYS.find((key) => typeof props[key] === "number");
      if (hide3dProperty === undefined && "hide_3d" in props) hide3dProperty = "hide_3d";
      if (heightProperty && baseProperty) break;
    }
  } catch {
    // Source not queryable yet: fall through; the caller copes with no height.
  }

  return { ...match, heightProperty, baseProperty, hide3dProperty, beforeId: firstSymbolId };
}

/** `["case", …]` yielding `selected` / `comparable` / `base` per feature. */
export function stateExpression<T extends string | number>(
  selectedId: string | null,
  comparableIds: readonly string[],
  values: { selected: T; comparable: T; base: T },
): T | StyleExpression {
  const cases: unknown[] = ["case"];
  if (selectedId) cases.push(["==", ["get", "id"], selectedId], values.selected);
  if (comparableIds.length > 0) {
    cases.push(["in", ["get", "id"], ["literal", [...comparableIds]]], values.comparable);
  }
  if (cases.length === 1) return values.base;
  cases.push(values.base);
  return cases;
}

export { getCartoPalette };
export type { CartoPalette };
