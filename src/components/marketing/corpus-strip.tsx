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
  // `medium` plutôt que `long` : « 1 sept. 2026 » tient sur une ligne dans une
  // colonne de 150 px, là où « 1 septembre 2026 » en prenait trois et cassait
  // l'alignement des quatre chiffres.
  const generated = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(new Date(`${dataset.generatedAt}T00:00:00.000Z`));

  const facts: Array<[value: string, label: string]> = [
    [formatNumber(sales), "ventes de logement dans le corpus"],
    [formatNumber(cities.length), "communes documentées"],
    [`${first} à ${last}`, "millésimes DVF couverts"],
    [generated, "dernière mise à jour"],
  ];

  return (
    <section aria-label="L'étendue du corpus" className="container-page">
      {/* Un panneau posé à cheval sur le bas du héros : les quatre bornes du
          corpus flottent entre la promesse et le reste de la page. */}
      <dl className="panel relative z-10 -mt-8 grid grid-cols-2 gap-y-8 px-2 py-8 md:-mt-10 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-border-soft md:px-4">
        {facts.map(([value, label]) => (
          <div
            key={label}
            className="flex min-w-0 flex-col items-center gap-1.5 px-4 text-center"
          >
            {/* Le libellé AVANT le chiffre : c'est l'ordre d'une ligne
                d'indicateurs, et il évite l'orpheline sous un grand nombre.
                Le DOM garde `dt` puis `dd`, l'ordre visuel ne le contredit
                donc pas. */}
            {/* `min-h` de deux lignes : deux libellés sur quatre passent à la
                ligne, et sans cette réserve les quatre chiffres ne seraient
                pas sur la même ligne de base. */}
            <dt className="eyebrow-text flex min-h-[2.4em] items-end justify-center !text-ink-subtle">
              {label}
            </dt>
            <dd className="tnum font-display text-xl leading-none whitespace-nowrap text-ink md:text-2xl lg:text-[1.75rem]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
