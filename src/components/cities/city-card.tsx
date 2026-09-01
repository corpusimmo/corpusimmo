import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { canPublishFigure } from "@/lib/cities/thresholds";
import { cityPath } from "@/lib/cities/links";
import type { CityAggregate, CityFigure } from "@/lib/cities/types";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";

/**
 * Ce que la vignette a besoin de savoir d'une commune, et rien de plus.
 *
 * Le sommaire filtre ses cent vignettes côté navigateur : les agrégats
 * complets (histogrammes, millésimes, secteurs) pèseraient des centaines de
 * kilo-octets dans la page pour n'y servir à rien. On ne fait voyager que les
 * deux médianes et leurs effectifs, qui sont tout ce que la vignette affiche.
 */
export interface CityCardFigure {
  sample: number;
  total: number;
  median?: number;
}

export interface CityCardData {
  slug: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  apartment?: CityCardFigure;
  house?: CityCardFigure;
}

function pick(figure: CityFigure | undefined): CityCardFigure | undefined {
  if (!figure) return undefined;
  return figure.median === undefined
    ? { sample: figure.sample, total: figure.total }
    : { sample: figure.sample, total: figure.total, median: figure.median };
}

export function toCityCardData(city: CityAggregate): CityCardData {
  const apartment = pick(city.byType.apartment);
  const house = pick(city.byType.house);
  return {
    slug: city.slug,
    name: city.name,
    departmentCode: city.departmentCode,
    departmentName: city.departmentName,
    ...(apartment ? { apartment } : {}),
    ...(house ? { house } : {}),
  };
}

/**
 * La vignette d'une commune, au sommaire.
 *
 * Elle porte les deux médianes ET leurs effectifs. C'est plus dense qu'une
 * simple liste de noms, et c'est le but : un sommaire qui n'affiche que des
 * noms oblige à ouvrir dix pages pour comparer deux communes, alors que la
 * donnée tient en une ligne.
 */
export function CityCard({ city }: { city: CityCardData }) {
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
        <Line label="Appartement" figure={city.apartment} />
        <Line label="Maison" figure={city.house} />
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

function Line({ label, figure }: { label: string; figure: CityCardFigure | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums">
        {canPublishFigure(figure) && figure?.median !== undefined ? (
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
