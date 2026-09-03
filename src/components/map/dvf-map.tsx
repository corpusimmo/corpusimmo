"use client";

/**
 * The DVF map.
 *
 * ARCHITECTURE (and why)
 * ──────────────────────
 * · Data is drawn by MapLibre LAYERS, never by DOM markers. Three regimes take
 *   over from one another as you zoom: numbered clusters → plain dots →
 *   labelled price pills. The only DOM marker is the studied property, which is
 *   unique and deserves an animated halo.
 * · Selection, hover and "already in the basket" are expressed as *paint
 *   expressions* recomputed on change, not as data round-trips: re-sending the
 *   GeoJSON on every hover would allocate megabytes per second.
 * · Loading is debounced 400 ms on `moveend`, aborted on the next move, and
 *   refused below `MIN_DATA_ZOOM` — a France-wide query is neither useful nor
 *   affordable (CONTRACTS §7).
 * · An error NEVER degrades into plausible-looking data: the map empties and
 *   says what failed, with a retry.
 *
 * THE `setStyle` TRAP
 * ───────────────────
 * Switching basemap replaces the whole style document, which destroys every
 * source, layer AND image we added — the transactions would silently vanish on
 * the first switch. `ensureDvfLayers()` is therefore idempotent and is called
 * both on `load` and on every `styledata`, reinstalling the overlay whenever it
 * finds it missing.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AttributionControl,
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Box,
  Tag,
  TrainFront,
  Layers,
  Loader2,
  RotateCw,
  Search,
  Square,
  TriangleAlert,
} from "lucide-react";
import type { DvfQueryFilters, DvfResult, DvfTransaction } from "@/types/dvf";
import type { BBox, LatLng } from "@/types/geo";
import { cleanEnv } from "@/lib/utils/env-value";
import { haversineMeters } from "@/lib/geo/distance";
import { coverageDisclaimer, coverageLabel } from "@/lib/dvf/coverage";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import {
  buildMapStyle,
  BUILDING_3D_MIN_ZOOM,
  SOURCE_BASEMAP,
  createPillImage,
  detectBuildingCapability,
  DVF_ATTRIBUTION,
  EMPTY_POINTS,
  EMPTY_POLYGONS,
  FALLBACK_MAP_TOKENS,
  getCartoPalette,
  markerChrome,
  readMapTokens,
  resolveFontStack,
  stateExpression,
  subjectCircleCollection,
  toFeatureCollection,
  type MapTokens,
  type PriceMode,
} from "./map-style";
import { TransactionPopup } from "./transaction-popup";
import { TransactionCard } from "./transaction-card";
import { useDvfData } from "./use-dvf-data";
import { PRICE_RAMP } from "./base-palette";
import { PriceLegend } from "./price-legend";
import { ZoningLegend } from "./zoning-legend";
import {
  installTransportLayers,
  setTransportVisibility,
} from "./transports";
import { TransportsLegend } from "./transports-legend";
import {
  buildTerritoryScale,
  installTerritoryLayers,
  type TerritoryScale,
} from "./territories";
import { buildPriceScale, byPriceClass, type PriceScale } from "./price-scale";
import {
  installZoningLayers,
  setZoningVisibility,
} from "./zoning";

/** Below this zoom a viewport covers whole départements: we refuse to query. */
export const MIN_DATA_ZOOM = 13;

/**
 * Ce que la carte sait dire d'elle-même à l'écran qui l'entoure.
 *
 * `zoom` n'est pas un chargement : aucune requête n'est lancée tant que
 * l'emprise dépasse ce que le serveur accepte. Les confondre laissait le
 * panneau latéral sur un squelette éternel, pendant que la carte affichait déjà
 * « Zoomez pour afficher les ventes ». Deux écrans qui se contredisent.
 */
export type DvfMapState = "zoom" | "loading" | "ready" | "error";

/** Camera tilt used whenever the building volumes are on screen. */
const PITCH_3D = 52;

/**
 * Délai au-delà duquel un fond de carte qui n'a pas répondu est déclaré en
 * panne — compté UNIQUEMENT pendant que la page est visible (voir l'effet
 * « chien de garde »). Large : sur un réseau lent, le TileJSON, le sprite et
 * les trois plages de glyphes prennent facilement plusieurs secondes.
 */
const BASEMAP_TIMEOUT_MS = 15_000;

/**
 * Échappatoire vers MapTiler / Protomaps / IGN.
 *
 * `cleanEnv` et non une lecture directe : Next inline une variable
 * NEXT_PUBLIC absente en chaîne VIDE, et `STYLE_OVERRIDE ?? buildMapStyle(…)`
 * renvoyait alors `""` à MapLibre — carte blanche en production, alors qu'elle
 * fonctionnait en développement. Voir `lib/utils/env-value.ts`.
 */
const STYLE_OVERRIDE = cleanEnv(process.env.NEXT_PUBLIC_MAP_STYLE_URL);

const SOURCE_POINTS = "corpusimmo-dvf";
const SOURCE_SUBJECT = "corpusimmo-subject";

const LAYER_SUBJECT_FILL = "corpusimmo-subject-fill";
const LAYER_SUBJECT_LINE = "corpusimmo-subject-line";
const LAYER_CLUSTER = "corpusimmo-cluster";
const LAYER_CLUSTER_COUNT = "corpusimmo-cluster-count";
const LAYER_DOT = "corpusimmo-dot";
const LAYER_PRICE = "corpusimmo-price";
const LAYER_BUILDINGS = "corpusimmo-buildings";

const IMG_PILL = "corpusimmo-pill";
const IMG_PILL_SELECTED = "corpusimmo-pill-selected";
const IMG_PILL_COMPARABLE = "corpusimmo-pill-comparable";

/** Une pastille par couleur de l'échelle, nommée par sa teinte. */
function pillImageId(color: string): string {
  return `corpusimmo-pill-${color.replace("#", "")}`;
}

const DEFAULT_CENTER: LatLng = { lat: 47.2184, lng: -1.5536 };

export interface DvfMapProps {
  className?: string;
  initialCenter?: LatLng;
  initialZoom?: number;
  filters?: DvfQueryFilters;
  /** Studied property: distinct marker plus a true-to-scale radius ring. */
  subject?: { point: LatLng; label?: string; radius?: number } | null;
  /** Imposed rows (result page). When absent, the map queries the API itself. */
  transactions?: DvfTransaction[];
  selectedId?: string | null;
  onSelect?: (transaction: DvfTransaction | null) => void;
  /** Pro: ids already in the basket, for the ✓ state of the markers. */
  comparableIds?: string[];
  onToggleComparable?: (transaction: DvfTransaction) => void;
  onDataChange?: (result: DvfResult | null, state: DvfMapState) => void;
  /**
   * Densité d'affichage, jamais un univers : mêmes couleurs, mêmes composants.
   * `dense` resserre les libellés, les pastilles et les seuils de zoom pour les
   * écrans d'analyse où la carte partage la largeur avec un tableau.
   */
  density?: "standard" | "dense";
  interactive3d?: boolean;
  /**
   * Décale les commandes de la carte vers le bas, en unités CSS.
   *
   * La page « Carte des ventes » pose sa propre recherche flottante par-dessus
   * la carte sur mobile : sans ce décalage, les commandes de la carte se
   * retrouvent DERRIÈRE elle, visibles mais inatteignables. L'écran qui
   * superpose est le seul à savoir de combien, donc c'est lui qui le dit.
   */
  chromeOffset?: string;
}

interface InstallContext {
  tokens: MapTokens;
  dense: boolean;
  dark: boolean;
}

