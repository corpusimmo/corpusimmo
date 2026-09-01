import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";

import { CityCard } from "@/components/cities/city-card";
import { Button } from "@/components/ui";
import { disclaimers, dvfCoverage } from "@/config/site";
import {
  CITIES_ROOT,
  MIN_CITY_DWELLING_SALES,
  MIN_FIGURE_SAMPLE,
  cityDataset,
  cityPath,
  formatIsoDay,
  mapHref,
  publishedCities,
} from "@/lib/cities";
import { breadcrumbNode, itemListNode } from "@/lib/seo/json-ld";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = pageMetadata({
  title: "Prix immobilier par commune",
  description:
    "Le prix au m² dans les grandes communes françaises, calculé sur les ventes réellement " +
    "enregistrées par la DGFiP, avec le nombre de ventes derrière chaque chiffre.",
  path: CITIES_ROOT,
  socialTitle: "Le prix au m², commune par commune, sur les ventes réelles",
});

export default function PrixImmobilierPage() {
  const cities = publishedCities();
  const dataset = cityDataset();
  const firstYear = dataset.years[0];
  const lastYear = dataset.years[dataset.years.length - 1];

  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page flex flex-col gap-10">
        {/* Un sommaire est une liste : c'est ce que dit le balisage, et rien de
            plus. Aucun jeu de données déclaré, aucune FAQ absente de l'écran. */}
        <JsonLd
          nodes={[
            breadcrumbNode([
              { name: "Accueil", path: "/" },
              { name: "Prix immobilier", path: CITIES_ROOT },
            ]),
            itemListNode(
              "Prix immobilier par commune",
              cities.map((city) => ({
                name: `Prix immobilier à ${city.name}`,
                path: cityPath(city.slug),
                description: `Sur ${formatNumber(city.dwellingSales)} ventes enregistrées.`,
              })),
            ),
          ]}
        />

        <header className="max-w-3xl">
          <p className="eyebrow">Observatoire des prix</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            Le prix immobilier, commune par commune
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-muted">
            {cities.length} communes, {formatNumber(totalSales(cities))} ventes de logement
            enregistrées entre {firstYear} et {lastYear}. Chaque chiffre de ces pages est
            accompagné du nombre de ventes qui le fonde, et rien n&apos;y est extrapolé depuis
            des annonces.
          </p>
        </header>

        <section
          aria-labelledby="methode"
          className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-3"
        >
          <div className="lg:col-span-3">
            <h2 id="methode" className="font-display text-xl text-ink">
              Ce que ces pages contiennent, et ce qu&apos;elles refusent d&apos;afficher
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Des actes, pas des annonces</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Les prix viennent des Demandes de Valeurs Foncières&nbsp;: le prix inscrit à
              l&apos;acte, chez le notaire. Un prix demandé dans une annonce n&apos;est pas un
              prix payé, et l&apos;écart entre les deux est précisément ce qu&apos;une
              négociation produit.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Un seuil, pas une page par commune</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Une commune n&apos;a de page qu&apos;au-delà de {MIN_CITY_DWELLING_SALES} ventes de
              logement sur la période, et une médiane n&apos;est publiée qu&apos;au-delà de{" "}
              {MIN_FIGURE_SAMPLE} ventes du même type. En dessous, la page dit
              l&apos;effectif et se tait sur le prix.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Aucune prévision</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              Les évolutions comparent deux millésimes complets déjà enregistrés. Quand
              l&apos;écart mesuré reste dans la marge d&apos;incertitude des deux médianes, il
              est affiché comme tel et nous ne concluons pas à une tendance.
            </p>
          </div>
        </section>

        <section aria-labelledby="communes" className="flex flex-col gap-5">
          <div className="max-w-3xl">
            <h2 id="communes" className="font-display text-2xl text-ink">
              Les communes couvertes
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Les cent communes les plus peuplées parmi celles que DVF couvre, de la plus
              peuplée à la moins peuplée. {dvfCoverage.excludedLabel} n&apos;y figurent pas,
              faute de publication&nbsp;: Strasbourg, Mulhouse et Metz relèvent du livre
              foncier et sont absentes de la source, pas de notre sélection.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cities.map((city) => (
              <li key={city.slug}>
                <CityCard city={city} />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 font-display text-xl text-ink">
              <MapPinned aria-hidden="true" className="size-5 text-ink-subtle" />
              Votre commune n&apos;est pas dans la liste
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              La carte des ventes couvre toute la France, sans sélection ni seuil&nbsp;: elle
              affiche les mutations une par une, ce qui reste honnête là où une médiane ne le
              serait pas.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href={mapHref()}>
              Ouvrir la carte des ventes
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </section>

        <footer className="flex flex-col gap-2 border-t border-border pt-6 text-xs leading-relaxed text-ink-subtle">
          <p>{disclaimers.dvfSource}</p>
          <p>{disclaimers.dvfLimits}</p>
          <p>Agrégats calculés le {formatIsoDay(dataset.generatedAt)}.</p>
        </footer>
      </div>
    </div>
  );
}

function totalSales(cities: readonly { dwellingSales: number }[]): number {
  return cities.reduce((sum, city) => sum + city.dwellingSales, 0);
}
