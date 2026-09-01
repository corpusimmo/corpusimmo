import { RangeBar } from "@/components/charts";
import { Badge } from "@/components/ui";
import { formatPrice, formatPricePerSqm } from "@/lib/utils/format";
import type { ValuationRange } from "@/types/valuation";

export function ValueHeadline({
  value,
  pricePerSqm,
  medianPricePerSqm,
  averagePricePerSqm,
  comparableCount,
}: {
  value: ValuationRange;
  pricePerSqm?: number;
  medianPricePerSqm?: number;
  averagePricePerSqm?: number;
  comparableCount: number;
}) {
  // Showing the median and the mean next to the weighted price is a
  // transparency choice: the reader can see we did not pick the flattering one.
  const secondary: { label: string; value: number }[] = [];
  if (medianPricePerSqm !== undefined) {
    secondary.push({ label: "Médiane des ventes retenues", value: medianPricePerSqm });
  }
  if (averagePricePerSqm !== undefined) {
    secondary.push({ label: "Moyenne simple", value: averagePricePerSqm });
  }

  return (
    <section
      aria-labelledby="valeur-title"
      className="animate-fade-up overflow-hidden rounded-xl border border-border bg-surface shadow-md"
    >
      <div className="flex flex-col gap-7 p-6 sm:p-9">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="valeur-title"
            className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle"
          >
            Valeur estimée
          </h2>
          <Badge tone="info" size="sm">
            {comparableCount} vente{comparableCount > 1 ? "s" : ""} comparable
            {comparableCount > 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex flex-col gap-2">
          <p
            className="tnum text-[2.75rem] font-semibold leading-none text-ink sm:text-6xl"
          >
            {formatPrice(value.central)}
          </p>
          <p className="text-sm text-ink-muted">
            Estimation indicative, à considérer comme le centre d’une fourchette.
          </p>
        </div>

        {/* La barre porte déjà les deux bornes avec leurs libellés, et le
            chiffre central est écrit en gros juste au-dessus : rien n'est
            répété. */}
        <RangeBar
          low={value.low}
          central={value.central}
          high={value.high}
          format={formatPrice}
          showCentral={false}
        />

        {pricePerSqm !== undefined ? (
          <div className="flex flex-col gap-3 border-t border-border-soft pt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm text-ink-muted">Prix au m² retenu (pondéré)</span>
              <span className="tnum text-2xl font-semibold text-ink">
                {formatPricePerSqm(pricePerSqm)}
              </span>
            </div>
            {secondary.length > 0 ? (
              <dl className="flex flex-wrap gap-x-8 gap-y-1.5">
                {secondary.map((item) => (
                  <div key={item.label} className="flex items-baseline gap-2">
                    <dt className="text-xs text-ink-subtle">{item.label}</dt>
                    <dd className="tnum text-sm font-medium text-ink-muted">
                      {formatPricePerSqm(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
