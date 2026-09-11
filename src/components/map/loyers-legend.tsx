"use client";

import { cn } from "@/lib/utils/cn";

import { CALIBRATION_LOYERS } from "@/lib/loyers/calibration";

import { LOYERS_TYPES, type LoyersIndex, type LoyersObservesIndex, type LoyersScale, type LoyersType } from "./loyers";

/**
 * La légende du calque des loyers.
 *
 * Elle doit dire quatre choses que la couleur seule ne dit pas :
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
  type = "app",
  className,
}: {
  scale: LoyersScale;
  index: LoyersIndex;
  observes: LoyersObservesIndex | null;
  /** Le type de bien peint sur la carte : la légende en parle nommément. */
  type?: LoyersType;
  className?: string;
}) {
  const labels = scaleLabels(scale.breaks);
  const annees = observes?.annees.join(" et ");
  const choisi = LOYERS_TYPES.find((t) => t.id === type) ?? LOYERS_TYPES[0]!;
  const surface =
    type === "mai"
      ? index.surfacesType.maison
      : type === "a12"
        ? (index.surfacesType.appartementT12 ?? index.surfacesType.appartement)
        : type === "a3"
          ? (index.surfacesType.appartementT3 ?? index.surfacesType.appartement)
          : index.surfacesType.appartement;

  return (
    <div
      className={cn(
        "pointer-events-auto max-w-[16rem] rounded-md border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-medium text-ink">
        Loyer au m², par mois, hors charges
      </p>
      <p className="text-[10px] text-ink-subtle">{choisi.nom}</p>
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
            {type === "a12" || type === "a3" ? (
              <>
                {" "}
                Les observatoires ne découpent pas par nombre de pièces : ces zones restent
                sur leur médiane appartement, tous types confondus.
              </>
            ) : null}
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
            d’annonce par commune, {choisi.bien} type {surface} m² ({index.annee}), <strong className="font-medium text-ink-muted">ramenés hors
            charges</strong> par le facteur mesuré sur les zones d’observatoire
            ({CALIBRATION_LOYERS.appariement.zones} zones,{" "}
            {Math.round((1 - CALIBRATION_LOYERS.global) * 100)} % d’écart médian). Demi-teinte :
            estimé sur les communes voisines, faute d’annonces locales.
          </span>
        </li>
      </ul>
      {/* LE CHEMIN DE RETOUR VERS LE CHIFFRE PUBLIÉ.
          Quelqu'un qui a lu « 17,2 €/m² » sur la carte des loyers de l'ANIL
          ne retrouve pas ce nombre ici, et sans cette ligne il conclut à une
          erreur plutôt qu'à une correction. Le facteur est écrit, pas
          seulement son principe. */}
      <p className="mt-2 text-[10px] leading-snug text-ink-subtle">
        Le chiffre publié par l’ANIL est charges comprises : ajouter environ{" "}
        {Math.round((1 / CALIBRATION_LOYERS.global - 1) * 100)} % à la valeur
        affichée pour le retrouver.
      </p>
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
