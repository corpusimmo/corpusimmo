"use client";

/**
 * LOYERS — ce que le logement rapporte, par-dessus ce qu'il s'est vendu.
 *
 * DVF ne contient que des ventes. Ce calque pose, à côté, la seule chose
 * qu'un acheteur bailleur veut lire sur une carte : le loyer au m². Deux
 * sources publiques, superposées, qui ne disent PAS la même chose :
 *
 *   · LA CARTE DES LOYERS (ANIL, `scripts/agreger-loyers.mjs` puis
 *     `contours-communes-loyers.mjs`). Toute la France, à la commune. Des
 *     loyers d'ANNONCE, charges comprises, estimés par un modèle ; pour cinq
 *     communes sur six, la valeur vient de communes voisines (« maille »).
 *     Peinte en aplat clair, plus clair encore quand l'estimation n'est pas
 *     locale.
 *
 *   · LES OBSERVATOIRES LOCAUX DES LOYERS (réseau ANIL,
 *     `scripts/agreger-loyers-observes.mjs`). Une cinquantaine
 *     d'agglomérations, découpées en zones. Des loyers de BAUX SIGNÉS, hors
 *     charges, relevés auprès des bailleurs. Peints en aplat plein, avec un
 *     contour marqué et une étiquette : là où ils existent, ils priment.
 *
 * ── CHARGEMENT ─────────────────────────────────────────────────────────────
 * Les contours communaux pèsent 18 Mo pour la France entière : on ne charge
 * que les départements dont la boîte englobante croise la vue, et seulement
 * quand le calque est allumé et le zoom suffisant. Les zones observées, elles,
 * tiennent en un fichier de 1,8 Mo chargé une fois.
 *
 * ── L'ÉCHELLE ──────────────────────────────────────────────────────────────
 * Fixe et nationale, écrite par le script dans `index.json`. Un loyer doit se
 * comparer d'une ville à l'autre ; les quintiles mouvants des pastilles de
 * prix seraient ici un contresens. La rampe est chaude, à dessein : le bleu
 * dit déjà « prix de vente » sur la même carte.
 */

import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatLike,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { Popup } from "maplibre-gl";

import { CALIBRATION_LOYERS, loyerHorsCharges } from "@/lib/loyers/calibration";

export const SOURCE_LOYERS_COMMUNES = "corpusimmo-loyers-communes";
export const SOURCE_LOYERS_OBSERVES = "corpusimmo-loyers-observes";

export const LAYER_LOYERS_COMMUNE_FILL = "corpusimmo-loyers-commune-fill";
export const LAYER_LOYERS_COMMUNE_LINE = "corpusimmo-loyers-commune-line";
export const LAYER_LOYERS_OBSERVE_FILL = "corpusimmo-loyers-observe-fill";
export const LAYER_LOYERS_OBSERVE_LINE = "corpusimmo-loyers-observe-line";
export const LAYER_LOYERS_OBSERVE_LABEL = "corpusimmo-loyers-observe-label";

export const LOYERS_LAYER_IDS = [
  LAYER_LOYERS_COMMUNE_FILL,
  LAYER_LOYERS_COMMUNE_LINE,
  LAYER_LOYERS_OBSERVE_FILL,
  LAYER_LOYERS_OBSERVE_LINE,
  LAYER_LOYERS_OBSERVE_LABEL,
] as const;

/**
 * Sous ce zoom, un département entier tient dans quelques pixels de large et
 * ses communes ne se distinguent plus : on ne charge rien, on n'affiche rien.
 */
export const LOYERS_MIN_ZOOM = 7;
/** Les étiquettes des zones observées n'apparaissent qu'une fois lisibles. */
const OBSERVE_LABEL_MIN_ZOOM = 9.5;

/** Rampe séquentielle chaude, du loyer le plus bas au plus haut. */
export const LOYERS_RAMP = [
  "#fbeee2",
  "#f5c9a1",
  "#e99a63",
  "#cf6636",
  "#963b1c",
] as const;

const NO_DATA_FILL = "rgba(0,0,0,0)";

