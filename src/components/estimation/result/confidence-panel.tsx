import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { ConfidenceBand } from "@/components/illustrations";
import { Progress } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { ConfidenceLevel, ValuationConfidence } from "@/types/valuation";

const LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  low: "Faible",
  moderate: "Modérée",
  high: "Élevée",
};

const LEVEL_HINTS: Record<ConfidenceLevel, string> = {
  low: "Peu de ventes réellement comparables, ou des prix très hétérogènes. Prenez cette fourchette comme un ordre de grandeur.",
  moderate:
    "Un socle de ventes correct, avec des écarts de prix notables. La fourchette reste large à dessein.",
  high: "De nombreuses ventes proches et cohérentes entre elles. La fourchette est resserrée.",
};

const LEVEL_TONE: Record<ConfidenceLevel, "primary" | "accent" | "success"> = {
  low: "accent",
  moderate: "primary",
  high: "success",
};

const IMPACT_ICON = {
  positive: TrendingUp,
  neutral: Minus,
  negative: TrendingDown,
} as const;

const IMPACT_CLASS = {
  positive: "text-success",
  neutral: "text-ink-subtle",
  negative: "text-danger",
} as const;

export function ConfidencePanel({ confidence }: { confidence: ValuationConfidence }) {
  const Icon = IMPACT_ICON;

  return (
    <section
      aria-labelledby="confiance-title"
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2
            id="confiance-title"
            className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle"
          >
            Niveau de confiance
          </h2>
          <p className="text-lg font-semibold text-ink">{LEVEL_LABELS[confidence.level]}</p>
        </div>
        <p className="tnum text-2xl font-semibold text-ink">
          {Math.round(confidence.score)}
          <span className="text-base font-normal text-ink-subtle">/100</span>
        </p>
      </div>

      {/* Posée AU-DESSUS du score : elle apprend à le lire avant de le donner.
          Un « 63/100 » sans grille de lecture est un chiffre qu'on prend soit
          pour une note d'école, soit pour une probabilité, et il n'est ni l'un
          ni l'autre. */}
      <div className="rounded-lg bg-surface-2 p-3 sm:p-4">
        <ConfidenceBand />
      </div>

      <div>
        <Progress
          value={confidence.score}
          max={100}
          tone={LEVEL_TONE[confidence.level]}
          label={`Niveau de confiance : ${Math.round(confidence.score)} sur 100`}
        />
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">
        {LEVEL_HINTS[confidence.level]}
      </p>

      {confidence.factors.length > 0 ? (
        <ul className="flex flex-col gap-2.5 border-t border-border-soft pt-4">
          {confidence.factors.map((factor) => {
            const FactorIcon = Icon[factor.impact];
            return (
              <li key={factor.label} className="flex items-start gap-2.5 text-sm text-ink">
                <FactorIcon
                  aria-hidden="true"
                  className={cn("mt-0.5 size-4 shrink-0", IMPACT_CLASS[factor.impact])}
                />
                <span className="leading-relaxed">{factor.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
