import { cityDataset, publishedCities } from "@/lib/cities/dataset";
import { formatNumber } from "@/lib/utils/format";

/**
 * LE BANDEAU DU CORPUS.
 *
 * Un « corpus » est un ensemble fini, clos et structuré de pièces
 * authentiques. Ce bandeau en donne la mesure exacte, calculée au build depuis
 * le jeu de données versionné : tant de ventes, tant de communes, tels
 * millésimes, telle date. Ce ne sont pas des chiffres de plaquette, ce sont les
 * bornes de ce que le site sait.
 *
 * Il est rendu côté serveur, sans JavaScript, et ne change que quand le jeu
 * de données est régénéré. Une date qui bouge sans commit serait un mensonge.
 */
export function CorpusStrip() {
  const dataset = cityDataset();
  const cities = publishedCities();
  const sales = cities.reduce((sum, city) => sum + city.dwellingSales, 0);
  const first = dataset.years[0];
  const last = dataset.years[dataset.years.length - 1];
  const generated = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
    new Date(`${dataset.generatedAt}T00:00:00.000Z`),
  );

  const facts: Array<[value: string, label: string]> = [
    [formatNumber(sales), "ventes de logement dans le corpus"],
    [formatNumber(cities.length), "communes documentées"],
    [`${first} à ${last}`, "millésimes DVF couverts"],
    [generated, "dernière mise à jour"],
  ];

  return (
    <section
      aria-label="L'étendue du corpus"
      className="border-y border-border bg-surface-3"
    >
      <dl className="container-page grid grid-cols-2 gap-x-8 gap-y-6 py-7 md:grid-cols-4 md:py-8">
        {facts.map(([value, label]) => (
          <div key={label} className="flex flex-col gap-1 border-l-2 border-accent-rule pl-4">
            <dd className="tnum order-1 font-display text-2xl leading-none text-ink md:text-[1.75rem]">
              {value}
            </dd>
            <dt className="order-2 text-xs leading-snug text-ink-muted">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
