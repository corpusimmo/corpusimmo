"use client";

/**
 * La cartographie du produit — une seule, littérale.
 *
 * Un style MapLibre est du JSON rendu sur un canevas WebGL : il ne peut pas
 * lire une variable CSS. C'est donc le SEUL endroit du produit où des couleurs
 * en dur sont légitimes. Elles transposent les tokens de `globals.css` — papier
 * chaud, encre brune, eau désaturée — pour que la carte appartienne
 * visiblement au même document que la page qui l'entoure.
 *
 * Deux invariants :
 *   1. le fond s'efface. Les marqueurs DVF (bleu nuit, bronze en sélection)
 *      doivent rester la chose la plus lisible à l'écran ; le sol, le bâti et
 *      les libellés sont donc tous à faible contraste face à eux ;
 *   2. aucun dégradé, aucun ombrage de relief — les deux vieillissent une carte
 *      et coûtent des images par seconde.
 */

export interface CartoPalette {
  dark: boolean;
  land: string;
  landuseResidential: string;
  landuseIndustrial: string;
  green: string;
  water: string;
  waterway: string;
  building: string;
  buildingOutline: string;
  building3d: string;
  roadFill: string;
  roadFillMinor: string;
  roadCasing: string;
  motorwayFill: string;
  motorwayCasing: string;
  rail: string;
  boundary: string;
  textPrimary: string;
  textSecondary: string;
  textHalo: string;

  /** Largeur relative du liseré sous chaque voie. */
  casingFactor: number;
  /** Petites capitales sur les noms de communes — le signal éditorial. */
  smallCaps: boolean;
  letterSpacing: number;
  /** Multiplie la taille de tous les libellés. */
  labelScale: number;
  /** Opacité du tissu bâti. */
  buildingOpacity: number;
}

/**
 * Le fond de carte, en registre document : papier chaud, voies en blanc cassé
 * cerclées d'un liseré sable, eau bleu-gris désaturée, toponymes en petites
 * capitales espacées comme sur un plan gravé.
 */
const CORPUS: CartoPalette = {
  dark: false,
  land: "#f6f4ef",
  landuseResidential: "#f1eee6",
  landuseIndustrial: "#edeae1",
  green: "#e6ebdd",
  water: "#c6d2dd",
  waterway: "#a5b6c7",
  building: "#ece5d7",
  buildingOutline: "#dbd0bb",
  building3d: "#e8e0cf",
  roadFill: "#fffdf9",
  roadFillMinor: "#fcf9f3",
  roadCasing: "#d8cdb8",
  motorwayFill: "#fffdf9",
  motorwayCasing: "#c6b79a",
  rail: "#d3c8b3",
  boundary: "#ab9d82",
  textPrimary: "#3b3729",
  textSecondary: "#6b6352",
  textHalo: "#f6f4ef",
  casingFactor: 1.35,
  smallCaps: true,
  letterSpacing: 0.12,
  labelScale: 0.9,
  buildingOpacity: 1,
};

/**
 * Sur un écran d'analyse, la carte partage la largeur avec un tableau et un
 * panneau : les libellés y sont réduits pour que la donnée reste au premier
 * plan. Ce n'est pas une seconde identité — une seule valeur change.
 */
const CORPUS_DENSE: CartoPalette = { ...CORPUS, labelScale: 0.82 };

export function getCartoPalette(dense = false): CartoPalette {
  return dense ? CORPUS_DENSE : CORPUS;
}

/**
 * L'échelle des prix au m², du plus bas au plus haut : sauge, sable, ambre,
 * brique, sang-de-bœuf. Cinq classes, calées sur les quintiles des ventes
 * chargées (voir `price-scale.ts`), jamais sur des bornes fixes : un centre-ville
 * et une périphérie n'ont pas la même échelle, et une échelle nationale
 * peindrait l'un tout en rouge et l'autre tout en vert.
 *
 * Les deux extrémités restent lisibles à côté du bronze de sélection et du vert
 * des comparables, qui gardent leurs contours propres.
 */
export const PRICE_RAMP = [
  "#7fae9c",
  "#c9c17f",
  "#e0a458",
  "#c2633c",
  "#872f2f",
] as const;
