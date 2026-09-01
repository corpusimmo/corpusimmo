import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Ce que nous collectons, pourquoi, combien de temps, et comment exercer vos droits.",
  alternates: { canonical: "/confidentialite" },
  robots: { index: true, follow: true },
};

/**
 * Cette page décrit l'état RÉEL du traitement, pas l'état cible.
 *
 * Elle sera fausse le jour où une base de données sera branchée, et c'est
 * voulu&nbsp;: une politique de confidentialité écrite pour un produit qu'on
 * n'a pas encore construit est le meilleur moyen d'annoncer des durées de
 * conservation que personne ne respectera.
 */
export default function ConfidentialitePage() {
  return (
    <div className="bg-canvas py-12 md:py-16">
      <div className="container-page">
        <article className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <p className="eyebrow">Données personnelles</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Confidentialité</h1>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Cette page décrit l&apos;état réel du service aujourd&apos;hui, et non un état cible.
              Elle sera mise à jour, et datée, le jour où une base de données sera branchée.
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Ce que le site ne fait pas</h2>
            <p className="leading-relaxed text-ink-muted">
              Il n&apos;y a ni compte, ni mot de passe, ni base de données de contacts. Aucun
              traceur publicitaire, aucun outil de mesure d&apos;audience tiers, aucun cookie
              déposé à des fins de suivi.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Votre saisie d&apos;estimation en cours et votre sélection de comparables sont
              conservées <strong>dans votre navigateur</strong>, sur votre appareil. Elles ne nous
              sont pas transmises et ne survivent pas à un changement de machine.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Ce qui transite par nos serveurs</h2>
            <ul className="flex flex-col gap-3 leading-relaxed text-ink-muted">
              <li>
                <strong className="font-semibold text-ink">L&apos;adresse recherchée</strong> — elle
                est transmise à la Géoplateforme IGN pour être géocodée. Nous ne la conservons pas.
              </li>
              <li>
                <strong className="font-semibold text-ink">Les caractéristiques du bien</strong> —
                elles servent au calcul, le temps de la requête, puis sont oubliées.
              </li>
              <li>
                <strong className="font-semibold text-ink">Vos coordonnées</strong> — prénom,
                adresse e-mail et, si vous le souhaitez, téléphone, transmises à la dernière étape
                pour vous envoyer l&apos;estimation. Elles servent à composer et envoyer cet e-mail,
                et ne sont enregistrées nulle part à ce stade.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Vos consentements</h2>
            <p className="leading-relaxed text-ink-muted">
              Trois accords distincts vous sont demandés, et un seul est requis&nbsp;: recevoir
              votre estimation. Être contacté par un professionnel de votre secteur et recevoir nos
              informations sont deux cases séparées, jamais pré-cochées, jamais déduites l&apos;une
              de l&apos;autre. Une case non cochée est un refus, et le serveur la traite comme tel.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Chaque accord est horodaté côté serveur au moment où il est donné. Un horodatage
              fourni par votre navigateur ne prouverait rien&nbsp;; c&apos;est pourquoi nous ne
              l&apos;utilisons pas.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Journaux techniques</h2>
            <p className="leading-relaxed text-ink-muted">
              Les journaux applicatifs mentionnent qu&apos;une demande a eu lieu, jamais votre
              adresse e-mail en clair&nbsp;: elle y apparaît toujours masquée, sous la forme
              <code className="mx-1 rounded-xs bg-surface-2 px-1 py-0.5 text-[0.9em]">
                j***t@exemple.fr
              </code>
              . Une limitation de débit par adresse IP protège le formulaire des envois massifs.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Vos droits</h2>
            <p className="leading-relaxed text-ink-muted">
              Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement,
              d&apos;opposition et de portabilité sur vos données. Comme rien n&apos;est conservé à
              ce jour, une demande d&apos;effacement recevra une réponse indiquant qu&apos;aucune
              donnée vous concernant n&apos;est détenue.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Pour exercer un droit ou poser une question&nbsp;:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-primary underline"
              >
                {siteConfig.contactEmail}
              </a>
              . Vous pouvez également saisir la CNIL.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Données DVF et personnes tierces</h2>
            <p className="leading-relaxed text-ink-muted">
              Les mutations affichées proviennent d&apos;une publication officielle en open data
              qui ne comporte ni l&apos;identité des parties, ni aucune donnée directement
              identifiante. Toute tentative de réidentification est interdite par la licence de
              réutilisation, et les pages portant des mutations détaillées sont exclues de
              l&apos;indexation.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
