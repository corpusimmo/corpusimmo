import { BarChart } from "@/components/charts";
import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";
import type { CityFigure, CityHistogram } from "@/lib/cities/types";

/**
 * Où tombe une valeur sur l'axe des tranches, de 0 à 1.
 *
 * Une médiane vit presque toujours À L'INTÉRIEUR d'une tranche : on situe la
 * tranche, puis la position dans la tranche. `null` quand la valeur sort du
 * cadre — le repère n'est alors pas tracé plutôt que collé contre un bord,
 * où il annoncerait une médiane que le graphique ne contient pas.
 */
function positionDe(valeur: number | undefined, histogram: CityHistogram): number | null {
  if (typeof valeur !== "number" || histogram.bins.length === 0) return null;
  const index = histogram.bins.findIndex(
    (bin) => valeur >= bin.from && valeur <= bin.to,
  );
  if (index < 0) return null;
  const bin = histogram.bins[index];
  if (!bin) return null;
  const largeur = bin.to - bin.from;
  const dans = largeur > 0 ? (valeur - bin.from) / largeur : 0.5;
  return (index + dans) / histogram.bins.length;
}

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

  /* LA MOITIÉ CENTRALE EST PEINTE, LE RESTE S'EFFACE. Le texte cite déjà Q1 et
     Q3 ; sans marquage, le lecteur devait les reporter à la main sur l'axe.
     Une tranche compte comme centrale dès qu'elle CHEVAUCHE l'intervalle : la
     rogner à la tranche entièrement comprise ferait disparaître, sur huit
     tranches, la moitié de ce qu'on veut montrer. */
  const emphasis =
    typeof figure.q1 === "number" && typeof figure.q3 === "number"
      ? histogram.bins.map(
          (bin) => bin.to >= figure.q1! && bin.from <= figure.q3!,
        )
      : undefined;

  const positionMediane = positionDe(figure.median, histogram);

  return (
    <figure className="flex flex-col gap-3">
      <BarChart
        data={data}
        tone="primary"
        valueFormat={formatNumber}
        caption={`Répartition des prix au m² des ${label}`}
        height={200}
        emphasis={emphasis}
        reperes={
          positionMediane === null
            ? undefined
            : [
                {
                  position: positionMediane,
                  label: `Médiane ${formatPricePerSqm(figure.median)}`,
                },
              ]
        }
      />
      <figcaption className="flex flex-col gap-1 text-xs leading-relaxed text-ink-subtle">
        <span>
          Nombre de ventes par tranche de prix au m², de {formatPricePerSqm(figure.d1)} à{" "}
          {formatPricePerSqm(figure.d9)}.
          {emphasis ? (
            <>
              {" "}
              Les barres pleines sont la moitié centrale des ventes,{" "}
              {formatPricePerSqm(figure.q1)} à {formatPricePerSqm(figure.q3)}.
            </>
          ) : null}
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
