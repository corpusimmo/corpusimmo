import { BarChart } from "@/components/charts";
import { BrandMark } from "@/components/layout/brand-mark";
import { canPublishFigure } from "@/lib/cities/thresholds";
import { cityPath } from "@/lib/cities/links";
import type { CityAggregate } from "@/lib/cities/types";
import {
  formatNumber,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import Link from "next/link";

/**
 * LA PIÈCE À CONVICTION, à droite du titre.
 *
 * Un site dont tout l'argument est « nous partons de ventes réelles » ne peut
 * pas s'ouvrir sur une moitié d'écran vide. Ce composant montre, dès la
 * première vue, ce que le site fait de mieux : un relevé calculé sur des actes.
 *
 * TOUT EST RÉEL. Les chiffres viennent des agrégats DVF versionnés dans
 * `src/data/cities`, les mêmes que ceux des pages villes, avec leurs effectifs.
 * Rien n'est arrondi pour faire joli, rien n'est inventé pour remplir. La
 * commune est choisie par l'appelant, et si sa donnée ne porte pas la figure,
 * le composant ne rend rien plutôt qu'un cadre vide.
 *
 * LA FORME EST CELLE D'UN DOCUMENT, pas d'une carte d'application : en-tête
 * avec la marque, filet bronze, chiffres tabulaires, mention de source en pied.
 * C'est le registre du logotype (un titre de propriété) appliqué à une page.
 * Un léger pli de coin, dessiné en CSS avec les tokens, rappelle qu'un corpus
 * est fait de feuillets.
 */
export function HeroExhibit({ city }: { city: CityAggregate }) {
  const flats = city.byType.apartment;
  if (!canPublishFigure(flats) || !flats.histogram) return null;

  const years = `${city.years[0]} à ${city.years[city.years.length - 1]}`;
  const bins = flats.histogram.bins.map((bin) => ({
    label: formatNumber(bin.from),
    value: bin.count,
  }));

  return (
    <Link
      href={cityPath(city.slug)}
      aria-label={`Prix immobilier à ${city.name}, la page complète`}
      className="group relative block rounded-xl border border-border bg-surface shadow-lg transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1"
    >
      {/* Le coin corné : un triangle de papier replié, deux tokens et rien
          d'autre. Il transforme une carte en feuillet. */}
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 size-7 rounded-tr-xl bg-[linear-gradient(225deg,var(--canvas)_50%,var(--paper-200)_50%)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-soft px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-[22px]" />
          <span className="eyebrow">Relevé de ventes</span>
        </div>
        <span className="tnum text-xs text-ink-subtle">Millésimes {years}</span>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <p className="font-display text-2xl leading-tight text-ink">
          {city.name}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">
          {city.departmentName} · {formatNumber(city.dwellingSales)} ventes de
          logement enregistrées
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 pt-5 sm:gap-x-6 sm:px-6">
        <Figure
          label="Appartement, médiane"
          value={formatPricePerSqm(flats.median)}
          hint={`sur ${formatNumber(flats.sample)} ventes`}
          strong
        />
        <Figure
          label="Prix de vente médian"
          value={formatPrice(flats.medianPrice)}
          hint={
            flats.medianArea
              ? `pour ${formatNumber(flats.medianArea)} m² en médiane`
              : undefined
          }
        />
      </dl>

      <div className="px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-xs font-medium text-ink-muted">
            Répartition des prix au m²
          </p>
          <p className="tnum text-xs text-ink-subtle">
            {formatPricePerSqm(flats.d1)} à {formatPricePerSqm(flats.d9)}
          </p>
        </div>
        <BarChart
          data={bins}
          tone="accent"
          height={128}
          valueFormat={formatNumber}
          caption={`Nombre de ventes d'appartements à ${city.name} par tranche de prix au m²`}
          className="mt-2"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-b-xl border-t border-border-soft bg-surface-2 px-5 py-3 sm:px-6">
        <p className="text-xs leading-relaxed text-ink-subtle">
          Source&nbsp;: DVF, DGFiP. Ventes de gré à gré, lot unique.
        </p>
        <span className="shrink-0 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
          Voir la commune&nbsp;→
        </span>
      </div>
    </Link>
  );
}

function Figure({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd
        className={
          strong
            ? "tnum font-display text-3xl leading-none text-ink"
            : "tnum font-display text-2xl leading-none text-ink"
        }
      >
        {value}
      </dd>
      {hint ? <dd className="tnum text-xs text-ink-subtle">{hint}</dd> : null}
    </div>
  );
}
