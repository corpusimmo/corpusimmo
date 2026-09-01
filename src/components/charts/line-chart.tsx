import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ChartEmpty, niceDomain } from "./chart-primitives";

export type LineTone = "primary" | "accent" | "muted";

export interface LineSeries {
  label: string;
  points: { x: string; y: number }[];
  tone?: LineTone;
}

export interface LineChartProps {
  series: LineSeries[];
  height?: number;
  valueFormat?: (n: number) => string;
  className?: string;
  caption?: string;
}

const STROKE_TONES: Record<LineTone, string> = {
  primary: "stroke-primary",
  accent: "stroke-accent",
  muted: "stroke-ink-subtle",
};

const FILL_TONES: Record<LineTone, string> = {
  primary: "fill-primary/12",
  accent: "fill-accent/14",
  muted: "fill-ink-subtle/10",
};

const DOT_TONES: Record<LineTone, string> = {
  primary: "stroke-primary",
  accent: "stroke-accent",
  muted: "stroke-ink-subtle",
};

const LEGEND_TONES: Record<LineTone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  muted: "bg-ink-subtle",
};

const FALLBACK_TONES: LineTone[] = ["primary", "accent", "muted"];
const AXIS_WIDTH = 60;
const PAD = 6;

export function LineChart({
  series,
  height = 240,
  valueFormat = formatNumber,
  className,
  caption,
}: LineChartProps) {
  // Union of x categories, first-seen order — series may be sparse.
  const xs: string[] = [];
  for (const line of series) {
    for (const point of line.points) {
      if (!xs.includes(point.x)) xs.push(point.x);
    }
  }

  const values = series.flatMap((line) =>
    line.points.map((point) => point.y).filter((y) => Number.isFinite(y)),
  );

  if (xs.length === 0 || values.length === 0) {
    return <ChartEmpty height={height} className={className} />;
  }

  const { min, max, ticks } = niceDomain(Math.min(...values), Math.max(...values), 4);
  const span = max - min || 1;

  const yPx = (value: number) => PAD + (1 - (value - min) / span) * (height - PAD * 2);
  const xFrac = (index: number) => (xs.length > 1 ? index / (xs.length - 1) : 0.5);

  const showDots = xs.length <= 14;
  const labelStep = Math.max(1, Math.ceil(xs.length / 6));

  const resolved = series.map((line, index) => {
    const tone: LineTone = line.tone ?? FALLBACK_TONES[index % 3] ?? "primary";
    const points = xs
      .map((x, xIndex) => {
        const found = line.points.find((point) => point.x === x);
        if (!found || !Number.isFinite(found.y)) return null;
        return { x: xFrac(xIndex) * 100, y: (yPx(found.y) / height) * 100, index: xIndex, value: found.y };
      })
      .filter((point): point is { x: number; y: number; index: number; value: number } => point !== null);
    return { ...line, tone, points };
  });

  const summary = `${caption ?? "Graphique linéaire"} : ${resolved
    .map((line) => {
      const last = line.points[line.points.length - 1];
      return `${line.label}${last ? ` : ${valueFormat(last.value)}` : ""}`;
    })
    .join(", ")}`;

  return (
    <figure role="img" aria-label={summary} className={cn("w-full", className)}>
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-[60px]">
          {resolved.map((line) => (
            <span
              key={line.label}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
            >
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", LEGEND_TONES[line.tone])}
              />
              {line.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex">
        <div className="relative shrink-0" style={{ width: AXIS_WIDTH, height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-subtle"
              style={{ top: yPx(tick) }}
            >
              {valueFormat(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Stretched layer: geometry follows the container width. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {resolved.map((line) => {
              if (line.points.length === 0) return null;
              const path = line.points
                .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
                .join(" ");
              const first = line.points[0];
              const last = line.points[line.points.length - 1];

              return (
                <g key={line.label}>
                  {series.length === 1 && first && last ? (
                    <path
                      d={`${path} L${last.x} 100 L${first.x} 100 Z`}
                      className={FILL_TONES[line.tone]}
                    />
                  ) : null}
                  <path
                    d={path}
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className={STROKE_TONES[line.tone]}
                  />
                </g>
              );
            })}
          </svg>

          {/* Pixel layer: gridlines and perfectly round markers. */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100%"
                y1={yPx(tick)}
                y2={yPx(tick)}
                strokeWidth="1"
                className="stroke-border-soft"
              />
            ))}

            {showDots
              ? resolved.flatMap((line) =>
                  line.points.map((point) => (
                    <circle
                      key={`${line.label}-${point.index}`}
                      cx={`${point.x}%`}
                      cy={(point.y / 100) * height}
                      r="3.5"
                      strokeWidth="2"
                      className={cn("fill-surface", DOT_TONES[line.tone])}
                    >
                      <title>{`${line.label}, ${xs[point.index] ?? ""} : ${valueFormat(point.value)}`}</title>
                    </circle>
                  )),
                )
              : null}
          </svg>
        </div>
      </div>

      <div className="flex pt-2">
        <div className="shrink-0" style={{ width: AXIS_WIDTH }} />
        <div className="relative h-4 min-w-0 flex-1">
          {xs.map((x, index) => {
            const visible = index % labelStep === 0 || index === xs.length - 1;
            if (!visible) return null;
            const isFirst = index === 0;
            const isLast = index === xs.length - 1;
            return (
              <span
                key={x}
                className={cn(
                  "absolute top-0 text-[0.6875rem] whitespace-nowrap text-ink-muted",
                  !isFirst && !isLast && "-translate-x-1/2",
                  isLast && xs.length > 1 && "-translate-x-full",
                )}
                style={{ left: `${xFrac(index) * 100}%` }}
              >
                {x}
              </span>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
