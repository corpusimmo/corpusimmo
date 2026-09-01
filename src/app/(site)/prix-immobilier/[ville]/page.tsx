import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Home, Ruler } from "lucide-react";

import { BarChart } from "@/components/charts";
import { PriceByTypeTable } from "@/components/cities/price-table";
import { PriceDistribution } from "@/components/cities/price-distribution";
import { CityPriceSeries } from "@/components/cities/price-series";
import { SectorTable } from "@/components/cities/sector-table";
import { Badge, Button, Stat } from "@/components/ui";
import { disclaimers } from "@/config/site";
import {
  CITIES_ROOT,
  CITY_PROPERTY_TYPES,
  MIN_SERIES_POINTS,
  TYPE_LABELS,
  canPublishFigure,
  cityBreadcrumb,
  cityDataset,
  cityPath,
  cityTools,
  comparisonSentence,
  coverageParagraph,
  dispersionParagraph,
  distanceBetweenCitiesKm,
  estimatorHref,
  evolutionOf,
  evolutionParagraph,
  findCity,
  formatIsoDay,
  mapHref,
  marketParagraph,
  metaDescription,
  neighbourCities,
  pageTitle,
  periodLabel,
  plottableYears,
  publishableSectors,
  publishedCities,
  sectorCoverage,
  sectorParagraph,
  transactionsHref,
} from "@/lib/cities";
import type { CityAggregate } from "@/lib/cities";
import { coverageDisclaimer } from "@/lib/dvf";
import { breadcrumbNode } from "@/lib/seo/json-ld";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";

interface PageProps {
  params: Promise<{ ville: string }>;
}

