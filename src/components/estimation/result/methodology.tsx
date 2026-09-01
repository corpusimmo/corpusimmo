import { disclaimers } from "@/config/site";
import { formatDistance, formatNumber, formatPercent } from "@/lib/utils/format";
import type { ValuationResult } from "@/types/valuation";

export function Methodology({ valuation }: { valuation: ValuationResult }) {
  const { diagnostics } = valuation;
  const [firstYear, lastYear] = diagnostics.yearRange ?? [];

  const rows: { label: string; value: string }[] = [
    { label: "Méthode", value: "Comparaison directe (ventes DVF pondérées)" },
    { label: "Rayon retenu", value: formatDistance(diagnostics.radiusUsed) },
    { label: "Ventes trouvées dans la zone", value: formatNumber(diagnostics.candidatesFound) },
    { label: "Ventes retenues", value: formatNumber(diagnostics.retained) },
  ];

  if (diagnostics.dispersion !== undefined) {
    rows.push({
      label: "Dispersion des prix",
      value: formatPercent(diagnostics.dispersion * 100, 0),
    });
  }
  if (firstYear !== undefined && lastYear !== undefined) {
    rows.push({
      label: "Millésimes utilisés",
      value: firstYear === lastYear ? `${firstYear}` : `${firstYear} – ${lastYear}`,
    });
  }

  return (
    <section
      aria-labelledby="methode-title"
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface-2 p-6"
    >
      <h2
        id="methode-title"
        className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle"
      >
        Méthode et traçabilité
      </h2>

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-border-soft pb-2"
          >
            <dt className="text-sm text-ink-muted">{row.label}</dt>
            <dd className="tnum text-sm font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      {diagnostics.rejected.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">Ventes écartées</h3>
          <ul className="flex flex-col gap-1.5">
            {diagnostics.rejected.map((row) => (
              <li key={row.reason} className="flex justify-between gap-4 text-sm text-ink-muted">
                <span>{row.reason}</span>
                <span className="tnum shrink-0 font-medium text-ink">{formatNumber(row.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-ink-muted">
        {disclaimers.long}
      </p>
    </section>
  );
}
