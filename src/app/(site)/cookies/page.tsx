import type { Metadata } from "next";
import Link from "next/link";

import { ConsentSettings } from "@/components/consent/consent-settings";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Cookies et traceurs",
  description:
    "La liste complète de ce que CorpusImmo dépose dans votre navigateur : à quoi chaque élément sert, combien de temps il reste, et lequel dépend de votre accord.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

/**
 * LA POLITIQUE DE COOKIES, écrite depuis le code plutôt que depuis un modèle.
 *
 * Chaque ligne du tableau correspond à un identifiant qui existe réellement
 * dans ce dépôt, et se vérifie en le cherchant. Une politique recopiée d'un
 * générateur décrit des traceurs qu'on n'a pas et tait ceux qu'on a : c'est
 * précisément ce qui la rend inutile le jour d'un contrôle.
 *
 * La distinction qui commande tout : ce qui est STRICTEMENT NÉCESSAIRE au
 * service demandé est dispensé de consentement, le reste ne l'est pas. Un
 * cookie de session pour une personne qui vient de se connecter est nécessaire.
 * Une mesure d'audience ne l'est jamais, quel que soit l'intérêt qu'on y trouve.
 */

interface Tracker {
  name: string;
  kind: string;
  purpose: string;
  duration: string;
}

const NECESSARY: Tracker[] = [
  {
    name: "corpusimmo.session",
    kind: "Cookie",
    purpose:
      "Vous garde connecté après une connexion Google. Sans lui, il faudrait se reconnecter à chaque page.",
    duration: "30 jours",
  },
  {
    name: "corpusimmo_acces",
    kind: "Cookie signé",
    purpose:
      "Mémorise les calculateurs que vous avez ouverts et le décompte des deux accès hebdomadaires. Signé, pour qu'un accès ne puisse pas être ajouté à la main.",
    duration: "6 mois",
  },
  {
    name: "authjs.csrf-token, authjs.callback-url, authjs.pkce.code_verifier",
    kind: "Cookies",
    purpose:
      "Sécurisent l'aller-retour de connexion avec Google et empêchent qu'un site tiers déclenche une connexion à votre place.",
    duration: "Le temps de la connexion",
  },
  {
    name: "corpusimmo:estimator:v1",
    kind: "Stockage de session",
    purpose:
      "Conserve votre estimation en cours pour que fermer un onglet par erreur ne coûte pas six écrans de saisie. Effacé à la fermeture du navigateur.",
    duration: "Session",
  },
  {
    name: "corpusimmo.estimations.v1",
    kind: "Stockage local",
    purpose:
      "L'historique de vos estimations terminées, affiché dans votre espace. Il ne quitte jamais votre appareil.",
    duration: "Jusqu'à effacement",
  },
  {
    name: "corpusimmo.outils.favoris.v1",
    kind: "Stockage local",
    purpose: "Les outils que vous avez mis de côté pour plus tard.",
    duration: "Jusqu'à effacement",
  },
  {
    name: "corpusimmo.pro.comparables.v1, corpusimmo.pro.subject.v1",
    kind: "Stockage local",
    purpose:
      "Votre sélection de ventes comparables et le bien de référence associé, dans l'observatoire.",
    duration: "Jusqu'à effacement",
  },
  {
    name: "corpusimmo:outil:<identifiant>, corpusimmo:tutoriel:support",
    kind: "Stockage local",
    purpose:
      "Les valeurs saisies dans un calculateur et votre préférence d'affichage du mode pas à pas, pour ne pas tout retaper à la visite suivante.",
    duration: "Jusqu'à effacement",
  },
  {
    name: "corpusimmo.consentement.v1",
    kind: "Stockage local",
    purpose:
      "Votre réponse à ce bandeau. Sans lui, la question vous serait reposée à chaque page.",
    duration: "Jusqu'à effacement ou changement de finalités",
  },
];

const OPTIONAL: Tracker[] = [
  {
    name: "_ga, _ga_<identifiant de flux>",
    kind: "Cookies Google Analytics",
    purpose:
      "Comptent les visites et distinguent les visiteurs revenants, pour savoir quelles pages servent réellement. Déposés uniquement après votre accord.",
    duration: "13 mois",
  },
];

