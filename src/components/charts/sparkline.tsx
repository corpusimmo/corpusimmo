import { cn } from "@/lib/utils/cn";

export type SparklineTone = "primary" | "accent" | "success" | "danger";

export interface SparklineProps {
  values: number[];
  height?: number;
  tone?: SparklineTone;
  className?: string;
  /** Accessible name — a sparkline without context is noise for a screen reader. */
  label?: string;
}

const STROKE: Record<SparklineTone, string> = {
  primary: "stroke-primary",
  accent: "stroke-accent",
  success: "stroke-success",
  danger: "stroke-danger",
};

const FILL: Record<SparklineTone, string> = {
  primary: "fill-primary/12",
  accent: "fill-accent/14",
  success: "fill-success/12",
  danger: "fill-danger/12",
};

export function Sparkline({
  values,
  height = 40,
  tone = "primary",
  className,
  label,
}: SparklineProps) {
  const clean = values.filter((value) => Number.isFinite(value));

  if (clean.length < 2) {
    return (
      <div
        style={{ height }}
        aria-hidden="true"
        className={cn("flex w-full items-center", className)}
      >
        <span className="h-px w-full bg-border" />
      </div>
    );
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;

  // 6% of vertical padding so the extremes are not clipped by the stroke.
  const points = clean.map((value, index) => ({
    x: (index / (clean.length - 1)) * 100,
    y: 6 + (1 - (value - min) / span) * 88,
  }));

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L${last.x} 100 L${first.x} 100 Z` : line;

  return (
    <div
      role="img"
      aria-label={label ?? "Évolution"}
      style={{ height }}
      className={cn("relative w-full", className)}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path d={area} className={FILL[tone]} />
        <path
          d={line}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={STROKE[tone]}
        />
      </svg>

      {/* Pixel layer keeps the end marker a real circle. */}
      {last ? (
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <circle
            cx="100%"
            cy={(last.y / 100) * height}
            r="2.5"
            className={cn("fill-surface", STROKE[tone])}
            strokeWidth="2"
          />
        </svg>
      ) : null}
    </div>
  );
}
