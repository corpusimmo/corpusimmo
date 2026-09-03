import type { Metadata } from "next";

import Link from "next/link";

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
        <article className="prose-justifiee mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <p className="eyebrow">Données personnelles</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
              Confidentialité
            </h1>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Cette page décrit l&apos;état réel du service aujourd&apos;hui, et
              non un état cible. Elle sera mise à jour, et datée, le jour où une
              base de données sera branchée.
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Ce que le site ne fait pas
            </h2>
            <p className="leading-relaxed text-ink-muted">
              Il n&apos;y a pas de mot de passe à retenir, pas de base de
              données de contacts, et aucun traceur publicitaire. Rien
              n&apos;est revendu ni partagé à des fins de ciblage.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Votre saisie d&apos;estimation en cours, votre historique
              d&apos;estimations, vos outils mis de côté et votre sélection de
              comparables sont conservés <strong>dans votre navigateur</strong>,
              sur votre appareil. Ils ne nous sont pas transmis et ne survivent
              pas à un changement de machine.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Le compte, et ce qu&apos;il ouvre
            </h2>
            <p className="leading-relaxed text-ink-muted">
              L&apos;estimateur et l&apos;observatoire, carte comprise,
              s&apos;utilisent sans compte, et c&apos;est un engagement. Seuls
              les dix calculateurs demandent une connexion Google&nbsp;: leurs
              fiches restent consultables librement, mais leur utilisation est
              réservée aux personnes connectées, à raison de deux outils par
              semaine glissante.
            </p>
            <p className="leading-relaxed text-ink-muted">
              De cette connexion, nous recevons de Google votre adresse e-mail
              vérifiée, votre nom et votre photo de profil, et rien
              d&apos;autre&nbsp;: ni contacts, ni agenda, ni fichiers. La
              session est un jeton signé déposé dans un cookie&nbsp;; aucun
              profil n&apos;est enregistré sur nos serveurs à ce jour. La liste
              de vos outils débloqués vit dans un second cookie, signé lui
              aussi, sur votre appareil.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Mesure d&apos;audience
            </h2>
            <p className="leading-relaxed text-ink-muted">
              Nous utilisons Google Analytics pour compter les visites, et
              uniquement si vous l&apos;acceptez. Tant que vous n&apos;avez pas
              répondu au bandeau, le script n&apos;est pas téléchargé&nbsp;: il
              n&apos;est pas silencieux, il n&apos;est pas là. Refuser ne retire
              aucune fonctionnalité, et votre choix se retire aussi facilement
              qu&apos;il se donne.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Ce qui est envoyé est délibérément grossier&nbsp;: un type de
              bien, un département, une tranche de confiance. Jamais une adresse
              e-mail, jamais une adresse postale, jamais une surface ni un
              montant estimé. Le détail de chaque traceur figure sur la{" "}
              <Link
                href="/cookies"
                className="font-semibold text-primary underline"
              >
                page dédiée aux cookies
              </Link>
              .
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Ce qui transite par nos serveurs
            </h2>
            <ul className="flex flex-col gap-3 leading-relaxed text-ink-muted">
              <li>
                <strong className="font-semibold text-ink">
                  L&apos;adresse recherchée
                </strong>
                &nbsp;: elle est transmise à la Géoplateforme IGN pour être
                géocodée. Nous ne la conservons pas.
              </li>
              <li>
                <strong className="font-semibold text-ink">
                  Les caractéristiques du bien
                </strong>
                &nbsp;: elles servent au calcul, le temps de la requête, puis
                sont oubliées.
              </li>
              <li>
                <strong className="font-semibold text-ink">
                  Vos coordonnées
                </strong>
                &nbsp;: prénom, adresse e-mail et, si vous le souhaitez,
                téléphone, transmises à la dernière étape pour vous envoyer
                l&apos;estimation. Elles servent à composer et envoyer cet
                e-mail, et ne sont enregistrées nulle part à ce stade.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Vos consentements</h2>
            <p className="leading-relaxed text-ink-muted">
              Trois accords distincts vous sont demandés, et un seul est
              requis&nbsp;: recevoir votre estimation. Être contacté par un
              professionnel de votre secteur et recevoir nos informations sont
              deux cases séparées, jamais pré-cochées, jamais déduites
              l&apos;une de l&apos;autre. Une case non cochée est un refus, et
              le serveur la traite comme tel.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Chaque accord est horodaté côté serveur au moment où il est donné.
              Un horodatage fourni par votre navigateur ne prouverait
              rien&nbsp;; c&apos;est pourquoi nous ne l&apos;utilisons pas.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Journaux techniques
            </h2>
            <p className="leading-relaxed text-ink-muted">
              Les journaux applicatifs mentionnent qu&apos;une demande a eu
              lieu, jamais votre adresse e-mail en clair&nbsp;: elle y apparaît
              toujours masquée, sous la forme
              <code className="mx-1 rounded-xs bg-surface-2 px-1 py-0.5 text-[0.9em]">
                j***t@exemple.fr
              </code>
              . Une limitation de débit par adresse IP protège le formulaire des
              envois massifs.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">
              Qui intervient dans le service
            </h2>
            <ul className="flex flex-col gap-3 leading-relaxed text-ink-muted">
              <li>
                <strong className="font-semibold text-ink">Vercel</strong>,
                hébergement du site et des fonctions serveur, avec des serveurs
                en Europe.
              </li>
              <li>
                <strong className="font-semibold text-ink">Google</strong>,
                connexion par compte Google et, sous réserve de votre accord,
                mesure d&apos;audience.
              </li>
              <li>
                <strong className="font-semibold text-ink">Resend</strong>,
                acheminement des e-mails que vous nous demandez d&apos;envoyer.
              </li>
              <li>
                <strong className="font-semibold text-ink">
                  IGN Géoplateforme
                </strong>
                , service public de géocodage des adresses.
              </li>
              <li>
                <strong className="font-semibold text-ink">
                  Etalab et la DGFiP
                </strong>
                , publication des Demandes de Valeurs Foncières.
              </li>
              <li>
                <strong className="font-semibold text-ink">OpenFreeMap</strong>{" "}
                et les contributeurs d&apos;OpenStreetMap, fonds de carte.
              </li>
            </ul>
            <p className="leading-relaxed text-ink-muted">
              Certains de ces traitements impliquent un transfert hors de
              l&apos;Union européenne, encadré par les mécanismes prévus par le
              règlement.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Vos droits</h2>
            <p className="leading-relaxed text-ink-muted">
              Vous disposez d&apos;un droit d&apos;accès, de rectification,
              d&apos;effacement, d&apos;opposition, de limitation et de
              portabilité sur vos données, ainsi que du droit de définir des
              directives sur leur sort après votre décès. Comme aucune base de
              données n&apos;est branchée à ce jour, une demande
              d&apos;effacement recevra une réponse indiquant qu&apos;aucune
              donnée vous concernant n&apos;est détenue sur nos serveurs&nbsp;;
              ce qui est stocké l&apos;est dans votre navigateur, et vous pouvez
              l&apos;effacer vous-même à tout instant depuis les réglages de
              celui-ci.
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
            <h2 className="font-display text-xl text-ink">
              Données DVF et personnes tierces
            </h2>
            <p className="leading-relaxed text-ink-muted">
              Les mutations affichées proviennent d&apos;une publication
              officielle en open data qui ne comporte ni l&apos;identité des
              parties, ni aucune donnée directement identifiante. Toute
              tentative de réidentification est interdite par la licence de
              réutilisation, et les pages portant des mutations détaillées sont
              exclues de l&apos;indexation.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
