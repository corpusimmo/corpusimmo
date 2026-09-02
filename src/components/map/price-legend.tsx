"use client";

import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

import { HEAT_RAMP } from "./base-palette";
import { scaleLabels, type PriceScale } from "./price-scale";

export type LayerMode = "points" | "heat";

/**
 * La légende de la carte, posée dans un coin.
 *
 * Elle dit ce que les couleurs veulent dire ET sur quoi elles sont calées :
 * les bornes sont celles des ventes à l'écran, et changent avec la vue. Une
 * légende qui tairait cela laisserait croire que le rouge de Niort est le
 * rouge de Paris.
 *
 * Les couleurs viennent de `base-palette.ts`, le seul endroit du produit où
 * une couleur en dur est légitime ; elles arrivent ici par import, jamais
 * recopiées.
 */
export function PriceLegend({
  scale,
  mode,
  compact = false,
  className,
}: {
  scale: PriceScale | null;
  mode: LayerMode;
  compact?: boolean;
  className?: string;
}) {
  const shell = cn(
    "pointer-events-auto rounded-md border border-border bg-surface/95 shadow-md backdrop-blur-sm",
    compact ? "px-2 py-1.5" : "px-3 py-2.5",
    className,
  );

  if (mode === "heat") {
    return (
      <div className={shell} role="img" aria-label="Légende : densité des ventes, du sable au bleu nuit">
        <p className="text-[11px] font-medium text-ink">Densité des ventes</p>
        <div
          aria-hidden="true"
          className={cn("mt-1.5 h-2 rounded-full", compact ? "w-28" : "w-40")}
          style={{ backgroundImage: `linear-gradient(90deg, ${HEAT_RAMP.join(", ")})` }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink-subtle">
          <span>peu</span>
          <span>beaucoup</span>
        </div>
      </div>
    );
  }

  if (!scale) return null;
  const labels = scaleLabels(scale);
  const first = scale.breaks[0];
  const last = scale.breaks[scale.breaks.length - 1];

  if (compact) {
    return (
      <div className={shell} role="img" aria-label={`Légende : prix au m² en cinq classes, de moins de ${formatNumber(first)} à plus de ${formatNumber(last)} euros`}>
        <p className="text-[11px] font-medium text-ink">Prix au m²</p>
        <div aria-hidden="true" className="mt-1.5 flex gap-0.5">
          {scale.colors.map((color) => (
            <span key={color} className="h-2 w-6 rounded-sm" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-ink-subtle tnum">
          <span>{formatNumber(first)}</span>
          <span>{formatNumber(last)} €</span>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <p className="text-[11px] font-medium text-ink">Prix au m², sur les ventes affichées</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {scale.colors.map((color, i) => (
          <li key={color} className="flex items-center gap-2 text-[11px] text-ink-muted tnum">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm border border-border-strong/40"
              style={{ backgroundColor: color }}
            />
            {labels[i]}
            {i === scale.colors.length - 1 ? " €/m²" : ""}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] leading-snug text-ink-subtle">
        Quintiles des {formatNumber(scale.sample)} ventes au m² connu. Les bornes suivent la vue.
      </p>
    </div>
  );
}
