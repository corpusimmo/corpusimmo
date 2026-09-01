import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergement, propriété intellectuelle et sources de données.",
  alternates: { canonical: "/mentions-legales" },
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <div className="bg-canvas py-12 md:py-16">
      <div className="container-page">
        <article className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <p className="eyebrow">Informations légales</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Mentions légales</h1>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Éditeur</h2>
            <p className="leading-relaxed text-ink-muted">
              {siteConfig.legalName}. Contact&nbsp;:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-primary underline"
              >
                {siteConfig.contactEmail}
              </a>
              . Les informations d&apos;immatriculation et de direction de la publication seront
              complétées à l&apos;ouverture commerciale du service.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Hébergement</h2>
            <p className="leading-relaxed text-ink-muted">
              Le site est hébergé sur une infrastructure de déploiement continu. Le nom et
              l&apos;adresse de l&apos;hébergeur retenu seront précisés ici avant toute ouverture au
              public.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Données publiques réutilisées</h2>
            <p className="leading-relaxed text-ink-muted">
              Les transactions proviennent des Demandes de Valeurs Foncières, produites par la
              Direction générale des Finances publiques et diffusées en open data sur data.gouv.fr.
              Leur réutilisation est soumise aux conditions de la licence ouverte, et notamment à
              l&apos;interdiction de toute tentative de réidentification des personnes concernées.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Conformément au décret n°&nbsp;2018-1350 du 28 décembre 2018, les pages portant des
              mutations détaillées ne sont pas indexables par les moteurs de recherche. Cette règle
              est appliquée par en-tête HTTP autant que par métadonnée de page.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Le fond cartographique est fourni par OpenFreeMap à partir des données
              OpenStreetMap, sous licence ODbL. Le géocodage d&apos;adresses est assuré par la
              Géoplateforme de l&apos;IGN, adossée à la base adresse nationale. Aucune de ces
              données n&apos;est extraite ni recopiée dans une base propre à l&apos;éditeur.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Propriété intellectuelle</h2>
            <p className="leading-relaxed text-ink-muted">
              La marque, l&apos;interface, les méthodes de calcul et leur documentation sont la
              propriété de l&apos;éditeur. Les données publiques réutilisées restent régies par
              leurs licences respectives.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Nature des résultats</h2>
            <p className="leading-relaxed text-ink-muted">
              Les valeurs affichées sont des estimations statistiques indicatives. Elles ne
              constituent ni une expertise immobilière au sens réglementaire, ni un conseil en
              investissement, ni un conseil fiscal.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
