import { CALIBRATION_LOYERS, loyerHorsCharges } from "@/lib/loyers/calibration";
import { lireRendement } from "@/lib/loyers/rendement";
import type { IndicateurLoyer, LoyersCommune } from "@/lib/loyers/types";
import type { CityAggregate } from "@/lib/cities";
import { formatNumber, formatPercent, formatPrice } from "@/lib/utils/format";

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
 * Les rendements, eux, ne sont calculés QUE sur « tous appartements » et
 * « maisons ». DVF ne ventile pas ses prix par nombre de pièces : croiser un
 * T2 loué avec un prix au m² tous appartements confondus donnerait un taux
 * qui a l'air d'un rendement de T2 sans en être un. La ligne reste, sans son
 * taux, plutôt que de porter un chiffre faux.
 *
 * ── LES LOYERS SONT CALIBRÉS ───────────────────────────────────────────────
 * La source donne des loyers d'ANNONCE, charges comprises. Ce qui s'encaisse
 * est un bail signé hors charges, environ 15 % plus bas
 * (`src/lib/loyers/calibration.ts`). Tous les chiffres de ce bloc sont
 * corrigés, et le rendement l'est avec eux : c'est la seule façon d'obtenir
 * un brut qui ne soit pas d'emblée un plafond.
 */

const LIGNES = [
  {
    clef: "appartement",
    nom: "Appartements",
    /** Le prix au m² auquel comparer, ou `null` quand la comparaison ment. */
    prix: "apartment",
  },
  {
    clef: "appartementT12",
    nom: "Appartements T1-T2",
    prix: null,
  },
  {
    clef: "appartementT3",
    nom: "Appartements T3 et plus",
    prix: null,
  },
  { clef: "maison", nom: "Maisons", prix: "house" },
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

    const prixM2 = ligne.prix ? city.byType[ligne.prix]?.median : undefined;
    /* Le rendement se calcule sur le loyer CORRIGÉ : le calculer sur
       l'annonce reviendrait à publier un plafond en l'appelant un
       rendement. */
    const lecture = ligne.prix
      ? lireRendement({ ...indicateur, m2: corrige }, prixM2)
      : null;

    return {
      ...ligne,
      indicateur,
      corrige,
      mensuel: loyerMensuel(indicateur, surfaces[ligne.clef]),
      surface: surfaces[ligne.clef],
      lecture,
    };
  }).filter((ligne): ligne is NonNullable<typeof ligne> => ligne !== null);

  if (lignes.length === 0) return null;

  const fragile = lignes.some((ligne) => ligne.lecture?.fragile);

  return (
    <section aria-labelledby="location" className="flex flex-col gap-4">
      <div className="max-w-3xl">
        <h2 id="location" className="font-display text-2xl text-ink">
          Le marché locatif
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Les ventes disent ce qu&apos;un logement coûte, pas ce qu&apos;il
          rapporte. Ces loyers viennent des annonces relevées à {city.name},
          ramenés hors charges par l&apos;écart mesuré avec les baux réellement
          signés des observatoires locaux. Le rendement croise ce loyer avec le
          prix médian de la même page&nbsp;: il est BRUT, et il n&apos;est
          calculé que là où les deux chiffres portent sur le même bien.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">
            Loyers médians hors charges et rendement locatif brut à{" "}
            {city.name}, par type de bien, avec le nombre d&apos;annonces
            relevées
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
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Rendement brut
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
                <td className="px-4 py-3 text-right tnum">
                  {ligne.lecture?.taux === null || ligne.lecture === null ? (
                    <span className="text-xs text-ink-subtle">
                      {ligne.prix === null
                        ? "pas de prix par typologie"
                        : "prix médian manquant"}
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold text-ink">
                        {formatPercent(ligne.lecture.taux, 2)}
                      </span>
                      {ligne.lecture.fourchette ? (
                        <span className="block text-xs text-ink-subtle">
                          {formatPercent(ligne.lecture.fourchette.bas, 1)} à{" "}
                          {formatPercent(ligne.lecture.fourchette.haut, 1)}
                        </span>
                      ) : null}
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
          Un rendement brut ne retire ni la taxe foncière, ni les charges non
          récupérables, ni la vacance, ni les frais d&apos;acquisition, ni
          l&apos;impôt. Le net tourne couramment entre 60 et 75&nbsp;% du brut,
          et nous ne le calculons pas&nbsp;: aucune source publique ne porte ces
          postes à l&apos;échelle de la commune, et un abattement forfaitaire
          appliqué à toute la France donnerait un chiffre qui a l&apos;air net
          sans l&apos;être.
        </p>
        <p>
          Les T1-T2 et les T3 et plus n&apos;ont pas de rendement ici parce que
          DVF ne publie pas de prix par nombre de pièces&nbsp;: le taux serait
          celui d&apos;un loyer de T2 rapporté au prix de tous les
          appartements.
        </p>
        {fragile ? (
          <p>
            Au moins un de ces loyers est estimé sur des communes voisines, ou
            repose sur moins de trente annonces, ou sort d&apos;un modèle dont
            le R² est bas. L&apos;ANIL invite alors à la prudence, et nous la
            relayons plutôt que de masquer le chiffre.
          </p>
        ) : null}
        <p>
          {CALIBRATION_LOYERS.appariement.zones} zones d&apos;observatoire ont
          servi à mesurer l&apos;écart entre annonce et bail signé, contrôlé sur{" "}
          {CALIBRATION_LOYERS.controle?.agglomerations ?? 0} agglomérations.
        </p>
      </div>
    </section>
  );
}
