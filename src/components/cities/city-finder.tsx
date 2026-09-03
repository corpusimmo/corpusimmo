"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import Link from "next/link";
import { MapPinned, Search } from "lucide-react";

import { Button, EmptyState, Input } from "@/components/ui";
import { cityMatches } from "@/lib/cities/search";
import { formatNumber } from "@/lib/utils/format";

import { CityCard, type CityCardData } from "./city-card";

/**
 * Le sommaire des communes, avec un champ pour y trouver la sienne.
 *
 * Cent vignettes triées par population, c'est lisible pour Paris et Lyon et
 * illisible pour Niort : personne ne fait défiler quatre-vingts cartes pour
 * trouver la sienne. Le champ filtre sur le nom de la commune, le nom et le
 * numéro du département, sans tenir compte des accents ni des tirets, et sans
 * requête : tout est déjà dans la page.
 *
 * Le rendu initial (serveur) affiche les cent vignettes : le robot comme le
 * lecteur sans JavaScript voient le sommaire complet, et le champ n'agit que
 * par-dessus.
 */
export function CityFinder({ cities }: { cities: CityCardData[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const matches = useMemo(
    () => cities.filter((city) => cityMatches(city, deferred)),
    [cities, deferred],
  );

  const filtering = deferred.trim() !== "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={id} className="sr-only">
            Trouver une commune ou un département
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            id={id}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Trouver une commune ou un département"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="pl-10"
          />
        </div>
        <p className="tnum text-sm text-ink-muted" aria-live="polite">
          {filtering
            ? `${formatNumber(matches.length)} commune${matches.length > 1 ? "s" : ""} sur ${formatNumber(cities.length)}`
            : `${formatNumber(cities.length)} communes, de la plus peuplée à la moins peuplée`}
        </p>
      </div>

      {matches.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matches.map((city) => (
            <li key={city.slug}>
              <CityCard city={city} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<MapPinned aria-hidden="true" className="size-6" />}
          title="Aucune commune ne porte ce nom dans la sélection"
          description="Le sommaire ne couvre que les cent communes les plus peuplées. L'observatoire, lui, couvre toute la France : cherchez-y votre adresse."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/observatoire">Ouvrir l&apos;observatoire</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
