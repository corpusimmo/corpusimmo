import { niceDomain } from "@/components/charts/chart-primitives";
import type { CityYearFigure } from "@/lib/cities/types";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";

/**
 * LA COURBE DU PRIX MÉDIAN, MILLÉSIME PAR MILLÉSIME.
 *
 * POURQUOI UNE COURBE DE PLUS PLUTÔT QUE `@/components/charts` `LineChart`
 *   Deux raisons, et la première suffirait.
 *
 *   1. L'EFFECTIF DOIT SUIVRE LE POINT. L'infobulle du graphique générique
 *      affiche « 3 390 €/m² » et rien d'autre. Sur ces pages, un chiffre sans
 *      son effectif est un chiffre qu'on ne publie pas : ici, l'infobulle dit
 *      « 2025 : 3 390 €/m², sur 3 962 ventes ». Le graphique générique ne peut
 *      pas le faire, il ne connaît que des couples (x, y).
 *   2. Son infobulle sépare la série de l'abscisse par un tiret cadratin, qui
 *      est proscrit dans tout texte visible de ce site, et une infobulle SVG
 *      est un texte visible.
 *
 * Aucun état, aucun JavaScript : deux calques SVG, comme le reste des
 * graphiques du dépôt, et les mêmes jetons de couleur.
 */

const HEIGHT = 180;
const AXIS_WIDTH = 62;
/** Marge haute et basse, pour que le premier et le dernier point respirent. */
const PAD = 10;

export function CityPriceSeries({
  points,
  label,
}: {
  points: readonly CityYearFigure[];
  /** « appartements » à Nantes : sert au libellé accessible du graphique. */
  label: string;
}) {
  const usable = points.filter(
    (point): point is CityYearFigure & { median: number } => point.median !== undefined,
  );
  if (usable.length < 2) return null;

  const values = usable.map((point) => point.median);
  const { min, max, ticks } = niceDomain(Math.min(...values), Math.max(...values));
  const span = max - min || 1;

  const plot = HEIGHT - PAD * 2;
  const yFor = (value: number) => PAD + (1 - (value - min) / span) * plot;
  const xFor = (index: number) =>
    usable.length === 1 ? 50 : (index / (usable.length - 1)) * 92 + 4;

  const summary =
    `Prix médian au m² des ${label}, par millésime : ` +
    usable
      .map(
        (point) =>
          `${point.year}, ${formatPricePerSqm(point.median)} sur ${formatNumber(point.sample)} ventes`,
      )
      .join(" ; ");

  return (
    <figure role="img" aria-label={summary} className="w-full">
      <div className="flex">
        <div className="relative shrink-0" style={{ width: AXIS_WIDTH, height: HEIGHT }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-subtle"
              style={{ top: yFor(tick) }}
            >
              {formatPricePerSqm(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: HEIGHT }}>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100%"
                y1={yFor(tick)}
                y2={yFor(tick)}
                strokeWidth="1"
                className="stroke-border-soft"
              />
            ))}

            {usable.slice(1).map((point, index) => {
              const previous = usable[index];
              if (!previous?.median) return null;
              return (
                <line
                  key={`segment-${point.year}`}
                  x1={`${xFor(index)}%`}
                  y1={yFor(previous.median)}
                  x2={`${xFor(index + 1)}%`}
                  y2={yFor(point.median)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-primary"
                />
              );
            })}

            {usable.map((point, index) => (
              <circle
                key={point.year}
                cx={`${xFor(index)}%`}
                cy={yFor(point.median)}
                r="4"
                strokeWidth="2"
                className="fill-surface stroke-primary"
              >
                {/* L'effectif voyage avec le point, jusque dans l'infobulle. */}
                <title>{`${point.year} : ${formatPricePerSqm(point.median)}, sur ${formatNumber(point.sample)} ventes`}</title>
              </circle>
            ))}
          </svg>
        </div>
      </div>

      <div className="flex pt-2">
        <div className="shrink-0" style={{ width: AXIS_WIDTH }} />
        <div className="flex min-w-0 flex-1">
          {usable.map((point) => (
            <span
              key={point.year}
              className="min-w-0 flex-1 text-center text-[0.6875rem] tabular-nums text-ink-muted"
            >
              {point.year}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
