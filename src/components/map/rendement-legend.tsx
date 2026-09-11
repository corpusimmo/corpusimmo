"use client";

import { cn } from "@/lib/utils/cn";

import { RENDEMENT_RAMP, type RendementScale } from "./rendement";
import { LOYERS_TYPES, type LoyersIndex, type LoyersType } from "./loyers";

/**
 * La légende du rendement, qui porte plus de réserves que de couleurs.
 *
 * Un taux est le chiffre le plus facile à sur-lire de tout le produit : il a
 * l'air d'un revenu, il n'en est pas un. Cette légende dit donc, dans cet
 * ordre : ce que la couleur mesure, ce que le taux ne retire pas, pourquoi un
 * vert foncé n'est pas une bonne nouvelle en soi, et ce que le blanc veut
 * dire.
 */
export function RendementLegend({
  scale,
  index,
  type,
  className,
}: {
  scale: RendementScale;
  index: LoyersIndex;
  type: LoyersType;
  className?: string;
}) {
  const bien = type === "mai" ? "maisons" : "appartements";
  const typologie = type === "a12" || type === "a3";
  const annees = index.rendement?.annees;
  const periode =
    annees && annees.length > 0
      ? `${annees[0]} à ${annees[annees.length - 1]}`
      : null;

  const labels = bornesLabels(scale.breaks);

  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[16rem] rounded-md border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-ink">Rendement locatif brut</p>
      <p className="text-[10px] text-ink-subtle">
        {bien}, loyer annuel hors charges sur prix de vente
      </p>

      <ul className="mt-1.5 flex flex-col gap-1">
        {RENDEMENT_RAMP.map((color, i) => (
          <li
            key={color}
            className="flex items-center gap-2 text-[11px] text-ink-muted tnum"
          >
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-sm border border-border-strong/40"
              style={{ backgroundColor: color }}
            />
            {labels[i]}
            {i === RENDEMENT_RAMP.length - 1 ? " %" : ""}
          </li>
        ))}
      </ul>

      <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[10px] leading-snug text-ink-subtle">
        <li>
          <strong className="font-medium text-ink-muted">Brut :</strong> avant
          taxe foncière, charges non récupérables, vacance, gestion, frais
          d’acquisition et impôt. Le net tourne couramment entre 60 et 75 % de
          ce chiffre, et nous ne le calculons pas.
        </li>
        <li>
          <strong className="font-medium text-ink-muted">
            Un vert foncé n’est pas une bonne nouvelle en soi :
          </strong>{" "}
          un rendement élevé accompagne le plus souvent un marché où la
          revente est lente. Le prix au m² se lit avec le taux, dans la fiche.
        </li>
        {typologie ? (
          <li>
            DVF ne publie pas de prix par nombre de pièces : cette vue montre
            le rendement de tous les appartements, pas celui de la typologie
            choisie.
          </li>
        ) : null}
        <li>
          <strong className="font-medium text-ink-muted">Sans couleur :</strong>{" "}
          moins de {index.rendement?.seuil ?? 30} ventes enregistrées
          {periode ? ` de ${periode}` : ""}, donc pas de médiane publiable. Le
          vide dit qu’on ne sait pas.
        </li>
      </ul>

      <p className="mt-1.5 text-[10px] leading-snug text-ink-subtle">
        {index.attribution} · {index.rendement?.source ?? "DVF (DGFiP)"}.
      </p>
    </div>
  );
}

/** « moins de 4 », « 4 à 4,8 », … « 7,2 et plus ». */
function bornesLabels(breaks: number[]): string[] {
  const f = (v: number) =>
    v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const premier = breaks[0];
  const dernier = breaks[breaks.length - 1];
  if (premier === undefined || dernier === undefined) return [];
  const labels = [`moins de ${f(premier)}`];
  for (let i = 0; i < breaks.length - 1; i += 1) {
    const a = breaks[i];
    const b = breaks[i + 1];
    if (a === undefined || b === undefined) continue;
    labels.push(`${f(a)} à ${f(b)}`);
  }
  labels.push(`${f(dernier)} et plus`);
  return labels;
}

/** Le libellé du type, pour l'en-tête du bandeau. */
export function nomDuType(type: LoyersType): string {
  return (LOYERS_TYPES.find((t) => t.id === type) ?? LOYERS_TYPES[0]!).nom;
}
