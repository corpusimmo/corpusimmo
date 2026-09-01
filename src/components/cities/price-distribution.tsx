import { BarChart } from "@/components/charts";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";
import type { CityFigure } from "@/lib/cities/types";

/**
 * LA DISTRIBUTION DES PRIX AU M², ET CE QU'ELLE MONTRE QUE LA MÉDIANE CACHE.
 *
 * L'histogramme est BORNÉ AUX DÉCILES, et les ventes hors cadre sont comptées
 * sous le graphique plutôt que rognées. La raison est visuelle et honnête à la
 * fois : une seule vente à 40 000 €/m² étirerait l'axe au point d'écraser
 * toutes les barres contre le zéro, et la commune apparaîtrait parfaitement
 * homogène. Le lecteur verrait alors l'inverse de la vérité.
 *
 * Le graphique vient de `@/components/charts` : ce sont des SVG sans état, sans
 * dépendance, rendus côté serveur. Rien ici ne charge de JavaScript.
 */
export function PriceDistribution({
  figure,
  label,
}: {
  figure: CityFigure;
  /** « appartements », « maisons ». Sert au libellé accessible du graphique. */
  label: string;
}) {
  const histogram = figure.histogram;
  if (!histogram) return null;

  const data = histogram.bins.map((bin) => ({
    label: formatNumber(bin.from),
    value: bin.count,
  }));

  const outside = histogram.below + histogram.above;

  return (
    <figure className="flex flex-col gap-3">
      <BarChart
        data={data}
        tone="primary"
        valueFormat={formatNumber}
        caption={`Répartition des prix au m² des ${label}`}
        height={200}
      />
      <figcaption className="flex flex-col gap-1 text-xs leading-relaxed text-ink-subtle">
        <span>
          Nombre de ventes par tranche de prix au m², de {formatPricePerSqm(figure.d1)} à{" "}
          {formatPricePerSqm(figure.d9)}.
        </span>
        <span>
          {formatNumber(outside)} ventes se situent hors de ce cadre&nbsp;:{" "}
          {formatNumber(histogram.below)} en dessous, {formatNumber(histogram.above)} au-dessus.
          Elles comptent dans la médiane, et ne sont retirées que du graphique, où elles
          écraseraient toutes les barres.
        </span>
      </figcaption>
    </figure>
  );
}