/**
 * LES CENT PAGES SONT ÉCRITES AU BUILD, ET RIEN N'Y EST LU À LA REQUÊTE.
 *
 * Aucun `cookies()`, aucun `headers()`, aucun `searchParams` : c'est
 * l'invariant du dépôt, et il tient ici pour une raison simple. Les agrégats
 * sont un fichier versionné (`src/data/cities/aggregates.json`), pas un appel
 * réseau. Le build ne télécharge rien et ne peut donc pas échouer parce que
 * data.gouv.fr est indisponible un mardi.
 *
 * `dynamicParams = false` ferme la porte au reste : une commune absente du jeu
 * de données répond 404 plutôt que de tenter un rendu à la volée. Une URL
 * inventée ne doit pas produire une page à moitié vide qui entrerait dans
 * l'index.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedCities().map((city) => ({ ville: city.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ville } = await params;
  const city = findCity(ville);
  if (!city) return { title: "Commune introuvable" };

  return pageMetadata({
    title: pageTitle(city),
    description: metaDescription(city),
    path: cityPath(city.slug),
    socialTitle: `${pageTitle(city)}, d'après les ventes enregistrées`,
  });
}

export default async function VillePage({ params }: PageProps) {
  const { ville } = await params;
  const city = findCity(ville);
  if (!city) notFound();

  const dataset = cityDataset();
  const neighbours = neighbourCities(city);
  const sectors = publishableSectors(city);
  const tools = cityTools();
  const flats = city.byType.apartment;
  const houses = city.byType.house;
  const headline = canPublishFigure(flats) ? flats : houses;

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex flex-col gap-10">
        {/*
          LE BALISAGE S'ARRÊTE AU FIL D'ARIANE, DÉLIBÉRÉMENT.

          Pas de `Dataset` : le jeu de données est celui de la DGFiP, il vit sur
          data.gouv.fr, et le revendiquer serait faux. Pas de `Product` ni
          d'`Offer` : rien n'est vendu. Aucun balisage de questions-réponses non
          plus, puisque la page n'en affiche aucune. Le fil d'Ariane, lui, décrit
          une arborescence qui existe vraiment et un lien de retour qui est
          réellement à l'écran.

          (Le nom du type schema.org des questions-réponses n'est volontairement
          pas écrit ici : `src/lib/seo/json-ld.test.ts` parcourt le TEXTE des
          fichiers de `src/app` pour vérifier qu'aucune page ne le pose, et une
          simple phrase de commentaire le citant ferait échouer ce garde-fou.)
        */}
        <JsonLd nodes={[breadcrumbNode(cityBreadcrumb(city))]} />

        <header className="flex flex-col gap-4">
          <Link
            href={CITIES_ROOT}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Toutes les communes
          </Link>

          <div className="max-w-3xl">
            <p className="eyebrow">
              {city.departmentName} ({city.departmentCode})
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
              {pageTitle(city)}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-ink-muted">
              {formatNumber(city.dwellingSales)} ventes de logement enregistrées{" "}
              {periodLabel(city)}, dont {formatNumber(headline.sample)} exploitables au prix au
              m². Tous les chiffres de cette page viennent des actes notariés publiés par la
              DGFiP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              Population&nbsp;: {formatNumber(city.population)}
            </Badge>
            {city.postcodes.slice(0, 4).map((postcode) => (
              <Badge key={postcode} tone="neutral" size="sm">
                {postcode}
              </Badge>
            ))}
            <Badge tone="accent" size="sm">
              Millésimes DVF {city.years[0]} à {city.latestYear}
            </Badge>
          </div>
        </header>

        <section aria-label="Les chiffres clés" className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Appartement, prix médian au m²"
            value={canPublishFigure(flats) ? formatPricePerSqm(flats.median) : "Non publié"}
            hint={
              canPublishFigure(flats)
                ? `Sur ${formatNumber(flats.sample)} ventes retenues`
                : `${formatNumber(flats.sample)} ventes exploitables, effectif insuffisant`
            }
            icon={<Building2 aria-hidden="true" />}
          />
          <Stat
            label="Maison, prix médian au m²"
            value={canPublishFigure(houses) ? formatPricePerSqm(houses.median) : "Non publié"}
            hint={
              canPublishFigure(houses)
                ? `Sur ${formatNumber(houses.sample)} ventes retenues`
                : `${formatNumber(houses.sample)} ventes exploitables, effectif insuffisant`
            }
            icon={<Home aria-hidden="true" />}
          />
          <Stat
            label="Ventes de logement"
            value={formatNumber(city.dwellingSales)}
            hint={`Ventes de gré à gré, ${periodLabel(city)}`}
            icon={<Ruler aria-hidden="true" />}
          />
        </section>

        <section aria-labelledby="marche" className="flex max-w-3xl flex-col gap-3">
          <h2 id="marche" className="font-display text-2xl text-ink">
            Ce que disent les ventes enregistrées
          </h2>
          <p className="leading-relaxed text-ink-muted">{marketParagraph(city)}</p>
          {CITY_PROPERTY_TYPES.map((type) => {
            const sentence = comparisonSentence(city, neighbours, type);
            return sentence ? (
              <p key={type} className="leading-relaxed text-ink-muted">
                {sentence}
              </p>
            ) : null;
          })}
        </section>

        <section aria-labelledby="prix" className="flex flex-col gap-4">
          <div className="max-w-3xl">
            <h2 id="prix" className="font-display text-2xl text-ink">
              Le prix au m², par type de bien
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Les mutations retenues sont les ventes de gré à gré portant sur un lot unique, avec
              une surface exploitable&nbsp;: ce sont exactement les règles de sélection du moteur
              d&apos;estimation, pour que les deux ne se contredisent jamais.
            </p>
          </div>
          <PriceByTypeTable city={city} />
          <p className="max-w-3xl text-xs leading-relaxed text-ink-subtle">
            La colonne « vente médiane » ne se divise pas par la surface médiane pour retrouver
            le prix au m²&nbsp;: la médiane d&apos;un rapport n&apos;est pas le rapport des
            médianes. Les deux colonnes décrivent le même marché, elles ne se déduisent pas
            l&apos;une de l&apos;autre.
          </p>
        </section>

        <section aria-labelledby="dispersion" className="flex flex-col gap-6">
          <div className="max-w-3xl">
            <h2 id="dispersion" className="font-display text-2xl text-ink">
              La dispersion, que la médiane ne montre pas
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Une médiane dit qu&apos;une vente sur deux est passée au-dessus. Elle ne dit rien de
              l&apos;écart entre les deux moitiés, et c&apos;est pourtant lui qui décide si un
              prix communal vous sert à quelque chose.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {CITY_PROPERTY_TYPES.map((type) => {
              const figure = city.byType[type];
              const paragraph = dispersionParagraph(city, type);
              if (!paragraph) return null;

              return (
                <article
                  key={type}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
                >
                  <h3 className="font-display text-lg text-ink capitalize">
                    {TYPE_LABELS[type].plural}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-muted">{paragraph}</p>
                  <PriceDistribution figure={figure} label={TYPE_LABELS[type].plural} />
                </article>
              );
            })}
          </div>
        </section>

        <EvolutionSection city={city} />

        {sectors ? (
          <section aria-labelledby="secteurs" className="flex flex-col gap-4">
            <div className="max-w-3xl">
              <h2 id="secteurs" className="font-display text-2xl text-ink">
                Les écarts à l&apos;intérieur de la commune
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {sectorParagraph(city, sectors, sectorCoverage(city))}
              </p>
            </div>
            <SectorTable city={city} sectors={sectors} reference={headline.median} />
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl text-ink">Estimer un bien à {city.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Une médiane communale situe un ordre de grandeur, elle n&apos;estime pas un bien.
              L&apos;estimateur cherche les ventes comparables autour de l&apos;adresse exacte,
              qu&apos;il vous demandera&nbsp;: à ce niveau de dispersion, estimer depuis le centre
              de la commune reviendrait à contredire cette page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={estimatorHref()}>
                Estimer un logement
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={mapHref(city.insee)}>Voir les ventes sur la carte</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={transactionsHref()}>Rechercher une vente, ligne à ligne</Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="limites"
          className="flex max-w-3xl flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft p-6"
        >
          <h2 id="limites" className="font-display text-xl text-warning-soft-fg">
            Ce que cette page ne dit pas
          </h2>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">
            {coverageParagraph(city, dataset.generatedAt)}
          </p>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">
            {coverageDisclaimer(city.latestYear)}
          </p>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">
            {disclaimers.dvfLimits}
          </p>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">
            {disclaimers.dvfSource}
          </p>
        </section>

        {neighbours.length > 0 ? (
          <section aria-labelledby="voisines" className="border-t border-border pt-8">
            <h2 id="voisines" className="font-display text-xl text-ink">
              Les communes voisines
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Les communes couvertes ici les plus proches de {city.name}, par distance entre
              centres.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {neighbours.map((neighbour) => (
                <li key={neighbour.slug}>
                  <Link
                    href={cityPath(neighbour.slug)}
                    className="group flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-shadow hover:shadow-md"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {neighbour.name}
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        à {Math.round(distanceBetweenCitiesKm(city, neighbour))} km
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      {canPublishFigure(neighbour.byType.apartment) ? (
                        <>
                          <span className="block text-sm font-semibold text-ink">
                            {formatPricePerSqm(neighbour.byType.apartment.median)}
                          </span>
                          <span className="block text-xs text-ink-subtle">
                            {formatNumber(neighbour.byType.apartment.sample)} ventes
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-ink-subtle">appartements non publiés</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tools.length > 0 ? (
          <section aria-labelledby="outils" className="border-t border-border pt-8">
            <h2 id="outils" className="font-display text-xl text-ink">
              Après le prix au m²
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Les mêmes trois outils sur toutes les communes&nbsp;: la question posée par un prix
              au m² ne change pas d&apos;une ville à l&apos;autre.
            </p>
            <ul className="mt-5 grid gap-4 md:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={`/outils/${tool.id}`}
                    className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                  >
                    <h3 className="text-base font-semibold text-ink">{tool.title}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-ink-muted">{tool.summary}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Voir la fiche
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-xs leading-relaxed text-ink-subtle">
          {disclaimers.short} Agrégats calculés le {formatIsoDay(dataset.generatedAt)}.
        </p>
      </div>
    </div>
  );
}

/**
 * L'ÉVOLUTION, ET LE VOLUME QUI LA REND LISIBLE.
 *
 * Le volume de ventes par millésime est affiché à côté de la courbe des prix,
 * et c'est volontaire : une médiane qui monte pendant que le nombre de ventes
 * s'effondre ne raconte pas la même histoire qu'une médiane qui monte sur un
 * marché actif. Séparer les deux graphiques laisserait le lecteur croire que
 * le prix est le seul indicateur du marché.
 */
function EvolutionSection({ city }: { city: CityAggregate }) {
  return (
    <section aria-labelledby="evolution" className="flex flex-col gap-6">
      <div className="max-w-3xl">
        <h2 id="evolution" className="font-display text-2xl text-ink">
          L&apos;évolution, quand elle est défendable
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Deux millésimes complets, au moins soixante ventes de chaque côté, et un écart qui
          dépasse la marge d&apos;incertitude des deux médianes. Faute de quoi, l&apos;écart est
          affiché sans être appelé une tendance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {CITY_PROPERTY_TYPES.map((type) => {
          const series = plottableYears(city.yearlyByType[type]);
          const evolution = evolutionOf(city.yearlyByType[type]);

          return (
            <article
              key={type}
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
            >
              <h3 className="font-display text-lg text-ink capitalize">
                {TYPE_LABELS[type].plural}
              </h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                {evolutionParagraph(city, type, evolution)}
              </p>

              {series.length >= MIN_SERIES_POINTS ? (
                <figure className="flex flex-col gap-2">
                  <CityPriceSeries
                    points={series}
                    label={`${TYPE_LABELS[type].plural} à ${city.name}`}
                  />
                  <figcaption className="text-xs leading-relaxed text-ink-subtle">
                    Effectifs par millésime&nbsp;:{" "}
                    {series
                      .map((entry) => `${entry.year}, ${formatNumber(entry.sample)} ventes`)
                      .join(" ; ")}
                    .
                  </figcaption>
                </figure>
              ) : (
                <p className="text-xs leading-relaxed text-ink-subtle">
                  Aucune courbe&nbsp;: il faudrait au moins {MIN_SERIES_POINTS} millésimes
                  complets portant chacun un effectif suffisant.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <figure className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-6">
        <figcaption className="text-sm font-semibold text-ink">
          Nombre de ventes de logement par millésime
        </figcaption>
        <BarChart
          data={city.volumeByYear.map((entry) => ({
            label: String(entry.year),
            value: entry.total,
          }))}
          valueFormat={formatNumber}
          tone="accent"
          caption={`Ventes de logement enregistrées à ${city.name}`}
          height={180}
        />
        <p className="text-xs leading-relaxed text-ink-subtle">
          Ventes de gré à gré portant sur un logement. Un millésime en retrait signale souvent une
          publication encore incomplète plutôt qu&apos;un marché à l&apos;arrêt.
        </p>
      </figure>
    </section>
  );
}
