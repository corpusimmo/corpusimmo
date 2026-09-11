"use client";

/**
 * LE RENDEMENT LOCATIF BRUT, COMMUNE PAR COMMUNE.
 *
 * C'est le croisement des deux moitiés du produit : ce qu'un logement s'est
 * VENDU (médiane DVF, `scripts/agreger-communes-prix.mjs`) et ce qu'il se
 * LOUE (carte des loyers calée sur les baux signés). Ni l'une ni l'autre des
 * deux sources ne le publie ; il naît de leur rencontre, et c'est la question
 * que pose tout acheteur qui n'habitera pas le bien.
 *
 * ── CE QUE « BRUT » VEUT DIRE, ET POURQUOI ON S'Y TIENT ────────────────────
 * Le calcul est `loyer hors charges × 12 ÷ prix au m²`. Sont dehors, parce
 * qu'aucune source publique ne les porte à l'échelle de la commune : la taxe
 * foncière, qui varie du simple au triple d'une commune à l'autre, les
 * charges non récupérables, la vacance, la gestion, les frais d'acquisition
 * et l'impôt. Le net tourne couramment entre 60 et 75 % du brut, et on ne le
 * calcule pas : un abattement forfaitaire appliqué à toute la France
 * donnerait un chiffre qui a l'air net sans l'être, ce qui est pire qu'un
 * brut annoncé comme brut. `src/lib/loyers/rendement.ts` tient le même
 * discours pour les pages de ville, avec les mêmes mots.
 *
 * ── CE QUI N'EST PAS PEINT ─────────────────────────────────────────────────
 * Une commune sans médiane DVF publiable (moins de trente ventes en trois
 * ans) reste sans couleur, comme partout ailleurs dans ce produit. Le vide
 * est une réponse : il dit qu'on ne sait pas, et non que le rendement y est
 * nul ou que le marché y est mauvais.
 *
 * ── LA RAMPE EST VERTE, ET C'EST UN CHOIX DE LECTURE ───────────────────────
 * Le bleu dit déjà « prix de vente » sur cette carte et l'orange « loyer ».
 * Une troisième grandeur a besoin d'une troisième famille de teintes, sans
 * quoi trois calques se confondent au premier coup d'œil. Le vert ne veut pas
 * dire « bon » : un rendement élevé signale aussi, très souvent, un marché où
 * la revente est difficile. La légende le dit.
 */

import type {
  ExpressionSpecification,
  LngLatLike,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { Popup } from "maplibre-gl";

import { loyerHorsCharges } from "@/lib/loyers/calibration";

import {
  LAYER_LOYERS_COMMUNE_FILL,
  SOURCE_LOYERS_COMMUNES,
  type LoyersType,
} from "./loyers";

export const LAYER_RENDEMENT_FILL = "corpusimmo-rendement-fill";
export const LAYER_RENDEMENT_LINE = "corpusimmo-rendement-line";

export const RENDEMENT_LAYER_IDS = [
  LAYER_RENDEMENT_FILL,
  LAYER_RENDEMENT_LINE,
] as const;

/** Même seuil de zoom que les loyers : ce sont les mêmes contours. */
export const RENDEMENT_MIN_ZOOM = 7;

/**
 * Rampe séquentielle verte, du rendement le plus faible au plus élevé.
 *
 * Cinq classes, comme les autres calques : au-delà, l'œil ne distingue plus
 * deux teintes voisines sur une commune de quelques pixels.
 */
export const RENDEMENT_RAMP = [
  "#e7f0ea",
  "#b9d8c4",
  "#7fb897",
  "#4a8f6a",
  "#2a6146",
] as const;

const NO_DATA_FILL = "rgba(0,0,0,0)";

export interface RendementScale {
  /** Bornes en pourcent, croissantes. Quatre bornes, cinq classes. */
  breaks: number[];
  colors: readonly string[];
}

/**
 * La propriété à lire selon le type de bien affiché.
 *
 * LES TYPOLOGIES N'ONT PAS DE RENDEMENT PROPRE, et c'est une limite de DVF,
 * pas un oubli : les prix de vente ne sont pas ventilés par nombre de pièces.
 * Un rendement de T1-T2 calculé sur un prix au m² tous appartements confondus
 * ressemblerait à un rendement de T1-T2 sans en être un. Ces deux vues
 * retombent donc sur le rendement « tous appartements », et la légende
 * l'écrit.
 */
export function rendementProperty(type: LoyersType): "ra" | "rm" {
  return type === "mai" ? "rm" : "ra";
}

function fillExpression(
  scale: RendementScale,
  property: string,
): ExpressionSpecification {
  const step: unknown[] = ["step", ["get", property], scale.colors[0]];
  scale.breaks.forEach((bound, i) => step.push(bound, scale.colors[i + 1]));
  return [
    "case",
    ["==", ["get", property], null],
    NO_DATA_FILL,
    step,
  ] as unknown as ExpressionSpecification;
}

/**
 * Pose les deux couches, cachées, SUR LA SOURCE DES LOYERS.
 *
 * Elles ne chargent rien : les contours communaux et leurs propriétés sont
 * déjà en mémoire pour le calque des loyers, rendement compris. Une source
 * séparée redemanderait dix-huit méga-octets de géométrie pour la même carte.
 */
export function installRendementLayers(
  map: MapLibreMap,
  scale: RendementScale,
  ligne: string,
  beforeId?: string,
  type: LoyersType = "app",
): void {
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
  if (!map.getSource(SOURCE_LOYERS_COMMUNES)) return;
  if (map.getLayer(LAYER_RENDEMENT_FILL)) return;

  map.addLayer(
    {
      id: LAYER_RENDEMENT_FILL,
      type: "fill",
      source: SOURCE_LOYERS_COMMUNES,
      minzoom: RENDEMENT_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        "fill-color": fillExpression(scale, rendementProperty(type)),
        "fill-opacity": 0.62,
      },
    } as never,
    before,
  );
  map.addLayer(
    {
      id: LAYER_RENDEMENT_LINE,
      type: "line",
      source: SOURCE_LOYERS_COMMUNES,
      minzoom: RENDEMENT_MIN_ZOOM,
      layout: { visibility: "none" },
      paint: {
        "line-color": ligne,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.2, 12, 0.7],
        "line-opacity": 0.5,
      },
    } as never,
    before,
  );
}

