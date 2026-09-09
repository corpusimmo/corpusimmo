"use client";

import { cn } from "@/lib/utils/cn";

import type { LoyersIndex, LoyersObservesIndex, LoyersScale } from "./loyers";

/**
 * La légende du calque des loyers.
 *
 * Elle doit dire trois choses que la couleur seule ne dit pas :
 *
 *   · DEUX SOURCES, pas une. L'aplat plein est un loyer de bail signé, hors
 *     charges, relevé par un observatoire local. L'aplat clair est un loyer
 *     d'annonce, charges comprises, estimé par modèle. Les deux ne sont pas
 *     comparables au centime, et les colorier avec la même rampe est un choix
 *     de lisibilité, pas une équivalence.
 *   · LE DEMI-TON. Une commune sans annonce locale reçoit la valeur de ses
 *     voisines ; elle est peinte à moitié pour que l'œil ne lui prête pas une
 *     précision qu'elle n'a pas.
 *   · L'ATTRIBUTION, exigée par la licence de la carte des loyers.
 */
export function LoyersLegend({
  scale,
  index,
  observes,
  className,
}: {
  scale: LoyersScale;
  index: LoyersIndex;
  observes: LoyersObservesIndex | null;
  className?: string;
}) {
  const labels = scaleLabels(scale.breaks);
  const annees = observes?.annees.join(" et ");

  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[16rem] rounded-md border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-ink">Loyer au m², par mois</p>
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
      <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[10px] leading-snug text-ink-subtle">
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0 rounded-sm border-2 border-ink/70"
            style={{ backgroundColor: scale.colors[2] }}
          />
          <span>
            <strong className="font-medium text-ink-muted">Contour marqué :</strong> loyers de
            baux signés, hors charges, observatoires locaux des loyers
            {annees ? ` (${annees})` : ""}.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0 rounded-sm opacity-40"
            style={{ backgroundColor: scale.colors[2] }}
          />
          <span>
            <strong className="font-medium text-ink-muted">Aplat clair :</strong> loyers
            d’annonce par commune, charges comprises, appartement type{" "}
            {index.surfacesType.appartement} m² ({index.annee}). Demi-teinte : estimé sur les
            communes voisines, faute d’annonces locales.
          </span>
        </li>
      </ul>
      <p className="mt-1.5 text-[10px] leading-snug text-ink-subtle">{index.attribution}.</p>
    </div>
  );
}

function scaleLabels(breaks: number[]): string[] {
  const first = breaks[0];
  const last = breaks[breaks.length - 1];
  if (first === undefined || last === undefined) return [];
  const f = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const labels = [`moins de ${f(first)}`];
  for (let i = 0; i < breaks.length - 1; i += 1) {
    const from = breaks[i];
    const to = breaks[i + 1];
    if (from === undefined || to === undefined) continue;
    labels.push(`${f(from)} à ${f(to)}`);
  }
  labels.push(`${f(last)} et plus`);
  return labels;
}
