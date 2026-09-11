import { CALIBRATION_LOYERS, loyerHorsCharges } from "@/lib/loyers/calibration";
import { lireRendement } from "@/lib/loyers/rendement";
import type { IndicateurLoyer, LoyersCommune } from "@/lib/loyers/types";
import type { CityAggregate } from "@/lib/cities";
import { formatNumber, formatPercent, formatPrice } from "@/lib/utils/format";

/**
 * LE MARCHÉ DE L'INVESTISSEMENT : ce que les deux autres, mis face à face,
 * finissent par dire.
 *
 * Ni DVF ni la carte des loyers ne publient un rendement. Il naît de leur
 * rencontre, et c'est la seule question de cette section : à quel prix
 * s'achète le mètre carré, combien il se loue, ce que le rapport des deux
 * vaut avant charges.
 *
 * ── DEUX FAMILLES, ET PAS QUATRE ───────────────────────────────────────────
 * L'appartement et la maison, rien d'autre. DVF ne ventile pas ses prix par
 * nombre de pièces : un rendement de T2 calculé sur le prix au m² de tous
 * les appartements ressemblerait à un rendement de T2 sans en être un, et
 * une ligne fausse coûte plus cher qu'une ligne absente. Les loyers par
 * typologie restent dans la section « location », où ils ne prétendent à rien
 * de plus qu'à un loyer.
 *
 * ── LE PRIX D'ENTRÉE EST DONNÉ, ET CE N'EST PAS DÉCORATIF ──────────────────
 * Un taux seul se compare mal : 6 % sur un bien à 70 000 € et 6 % sur un bien
 * à 400 000 € n'engagent pas la même personne. Le prix du bien type — la
 * surface sur laquelle la source estime le loyer, multipliée par la médiane
 * DVF — remet le taux à son échelle.
 *
 * ── CE QUE LE BRUT NE RETIENT PAS ──────────────────────────────────────────
 * Taxe foncière, charges non récupérables, vacance, gestion, frais
 * d'acquisition, impôt. Le net tourne couramment entre 60 et 75 % du brut, et
 * ce produit ne le calcule pas : aucune source publique ne porte ces postes à
 * l'échelle de la commune, et un abattement forfaitaire national donnerait un
 * chiffre qui a l'air net sans l'être.
 */

const FAMILLES = [
  { clef: "appartement", nom: "Appartement", prix: "apartment" },
  { clef: "maison", nom: "Maison", prix: "house" },
] as const;

interface Ligne {
  clef: string;
  nom: string;
  indicateur: IndicateurLoyer;
  loyerM2: number;
  surface: number | undefined;
  prixM2: number | undefined;
  prixEntree: number | null;
  loyerMensuel: number | null;
  lecture: ReturnType<typeof lireRendement>;
}

