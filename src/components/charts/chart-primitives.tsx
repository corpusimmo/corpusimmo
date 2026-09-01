import { cn } from "@/lib/utils/cn";

/**
 * Charts are drawn on two stacked SVG layers over a box of known pixel height:
 *
 *  - a *pixel* layer (no viewBox): `x`/`width` in %, `y`/`height` in px.
 *    Circles stay round, strokes stay 1px, `<text>` keeps its real font size
 *    whatever the container width.
 *  - a *stretched* layer (viewBox + preserveAspectRatio="none") for paths,
 *    whose geometry must follow the container. Strokes there use
 *    `vector-effect="non-scaling-stroke"`.
 *
 * That is the whole trick: responsive without measuring anything, so charts
 * stay Server Components and callers can pass `valueFormat` freely.
 */

export function ChartEmpty({
  height,
  message = "Aucune donnée à afficher",
  className,
}: {
  height: number;
  message?: string;
  className?: string;
}) {
  return (
    <div
      style={{ height }}
      className={cn(
        "flex w-full items-center justify-center rounded-md border border-dashed border-border bg-surface-2 px-4 text-center text-xs text-ink-subtle",
        className,
      )}
    >
      {message}
    </div>
  );
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const factor =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** Axis running from 0 to a rounded maximum, with `count` even intervals. */
export function niceTicks(rawMax: number, count = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(rawMax) || rawMax <= 0) {
    return { max: 1, ticks: [0, 1] };
  }
  const step = niceStep(rawMax / count);
  const max = step * count;
  const ticks = Array.from({ length: count + 1 }, (_, index) => step * index);
  return { max, ticks };
}

/** Axis that does not start at zero — for prices, where 0 is never interesting. */
export function niceDomain(
  rawMin: number,
  rawMax: number,
  count = 4,
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    return { min: 0, max: 1, ticks: [0, 1] };
  }

  let min = Math.min(rawMin, rawMax);
  let max = Math.max(rawMin, rawMax);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }

  const step = niceStep((max - min) / count);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }

  return { min: niceMin, max: niceMax, ticks };
}
