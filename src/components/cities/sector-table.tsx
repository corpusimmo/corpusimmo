import { formatNumber, formatPricePerSqm } from "@/lib/utils/format";
import type { CityAggregate, CitySector } from "@/lib/cities/types";

/**
 * LE TABLEAU DES SECTEURS.
 *
 * Le titre de la colonne change avec la nature du découpage, et ce n'est pas
 * cosmétique : un arrondissement est une circonscription administrative, un
 * code postal est un secteur de distribution du courrier. Les appeler tous
 * deux « quartier » ferait passer le second pour ce qu'il n'est pas. DVF ne
 * publie aucun quartier, et cette page n'en invente pas.
 *
 * L'écart au prix communal est affiché en clair : c'est la seule colonne qui
 * répond à la question réellement posée, qui n'est pas « combien ici » mais
 * « ici, est-ce plus cher qu'ailleurs dans la ville ».
 */
export function SectorTable({
  city,
  sectors,
  reference,
}: {
  city: CityAggregate;
  sectors: readonly CitySector[];
  /** Médiane communale des logements, servant de point de comparaison. */
  reference: number | undefined;
}) {
  const kindLabel = city.sectors?.kind === "arrondissement" ? "Arrondissement" : "Secteur postal";

  return (
    <div className="scroll-slim w-full overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Prix médian au mètre carré par secteur à {city.name}, avec le nombre de ventes retenues
        </caption>
        <thead className="bg-surface-2 text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold">
              {kindLabel}
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Prix médian au m²
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Écart à la commune
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold">
              Ventes retenues
            </th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((sector) => {
            const gap =
              reference && reference > 0 && sector.median !== undefined
                ? ((sector.median - reference) / reference) * 100
                : undefined;

            return (
              <tr key={sector.code} className="border-b border-border-soft last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                  {sector.label}
                </th>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                  {formatPricePerSqm(sector.median)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                  {gap === undefined ? "–" : signed(gap)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatNumber(sector.sample)}
                  <span className="block text-xs text-ink-subtle">
                    sur {formatNumber(sector.total)} ventes
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** `+ 12,4 %` ou `− 6,1 %`, avec l'espace insécable devant le signe pourcent. */
function signed(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const magnitude = Math.abs(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}${magnitude} %`;
}