/** Le contrat de `public/geo/loyers/index.json`. */
export interface LoyersIndex {
  annee: number;
  attribution: string;
  page: string;
  surfacesType: { appartement: number; maison: number };
  breaks: number[];
  departements: Record<string, [number, number, number, number]>;
}

export interface LoyersObservesIndex {
  attribution: string;
  page: string;
  annees: number[];
  agglomerations: { code: string; nom: string; annee: number; zones: number }[];
}

export interface LoyersScale {
  /**
   * Bornes de l'échelle affichée, HORS CHARGES : c'est l'espace dans lequel
   * la légende écrit et dans lequel les zones observées sont déjà mesurées.
   */
  breaks: number[];
  /**
   * Les MÊMES bornes, en loyer d'annonce charges comprises.
   *
   * Elles servent à peindre les communes, dont les propriétés restent brutes
   * dans le GeoJSON : colorier sur la borne d'origine revient exactement à
   * colorier la valeur corrigée sur la borne corrigée, sans recalculer
   * 34 900 valeurs dans une expression de style.
   */
  breaksAnnonce: number[];
  colors: readonly string[];
}

/**
 * L'ÉCHELLE VIT HORS CHARGES, ET C'ÉTAIT UN BOGUE DE LECTURE.
 *
 * Les mêmes bornes servaient aux deux calques : les communes portent des
 * loyers d'annonce charges comprises, les zones d'observatoire des loyers de
 * bail hors charges. Une zone observée paraissait donc systématiquement moins
 * chère que les communes qui l'entourent — d'environ 15 %, soit une classe
 * entière de la rampe — alors que le marché y est le même. Les bornes
 * passent hors charges, et ce sont les communes qu'on ramène à elles.
 */
export function loyersScale(index: LoyersIndex): LoyersScale {
  return {
    breaks: index.breaks.map(
      (borne) => Math.round((loyerHorsCharges(borne) ?? borne) * 10) / 10,
    ),
    breaksAnnonce: index.breaks,
    colors: LOYERS_RAMP,
  };
}

export async function fetchLoyersIndex(): Promise<LoyersIndex> {
  const response = await fetch("/geo/loyers/index.json");
  if (!response.ok) throw new Error(`index des loyers : ${response.status}`);
  return (await response.json()) as LoyersIndex;
}

export async function fetchLoyersObservesIndex(): Promise<LoyersObservesIndex | null> {
  try {
    const response = await fetch("/geo/loyers-observes-index.json");
    if (!response.ok) return null;
    return (await response.json()) as LoyersObservesIndex;
  } catch {
    return null;
  }
}

/* ── Expressions ─────────────────────────────────────────────────────────── */

/** `["step", valeur, c0, b0, c1, …]`, avec le vide traité avant toute borne. */
function fillExpression(
  scale: LoyersScale,
  property: string,
  espace: "annonce" | "horsCharges",
): ExpressionSpecification {
  const bornes = espace === "annonce" ? scale.breaksAnnonce : scale.breaks;
  const step: unknown[] = ["step", ["get", property], scale.colors[0]];
  bornes.forEach((bound, i) => step.push(bound, scale.colors[i + 1]));
  return [
    "case",
    ["==", ["get", property], null],
    NO_DATA_FILL,
    step,
  ] as unknown as ExpressionSpecification;
}

/** Le strict nécessaire : le projet n'embarque pas `@types/geojson`. */
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: unknown };
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

interface LoyersChrome {
  line: string;
  label: string;
  halo: string;
}

/**
 * Pose les cinq couches sous `beforeId`, cachées. Idempotent : repasse à
 * chaque changement de fond de carte.
 */
