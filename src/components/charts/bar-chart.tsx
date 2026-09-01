import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ChartEmpty, niceTicks } from "./chart-primitives";

export interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  valueFormat?: (n: number) => string;
  tone?: "primary" | "accent";
  className?: string;
  /** Short description used as the chart's accessible name. */
  caption?: string;
}

const BAR_TONES: Record<"primary" | "accent", string> = {
  primary: "fill-primary",
  accent: "fill-accent",
};

const AXIS_WIDTH = 52;

export function BarChart({
  data,
  height = 220,
  valueFormat = formatNumber,
  tone = "primary",
  className,
  caption,
}: BarChartProps) {
  if (data.length === 0) {
    return <ChartEmpty height={height} className={className} />;
  }

  const rawMax = data.reduce(
    (max, item) => (Number.isFinite(item.value) && item.value > max ? item.value : max),
    0,
  );
  const { max: axisMax, ticks } = niceTicks(rawMax, 4);

  const showValues = data.length <= 10;
  // Headroom so the value label never sits on top of its own bar.
  const headroom = showValues ? 20 : 6;
  const plotHeight = Math.max(height - headroom, 10);

  const slot = 100 / data.length;
  const barWidth = Math.min(slot * 0.55, 15);

  const yFor = (value: number) => height - (value / axisMax) * plotHeight;

  const summary = `${caption ?? "Graphique en barres"} : ${data
    .map((item) => `${item.label} : ${valueFormat(item.value)}`)
    .join(", ")}`;

  return (
    <figure role="img" aria-label={summary} className={cn("w-full", className)}>
      <div className="flex">
        <div className="relative shrink-0" style={{ width: AXIS_WIDTH, height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-subtle"
              style={{ top: yFor(tick) }}
            >
              {valueFormat(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100%"
                y1={yFor(tick)}
                y2={yFor(tick)}
                strokeWidth="1"
                className={tick === 0 ? "stroke-border" : "stroke-border-soft"}
              />
            ))}

            {data.map((item, index) => {
              const value = Number.isFinite(item.value) ? Math.max(item.value, 0) : 0;
              const barHeight = (value / axisMax) * plotHeight;
              const x = index * slot + (slot - barWidth) / 2;
              const top = height - barHeight;

              return (
                <g key={`${item.label}-${index}`}>
                  <rect
                    x={`${x}%`}
                    width={`${barWidth}%`}
                    y={top}
                    height={Math.max(barHeight, value > 0 ? 2 : 0)}
                    rx="4"
                    className={cn(
                      BAR_TONES[tone],
                      "transition-opacity duration-150 hover:opacity-80",
                    )}
                  >
                    <title>{`${item.label} : ${valueFormat(item.value)}`}</title>
                  </rect>

                  {showValues ? (
                    <text
                      x={`${x + barWidth / 2}%`}
                      y={top - 7}
                      textAnchor="middle"
                      className="fill-ink text-[0.6875rem] font-semibold tabular-nums"
                    >
                      {valueFormat(item.value)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="flex pt-2">
        <div className="shrink-0" style={{ width: AXIS_WIDTH }} />
        <div className="flex min-w-0 flex-1">
          {data.map((item, index) => (
            <span
              key={`${item.label}-${index}`}
              title={item.label}
              className="min-w-0 flex-1 truncate px-0.5 text-center text-[0.6875rem] text-ink-muted"
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
