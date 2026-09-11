import { CALIBRATION_LOYERS, loyerHorsCharges } from "@/lib/loyers/calibration";
import type { IndicateurLoyer, LoyersCommune } from "@/lib/loyers/types";
import type { CityAggregate } from "@/lib/cities";
import { formatNumber, formatPrice } from "@/lib/utils/format";

/**
 * LE MARCHÉ LOCATIF, À CÔTÉ DU MARCHÉ À LA VENTE.
 *
 * Une page « prix immobilier » qui ne parle que de ventes répond à la moitié
 * des visiteurs. L'autre moitié achète pour louer, ou loue tout court, et
 * n'avait ici aucun chiffre — alors que la donnée était déjà dans le dépôt,
 * servie à la carte de l'observatoire.
 *
 * ── QUATRE LOYERS, DEUX RENDEMENTS, ET LA RAISON DE L'ÉCART ────────────────
 * La source publie quatre cartes : appartements tous types, T1-T2, T3 et
 * plus, maisons. Les quatre loyers s'affichent, parce qu'un studio se loue
 * trois euros du mètre de plus qu'un quatre-pièces et qu'un loyer unique par
 * commune ment à qui cherche le sien.
 *
 * LE RENDEMENT VIT AILLEURS, dans `investment-market.tsx`. Cette section
 * répond à « combien ça se loue », pas à « combien ça rapporte » : mêler les
 * deux obligeait à laisser deux cases vides sur quatre, puisque DVF ne
 * ventile pas ses prix par nombre de pièces.
 *
 * ── LES LOYERS SONT CALIBRÉS ───────────────────────────────────────────────
 * La source donne des loyers d'ANNONCE, charges comprises. Ce qui s'encaisse
 * est un bail signé hors charges, environ 15 % plus bas
 * (`src/lib/loyers/calibration.ts`). Tous les chiffres de ce bloc sont
 * corrigés, et le rendement l'est avec eux : c'est la seule façon d'obtenir
 * un brut qui ne soit pas d'emblée un plafond.
 */

const LIGNES = [
  { clef: "appartement", nom: "Appartements" },
  { clef: "appartementT12", nom: "Appartements T1-T2" },
  { clef: "appartementT3", nom: "Appartements T3 et plus" },
  { clef: "maison", nom: "Maisons" },
] as const;

function loyerMensuel(
  indicateur: IndicateurLoyer | null,
  surface: number | undefined,
): number | null {
  const m2 = loyerHorsCharges(indicateur?.m2);
  if (m2 === null || !surface) return null;
  return Math.round((m2 * surface) / 10) * 10;
}

export function RentalMarket({
  city,
  loyers,
  surfaces,
}: {
  city: CityAggregate;
  loyers: LoyersCommune;
  /** Surfaces du bien type, par famille, telles que la source les publie. */
  surfaces: Record<string, number>;
}) {
  const lignes = LIGNES.map((ligne) => {
    const indicateur = loyers[ligne.clef];
    if (!indicateur) return null;

    const corrige = loyerHorsCharges(indicateur.m2);
    if (corrige === null) return null;

    return {
      ...ligne,
      indicateur,
      corrige,
      mensuel: loyerMensuel(indicateur, surfaces[ligne.clef]),
      surface: surfaces[ligne.clef],
    };
  }).filter((ligne): ligne is NonNullable<typeof ligne> => ligne !== null);

  if (lignes.length === 0) return null;

  return (
    <section
      aria-labelledby="location"
      className="flex scroll-mt-32 flex-col gap-4"
      id="location"
    >
      <div className="max-w-3xl">
        <h2 id="location" className="font-display text-2xl text-ink">
          Le marché locatif
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Ce qu&apos;un logement se loue à {city.name}, par type de bien. Ces
          loyers viennent des annonces relevées sur la commune, ramenés hors
          charges par l&apos;écart mesuré avec les baux réellement signés des
          observatoires locaux. Un studio se loue plus cher au mètre
          qu&apos;un quatre-pièces&nbsp;: les typologies sont donc séparées
          plutôt que moyennées.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">
            Loyers médians hors charges à {city.name}, par type de bien, avec
            le nombre d&apos;annonces relevées
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-subtle">
              <th scope="col" className="px-4 py-3 font-medium">
                Type de bien
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Loyer au m², hors charges
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Loyer du bien type
              </th>

            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.clef} className="border-b border-border-soft last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
                  {ligne.nom}
                </th>
                <td className="px-4 py-3 text-right font-semibold text-ink tnum">
                  {ligne.corrige.toLocaleString("fr-FR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  &nbsp;€/m²
                  {/* AUCUN CHIFFRE SANS SON EFFECTIF, la règle de tout ce
                      site. Une commune sans annonce relevée porte la valeur
                      de ses voisines : c'est ce que la seconde ligne dit,
                      plutôt qu'un effectif de zéro qui se lirait comme une
                      absence de marché. */}
                  <span className="block text-xs font-normal text-ink-subtle">
                    {ligne.indicateur.echelle === "commune"
                      ? `médian, sur ${formatNumber(ligne.indicateur.obs)} annonces`
                      : "médian, estimé sur les communes voisines"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-ink-muted tnum">
                  {ligne.mensuel === null ? (
                    "—"
                  ) : (
                    <>
                      {formatPrice(ligne.mensuel)}
                      <span className="block text-xs text-ink-subtle">
                        {formatNumber(ligne.surface)}&nbsp;m²
                      </span>
                    </>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-ink-subtle">
        <p>
          Loyers d&apos;annonce, pour des biens loués vides, ramenés hors
          charges&nbsp;: un bail signé se conclut sous le prix demandé, et la
          source inclut les charges. Ce que ce tableau montre est donc une
          estimation de ce qui s&apos;encaisse, pas de ce qui s&apos;affiche.
        </p>
        <p>
          Chaque colonne a son bien type, propre à sa carte&nbsp;: deux lignes
          ne se comparent pas au mètre carré près, un petit logement se louant
          structurellement plus cher au mètre.
        </p>
        <p>
          {CALIBRATION_LOYERS.appariement.zones} zones d&apos;observatoire ont
          servi à mesurer l&apos;écart entre annonce et bail signé, contrôlé sur{" "}
          {CALIBRATION_LOYERS.controle?.agglomerations ?? 0} agglomérations.
        </p>
      </div>
    </section>
  );
}