export function installLoyersLayers(
  map: MapLibreMap,
  scale: LoyersScale,
  chrome: LoyersChrome,
  beforeId?: string,
): void {
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;

  if (!map.getSource(SOURCE_LOYERS_COMMUNES)) {
    map.addSource(SOURCE_LOYERS_COMMUNES, { type: "geojson", data: EMPTY as never });
  }
  if (!map.getSource(SOURCE_LOYERS_OBSERVES)) {
    map.addSource(SOURCE_LOYERS_OBSERVES, { type: "geojson", data: EMPTY as never });
  }
  if (map.getLayer(LAYER_LOYERS_COMMUNE_FILL)) return;

  map.addLayer(
    {
      id: LAYER_LOYERS_COMMUNE_FILL,
      type: "fill",
      source: SOURCE_LOYERS_COMMUNES,
      minzoom: LOYERS_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        "fill-color": fillExpression(scale, "app", "annonce"),
        // Une estimation LOCALE est peinte franchement ; une valeur héritée
        // des communes voisines s'efface à moitié. La légende le dit.
        "fill-opacity": [
          "case",
          ["==", ["get", "app_ech"], "commune"],
          0.6,
          0.32,
        ],
      },
    } as never,
    before,
  );
  map.addLayer(
    {
      id: LAYER_LOYERS_COMMUNE_LINE,
      type: "line",
      source: SOURCE_LOYERS_COMMUNES,
      minzoom: LOYERS_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        "line-color": chrome.line,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.2, 12, 0.7],
        "line-opacity": 0.5,
      },
    } as never,
    before,
  );
  map.addLayer(
    {
      id: LAYER_LOYERS_OBSERVE_FILL,
      type: "fill",
      source: SOURCE_LOYERS_OBSERVES,
      minzoom: LOYERS_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        "fill-color": fillExpression(scale, "m2", "horsCharges"),
        "fill-opacity": 0.66,
      },
    } as never,
    before,
  );
  map.addLayer(
    {
      id: LAYER_LOYERS_OBSERVE_LINE,
      type: "line",
      source: SOURCE_LOYERS_OBSERVES,
      minzoom: LOYERS_MIN_ZOOM,
      layout: { visibility: "none", "line-join": "round" },
      paint: {
        "line-color": chrome.label,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 12, 1.8],
        "line-opacity": 0.85,
      },
    } as never,
    before,
  );
  map.addLayer(
    {
      id: LAYER_LOYERS_OBSERVE_LABEL,
      type: "symbol",
      source: SOURCE_LOYERS_OBSERVES,
      minzoom: OBSERVE_LABEL_MIN_ZOOM,
      layout: {
        visibility: "none",
        "symbol-placement": "point",
        "text-field": ["concat", ["to-string", ["get", "m2"]], " €/m²"],
        "text-size": 11,
        "text-allow-overlap": false,
        "text-padding": 4,
      },
      paint: {
        "text-color": chrome.label,
        "text-halo-color": chrome.halo,
        "text-halo-width": 1.4,
      },
    } as never,
    before,
  );
}

