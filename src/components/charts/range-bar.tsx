import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ChartEmpty } from "./chart-primitives";

export interface RangeBarProps {
  low: number;
  central: number;
  high: number;
  format?: (n: number) => string;
  className?: string;
  /** Overrides the "Estimation centrale" caption above the value. */
  centralLabel?: string;
  /**
   * Faux quand le chiffre central est déjà écrit en gros juste au-dessus :
   * le répéter à quelques pixels d'écart affaiblit les deux.
   */
  showCentral?: boolean;
}

const TRACK_HEIGHT = 22;
/** Slack on each side so the range never touches the ends of the track. */
const SIDE_PADDING = 0.28;

/**
 * The signature component of the product: an estimation is a range, and the
 * range must be as visible as the headline number.
 */
export function RangeBar({
  low,
  central,
  high,
  format = formatPrice,
  className,
  centralLabel = "Estimation centrale",
  showCentral = true,
}: RangeBarProps) {
  if (![low, central, high].every((value) => Number.isFinite(value))) {
    return <ChartEmpty height={120} className={className} message="Fourchette indisponible" />;
  }

  const lowValue = Math.min(low, high);
  const highValue = Math.max(low, high);
  const spread = highValue - lowValue;
  const padding = spread > 0 ? spread * SIDE_PADDING : Math.max(Math.abs(highValue) * 0.05, 1);

  const domainMin = lowValue - padding;
  const domainMax = highValue + padding;
  const domainSpan = domainMax - domainMin || 1;

  const percent = (value: number) =>
    Math.min(Math.max(((value - domainMin) / domainSpan) * 100, 0), 100);

  const lowPercent = percent(lowValue);
  const highPercent = percent(highValue);
  const centralPercent = percent(Math.min(Math.max(central, domainMin), domainMax));

  return (
    <figure
      role="img"
      aria-label={`Fourchette d'estimation de ${format(lowValue)} à ${format(highValue)}, valeur centrale ${format(central)}`}
      className={cn("flex w-full flex-col gap-3", className)}
    >
      {showCentral ? (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-3xl leading-none font-semibold tabular-nums text-ink sm:text-4xl">
            {format(central)}
          </span>
          <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            {centralLabel}
          </span>
        </div>
      ) : null}

      <svg className="block w-full" height={TRACK_HEIGHT} aria-hidden="true">
        <defs>
          <linearGradient id="corpusimmo-range-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* Track */}
        <rect
          x="0"
          y={TRACK_HEIGHT / 2 - 3}
          width="100%"
          height="6"
          rx="3"
          className="fill-border-soft"
        />

        {/* Range */}
        <rect
          x={`${lowPercent}%`}
          y={TRACK_HEIGHT / 2 - 6}
          width={`${Math.max(highPercent - lowPercent, 0.5)}%`}
          height="12"
          rx="6"
          fill="url(#corpusimmo-range-fill)"
        />

        {/* Bounds */}
        <rect
          x={`${lowPercent}%`}
          y={TRACK_HEIGHT / 2 - 9}
          width="2"
          height="18"
          rx="1"
          className="fill-primary/60"
        />
        <rect
          x={`${highPercent}%`}
          y={TRACK_HEIGHT / 2 - 9}
          width="2"
          height="18"
          rx="1"
          className="fill-primary/60"
        />

        {/* Central marker */}
        <circle
          cx={`${centralPercent}%`}
          cy={TRACK_HEIGHT / 2}
          r="8"
          strokeWidth="3"
          className="fill-primary stroke-surface"
        />
      </svg>

      <div className="flex items-start justify-between gap-4 text-xs">
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold tabular-nums text-ink">{format(lowValue)}</span>
          <span className="text-ink-subtle">Fourchette basse</span>
        </span>
        <span className="flex flex-col gap-0.5 text-right">
          <span className="font-semibold tabular-nums text-ink">{format(highValue)}</span>
          <span className="text-ink-subtle">Fourchette haute</span>
        </span>
      </div>
    </figure>
  );
}
