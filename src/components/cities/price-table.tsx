import { Fragment } from "react";

import {
  canPublishDeciles,
  canPublishFigure,
  canPublishQuartiles,
  MIN_DECILE_SAMPLE,
  MIN_FIGURE_SAMPLE,
} from "@/lib/cities/thresholds";
import { CITY_PROPERTY_TYPES } from "@/lib/cities/aggregate";
import { TYPE_LABELS } from "@/lib/cities/copy";
import type { CityAggregate } from "@/lib/cities/types";
import { formatArea, formatNumber, formatPrice, formatPricePerSqm } from "@/lib/utils/format";

/**
 * LE TABLEAU DES PRIX PAR TYPE DE BIEN.
 *
 * DEUX PARTIS PRIS, ET LE MÊME DANS LES DEUX CAS : NE JAMAIS LAISSER UN CHIFFRE
 * SEUL.
 *
 *   1. La colonne « Ventes retenues » n'est pas une colonne de détail que l'on
 *      pourrait replier : c'est elle qui dit ce que vaut la ligne. Une médiane
 *      sur 41 ventes et une médiane sur 21 000 ne se lisent pas pareil, et rien
 *      d'autre à l'écran ne le signale.
 *   2. Un type de bien dont l'effectif ne suffit pas garde SA LIGNE, avec le
 *      motif du refus. Le supprimer laisserait croire qu'il ne se vend pas de
 *      maisons dans cette commune, ce qui est une information, et une fausse.
 *
 * POURQUOI CE TABLEAU N'UTILISE PAS `@/components/ui` `Table`
 *   La primitive du système est un composant client : elle porte le tri par
 *   en-tête. Ce tableau-ci ne se trie pas, ne se filtre pas et ne change jamais
 *   après le rendu. Lui faire traverser une frontière client ferait charger du
 *   JavaScript sur cent pages statiques pour rien. Le balisage reprend
 *   exactement les mêmes jetons de style.
 */

export function PriceByTypeTable({ city }: { city: CityAggregate }) {
  return (
    <div className="scroll-slim w-full overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Prix au mètre carré à {city.name}, par type de bien, avec le nombre de ventes retenues
        </caption>
        <thead className="bg-surface-2 text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">
              Type de bien
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Prix médian au m²
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Moitié centrale des ventes
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Huit ventes sur dix
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Ventes retenues
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Vente médiane
            </th>
          </tr>
        </thead>
        <tbody>
          {CITY_PROPERTY_TYPES.map((type) => {
            const figure = city.byType[type];
            const label = TYPE_LABELS[type].plural;

            if (!canPublishFigure(figure)) {
              return (
                <tr key={type} className="border-b border-border-soft last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-ink capitalize">
                    {label}
                  </th>
                  <td className="px-4 py-3 text-right text-ink-muted" colSpan={5}>
                    Effectif insuffisant&nbsp;: {formatNumber(figure.sample)} ventes exploitables
                    sur {formatNumber(figure.total)} enregistrées, moins que les{" "}
                    {MIN_FIGURE_SAMPLE} exigées pour publier une médiane.
                  </td>
                </tr>
              );
            }

            return (
              <tr key={type} className="border-b border-border-soft last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ink capitalize">
                  {label}
                </th>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                  {formatPricePerSqm(figure.median)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                  {canPublishQuartiles(figure) ? (
                    <Range low={figure.q1} high={figure.q3} />
                  ) : (
                    <span className="text-ink-subtle">non publié</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                  {canPublishDeciles(figure) ? (
                    <Range low={figure.d1} high={figure.d9} />
                  ) : (
                    <span className="text-ink-subtle">
                      moins de {MIN_DECILE_SAMPLE} ventes
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatNumber(figure.sample)}
                  <span className="block text-xs text-ink-subtle">
                    sur {formatNumber(figure.total)} ventes
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                  {figure.medianPrice === undefined ? (
                    "–"
                  ) : (
                    <Fragment>
                      {formatPrice(figure.medianPrice)}
                      <span className="block text-xs text-ink-subtle">
                        {formatArea(figure.medianArea)}
                      </span>
                    </Fragment>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Range({ low, high }: { low: number | undefined; high: number | undefined }) {
  if (low === undefined || high === undefined) return <span>–</span>;
  return (
    <span>
      {formatNumber(low)} à {formatPricePerSqm(high)}
    </span>
  );
}