export function DvfMap({
  className,
  initialCenter,
  initialZoom = 14,
  filters,
  subject,
  transactions,
  selectedId,
  onSelect,
  comparableIds,
  onToggleComparable,
  onDataChange,
  density = "standard",
  // 3D is the default posture, not an opt-in: the volumes are what make the
  // observatory read as a 2026 product rather than an administrative plan.
  interactive3d = true,
  chromeOffset,
}: DvfMapProps) {
  const isDense = density === "dense";
  const controlled = transactions !== undefined;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [map, setMap] = React.useState<MapLibreMap | null>(null);
  const [styleReady, setStyleReady] = React.useState(false);
  /** Erreurs du fond de carte : la première parle, les suivantes se taisent. */
  const erreursFondRef = React.useRef(0);
  /**
   * Le fond de carte a échoué. Distinct de `data.error`, qui ne concerne que
   * les ventes DVF : jusqu'ici un fond de carte en panne ne disait RIEN, et
   * l'écran restait sur son squelette indéfiniment.
   */
  const [basemapError, setBasemapError] = React.useState<string | null>(null);
  /** Le fond de carte a été peint au moins une fois (`load` / `idle`). */
  const [basemapPainted, setBasemapPainted] = React.useState(false);
  const [zoomTooLow, setZoomTooLow] = React.useState(false);
  const [isCompact, setIsCompact] = React.useState(false);
  // Le €/m² d'abord : c'est la seule unité comparable d'une vente à
  // l'autre. Le prix global reste à un clic, en second.
  const [priceMode, setPriceMode] = React.useState<PriceMode>("perSqm");
  /**
   * Les étiquettes de prix sont-elles affichées ?
   *
   * Allumées d'entrée : c'est ce que les gens viennent lire. Mais elles
   * couvrent la carte, et le zonage sous-jacent ne devient lisible qu'une fois
   * les pastilles retirées — d'où l'interrupteur.
   */
  const [showPrices, setShowPrices] = React.useState(true);

  /**
   * Le groupe de boutons où va se ranger la bascule 3D.
   *
   * Le relief est une commande de CAMÉRA, pas un calque : sa place est avec le
   * zoom et la boussole, pas dans la colonne qui décide de ce que la carte
   * affiche. On le pose donc dans la pile de commandes de MapLibre, où il
   * s'empile tout seul sous la navigation et hérite de son gabarit.
   */
  const [pitchSlot, setPitchSlot] = React.useState<HTMLElement | null>(null);

  /**
   * Échelle nationale des médianes départementales.
   *
   * Chargée une fois, en tâche de fond : sous le zoom 13 la carte n'a rien
   * d'autre à montrer, mais au-dessus le fichier ne sert plus à rien — il ne
   * doit donc jamais retarder l'affichage des ventes.
   */
  const [territoryScale, setTerritoryScale] =
    React.useState<TerritoryScale | null>(null);
  /** Le calque d'affectation du sol est-il allumé, et peut-il l'être ? */
  const [zoning, setZoning] = React.useState(false);
  const [zoningAvailable, setZoningAvailable] = React.useState(false);
  /** Le calque transports et commodités est-il allumé, et disponible ? */
  const [transports, setTransports] = React.useState(false);
  const [transportsAvailable, setTransportsAvailable] = React.useState(false);
  const [has3d, setHas3d] = React.useState(false);
  const [pitched, setPitched] = React.useState(false);
  const [internalSelectedId, setInternalSelectedId] = React.useState<
    string | null
  >(null);

  const tokensRef = React.useRef<MapTokens | null>(null);
  const subjectMarkerRef = React.useRef<Marker | null>(null);
  const hoveredIdRef = React.useRef<string | null>(null);
  /** Vrai dès que le fond de carte a été peint au moins une fois. */
  const basemapPaintedRef = React.useRef(false);

  const data = useDvfData(filters, !controlled);
  const rows = React.useMemo<DvfTransaction[]>(
    () => transactions ?? data.result?.transactions ?? [],
    [transactions, data.result],
  );

  const effectiveSelectedId =
    selectedId !== undefined ? selectedId : internalSelectedId;
  const selected = React.useMemo(
    () => rows.find((row) => row.id === effectiveSelectedId) ?? null,
    [rows, effectiveSelectedId],
  );
  const comparables = React.useMemo(() => comparableIds ?? [], [comparableIds]);
  /** L'échelle de couleur, recalculée sur les ventes à l'écran. */
  const scale = React.useMemo(
    () => buildPriceScale(rows.map((row) => row.pricePerSqm)),
    [rows],
  );

  const dark = getCartoPalette(isDense).dark;

  // Refs mirror interactive state so map handlers, bound once, always read the
  // current value without being re-registered.
  const selectedIdRef = React.useRef<string | null>(effectiveSelectedId);
  selectedIdRef.current = effectiveSelectedId;
  const comparablesRef = React.useRef<readonly string[]>(comparables);
  comparablesRef.current = comparables;
  const rowsRef = React.useRef<DvfTransaction[]>(rows);
  rowsRef.current = rows;
  const priceModeRef = React.useRef<PriceMode>(priceMode);
  priceModeRef.current = priceMode;
  const zoningRef = React.useRef(zoning);
  zoningRef.current = zoning;
  const transportsRef = React.useRef(transports);
  transportsRef.current = transports;
  const showPricesRef = React.useRef(showPrices);
  showPricesRef.current = showPrices;
  const scaleRef = React.useRef<PriceScale | null>(scale);
  scaleRef.current = scale;
  const subjectRef = React.useRef(subject);
  subjectRef.current = subject;
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;
  const contextRef = React.useRef<InstallContext>({
    tokens: { ...FALLBACK_MAP_TOKENS },
    dense: isDense,
    dark,
  });
  contextRef.current = {
    tokens: tokensRef.current ?? FALLBACK_MAP_TOKENS,
    dense: isDense,
    dark,
  };
  const interactive3dRef = React.useRef(interactive3d);
  interactive3dRef.current = interactive3d;
  /** Set once the user tilts by hand, so the automatic camera stops meddling. */
  const userTiltedRef = React.useRef(false);

  const select = React.useCallback((transaction: DvfTransaction | null) => {
    setInternalSelectedId(transaction?.id ?? null);
    onSelectRef.current?.(transaction ?? null);
  }, []);

  /* ── Interaction styling ───────────────────────────────────────────────── */

  const applyInteractionStyles = React.useCallback(() => {
    const instance = mapRef.current;
    const tokens = tokensRef.current;
    if (!instance || !tokens || !instance.getLayer(LAYER_DOT)) return;

    const sel = selectedIdRef.current;
    const comp = comparablesRef.current;
    const hovered = hoveredIdRef.current ?? " ";
    const scale = scaleRef.current;
    const ppsm: unknown[] = ["get", "ppsm"];

    instance.setPaintProperty(
      LAYER_DOT,
      "circle-color",
      stateExpression(sel, comp, {
        selected: tokens.selected,
        comparable: tokens.success,
        base: scale
          ? byPriceClass(scale, ppsm, scale.colors, tokens.marker)
          : tokens.marker,
      }),
    );

    // Les grappes prennent la couleur de leur prix au m² moyen, calculé par
    // MapLibre lui-même (`clusterProperties`). Une grappe sans surface connue
    // garde le bleu neutre plutôt qu'une classe inventée.
    if (
      instance.getLayer(LAYER_CLUSTER) &&
      instance.getLayer(LAYER_CLUSTER_COUNT)
    ) {
      const mean: unknown[] = [
        "/",
        ["get", "ppsmSum"],
        ["max", ["get", "ppsmCount"], 1],
      ];
      const known: unknown[] = [">", ["get", "ppsmCount"], 0];
      instance.setPaintProperty(
        LAYER_CLUSTER,
        "circle-color",
        scale
          ? [
              "case",
              known,
              byPriceClass(scale, mean, scale.colors, tokens.cluster),
              tokens.cluster,
            ]
          : tokens.cluster,
      );
      instance.setPaintProperty(
        LAYER_CLUSTER_COUNT,
        "text-color",
        scale
          ? [
              "case",
              known,
              byPriceClass(
                scale,
                mean,
                scale.colors.map((color) => readableInk(color, tokens)),
                tokens.markerFg,
              ),
              tokens.markerFg,
            ]
          : tokens.markerFg,
      );
    }
    instance.setPaintProperty(LAYER_DOT, "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],
      MIN_DATA_ZOOM,
      ["case", ["==", ["get", "id"], hovered], 7, 4.2],
      17,
      ["case", ["==", ["get", "id"], hovered], 11, 8],
    ]);

    if (!instance.getLayer(LAYER_PRICE)) return;

    const pillText = markerChrome(tokens, contextRef.current.dark).pillText;
    instance.setLayoutProperty(
      LAYER_PRICE,
      "icon-image",
      stateExpression(sel, comp, {
        selected: IMG_PILL_SELECTED,
        comparable: IMG_PILL_COMPARABLE,
        base: scale
          ? byPriceClass(scale, ppsm, scale.colors.map(pillImageId), IMG_PILL)
          : IMG_PILL,
      }),
    );
    instance.setPaintProperty(
      LAYER_PRICE,
      "text-color",
      stateExpression(sel, comp, {
        selected: readableInk(tokens.selected, tokens),
        comparable: readableInk(tokens.success, tokens),
        base: scale
          ? byPriceClass(
              scale,
              ppsm,
              scale.colors.map((color) => readableInk(color, tokens)),
              pillText,
            )
          : pillText,
      }),
    );
    instance.setLayoutProperty(LAYER_PRICE, "symbol-sort-key", [
      "case",
      ["==", ["get", "id"], sel ?? " "],
      -1_000_000_000,
      ["-", 0, ["get", "price"]],
    ]);
  }, []);

  /* ── Overlay (re)installation ──────────────────────────────────────────── */

  const syncBuildings = React.useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;

    if (!interactive3dRef.current) {
      if (instance.getLayer(LAYER_BUILDINGS))
        instance.removeLayer(LAYER_BUILDINGS);
      setHas3d(false);
      return;
    }

    const capability = detectBuildingCapability(instance);
    if (!capability) {
      // The style has no building polygons at all. Rather than fake a skyline
      // we keep the map flat and hide the 3D affordance.
      setHas3d(false);
      return;
    }

    if (!instance.getLayer(LAYER_BUILDINGS)) {
      const palette = getCartoPalette(isDenseRef.current);
      instance.addLayer(
        {
          id: LAYER_BUILDINGS,
          type: "fill-extrusion",
          source: capability.source,
          "source-layer": capability.sourceLayer,
          minzoom: BUILDING_3D_MIN_ZOOM,
          // OSM marks volumes that must not be extruded (roofs over voids…).
          filter: capability.hide3dProperty
            ? ["!=", ["get", capability.hide3dProperty], true]
            : ["all"],
          paint: {
            "fill-extrusion-color": palette.building3d,
            // No height in the tiles → one low, uniform volume. Inventing
            // storeys would be a lie dressed up as a feature.
            "fill-extrusion-height": capability.heightProperty
              ? [
                  "coalesce",
                  ["to-number", ["get", capability.heightProperty]],
                  6,
                ]
              : 6,
            "fill-extrusion-base": capability.baseProperty
              ? ["coalesce", ["to-number", ["get", capability.baseProperty]], 0]
              : 0,
            "fill-extrusion-vertical-gradient": true,
            // Grows in rather than appearing: the handover from the flat fill
            // must feel like the same buildings standing up.
            "fill-extrusion-opacity": 0,
          },
        },
        capability.beforeId,
      );
      window.requestAnimationFrame(() => {
        // La carte a pu être détruite entre-temps — React monte et démonte deux
        // fois en développement. Sans ce garde, la frame s'exécute sur une
        // instance vidée et lève, ce qui masque les vraies erreurs de style.
        if (!instance.getStyle || !instance.getLayer(LAYER_BUILDINGS)) return;
        if (instance.getLayer(LAYER_BUILDINGS)) {
          instance.setPaintProperty(
            LAYER_BUILDINGS,
            "fill-extrusion-opacity",
            0.9,
          );
        }
      });
    }
    setHas3d(true);
  }, []);

  const isDenseRef = React.useRef(isDense);
  isDenseRef.current = isDense;

  const hydrate = React.useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;

    const collection = toFeatureCollection(
      rowsRef.current,
      priceModeRef.current,
    );
    geojsonSource(instance, SOURCE_POINTS)?.setData(collection);

    const current = subjectRef.current;
    geojsonSource(instance, SOURCE_SUBJECT)?.setData(
      current?.radius && current.radius > 0
        ? subjectCircleCollection(current.point, current.radius)
        : EMPTY_POLYGONS,
    );

    applyInteractionStyles();
    syncBuildings();
  }, [applyInteractionStyles, syncBuildings]);

  /* ── Échelle nationale ─────────────────────────────────────────────────── */

  React.useEffect(() => {
    let alive = true;
    fetch("/geo/departements.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((collection: { features?: { properties?: { ppsm?: number | null } }[] }) => {
        if (!alive) return;
        const values = (collection.features ?? [])
          .map((f) => f.properties?.ppsm)
          .filter((v): v is number => typeof v === "number");
        setTerritoryScale(buildTerritoryScale(values));
      })
      .catch(() => {
        // Pas d'échelle, pas de choropleth : la carte reste ce qu'elle était.
        // Un fond national absent ne doit rien casser des ventes.
      });
    return () => {
      alive = false;
    };
  }, []);

  /* ── Étiquettes de prix ────────────────────────────────────────────────── */

  const syncPriceLabels = React.useCallback(
    (instance: MapLibreMap, visible: boolean) => {
      if (!instance.getLayer(LAYER_PRICE) || !instance.getLayer(LAYER_DOT)) {
        return;
      }
      instance.setLayoutProperty(
        LAYER_PRICE,
        "visibility",
        visible ? "visible" : "none",
      );
      // Les points reprennent le service : sans ce retour à l'opacité pleine,
      // masquer les pastilles viderait la carte au-delà du zoom de bascule.
      const opacity = visible ? dotFade(isDense) : 1;
      instance.setPaintProperty(LAYER_DOT, "circle-opacity", opacity);
      instance.setPaintProperty(LAYER_DOT, "circle-stroke-opacity", opacity);
    },
    [isDense],
  );

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;
    syncPriceLabels(instance, showPrices);
  }, [showPrices, syncPriceLabels]);

  /**
   * Idempotent: called on `load` AND on every `styledata`, because switching
   * basemap wipes our sources, layers and images along with the old style.
   */
  const ensureDvfLayers = React.useCallback(() => {
    const instance = mapRef.current;
    const container = containerRef.current;
    if (!instance || !container || !instance.getStyle()) return;
    if (instance.getSource(SOURCE_POINTS)) return;

    const tokens = readMapTokens(container);
    tokensRef.current = tokens;
    installDvfLayers(instance, {
      tokens,
      dense: isDense,
      dark: contextRef.current.dark,
    });
    // Sous le bâti, donc sous les routes et les pastilles : le zonage est un
    // fond, jamais un premier plan. Il repart caché à chaque changement de
    // fond de carte, d'où la remise en état juste après.
    const supported = installZoningLayers(instance, "building");
    setZoningAvailable(supported);
    if (supported) setZoningVisibility(instance, zoningRef.current);

    // Les transports passent AU-DESSUS du zonage et du bâti, mais SOUS
    // l'overlay des ventes : un tram ne doit jamais masquer une pastille de
    // prix, qui reste la donnée principale de l'écran.
    const rails = installTransportLayers(instance, LAYER_SUBJECT_FILL);
    setTransportsAvailable(rails);
    if (rails) setTransportVisibility(instance, transportsRef.current);
    syncPriceLabels(instance, showPricesRef.current);
    hydrate();
  }, [hydrate, isDense, syncPriceLabels]);

  // L'échelle arrive par le réseau, souvent APRÈS la création de la carte, et
  // `ensureDvfLayers` sort tôt dès que ses propres sources existent : lui
  // repasser la main ne poserait rien. Le choropleth a donc son propre effet,
  // rejoué à chaque style prêt — donc aussi après un changement de fond.
  React.useEffect(() => {
    const instance = mapRef.current;
    const container = containerRef.current;
    if (!instance || !container || !territoryScale || !styleReady) return;
    if (!instance.getStyle()) return;

    const tokens = tokensRef.current ?? readMapTokens(container);
    installTerritoryLayers(
      instance,
      territoryScale,
      {
        line: tokens.markerFg,
        label: tokens.ink,
        halo: tokens.surface,
      },
      "building",
    );
  }, [territoryScale, styleReady]);

  /* ── Affectation du sol ────────────────────────────────────────────────── */

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !zoningAvailable) return;
    setZoningVisibility(instance, zoning);
  }, [zoning, zoningAvailable]);

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !transportsAvailable) return;
    setTransportVisibility(instance, transports);
  }, [transports, transportsAvailable]);

  /* ── Format d'affichage de la fiche ────────────────────────────────────── */

  // La largeur se SUIT, elle ne se photographie pas. Mesurée une seule fois à
  // la création de la carte, elle restait figée sur la valeur du premier rendu :
  // une carte montée en étroit gardait sa feuille du bas par-dessus la moitié
  // de la carte une fois la fenêtre élargie, et une carte montée en large
  // écrasait un encart de 19 rem sur un écran de téléphone.
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  /* ── Map creation ──────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    tokensRef.current = readMapTokens(container);

    // Les options de construction de MapLibre, elles, se figent bel et bien
    // à la création : gestes coopératifs, boutons de zoom, attribution.
    const compact = window.matchMedia("(max-width: 767px)").matches;

    // A map filling the viewport IS the page; anything shorter is embedded in a
    // scrolling document, where swallowing one-finger pans would trap the user.
    const embedded =
      container.getBoundingClientRect().height < window.innerHeight * 0.8;

    const instance = new MapLibreMap({
      container,
      style: STYLE_OVERRIDE ?? buildMapStyle({ dense: isDenseRef.current }),
      center: [
        (initialCenter ?? DEFAULT_CENTER).lng,
        (initialCenter ?? DEFAULT_CENTER).lat,
      ],
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      maxZoom: 19.5,
      minZoom: 4,
      // Licence condition: attribution is always on, never `false`.
      attributionControl: false,
      cooperativeGestures: compact && embedded,
      locale: {
        "CooperativeGesturesHandler.WindowsHelpText":
          "Utilisez Ctrl + molette pour zoomer sur la carte",
        "CooperativeGesturesHandler.MacHelpText":
          "Utilisez ⌘ + molette pour zoomer sur la carte",
        "CooperativeGesturesHandler.MobileHelpText":
          "Utilisez deux doigts pour déplacer la carte",
      },
    });

    mapRef.current = instance;
    setMap(instance);

    // En développement seulement : l'instance est exposée pour les scripts de
    // mesure (temps par image sur un déplacement programmé) et le débogage.
    // Jamais en production, où rien ne doit toucher la carte de l'extérieur.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __corpusMap?: MapLibreMap }).__corpusMap =
        instance;
    }

    instance.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: !compact,
        visualizePitch: true,
      }),
      "top-right",
    );
    instance.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: DVF_ATTRIBUTION,
      }),
      "bottom-right",
    );
    if (!compact) {
      instance.addControl(
        new ScaleControl({ maxWidth: 110, unit: "metric" }),
        "bottom-left",
      );
    }

    // Un groupe vide sous la navigation ; React y projette le bouton. Même
    // pattern que la fiche de vente, qui se projette dans le popup MapLibre :
    // la carte possède la position, React possède le contenu.
    const pitchGroup = document.createElement("div");
    pitchGroup.className = "maplibregl-ctrl maplibregl-ctrl-group";
    container
      .querySelector(".maplibregl-ctrl-top-right")
      ?.appendChild(pitchGroup);
    setPitchSlot(pitchGroup);

    /**
     * `getStyle()` ne renvoie un document QUE lorsque MapLibre l'a réellement
     * analysé (`Style.serialize()` rend `undefined` tant que `_loaded` est
     * faux). C'est le signal « les couches peuvent être posées » — il vaut
     * aussi après un `setStyle`, contrairement à `load` qui n'est émis qu'une
     * fois dans la vie de la carte.
     */
    const onStyleData = (): void => {
      ensureDvfLayersRef.current();
      if (instance.getStyle()) setStyleReady(true);
    };
    const onPitch = (): void => setPitched(instance.getPitch() > 10);

    /**
     * MapLibre ne lève jamais : tout passe par cet événement. Sans écouteur il
     * se contente d'un `console.error` — invisible pour l'utilisateur, resté
     * devant un rectangle vide. C'était la vraie faute : le composant savait
     * dire que les VENTES avaient échoué, jamais le FOND DE CARTE.
     *
     * Deux tris, dans cet ordre :
     *
     * 1. Un échec de TUILE ne condamne rien. Hors emprise, un 404 est même
     *    normal, et un accroc sur une tuile parmi cent laisse une carte
     *    parfaitement lisible. MapLibre les distingue en attachant `tile` à
     *    l'événement ; les échecs de style, de source (TileJSON), de sprite et
     *    de glyphes n'en ont pas.
     * 2. Passé le premier rendu complet, la carte est là : un incident tardif
     *    se journalise, il ne prend pas l'écran.
     *
     * Reste donc à l'écran ce qui laisse réellement l'utilisateur sans fond de
     * carte : style rejeté, TileJSON injoignable, sprite ou glyphes absents.
     */
    /**
     * Les erreurs du fond de carte, et pourquoi elles ne peuvent plus être
     * muettes.
     *
     * Ce gestionnaire reléguait TOUTE erreur de tuile en console, et tout ce
     * qui survenait après le premier `idle` avec. Or MapLibre déclare une
     * source morte comme « chargée » pour ne pas bloquer son moteur : `idle`
     * arrive donc même quand aucune tuile n'est jamais parvenue, et à partir de
     * là plus rien n'atteignait l'écran. Résultat, une carte uniformément vide
     * — la seule couche de fond peinte — sans un mot d'explication, ni pour le
     * visiteur ni pour nous.
     *
     * Désormais : la PREMIÈRE erreur de source parle, même tardive. Les
     * suivantes sont comptées et tues, car une source injoignable en émet une
     * par tuile et par déplacement — les afficher toutes ne dirait rien de plus.
     */
    const onError = (event: {
      error?: { message?: string; status?: number };
      sourceId?: string;
      tile?: unknown;
    }): void => {
      const message = event.error?.message ?? "erreur inconnue";
      const source = event.sourceId ?? "inconnue";

      // Les couches DVF sont du GeoJSON que nous produisons : leurs incidents
      // relèvent du bandeau de données, pas du fond de carte.
      const estFondDeCarte =
        !event.sourceId || event.sourceId === SOURCE_BASEMAP;

      if (!estFondDeCarte) {
        console.error(
          `[carte] incident sur la source « ${source} » :`,
          message,
        );
        return;
      }

      erreursFondRef.current += 1;
      if (erreursFondRef.current === 1) {
        console.error(
          `[carte] le fond de carte a échoué (source « ${source} ») :`,
          message,
        );
        setBasemapError(message);
      }
    };

    /**
     * The volumes stand up on their own as you zoom in, and lie back down as
     * you zoom out — the behaviour every modern map has trained users to
     * expect. Guarded by `userTiltedRef` so we never fight a deliberate tilt.
     */
    const onZoomEnd = (): void => {
      if (!interactive3dRef.current || userTiltedRef.current) return;
      const z = instance.getZoom();
      const pitch = instance.getPitch();
      if (z >= BUILDING_3D_MIN_ZOOM && pitch < 10) {
        instance.easeTo({ pitch: PITCH_3D, duration: 900 });
      } else if (z < BUILDING_3D_MIN_ZOOM - 0.6 && pitch > 10) {
        instance.easeTo({ pitch: 0, duration: 700 });
      }
    };

    /**
     * « Le fond de carte est effectivement peint » : `load` (toutes les
     * ressources téléchargées et premier rendu complet) et `idle` (plus rien
     * en vol). `load` n'est émis qu'une fois dans la vie de la carte ; `idle`
     * revient après chaque `setStyle`, et c'est lui qui valide un
     * « Réessayer ». C'est ce signal — et non l'analyse du style — que
     * surveille le chien de garde.
     */
    const onPainted = (): void => {
      ensureDvfLayersRef.current();
      basemapPaintedRef.current = true;
      setStyleReady(true);
      setBasemapPainted(true);
      // Volontairement, on n'efface PAS `basemapError` ici : une source morte
      // se déclare « chargée » pour ne pas bloquer le moteur, si bien que
      // `load` et `idle` arrivent APRÈS l'erreur, sur une carte vide. Les
      // effacer reviendrait à masquer la panne une seconde après l'avoir
      // annoncée. Seul « Réessayer » repart de zéro.
    };

    // `originalEvent` is present only when a human dragged the camera —
    // programmatic `easeTo` calls do not carry one.
    const onPitchStart = (event: { originalEvent?: unknown }): void => {
      if (event.originalEvent) userTiltedRef.current = true;
    };

    // Diagnostic du fond de carte. La carte peut vivre — recevoir les données
    // DVF, réagir au zoom — alors qu'aucune tuile n'est demandée : le style
    // n'est alors jamais résolu, et rien à l'écran ne le dit. On trace donc ce
    // que MapLibre a reçu, une fois, plutôt que de le deviner.
    if (process.env.NODE_ENV !== "production") {
      const source = STYLE_OVERRIDE ?? "style construit localement";
      console.info("[carte] style demandé :", source);
      instance.once("styledata", () => {
        const spec = instance.getStyle();
        console.info(
          "[carte] style reçu :",
          spec
            ? `${spec.layers?.length ?? 0} couches, sources : ${Object.keys(spec.sources ?? {}).join(", ") || "aucune"}`
            : "aucun",
        );
      });
    }

    instance.on("load", onPainted);
    instance.on("idle", onPainted);
    instance.on("error", onError);
    instance.on("styledata", onStyleData);
    instance.on("pitchend", onPitch);
    instance.on("pitchstart", onPitchStart);
    instance.on("zoomend", onZoomEnd);

    return () => {
      subjectMarkerRef.current?.remove();
      subjectMarkerRef.current = null;
      basemapPaintedRef.current = false;
      erreursFondRef.current = 0;
      instance.off("load", onPainted);
      instance.off("idle", onPainted);
      instance.off("error", onError);
      instance.off("styledata", onStyleData);
      instance.off("pitchend", onPitch);
      instance.off("pitchstart", onPitchStart);
      instance.off("zoomend", onZoomEnd);
      mapRef.current = null;
      setMap(null);
      setStyleReady(false);
      instance.remove();
    };
    // The map is created once; every prop change is applied through the effects
    // below rather than by tearing down a WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureDvfLayersRef = React.useRef(ensureDvfLayers);
  ensureDvfLayersRef.current = ensureDvfLayers;

  /* ── Chien de garde du fond de carte ───────────────────────────────────── */

  /**
   * Le mode d'échec le plus vicieux de MapLibre n'émet AUCUN événement.
   *
   * `Style.loadJSON` diffère l'analyse du style à la première frame
   * (`browser.frameAsync`) et avale le rejet de cette promesse
   * (`.catch(() => {})`). Si cette frame n'arrive jamais, il ne se passe
   * strictement rien : pas de TileJSON, pas de sprite, pas de glyphes, pas
   * d'événement `load`, pas d'`error`. Le `Map` lui-même ignore d'ailleurs en
   * silence un `style` vide (`if (options.style)`) — c'est ce qu'a produit
   * pendant deux versions la variable `NEXT_PUBLIC_MAP_STYLE_URL` inlinée en
   * chaîne vide. Dans les deux cas : rectangle vide, console propre.
   *
   * On ne compte QUE le temps pendant lequel la page est visible : dans un
   * onglet d'arrière-plan `requestAnimationFrame` ne s'exécute pas, la carte
   * n'est donc pas en panne — elle chargera dès qu'on la regardera, et
   * l'annoncer en panne serait un faux positif.
   */
  React.useEffect(() => {
    if (basemapPainted || basemapError) return;

    const tick = 500;
    let visibleMs = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleMs += tick;
      if (visibleMs < BASEMAP_TIMEOUT_MS) return;
      window.clearInterval(id);
      setBasemapError("aucune réponse du fournisseur de tuiles");
    }, tick);

    return () => window.clearInterval(id);
  }, [basemapPainted, basemapError]);

  const retryBasemap = React.useCallback(() => {
    setBasemapError(null);
    setBasemapPainted(false);

    const instance = mapRef.current;
    if (!instance) return;
    basemapPaintedRef.current = false;
    // `diff: false` : on repart d'un document neuf. Le précédent n'a
    // peut-être jamais été chargé, il n'y a donc rien à comparer.
    instance.setStyle(
      STYLE_OVERRIDE ?? buildMapStyle({ dense: isDenseRef.current }),
      { diff: false },
    );
  }, []);

  /* ── Jeu de tokens ─────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const container = containerRef.current;
    const instance = mapRef.current;
    if (!container || !instance || !styleReady) return;

    // Les couleurs de la surcouche viennent des tokens CSS calculés, et non de
    // valeurs littérales : elles ne peuvent être lues qu'une fois le conteneur
    // monté. Le fond de carte, lui, est figé — il n'y a plus ni direction
    // artistique ni thème à observer, donc plus de MutationObserver.
    const tokens = readMapTokens(container);
    tokensRef.current = tokens;
    repaintOverlay(instance, tokens, contextRef.current.dark);
    applyInteractionStyles();
  }, [styleReady, applyInteractionStyles]);

  /* ── Viewport → data ───────────────────────────────────────────────────── */

  const requestRef = React.useRef(data.request);
  requestRef.current = data.request;

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !styleReady || controlled) return;

    const sync = (): void => {
      if (instance.getZoom() < MIN_DATA_ZOOM) {
        setZoomTooLow(true);
        return;
      }
      setZoomTooLow(false);
      requestRef.current(toBBox(instance));
    };

    sync();
    instance.on("moveend", sync);
    return () => {
      instance.off("moveend", sync);
    };
  }, [styleReady, controlled]);

  /* ── Data → source ─────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !styleReady) return;
    const source = geojsonSource(instance, SOURCE_POINTS);
    if (!source) return;

    const collection =
      zoomTooLow && !controlled
        ? EMPTY_POINTS
        : toFeatureCollection(rows, priceMode);
    source.setData(collection);
    applyInteractionStyles();
  }, [
    rows,
    priceMode,
    styleReady,
    zoomTooLow,
    controlled,
    applyInteractionStyles,
  ]);

  React.useEffect(() => {
    applyInteractionStyles();
  }, [effectiveSelectedId, comparables, applyInteractionStyles]);

  /* ── Subject: DOM marker + true-scale radius ring ──────────────────────── */

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !styleReady) return;

    subjectMarkerRef.current?.remove();
    subjectMarkerRef.current = null;

    const circleSource = geojsonSource(instance, SOURCE_SUBJECT);

    if (!subject) {
      circleSource?.setData(EMPTY_POLYGONS);
      return;
    }

    const element = document.createElement("div");
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", subject.label ?? "Bien étudié");
    element.innerHTML = SUBJECT_MARKER_HTML;

    const marker = new Marker({ element, anchor: "center" })
      .setLngLat([subject.point.lng, subject.point.lat])
      .addTo(instance);
    subjectMarkerRef.current = marker;

    circleSource?.setData(
      subject.radius && subject.radius > 0
        ? subjectCircleCollection(subject.point, subject.radius)
        : EMPTY_POLYGONS,
    );

    return () => {
      marker.remove();
    };
  }, [subject, styleReady]);

  /* ── Pointer interaction ───────────────────────────────────────────────── */

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !styleReady) return;

    const onEnter = (
      event: MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ): void => {
      instance.getCanvas().style.cursor = "pointer";
      const id = event.features?.[0]?.properties?.id;
      const next = typeof id === "string" ? id : null;
      // `mousemove` tire à CHAQUE pixel parcouru, pas à l'entrée dans la
      // pastille. Sans ce garde-fou, `applyInteractionStyles()` réécrivait
      // `icon-image` — une propriété de LAYOUT — des dizaines de fois par
      // seconde, et MapLibre reprenait la mise en page de tous les symboles à
      // chaque passe : les pastilles disparaissaient et revenaient sous le
      // curseur. Rien à repeindre tant que la vente survolée ne change pas.
      if (next === hoveredIdRef.current) return;
      hoveredIdRef.current = next;
      applyInteractionStyles();
    };

    const onLeave = (): void => {
      instance.getCanvas().style.cursor = "";
      if (hoveredIdRef.current === null) return;
      hoveredIdRef.current = null;
      applyInteractionStyles();
    };

    const onPointClick = (
      event: MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ): void => {
      const id = event.features?.[0]?.properties?.id;
      const row =
        typeof id === "string"
          ? rowsRef.current.find((r) => r.id === id)
          : undefined;
      if (!row) return;
      select(row);
      // Gentle fly so the card never opens on top of its own marker.
      instance.easeTo({
        center: [row.coordinates.lng, row.coordinates.lat],
        offset: [0, instance.getContainer().clientWidth < 768 ? -90 : 40],
        duration: 550,
        essential: true,
      });
    };

    const onClusterClick = (
      event: MapMouseEvent & { features?: MapGeoJSONFeature[] },
    ): void => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = geojsonSource(instance, SOURCE_POINTS);
      if (typeof clusterId !== "number" || !source) return;
      void source
        .getClusterExpansionZoom(clusterId)
        .then((zoom: number) => {
          const geometry = feature?.geometry;
          if (!geometry || geometry.type !== "Point") return;
          instance.easeTo({
            center: geometry.coordinates as [number, number],
            zoom: zoom + 0.35,
            duration: 500,
          });
        })
        .catch(() => {
          /* A cluster can vanish between click and resolution — harmless. */
        });
    };

    const onBackgroundClick = (event: MapMouseEvent): void => {
      const layers = [LAYER_DOT, LAYER_PRICE, LAYER_CLUSTER].filter((id) =>
        instance.getLayer(id),
      );
      if (layers.length === 0) return;
      if (instance.queryRenderedFeatures(event.point, { layers }).length === 0)
        select(null);
    };

    const pointLayers = [LAYER_DOT, LAYER_PRICE];
    for (const layer of pointLayers) {
      instance.on("mouseenter", layer, onEnter);
      instance.on("mousemove", layer, onEnter);
      instance.on("mouseleave", layer, onLeave);
      instance.on("click", layer, onPointClick);
    }
    instance.on("mouseenter", LAYER_CLUSTER, onEnter);
    instance.on("mouseleave", LAYER_CLUSTER, onLeave);
    instance.on("click", LAYER_CLUSTER, onClusterClick);
    instance.on("click", onBackgroundClick);

    return () => {
      for (const layer of pointLayers) {
        instance.off("mouseenter", layer, onEnter);
        instance.off("mousemove", layer, onEnter);
        instance.off("mouseleave", layer, onLeave);
        instance.off("click", layer, onPointClick);
      }
      instance.off("mouseenter", LAYER_CLUSTER, onEnter);
      instance.off("mouseleave", LAYER_CLUSTER, onLeave);
      instance.off("click", LAYER_CLUSTER, onClusterClick);
      instance.off("click", onBackgroundClick);
    };
  }, [styleReady, select, applyInteractionStyles]);

  /* ── 3D buildings ──────────────────────────────────────────────────────── */

  React.useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !styleReady) return;

    syncBuildings();

    if (interactive3d) {
      // Tilt only if the volumes are actually on screen. Forcing a zoom here
      // would yank a user who opened the observatory on a country-wide view.
      if (
        instance.getZoom() >= BUILDING_3D_MIN_ZOOM &&
        instance.getPitch() < 20
      ) {
        instance.easeTo({ pitch: PITCH_3D, duration: 800 });
        setPitched(true);
      }
    } else if (instance.getPitch() !== 0) {
      instance.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      setPitched(false);
    }
  }, [interactive3d, styleReady, syncBuildings]);

  const togglePitch = React.useCallback(() => {
    const instance = mapRef.current;
    if (!instance) return;
    const next = instance.getPitch() > 10 ? 0 : 50;
    instance.easeTo({
      pitch: next,
      bearing: next === 0 ? 0 : instance.getBearing(),
      duration: 600,
    });
    setPitched(next > 0);
  }, []);

  /* ── Outward notification ──────────────────────────────────────────────── */

  const onDataChangeRef = React.useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  React.useEffect(() => {
    if (controlled) return;
    // « idle » recouvre deux situations opposées : aucune requête n'a encore
    // été lancée parce que l'emprise est trop large, ou la carte démarre. La
    // première n'est PAS un chargement — la confondre laissait le panneau sur
    // un squelette éternel pendant que la carte affichait déjà « Zoomez ».
    const state = zoomTooLow
      ? "zoom"
      : data.status === "idle"
        ? "loading"
        : data.status;
    onDataChangeRef.current?.(data.result, state);
  }, [controlled, data.result, data.status, zoomTooLow]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  const loading = !controlled && data.status === "loading";
  const failed = !controlled && data.status === "error";
  const result = controlled ? null : data.result;
  /**
   * Sans fond de carte, l'habillage n'a plus d'objet : les commandes agissent
   * sur des couches invisibles et « Chargement des ventes… » contredit
   * l'écran d'erreur qu'il recouvre. Une seule chose à lire à la fois.
   */
  const chrome = styleReady && !basemapError;
  /** Une légende sans ventes à l'écran ne décrit rien. */
  const showLegend = rows.length > 0 && !(zoomTooLow && !controlled);
  const distanceToSubject = (row: DvfTransaction): number | undefined =>
    subject ? haversineMeters(subject.point, row.coordinates) : undefined;

  return (
    <div
      className={cn("relative isolate overflow-hidden bg-canvas", className)}
    >
      {/* `size-full`, not `absolute inset-0`: maplibre-gl.css ships unlayered,
          so its `.maplibregl-map { position: relative }` outranks Tailwind's
          `absolute` utility (layered styles always lose to unlayered ones).
          The container would then have no positioning context and collapse to
          zero height, a blank map with the tiles loading perfectly fine. */}
      <div ref={containerRef} className="size-full" />

      {!styleReady && !basemapError ? (
        <div className="skeleton absolute inset-0 z-10" aria-hidden="true" />
      ) : null}

      {/* Le fond de carte est le socle de tout l'écran : son échec prend la
          place du squelette plutôt que de se glisser dans le bandeau de
          statut, qui parle des ventes. */}
      {basemapError ? (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-canvas px-6"
          role="alert"
        >
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger-soft-fg">
              <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm font-medium text-ink">
              Le fond de carte n&apos;a pas pu être chargé.
            </p>
            <p className="text-xs text-ink-muted">
              Les ventes ne peuvent pas être situées sans lui. Vérifiez votre
              connexion, puis réessayez.
            </p>
            <button
              type="button"
              onClick={retryBasemap}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-fg shadow-xs transition-opacity hover:opacity-90"
            >
              <RotateCw aria-hidden="true" className="size-3.5" />
              Réessayer
            </button>
            <p className="text-[11px] text-ink-subtle">
              Détail technique : {basemapError}
            </p>
          </div>
        </div>
      ) : null}

      {/* Les commandes tiennent en UNE colonne, et pas en quatre blocs
          positionnés chacun de son côté : c'est ce qui permet à l'écran qui
          superpose sa propre barre (la carte plein écran, sur mobile) de tout
          décaler d'un seul décalage, sans que rien ne passe dessous. */}
      {chrome ? (
        <div
          // UNE SEULE COLONNE, du haut au bas de la carte. Les légendes ont
          // longtemps eu leur propre ancrage en bas : sur une carte courte
          // elles remontaient dans les commandes et recouvraient « Zonage ».
          // Deux ancrages indépendants ne peuvent pas s'éviter — il n'y en a
          // donc plus qu'un, et `mt-auto` pousse les légendes en bas tant
          // qu'il reste de la place.
          className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2"
          style={{ top: chromeOffset ?? "0.75rem" }}
        >
          {/* PRIX — une seule commande, jamais deux.
              L'unité vivait dans un bloc qui apparaissait sous l'interrupteur :
              le décalage à chaque bascule était plus bruyant que le réglage
              lui-même. Tout tient maintenant dans une pastille : l'état à
              gauche, l'unité à droite, séparés d'un trait. Prix décoché,
              l'unité disparaît — il n'y a plus rien à cadrer, et comme elle
              vit DANS la pastille, sa disparition la rétrécit sans déplacer
              quoi que ce soit en dessous. C'était le décalage vertical du
              bloc précédent qui gênait, pas le fait de masquer. */}
          <div className="pointer-events-auto flex items-stretch overflow-hidden rounded-md border border-border bg-surface shadow-md">
            <button
              type="button"
              onClick={() => setShowPrices((on) => !on)}
              aria-pressed={showPrices}
              className={cn(
                "flex min-h-9 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors",
                showPrices
                  ? "bg-primary text-primary-fg"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Tag aria-hidden="true" className="size-3.5" />
              Prix
            </button>

            {showPrices ? (
              <div
                aria-hidden="true"
                className="w-px shrink-0 self-stretch bg-border"
              />
            ) : null}

            <div
              role="group"
              aria-label="Unité affichée sur les marqueurs"
              hidden={!showPrices}
              className="flex items-stretch"
            >
              {(
                [
                  { id: "perSqm", label: "€/m²" },
                  { id: "total", label: "Total" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!showPrices}
                  aria-pressed={priceMode === option.id}
                  onClick={() => setPriceMode(option.id)}
                  className={cn(
                    "min-h-9 px-2.5 text-xs transition-colors",
                    // L'unité retenue prend l'or, pas le bleu : le bleu est déjà
                    // pris par l'interrupteur, à sa gauche, et deux segments
                    // bleus côte à côte ne diraient plus lequel est quoi. Un
                    // simple fond gris ne suffisait pas — à côté du blanc de la
                    // pastille, il ne se voyait pas, et on ne savait plus quelle
                    // unité était affichée.
                    priceMode === option.id
                      ? "bg-accent font-semibold text-accent-fg"
                      : "font-medium text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* AFFECTATION DU SOL. Un interrupteur, pas un sélecteur : une seule
              source aujourd'hui. Le jour où la BDNB et le PLU arrivent, ce
              bouton devient une liste — et jamais des cases à cocher, car deux
              affectations peintes ensemble ne répondent pas à la même
              question et se recouvriraient sans que rien ne le dise. */}
          {zoningAvailable ? (
            <button
              type="button"
              onClick={() => setZoning((on) => !on)}
              aria-pressed={zoning}
              className={cn(
                "pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium shadow-md transition-colors",
                zoning
                  ? "bg-primary text-primary-fg"
                  : "bg-surface text-ink-muted hover:text-ink",
              )}
            >
              <Layers aria-hidden="true" className="size-3.5" />
              Zonage
            </button>
          ) : null}

          {transportsAvailable ? (
            <button
              type="button"
              onClick={() => setTransports((on) => !on)}
              aria-pressed={transports}
              className={cn(
                "pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium shadow-md transition-colors",
                transports
                  ? "bg-primary text-primary-fg"
                  : "bg-surface text-ink-muted hover:text-ink",
              )}
            >
              <TrainFront aria-hidden="true" className="size-3.5" />
              Transports
            </button>
          ) : null}

          {/* `mt-auto` colle les légendes au bas de la colonne quand la carte
              est haute, et les laisse simplement suivre les commandes quand
              elle est courte. `min-h-0` est ce qui autorise le rétrécissement :
              sans lui, une pile flex refuse de passer sous sa taille de
              contenu et déborderait à nouveau par le haut. Sur mobile la
              barre d'échelle occupe le coin, d'où la marge du bas. */}
          <div className="mt-auto flex min-h-0 w-full max-w-[16rem] flex-col gap-2 overflow-y-auto pb-14">
            {zoning ? <ZoningLegend /> : null}
            {transports ? <TransportsLegend /> : null}
            {showLegend && showPrices ? (
              <PriceLegend scale={scale} compact={isCompact} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Status band: never more than one message at a time. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-16">
        {basemapError ? null : zoomTooLow && !controlled ? (
          <Banner icon={<Search className="size-4" />} tone="neutral">
            Zoomez pour afficher les ventes enregistrées
          </Banner>
        ) : loading ? (
          <Banner
            icon={<Loader2 className="size-4 animate-spin" />}
            tone="neutral"
          >
            Chargement des ventes…
          </Banner>
        ) : failed ? (
          <Banner icon={<TriangleAlert className="size-4" />} tone="danger">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {data.error ?? "Données indisponibles."}
              <button
                type="button"
                onClick={data.retry}
                className="pointer-events-auto inline-flex items-center gap-1 font-semibold underline underline-offset-2"
              >
                <RotateCw aria-hidden="true" className="size-3.5" />
                Réessayer
              </button>
            </span>
          </Banner>
        ) : rows.length === 0 && data.status === "ready" ? (
          <Banner icon={<Layers className="size-4" />} tone="neutral">
            Aucune vente ne correspond à cette zone et à ces filtres
          </Banner>
        ) : null}
      </div>

      {/* Coverage line. DVF is published twice a year with ~6 months of lag:
          the most recent millésime is always partial, and we say so. */}
      {result && rows.length > 0 ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[min(28rem,70%)] md:bottom-9">
          <p
            className="pointer-events-auto rounded-sm bg-surface/90 px-2 py-1 text-[11px] leading-tight text-ink-muted shadow-xs backdrop-blur-sm"
            title={coverageDisclaimer(result.latestYear)}
          >
            <span className="tnum font-medium text-ink">
              {formatNumber(result.count)}
            </span>{" "}
            vente
            {result.count > 1 ? "s" : ""}
            {result.truncated ? " (affichage tronqué)" : ""} ·{" "}
            {coverageLabel(result.latestYear)}
            {result.source === "mock" ? " · jeu de démonstration" : ""}
          </p>
        </div>
      ) : null}

      {/* The map is visual; the count must still be announced. */}
      <p className="sr-only" role="status" aria-live="polite">
        {basemapError
          ? "Le fond de carte n'a pas pu être chargé."
          : liveMessage(
              zoomTooLow && !controlled,
              loading,
              failed,
              rows.length,
            )}
      </p>

      {/* La bascule de relief, rangée avec le zoom et la boussole. Le libellé
          vit dans le titre et le lecteur d'écran : dans une pile de 34 px, un
          mot ne tient pas, et « 3D » seul en dirait moins que l'icône. */}
      {has3d && pitchSlot
        ? createPortal(
            <button
              type="button"
              onClick={togglePitch}
              aria-pressed={pitched}
              title={pitched ? "Revenir à la vue à plat" : "Afficher le relief"}
              className={cn(
                "grid place-items-center transition-colors",
                pitched
                  ? "bg-primary text-primary-fg"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {pitched ? (
                <Square aria-hidden="true" className="size-4" />
              ) : (
                <Box aria-hidden="true" className="size-4" />
              )}
              <span className="sr-only">
                {pitched ? "Revenir à la vue à plat" : "Afficher le relief"}
              </span>
            </button>,
            pitchSlot,
          )
        : null}

      {selected && map && !isCompact ? (
        <TransactionPopup
          map={map}
          transaction={selected}
          distanceMeters={distanceToSubject(selected)}
          isComparable={comparables.includes(selected.id)}
          onToggleComparable={onToggleComparable}
          onClose={() => select(null)}
          density={density}
        />
      ) : null}

      {selected && isCompact ? (
        <div
          className="animate-slide-up absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto rounded-t-xl border-t border-border bg-surface shadow-lg"
          role="dialog"
          aria-label="Détail de la vente"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong"
          />
          <TransactionCard
            transaction={selected}
            distanceMeters={distanceToSubject(selected)}
            isComparable={comparables.includes(selected.id)}
            onToggleComparable={onToggleComparable}
            onClose={() => select(null)}
            density={density}
          />
        </div>
      ) : null}

      {interactive3d && !has3d && chrome ? (
        <p className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-sm bg-surface/90 px-2 py-1 text-[11px] text-ink-subtle shadow-xs">
          Relief 3D indisponible sur ce fond de plan
        </p>
      ) : null}
    </div>
  );
}

/* ── Layer installation ────────────────────────────────────────────────── */

function installDvfLayers(map: MapLibreMap, ctx: InstallContext): void {
  const { tokens, dense, dark } = ctx;
  const fontStack = resolveFontStack(map.getStyle());
  const chrome = markerChrome(tokens, dark);

  addPillImages(map, tokens, dark);

  map.addSource(SOURCE_SUBJECT, { type: "geojson", data: EMPTY_POLYGONS });
  map.addSource(SOURCE_POINTS, {
    type: "geojson",
    data: EMPTY_POINTS,
    cluster: true,
    // Pro reads denser on purpose: smaller radius, individual points sooner.
    clusterRadius: dense ? 44 : 58,
    // Clustering must survive until the labelled pills take over. Stopping it
    // at MIN_DATA_ZOOM left the whole 13 → 15.2 band showing every single sale
    // as its own marker — in a dense city centre that is several hundred
    // markers and the basemap disappears underneath them.
    clusterMaxZoom: Math.floor(pillZoom(dense)),
    // Somme et effectif des prix au m² connus, pour colorer chaque grappe à
    // sa moyenne sans renvoyer les points au navigateur.
    clusterProperties: {
      ppsmSum: ["+", ["case", [">", ["get", "ppsm"], 0], ["get", "ppsm"], 0]],
      ppsmCount: ["+", ["case", [">", ["get", "ppsm"], 0], 1, 0]],
    },
  });

  map.addLayer({
    id: LAYER_SUBJECT_FILL,
    type: "fill",
    source: SOURCE_SUBJECT,
    paint: { "fill-color": tokens.subject, "fill-opacity": dark ? 0.12 : 0.07 },
  });
  map.addLayer({
    id: LAYER_SUBJECT_LINE,
    type: "line",
    source: SOURCE_SUBJECT,
    paint: {
      "line-color": tokens.subject,
      "line-width": 1.5,
      "line-opacity": 0.6,
      "line-dasharray": [3, 3],
    },
  });

  map.addLayer({
    id: LAYER_CLUSTER,
    type: "circle",
    source: SOURCE_POINTS,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": tokens.cluster,
      "circle-opacity": 0.94,
      // The white ring is what keeps clusters legible on cream and on night.
      "circle-stroke-width": 3,
      "circle-stroke-color": chrome.clusterStroke,
      "circle-stroke-opacity": 0.92,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "point_count"],
        2,
        15,
        25,
        22,
        120,
        30,
        600,
        40,
      ],
    },
  });

  map.addLayer({
    id: LAYER_CLUSTER_COUNT,
    type: "symbol",
    source: SOURCE_POINTS,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": fontStack,
      "text-size": 12,
      "text-allow-overlap": true,
    },
    paint: { "text-color": tokens.markerFg },
  });

  const fade = pillZoom(dense);
  map.addLayer({
    id: LAYER_DOT,
    type: "circle",
    source: SOURCE_POINTS,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": tokens.marker,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": chrome.dotStroke,
      "circle-radius": 5,
      // Dots hand over to labelled pills, fading rather than popping.
      "circle-opacity": dotFade(dense),
      "circle-stroke-opacity": dotFade(dense),
    },
  });

  map.addLayer({
    id: LAYER_PRICE,
    type: "symbol",
    source: SOURCE_POINTS,
    filter: ["!", ["has", "point_count"]],
    minzoom: fade,
    layout: {
      "icon-image": IMG_PILL,
      "icon-text-fit": "width",
      "icon-text-fit-padding": [0, 10, 0, 10],
      "icon-allow-overlap": false,
      "text-field": ["get", "label"],
      "text-font": fontStack,
      "text-size": dense ? 11 : 12,
      "text-allow-overlap": false,
      // Generous padding is what keeps a dense centre readable: the collision
      // box, not the glyph box, decides how many pills survive.
      "text-padding": dense ? 5 : 8,
      // Highest price wins the decluttering fight: it is the most informative.
      "symbol-sort-key": ["-", 0, ["get", "price"]],
    },
    paint: { "text-color": chrome.pillText },
  });
}

function addPillImages(
  map: MapLibreMap,
  tokens: MapTokens,
  dark: boolean,
): void {
  const chrome = markerChrome(tokens, dark);
  const variants: [string, string, string][] = [
    [IMG_PILL, chrome.pillFill, chrome.pillStroke],
    [IMG_PILL_SELECTED, tokens.selected, tokens.selected],
    [IMG_PILL_COMPARABLE, tokens.success, tokens.success],
    ...PRICE_RAMP.map((color): [string, string, string] => [
      pillImageId(color),
      color,
      color,
    ]),
  ];
  for (const [id, fill, stroke] of variants) {
    const image = createPillImage(fill, stroke);
    if (!image) continue;
    if (map.hasImage(id)) map.updateImage(id, image.data);
    else map.addImage(id, image.data, image.options);
  }
}

/** Re-applies overlay colours after a token change, without touching data. */
function repaintOverlay(
  map: MapLibreMap,
  tokens: MapTokens,
  dark: boolean,
): void {
  const chrome = markerChrome(tokens, dark);
  const set = (layer: string, prop: string, value: string | number): void => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  set(LAYER_SUBJECT_FILL, "fill-color", tokens.subject);
  set(LAYER_SUBJECT_LINE, "line-color", tokens.subject);
  set(LAYER_CLUSTER, "circle-color", tokens.cluster);
  set(LAYER_CLUSTER, "circle-stroke-color", chrome.clusterStroke);
  set(LAYER_CLUSTER_COUNT, "text-color", tokens.markerFg);
  set(LAYER_DOT, "circle-stroke-color", chrome.dotStroke);
  addPillImages(map, tokens, dark);
}

/** Zoom at which individual price pills replace the dots. */
function pillZoom(dense: boolean): number {
  return dense ? 14.6 : 15.2;
}

/**
 * L'opacité des points, qui s'effacent quand les pastilles prennent le relais.
 *
 * Extrait parce que l'interrupteur « Prix » doit pouvoir l'ANNULER : sans
 * pastilles, ce fondu laisserait la carte vide au-delà du zoom de bascule.
 */
type FadeExpression = [
  "interpolate",
  ["linear"],
  ["zoom"],
  number,
  number,
  number,
  number,
];

function dotFade(dense: boolean): FadeExpression {
  const fade = pillZoom(dense);
  return ["interpolate", ["linear"], ["zoom"], fade - 0.4, 1, fade + 0.4, 0];
}

/**
 * `map.getSource()` is typed as the `Source` union; narrowing with `instanceof`
 * is what unlocks `setData` / `getClusterExpansionZoom` without a cast — and it
 * also returns `null` for the window between a `setStyle` and the reinstall,
 * when the source genuinely does not exist.
 */
function geojsonSource(map: MapLibreMap, id: string): GeoJSONSource | null {
  const source = map.getSource(id);
  return source instanceof GeoJSONSource ? source : null;
}

function toBBox(map: MapLibreMap): BBox {
  const bounds = map.getBounds();
  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];
}

/**
 * Picks the readable ink over an arbitrary token colour. The professional
 * theme selects in champagne gold, where white text would fail AA.
 */
function readableInk(background: string, tokens: MapTokens): string {
  const rgb = parseColor(background);
  if (!rgb) return tokens.inkInverted;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? tokens.ink : tokens.inkInverted;
}

function parseColor(value: string): [number, number, number] | null {
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = [hex[1], hex[2], hex[3]];
    return [
      parseInt(`${r}${r}`, 16),
      parseInt(`${g}${g}`, 16),
      parseInt(`${b}${b}`, 16),
    ];
  }
  const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(hex);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function liveMessage(
  zoomTooLow: boolean,
  loading: boolean,
  failed: boolean,
  count: number,
): string {
  if (zoomTooLow) return "Zoomez pour afficher les ventes enregistrées.";
  if (loading) return "Chargement des ventes en cours.";
  if (failed) return "Les données de ventes n'ont pas pu être chargées.";
  if (count === 0) return "Aucune vente dans cette zone.";
  return `${count} vente${count > 1 ? "s" : ""} affichée${count > 1 ? "s" : ""} sur la carte.`;
}

function Banner({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "animate-fade-in pointer-events-auto flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-md",
        tone === "danger"
          ? "bg-danger-soft text-danger-soft-fg"
          : "bg-surface/95 text-ink-muted backdrop-blur-sm",
      )}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      {children}
    </p>
  );
}

/**
 * The one DOM marker on the map: unique, so a pulsing halo costs nothing.
 * Inline styles keep it token-driven through `var(--map-subject)`.
 */
const SUBJECT_MARKER_HTML = `
<span style="position:relative;display:grid;place-items:center;width:44px;height:44px;color:var(--map-subject)">
  <span style="position:absolute;width:22px;height:22px;border-radius:9999px;background:currentColor;opacity:.35;animation:corpusimmo-pulse-ring 2.4s cubic-bezier(0,0,.2,1) infinite"></span>
  <span style="position:relative;display:grid;place-items:center;width:22px;height:22px;border-radius:9999px;background:currentColor;box-shadow:0 0 0 3px var(--surface),0 4px 12px rgb(12 20 40 / .35)">
    <span style="width:7px;height:7px;border-radius:9999px;background:var(--surface)"></span>
  </span>
</span>`;
