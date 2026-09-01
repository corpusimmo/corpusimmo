import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface StatProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  icon?: ReactNode;
  className?: string;
}

const TREND_STYLES: Record<"up" | "down" | "flat", string> = {
  up: "bg-success-soft text-success-soft-fg",
  down: "bg-danger-soft text-danger-soft-fg",
  flat: "bg-surface-2 text-ink-muted",
};

const TREND_LABELS: Record<"up" | "down" | "flat", string> = {
  up: "en hausse",
  down: "en baisse",
  flat: "stable",
};

export function Stat({ label, value, hint, trend, icon, className }: StatProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          {label}
        </p>
        {icon ? (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-subtle [&_svg]:size-4"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl leading-tight font-semibold tabular-nums text-ink">
          {value}
        </span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
              TREND_STYLES[trend.direction],
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : trend.direction === "down" ? (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            ) : (
              <Minus className="size-3.5" aria-hidden="true" />
            )}
            {trend.value}
            <span className="sr-only"> ({TREND_LABELS[trend.direction]})</span>
          </span>
        ) : null}
      </div>

      {hint ? <p className="text-xs leading-relaxed text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