export default function CookiesPage() {
  return (
    <div className="bg-canvas py-12 md:py-16">
      <div className="container-page">
        <article className="prose-justifiee mx-auto flex max-w-3xl flex-col gap-8">
          <div>
            <p className="eyebrow">Traceurs</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
              Cookies et traceurs
            </h1>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Cette page liste tout ce que le site dépose dans votre navigateur. Chaque nom qui y
              figure existe réellement dans le code, et rien n&apos;y est omis. Elle est datée du
              jour où elle a été écrite et sera mise à jour à chaque changement.
            </p>
          </div>

          <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
            <h2 className="font-display text-xl text-ink">Votre choix</h2>
            <ConsentSettings />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-ink">
              Nécessaires au fonctionnement, sans consentement
            </h2>
            <p className="leading-relaxed text-ink-muted">
              Ces éléments sont indispensables au service que vous demandez&nbsp;: rester connecté,
              retrouver un outil déjà ouvert, ne pas perdre une saisie en cours. La réglementation
              les dispense de consentement, et les soumettre à un choix qui n&apos;en serait pas un
              serait un consentement de façade. La plupart ne sont d&apos;ailleurs pas des cookies
              mais du stockage local&nbsp;: ils ne partent jamais vers nos serveurs.
            </p>
            <TrackerTable rows={NECESSARY} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl text-ink">Soumis à votre accord</h2>
            <p className="leading-relaxed text-ink-muted">
              La mesure d&apos;audience, et rien d&apos;autre. Aucun traceur publicitaire, aucun
              partage à des fins de ciblage, aucune revente. Tant que vous n&apos;avez pas répondu
              au bandeau, le script de Google n&apos;est pas même téléchargé&nbsp;: il ne se
              contente pas d&apos;être silencieux, il n&apos;est pas là.
            </p>
            <TrackerTable rows={OPTIONAL} />
            <p className="text-sm leading-relaxed text-ink-subtle">
              Google Analytics est édité par Google Ireland Limited. Les données de mesure peuvent
              être transférées hors de l&apos;Union européenne, dans le cadre du cadre de protection
              des données UE, États-Unis. L&apos;adresse IP est anonymisée avant traitement, et nous
              ne transmettons jamais d&apos;adresse e-mail, d&apos;adresse postale, de surface ni de
              montant estimé.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Si votre navigateur a déjà répondu</h2>
            <p className="leading-relaxed text-ink-muted">
              Certains navigateurs émettent un signal de refus de suivi, dit Global Privacy Control.
              Quand il est présent, nous le traitons comme un refus, quel que soit le choix fait
              dans le bandeau. Il n&apos;y a rien à faire de plus.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-ink">Effacer ce qui a été déposé</h2>
            <p className="leading-relaxed text-ink-muted">
              Retirer votre consentement ci-dessus arrête la mesure d&apos;audience. Pour supprimer
              également ce qui est déjà stocké, videz les données de site depuis les réglages de
              votre navigateur&nbsp;: cela effacera aussi vos favoris d&apos;outils, votre
              historique d&apos;estimations et votre sélection de comparables, qui vivent au même
              endroit.
            </p>
            <p className="leading-relaxed text-ink-muted">
              Pour toute question&nbsp;:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-primary underline"
              >
                {siteConfig.contactEmail}
              </a>
              . Voir aussi notre{" "}
              <Link href="/confidentialite" className="font-semibold text-primary underline">
                politique de confidentialité
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

function TrackerTable({ rows }: { rows: Tracker[] }) {
  return (
    <div className="scroll-slim overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead className="bg-surface-2">
          <tr>
            <Th>Nom</Th>
            <Th>Type</Th>
            <Th>Finalité</Th>
            <Th>Durée</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border-soft align-top">
              <td className="px-4 py-3 font-mono text-xs text-ink">{row.name}</td>
              <td className="px-4 py-3 text-ink-muted">{row.kind}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-muted">{row.purpose}</td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide text-ink uppercase">
      {children}
    </th>
  );
}
