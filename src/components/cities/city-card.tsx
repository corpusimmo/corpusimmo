import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { canPublishFigure } from "@/lib/cities/thresholds";
import { cityPath } from "@/lib/cities/links";
import type { CityAggregate } from "@/lib/cities/types";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";

/**
 * La vignette d'une commune, au sommaire.
 *
 * Elle porte les deux médianes ET leurs effectifs. C'est plus dense qu'une
 * simple liste de noms, et c'est le but : un sommaire qui n'affiche que des
 * noms oblige à ouvrir dix pages pour comparer deux communes, alors que la
 * donnée tient en une ligne.
 */
export function CityCard({ city }: { city: CityAggregate }) {
  const flats = city.byType.apartment;
  const houses = city.byType.house;

  return (
    <Link
      href={cityPath(city.slug)}
      className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div>
        <h3 className="text-base font-semibold text-ink">{city.name}</h3>
        <p className="text-xs text-ink-subtle">
          {city.departmentName} ({city.departmentCode})
        </p>
      </div>

      <dl className="flex flex-1 flex-col gap-1.5 text-sm">
        <Line label="Appartement" figure={flats} />
        <Line label="Maison" figure={houses} />
      </dl>

      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        Voir les prix
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

function Line({
  label,
  figure,
}: {
  label: string;
  figure: CityAggregate["byType"]["apartment"];
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums">
        {canPublishFigure(figure) ? (
          <>
            <span className="font-semibold text-ink">{formatPricePerSqm(figure.median)}</span>
            <span className="block text-xs text-ink-subtle">
              {formatNumber(figure.sample)} ventes
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-subtle">effectif insuffisant</span>
        )}
      </dd>
    </div>
  );
}
