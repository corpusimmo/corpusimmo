import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ProgressProps {
  value: number;
  max?: number;
  tone?: "primary" | "accent" | "success";
  className?: string;
  label?: string;
}

const TONES: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
};

export function Progress({
  value,
  max = 100,
  tone = "primary",
  className,
  label,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-ink-muted">{label}</span>
          <span className="text-xs font-semibold tabular-nums text-ink">
            {Math.round(percent)} %
          </span>
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label ?? "Progression"}
        className="h-2 w-full overflow-hidden rounded-full bg-border-soft"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            TONES[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      aria-label="Progression"
      className={cn("flex w-full items-center gap-1", className)}
    >
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2",
              index < steps.length - 1 && "flex-1",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors duration-150",
                done && "border-primary bg-primary text-primary-fg",
                active && "border-primary bg-primary-soft text-primary-soft-fg",
                !done && !active && "border-border bg-surface text-ink-subtle",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>

            {/* `whitespace-nowrap` et non `truncate` : une étiquette coupée
                à « Carac… » ne nomme plus l'étape, alors qu'un rail un peu
                plus serré se lit encore. C'est le trait de liaison qui cède la
                place, pas le mot. */}
            <span
              className={cn(
                "whitespace-nowrap text-xs font-medium",
                active ? "text-ink" : "text-ink-muted",
                // Only the active label survives on small screens.
                !active && "hidden sm:inline",
              )}
            >
              {step}
              {done ? <span className="sr-only"> (terminé)</span> : null}
            </span>

            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px min-w-2 flex-1 rounded-full transition-colors duration-150",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
