import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ChartEmpty } from "./chart-primitives";

export interface DistributionChartProps {
  values: number[];
  /** Where the studied property sits in the distribution. */
  highlight?: number;
  format?: (n: number) => string;
  height?: number;
  className?: string;
  caption?: string;
}

const HEADROOM = 20;

export function DistributionChart({
  values,
  highlight,
  format = formatNumber,
  height = 180,
  className,
  caption,
}: DistributionChartProps) {
  const clean = values.filter((value) => Number.isFinite(value));

  if (clean.length === 0) {
    return <ChartEmpty height={height} className={className} />;
  }

  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }

  const binCount = Math.min(16, Math.max(6, Math.round(Math.sqrt(clean.length))));
  const binWidth = (max - min) / binCount;
  const counts = new Array<number>(binCount).fill(0);

  for (const value of clean) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / binWidth)));
    counts[index] = (counts[index] ?? 0) + 1;
  }

  const maxCount = counts.reduce((acc, count) => (count > acc ? count : acc), 0) || 1;
  const plotHeight = Math.max(height - HEADROOM, 10);

  const slot = 100 / binCount;
  const barWidth = slot * 0.84;

  const highlightValue =
    highlight !== undefined && Number.isFinite(highlight) ? highlight : undefined;
  const highlightPercent =
    highlightValue === undefined
      ? undefined
      : Math.min(Math.max(((highlightValue - min) / (max - min)) * 100, 0), 100);
  const highlightBin =
    highlightValue === undefined
      ? -1
      : Math.min(binCount - 1, Math.max(0, Math.floor((highlightValue - min) / binWidth)));

  const summary = `${caption ?? "Répartition des valeurs"} — ${clean.length} valeurs, de ${format(min)} à ${format(max)}${
    highlightValue !== undefined ? `, bien étudié à ${format(highlightValue)}` : ""
  }`;

  return (
    <figure role="img" aria-label={summary} className={cn("w-full", className)}>
      <div className="relative w-full" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line
            x1="0"
            x2="100%"
            y1={height - 0.5}
            y2={height - 0.5}
            strokeWidth="1"
            className="stroke-border"
          />

          {counts.map((count, index) => {
            const barHeight = (count / maxCount) * plotHeight;
            const isHighlighted = index === highlightBin;
            const binStart = min + index * binWidth;
            const binEnd = binStart + binWidth;

            return (
              <rect
                key={index}
                x={`${index * slot + (slot - barWidth) / 2}%`}
                width={`${barWidth}%`}
                y={height - barHeight}
                height={Math.max(barHeight, count > 0 ? 2 : 0)}
                rx="3"
                className={cn(
                  "transition-opacity duration-150 hover:opacity-80",
                  isHighlighted ? "fill-accent" : "fill-primary/45",
                )}
              >
                <title>{`${format(binStart)} – ${format(binEnd)} : ${count} ${
                  count > 1 ? "biens" : "bien"
                }`}</title>
              </rect>
            );
          })}

          {highlightPercent !== undefined ? (
            <g>
              <line
                x1={`${highlightPercent}%`}
                x2={`${highlightPercent}%`}
                y1={HEADROOM - 4}
                y2={height}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="stroke-accent"
              />
              <text
                x={`${highlightPercent}%`}
                y={HEADROOM - 9}
                textAnchor={
                  highlightPercent < 12 ? "start" : highlightPercent > 88 ? "end" : "middle"
                }
                className="fill-accent-soft-fg text-[0.6875rem] font-semibold tabular-nums"
              >
                {format(highlightValue ?? 0)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      <div className="flex items-center justify-between pt-2 text-[0.6875rem] tabular-nums text-ink-muted">
        <span>{format(min)}</span>
        <span>{format((min + max) / 2)}</span>
        <span>{format(max)}</span>
      </div>
    </figure>
  );
}
