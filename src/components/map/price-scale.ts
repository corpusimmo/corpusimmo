/**
 * L'échelle de couleur des prix au m², calculée sur les ventes à l'écran.
 *
 * QUINTILES, PAS BORNES FIXES. Une échelle nationale (« moins de 2 000 €/m²,
 * plus de 6 000 ») peindrait Nantes en deux couleurs et Paris en une seule.
 * Les bornes sont donc les quintiles des ventes chargées : cinq classes de
 * même effectif, et une carte qui contraste quel que soit le quartier. Le
 * revers est assumé : les couleurs ne se comparent pas d'une vue à l'autre,
 * et la légende affiche les bornes du moment pour le dire.
 *
 * Tout ici est pur et testé ; MapLibre ne voit que les expressions produites.
 */

import { formatNumber } from "@/lib/utils/format";

import { PRICE_RAMP } from "./base-palette";

/** Sous cet effectif, cinq classes n'ont pas de sens : la carte reste neutre. */
export const MIN_SCALE_SAMPLE = 10;

/** Les bornes sont arrondies à ce pas, pour une légende qui se lit. */
const ROUNDING = 50;

export type StyleExpression = unknown[];

export interface PriceScale {
  /** Bornes strictement croissantes, en €/m². `breaks.length + 1` classes. */
  breaks: number[];
  /** Une couleur par classe, tirée de la rampe. */
  colors: string[];
  /** Ventes avec un prix au m² connu, qui ont fondé l'échelle. */
  sample: number;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? Number.NaN;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}

/**
 * Construit l'échelle, ou `null` quand l'effectif ne la porte pas ou que les
 * prix sont si serrés qu'aucune borne ne les sépare.
 */
export function buildPriceScale(
  values: readonly (number | undefined)[],
  ramp: readonly string[] = PRICE_RAMP,
): PriceScale | null {
  const known = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (known.length < MIN_SCALE_SAMPLE) return null;

  const lowest = known[0] ?? 0;
  const highest = known[known.length - 1] ?? 0;
  const classes = ramp.length;
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    const raw = quantile(known, i / classes);
    const rounded = Math.round(raw / ROUNDING) * ROUNDING;
    const previous = breaks[breaks.length - 1];
    // Une borne qui ne sépare rien (sous le minimum, au-dessus du maximum,
    // égale à la précédente) ferait une classe vide et, pour MapLibre, une
    // expression invalide : les paliers doivent croître strictement.
    if (rounded <= lowest || rounded > highest) continue;
    if (previous === undefined || rounded > previous) breaks.push(rounded);
  }
  if (breaks.length === 0) return null;

  // Moins de bornes que prévu : on garde les couleurs les plus écartées de la
  // rampe pour que le contraste ne s'effondre pas.
  const count = breaks.length + 1;
  const colors = Array.from({ length: count }, (_, i) => {
    const index = count === 1 ? 0 : Math.round((i * (ramp.length - 1)) / (count - 1));
    return ramp[index] ?? ramp[0] ?? "#000000";
  });

  return { breaks, colors, sample: known.length };
}

/** L'indice de classe d'un prix au m² ; `-1` quand il est inconnu. */
export function priceClass(scale: PriceScale, value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return -1;
  let index = 0;
  for (const boundary of scale.breaks) {
    if (value >= boundary) index += 1;
    else break;
  }
  return index;
}

/**
 * Une valeur par classe, choisie par paliers sur `input`, avec un repli quand
 * le prix au m² est inconnu (encodé négatif dans les propriétés du point).
 */
export function byPriceClass<T extends string | number>(
  scale: PriceScale,
  input: StyleExpression,
  values: readonly T[],
  unknown: T,
): StyleExpression {
  const step: unknown[] = ["step", input, values[0] ?? unknown];
  scale.breaks.forEach((boundary, i) => {
    step.push(boundary, values[i + 1] ?? values[values.length - 1] ?? unknown);
  });
  return ["case", ["<", input, 0], unknown, step];
}

/** Les libellés de légende, un par classe, dans l'ordre des couleurs. */
export function scaleLabels(scale: PriceScale): string[] {
  const { breaks } = scale;
  const first = breaks[0];
  const last = breaks[breaks.length - 1];
  if (first === undefined || last === undefined) return [];

  const labels: string[] = [`moins de ${formatNumber(first)}`];
  for (let i = 0; i < breaks.length - 1; i += 1) {
    const from = breaks[i];
    const to = breaks[i + 1];
    if (from === undefined || to === undefined) continue;
    labels.push(`${formatNumber(from)} à ${formatNumber(to)}`);
  }
  labels.push(`${formatNumber(last)} et plus`);
  return labels;
}