export function setLoyersVisibility(map: MapLibreMap, visible: boolean): void {
  for (const id of LOYERS_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/* ── Chargement à la demande ─────────────────────────────────────────────── */

/**
 * Charge les départements visibles, et rien d'autre.
 *
 * Un même `LoyersLoader` vit aussi longtemps que la carte : les départements
 * déjà chargés restent en mémoire (250 ko chacun au pire), et une
 * réinstallation des couches après un changement de fond de carte rejoue
 * simplement `setData` avec ce qu'il sait déjà.
 */
export class LoyersLoader {
  private readonly loaded = new Map<string, Feature[]>();
  private readonly pending = new Set<string>();
  private observed: Feature[] | null = null;
  private observedPending = false;
  private disposed = false;

  constructor(
    private readonly map: MapLibreMap,
    private readonly index: LoyersIndex,
  ) {}

  dispose(): void {
    this.disposed = true;
  }

  /** À appeler à chaque fin de mouvement tant que le calque est allumé. */
  sync(): void {
    if (this.disposed) return;
    if (this.map.getZoom() < LOYERS_MIN_ZOOM) return;

    const bounds = this.map.getBounds();
    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();

    for (const [dep, [minX, minY, maxX, maxY]] of Object.entries(this.index.departements)) {
      if (maxX < west || minX > east || maxY < south || minY > north) continue;
      if (this.loaded.has(dep) || this.pending.has(dep)) continue;
      void this.loadDepartement(dep);
    }
    if (!this.observed && !this.observedPending) void this.loadObserved();
  }

  /** Rejoue les données sur des sources fraîchement recréées. */
  replay(): void {
    this.pushCommunes();
    this.pushObserved();
  }

  private async loadDepartement(dep: string): Promise<void> {
    this.pending.add(dep);
    try {
      const response = await fetch(`/geo/loyers/${dep}.geojson`);
      if (!response.ok) return;
      const collection = (await response.json()) as FeatureCollection;
      if (this.disposed) return;
      this.loaded.set(dep, collection.features);
      this.pushCommunes();
    } catch {
      // Un département qui ne répond pas laisse un trou visible ; il ne casse
      // ni la carte ni les autres départements.
    } finally {
      this.pending.delete(dep);
    }
  }

  private async loadObserved(): Promise<void> {
    this.observedPending = true;
    try {
      const response = await fetch("/geo/loyers-observes.geojson");
      if (!response.ok) return;
      const collection = (await response.json()) as FeatureCollection;
      if (this.disposed) return;
      this.observed = collection.features;
      this.pushObserved();
    } catch {
      // Sans zones observées, la carte des loyers d'annonce reste seule.
    } finally {
      this.observedPending = false;
    }
  }

  private pushCommunes(): void {
    const source = this.map.getSource(SOURCE_LOYERS_COMMUNES) as GeoJSONSource | undefined;
    if (!source) return;
    const features: Feature[] = [];
    for (const list of this.loaded.values()) features.push(...list);
    source.setData({ type: "FeatureCollection", features } as never);
  }

  private pushObserved(): void {
    const source = this.map.getSource(SOURCE_LOYERS_OBSERVES) as GeoJSONSource | undefined;
    if (!source || !this.observed) return;
    source.setData({ type: "FeatureCollection", features: this.observed } as never);
  }
}

/* ── Fiche au survol ─────────────────────────────────────────────────────── */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function euro(value: unknown, decimals = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function entier(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("fr-FR");
}

const ECHELLE_LABEL: Record<string, string> = {
  commune: "estimé sur la commune",
  maille: "estimé sur les communes voisines",
  epci: "estimé à l'échelle de l'intercommunalité",
};

/** Le contenu HTML de la fiche d'une zone observée. */
function observedHtml(p: Record<string, unknown>): string {
  const titre = p.zone_nom ? `${p.agglo} · ${p.zone_nom}` : String(p.agglo);
  const types: string[] = [];
  if (typeof p.app === "number") types.push(`appartement ${euro(p.app)} €/m²`);
  if (typeof p.mai === "number") types.push(`maison ${euro(p.mai)} €/m²`);
  return `
    <p class="loyers-popup__eyebrow">Loyers de baux · ${escapeHtml(p.annee)}</p>
    <p class="loyers-popup__title">${escapeHtml(titre)}</p>
    <p class="loyers-popup__value">${euro(p.m2)} €/m² <span>hors charges, médiane</span></p>
    <p class="loyers-popup__line">Moitié des loyers entre ${euro(p.q1)} et ${euro(p.q3)} €/m²</p>
    ${types.length > 0 ? `<p class="loyers-popup__line">${escapeHtml(types.join(" · "))}</p>` : ""}
    <p class="loyers-popup__line">Loyer mensuel médian ${entier(p.mensuel)} € pour ${entier(p.surface)} m²</p>
    <p class="loyers-popup__meta">${entier(p.obs)} baux observés · observatoire local des loyers</p>
  `;
}

/**
 * Le contenu HTML de la fiche d'une commune (carte des loyers).
 *
 * LES CHIFFRES SONT CALIBRÉS, PAS BRUTS. La source publie des annonces
 * charges comprises ; ce qu'un bailleur encaisse est le bail signé hors
 * charges, environ 15 % plus bas (voir `src/lib/loyers/calibration.ts`). La
 * fiche montre donc la valeur corrigée en tête et l'annonce en second : c'est
 * l'ordre dans lequel la question se pose, et taire la source rendrait le
 * chiffre invérifiable.
 */
function communeHtml(p: Record<string, unknown>, index: LoyersIndex): string {
  const lignes: string[] = [];
  if (typeof p.app === "number") {
    const corrige = loyerHorsCharges(p.app);
    lignes.push(
      `<p class="loyers-popup__value">${euro(corrige)} €/m² <span>appartement, hors charges, estimé</span></p>` +
        `<p class="loyers-popup__line">Annonce ${euro(p.app)} €/m² charges comprises, ` +
        `fourchette ${euro(p.app_bas)} à ${euro(p.app_haut)} €/m², ` +
        `${escapeHtml(ECHELLE_LABEL[String(p.app_ech)] ?? "échelle inconnue")}</p>`,
    );
  }
  if (typeof p.mai === "number") {
    lignes.push(
      `<p class="loyers-popup__line">Maison ${euro(loyerHorsCharges(p.mai))} €/m² hors charges ` +
        `(annonce ${euro(p.mai)} €/m²), ` +
        `${escapeHtml(ECHELLE_LABEL[String(p.mai_ech)] ?? "échelle inconnue")}</p>`,
    );
  }
  if (lignes.length === 0) {
    lignes.push(`<p class="loyers-popup__line">Pas d'indicateur publié pour cette commune.</p>`);
  }
  const obs = typeof p.app_obs === "number" && p.app_obs > 0 ? `${entier(p.app_obs)} annonces · ` : "";
  return `
    <p class="loyers-popup__eyebrow">Loyers estimés · ${escapeHtml(index.annee)}</p>
    <p class="loyers-popup__title">${escapeHtml(p.nom)}</p>
    ${lignes.join("")}
    <p class="loyers-popup__meta">${obs}bien type ${index.surfacesType.appartement} m² · ${escapeHtml(index.attribution)}, calé sur les observatoires locaux (${escapeHtml(CALIBRATION_LOYERS.generatedAt.slice(0, 4))})</p>
  `;
}

/**
 * Une seule fiche, qui suit la souris et se pose au clic sur mobile.
 *
 * Les zones observées passent avant les communes : au même endroit, on
 * montre le bail signé, pas l'annonce. Renvoie la fonction de démontage.
 */
export function attachLoyersPopup(
  map: MapLibreMap,
  index: LoyersIndex,
  isEnabled: () => boolean,
): () => void {
  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "18rem",
    offset: 10,
    className: "loyers-popup",
  });
  let shown = false;

  const layers = () =>
    [LAYER_LOYERS_OBSERVE_FILL, LAYER_LOYERS_COMMUNE_FILL].filter((id) => map.getLayer(id));

  const render = (lngLat: LngLatLike, point: { x: number; y: number }): boolean => {
    const ids = layers();
    if (ids.length === 0) return false;
    const [hit] = map.queryRenderedFeatures([point.x, point.y] as never, { layers: ids });
    if (!hit) return false;
    const props = hit.properties as Record<string, unknown>;
    const html =
      hit.layer.id === LAYER_LOYERS_OBSERVE_FILL ? observedHtml(props) : communeHtml(props, index);
    popup.setLngLat(lngLat).setHTML(`<div class="loyers-popup__body">${html}</div>`);
    if (!shown) {
      popup.addTo(map);
      shown = true;
    }
    return true;
  };

  const hide = (): void => {
    if (!shown) return;
    popup.remove();
    shown = false;
  };

  const onMove = (event: MapMouseEvent): void => {
    if (!isEnabled()) {
      hide();
      return;
    }
    if (!render(event.lngLat, event.point)) hide();
  };
  const onLeave = (): void => hide();

  map.on("mousemove", onMove);
  map.getCanvas().addEventListener("mouseleave", onLeave);

  return () => {
    map.off("mousemove", onMove);
    map.getCanvas().removeEventListener("mouseleave", onLeave);
    hide();
  };
}