export function setRendementVisibility(
  map: MapLibreMap,
  visible: boolean,
): void {
  for (const id of RENDEMENT_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/** Repeint pour un autre type de bien. Aucun rechargement : tout est là. */
export function setRendementType(
  map: MapLibreMap,
  scale: RendementScale,
  type: LoyersType,
): void {
  if (!map.getLayer(LAYER_RENDEMENT_FILL)) return;
  map.setPaintProperty(
    LAYER_RENDEMENT_FILL,
    "fill-color",
    fillExpression(scale, rendementProperty(type)),
  );
}

/**
 * La fiche d'une commune : le rendement, et les deux termes qui le font.
 *
 * Les deux termes ne sont pas décoratifs. Un rendement de 9 % sur une commune
 * à 900 €/m² ne se lit pas comme un rendement de 9 % sur une commune à
 * 4 000 €/m² : le premier signale presque toujours un marché de revente
 * difficile. Cacher le prix reviendrait à cacher cette différence.
 */
export function rendementHtml(
  p: Record<string, unknown>,
  type: LoyersType,
  loyerHorsCharges: (valeur: unknown) => number | null,
): string {
  const taux = p[rendementProperty(type)];
  const prix = type === "mai" ? p.pxm : p.pxa;
  const loyerBrut = type === "mai" ? p.mai : p[type];
  const loyer = loyerHorsCharges(loyerBrut);
  const bien = type === "mai" ? "maison" : "appartement";

  if (typeof taux !== "number") {
    return (
      `<p class="loyers-popup__eyebrow">Rendement brut</p>` +
      `<p class="loyers-popup__title">${escapeHtml(p.nom)}</p>` +
      `<p class="loyers-popup__line">Pas assez de ventes enregistrées pour publier une médiane de prix ici, donc pas de rendement.</p>`
    );
  }

  const nombre = (v: unknown, unite: string, decimales = 0) =>
    typeof v === "number" && Number.isFinite(v)
      ? `${v.toLocaleString("fr-FR", {
          minimumFractionDigits: decimales,
          maximumFractionDigits: decimales,
        })}&nbsp;${unite}`
      : "—";

  return (
    `<p class="loyers-popup__eyebrow">Rendement brut · ${escapeHtml(bien)}</p>` +
    `<p class="loyers-popup__title">${escapeHtml(p.nom)}</p>` +
    `<p class="loyers-popup__value">${nombre(taux, "%", 2)} <span>brut, avant charges et impôt</span></p>` +
    `<p class="loyers-popup__line">${nombre(loyer, "€/m²", 1)} de loyer hors charges, sur ${nombre(prix, "€/m²")} à la vente</p>` +
    `<p class="loyers-popup__meta">Médiane DVF ${nombre(type === "mai" ? p.nmai : p.napp, "ventes")} · ni taxe foncière, ni vacance, ni gestion</p>`
  );
}

function escapeHtml(valeur: unknown): string {
  return String(valeur ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

/** Pour que le calque des loyers et celui du rendement ne coexistent pas. */
export const LOYERS_FILL_ID = LAYER_LOYERS_COMMUNE_FILL;

/**
 * Une fiche qui suit la souris, comme celle des loyers, et se pose au clic.
 *
 * Elle interroge la couche du rendement seule : les communes sont peintes par
 * deux calques selon le réglage, et `queryRenderedFeatures` sur les deux
 * rendrait la fiche des loyers par-dessus celle du rendement.
 */
export function attachRendementPopup(
  map: MapLibreMap,
  typeCourant: () => LoyersType,
): () => void {
  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "18rem",
    offset: 10,
    className: "loyers-popup",
  });
  let visible = false;

  const rendre = (
    lngLat: LngLatLike,
    point: { x: number; y: number },
  ): boolean => {
    if (!map.getLayer(LAYER_RENDEMENT_FILL)) return false;
    const [touche] = map.queryRenderedFeatures([point.x, point.y] as never, {
      layers: [LAYER_RENDEMENT_FILL],
    });
    if (!touche) return false;
    popup
      .setLngLat(lngLat)
      .setHTML(
        `<div class="loyers-popup__body">${rendementHtml(
          touche.properties as Record<string, unknown>,
          typeCourant(),
          (valeur) => loyerHorsCharges(typeof valeur === "number" ? valeur : null),
        )}</div>`,
      );
    if (!visible) {
      popup.addTo(map);
      visible = true;
    }
    return true;
  };

  const surMouvement = (event: MapMouseEvent): void => {
    if (!rendre(event.lngLat, event.point) && visible) {
      popup.remove();
      visible = false;
    }
  };

  const surSortie = (): void => {
    if (!visible) return;
    popup.remove();
    visible = false;
  };

  map.on("mousemove", surMouvement);
  map.on("click", surMouvement);
  map.on("mouseout", surSortie);

  return () => {
    map.off("mousemove", surMouvement);
    map.off("click", surMouvement);
    map.off("mouseout", surSortie);
    popup.remove();
  };
}