export function InvestmentMarket({
  city,
  loyers,
  surfaces,
}: {
  city: CityAggregate;
  loyers: LoyersCommune;
  surfaces: Record<string, number>;
}) {
  const lignes: Ligne[] = [];

  for (const famille of FAMILLES) {
    const indicateur = loyers[famille.clef];
    if (!indicateur) continue;
    const loyerM2 = loyerHorsCharges(indicateur.m2);
    if (loyerM2 === null) continue;

    const prixM2 = city.byType[famille.prix]?.median;
    const surface = surfaces[famille.clef];
    lignes.push({
      clef: famille.clef,
      nom: famille.nom,
      indicateur,
      loyerM2,
      surface,
      prixM2,
      prixEntree:
        typeof prixM2 === "number" && surface
          ? Math.round((prixM2 * surface) / 1000) * 1000
          : null,
      loyerMensuel: surface ? Math.round((loyerM2 * surface) / 10) * 10 : null,
      /* Le rendement part du loyer CORRIGÉ : le calculer sur l'annonce
         charges comprises revenait à publier un plafond en l'appelant un
         rendement. */
      lecture: lireRendement({ ...indicateur, m2: loyerM2 }, prixM2),
    });
  }

  const exploitables = lignes.filter((ligne) => ligne.lecture.taux !== null);
  if (exploitables.length === 0) return null;

  const fragile = exploitables.some((ligne) => ligne.lecture.fragile);
  const horsNorme = exploitables.some((ligne) => ligne.lecture.horsNorme);

  return (
    <section
      aria-labelledby="investissement"
      className="flex scroll-mt-32 flex-col gap-4"
      id="investissement"
    >
      <div className="max-w-3xl">
        <h2 id="investissement" className="font-display text-2xl text-ink">
          Investir&nbsp;: ce que le prix et le loyer donnent ensemble
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Aucune des deux sources ne publie de rendement&nbsp;: il naît de leur
          rencontre. Le loyer annuel hors charges, rapporté au prix médian des
          ventes enregistrées à {city.name}. Le prix d&apos;entrée est celui du
          bien type sur lequel le loyer est estimé, à la médiane communale.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {exploitables.map((ligne) => (
          <article
            key={ligne.clef}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
          >
            <h3 className="font-display text-lg text-ink">{ligne.nom}</h3>

            <p className="font-display text-3xl font-semibold text-ink tnum">
              {formatPercent(ligne.lecture.taux, 2)}
              <span className="ml-2 align-middle text-xs font-normal text-ink-subtle">
                brut, avant charges et impôt
              </span>
            </p>

            {ligne.lecture.fourchette ? (
              <p className="text-xs text-ink-subtle tnum">
                {formatPercent(ligne.lecture.fourchette.bas, 1)} à{" "}
                {formatPercent(ligne.lecture.fourchette.haut, 1)} selon
                l&apos;intervalle de prédiction du loyer, prix inchangé
              </p>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-soft pt-3 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">Prix d&apos;entrée</dt>
                <dd className="font-medium text-ink tnum">
                  {ligne.prixEntree === null
                    ? "—"
                    : formatPrice(ligne.prixEntree)}
                  {ligne.surface ? (
                    <span className="block text-xs font-normal text-ink-subtle">
                      {formatNumber(ligne.surface)}&nbsp;m² à{" "}
                      {formatNumber(ligne.prixM2)}&nbsp;€/m²
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Loyer mensuel</dt>
                <dd className="font-medium text-ink tnum">
                  {ligne.loyerMensuel === null
                    ? "—"
                    : formatPrice(ligne.loyerMensuel)}
                  <span className="block text-xs font-normal text-ink-subtle">
                    {ligne.loyerM2.toLocaleString("fr-FR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    &nbsp;€/m² hors charges
                  </span>
                </dd>
              </div>
            </dl>

            <p className="text-[0.6875rem] leading-snug text-ink-subtle">
              Médiane de {formatNumber(city.byType[ligne.clef === "maison" ? "house" : "apartment"]?.sample)}{" "}
              ventes retenues
              {ligne.indicateur.echelle === "commune"
                ? `, loyer estimé sur ${formatNumber(ligne.indicateur.obs)} annonces de la commune`
                : ", loyer estimé hors de la commune"}
              .
            </p>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-ink-subtle">
        <p>
          <strong className="font-medium text-ink-muted">Brut, donc partiel.</strong>{" "}
          Sont exclus la taxe foncière, qui varie du simple au triple d&apos;une
          commune à l&apos;autre, les charges non récupérables, la vacance, la
          gestion, les frais d&apos;acquisition et l&apos;impôt. Le net tourne
          couramment entre 60 et 75&nbsp;% du brut. Nous ne le calculons
          pas&nbsp;: aucune source publique ne porte ces postes à
          l&apos;échelle de la commune.
        </p>
        <p>
          <strong className="font-medium text-ink-muted">
            Un rendement élevé n&apos;est pas une bonne nouvelle en soi.
          </strong>{" "}
          Il accompagne le plus souvent un marché où la revente est lente, et
          c&apos;est pourquoi le prix figure à côté du taux.
        </p>
        <p>
          Pas de rendement par nombre de pièces&nbsp;: DVF ne publie pas de
          prix par typologie, et le taux serait celui d&apos;un loyer de T2
          rapporté au prix de tous les appartements.
        </p>
        {horsNorme ? (
          <p>
            Un des taux sort des bornes où un rendement dit encore quelque
            chose du marché locatif. Il signale le plus souvent une médiane
            fondée sur peu de ventes, ou une commune où résidences secondaires
            et location ne se mélangent pas.
          </p>
        ) : null}
        {fragile ? (
          <p>
            Au moins un de ces loyers est estimé sur des communes voisines, ou
            repose sur moins de trente annonces, ou sort d&apos;un modèle dont
            le R² est bas. L&apos;ANIL invite alors à la prudence, et nous la
            relayons plutôt que de masquer le chiffre.
          </p>
        ) : null}
        <p>
          Loyers calés sur les baux signés de{" "}
          {CALIBRATION_LOYERS.appariement.zones} zones d&apos;observatoire,
          contrôlé sur{" "}
          {CALIBRATION_LOYERS.controle?.agglomerations ?? 0} agglomérations.
        </p>
      </div>
    </section>
  );
}
