import type { Metadata } from "next";
import Image from "next/image";

import { disclaimers, siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "À propos",
  description:
    "Deux anciens analystes investissement passés à l'IA, un corpus d'actes plutôt que " +
    "d'annonces, et les quatre règles que nous nous fixons sur ce que nous affichons.",
  path: "/a-propos",
  socialTitle: "Un corpus, et ce qu'on en fait",
});

export default function AProposPage() {
  return (
    <div className="bg-canvas pb-12 md:pb-16">
      {/* ── EN-TÊTE ─────────────────────────────────────────────────────────
          L'image ne se donne plus à voir pour elle-même. Posée brute avec sa
          légende, elle occupait le premier écran sans rien dire du sujet, et
          la page commençait vraiment sous la ligne de flottaison. Elle passe
          donc en fond d'un bloc qui porte le titre, la phrase d'ouverture ET
          la signature des deux auteurs : on sait dès la première seconde de
          quoi ça parle et qui l'écrit. */}
      <header className="relative isolate overflow-hidden">
        <Image
          src="/illustrations/ville-rue-fenetre.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_38%]"
        />
        {/* Le voile est plus dense à gauche, là où court le texte, et
            s'éclaircit à droite pour laisser vivre la photo. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(15,30,51,.96)_0%,rgba(15,30,51,.92)_42%,rgba(15,30,51,.72)_68%,rgba(15,30,51,.5)_100%)]"
        />

        <div className="container-page py-14 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow-text text-[color:var(--accent-rule)]">
              À propos
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-tight text-white md:text-5xl">
              Un corpus, et ce qu&apos;on en fait
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Nous ne partons pas d&apos;annonces. Nous partons des mutations
              réellement enregistrées par la DGFiP — des prix payés, portés à un
              acte.
            </p>

            {/* La signature dans l'en-tête, pas en bas de page : sur un
                estimateur, la première question légitime est « qui a écrit la
                méthode ». */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-3">
                {TEAM.map((member) => (
                  <Image
                    key={member.name}
                    src={member.photo}
                    alt={`Portrait de ${member.name}`}
                    width={44}
                    height={44}
                    className="size-11 rounded-full border-2 border-white/85 object-cover"
                  />
                ))}
              </div>
              <p className="text-sm leading-snug text-white/75">
                Par{" "}
                <span className="font-semibold text-white">
                  Mathieu Guicheteau
                </span>{" "}
                et{" "}
                <span className="font-semibold text-white">Gaël Colin</span>
                <span className="block text-white/60">
                  ex-analystes investissement, aujourd&apos;hui sur les
                  solutions d&apos;IA appliquées à l&apos;immobilier
                </span>
              </p>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,var(--accent-rule),var(--accent),var(--accent-rule))]"
        />
      </header>

      <div className="container-page">
        <p className="mx-auto max-w-2xl pt-3 text-[11px] text-ink-subtle">
          Illustration. Aucune adresse réelle n&apos;est identifiable, et aucun
          bien du corpus n&apos;est photographié.
        </p>

        {/* ── LES DEUX PARCOURS ─────────────────────────────────────────────
            Remontés juste sous l'en-tête. Un estimateur en ligne se juge sur
            sa méthode, et une méthode se juge sur qui l'a signée : ces années
            de métier valent plus que n'importe quelle promesse sur la qualité
            des données, elles n'avaient rien à faire en bas de page. */}
        <section className="mx-auto mt-10 max-w-4xl">
          <h2 className="font-display text-2xl text-ink">Qui nous sommes</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
            Nous ne sommes pas venus à l&apos;immobilier par la technologie,
            mais l&apos;inverse. Tous deux issus de l&apos;ESPI, nous avons
            passé nos premières années professionnelles comme analystes
            investissement, à faire exactement ce que ce site
            automatise&nbsp;: chercher des références de marché, écarter celles
            qui ne comparent rien, et défendre un chiffre devant quelqu&apos;un
            qui allait engager son argent dessus. Nous développons aujourd&apos;hui
            l&apos;un et l&apos;autre des solutions d&apos;intelligence
            artificielle — et CorpusImmo est celle où les deux métiers se
            rejoignent.
          </p>

          <ul className="mt-7 grid gap-5 sm:grid-cols-2">
            {TEAM.map((member) => (
              <li key={member.name} className="panel flex flex-col gap-4 p-6">
                <div className="flex items-center gap-3.5">
                  <Image
                    src={member.photo}
                    alt={`Portrait de ${member.name}`}
                    width={60}
                    height={60}
                    className="size-15 shrink-0 rounded-full border border-border object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold leading-tight text-ink">
                      {member.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-ink-subtle">
                      {member.role}
                    </p>
                  </div>
                </div>

                {/* Les années de métier, lisibles sans lire le paragraphe. */}
                <ul className="flex flex-wrap gap-1.5">
                  {member.facts.map((fact) => (
                    <li
                      key={fact}
                      className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-muted"
                    >
                      {fact}
                    </li>
                  ))}
                </ul>

                <p className="text-sm leading-relaxed text-ink-muted">
                  {member.bio}
                </p>

                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-auto text-xs font-semibold text-primary underline underline-offset-2"
                >
                  Parcours détaillé sur LinkedIn
                </a>
              </li>
            ))}
          </ul>

          {/* La formation commune, une fois pour deux. Répéter le logo dans
              chaque fiche l'aurait transformé en décor ; posé ici, il dit ce
              qu'il doit dire : d'où vient la formation, pas qui la cautionne. */}
          <p className="mt-6 flex items-center gap-3 text-sm text-ink-muted">
            <Image
              src="/equipe/espi.png"
              alt="Logo du Groupe ESPI"
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-md border border-border bg-surface object-contain"
            />
            <span>
              Nous sommes tous deux issus du{" "}
              <strong className="font-semibold text-ink">Groupe ESPI</strong>,
              école spécialisée dans les métiers de l&apos;immobilier.
            </span>
          </p>

          <p className="mt-6 max-w-2xl leading-relaxed text-ink-muted">
            CorpusImmo est né de la lassitude de refaire ce travail à la main,
            et de la conviction qu&apos;un estimateur honnête doit montrer ses
            ventes plutôt que son résultat.
          </p>
        </section>

        {/* ── LE CORPUS ─────────────────────────────────────────────────────*/}
        <article className="mx-auto mt-14 max-w-2xl">
          <h2 className="font-display text-2xl text-ink">
            Pourquoi « corpus »
          </h2>

          <div className="mt-4 flex flex-col gap-5 leading-relaxed text-ink-muted">
            <p>
              Un <em>corpus</em>, en science comme en droit, n&apos;est pas un
              tas de données. C&apos;est un ensemble fini, clos et structuré de
              pièces authentiques, réunies pour être analysées&nbsp;: rien
              n&apos;y entre qui n&apos;ait été constaté. Un corpus linguistique
              ne contient que des énoncés réellement produits&nbsp;; le{" "}
              <em>corpus juris</em> ne contient que des textes en vigueur.
            </p>
            <p>
              Les Demandes de Valeurs Foncières sont exactement cela&nbsp;:
              l&apos;ensemble des mutations à titre onéreux enregistrées par la
              DGFiP, publiées en open data. Pas des prix demandés, mais des prix
              payés, portés à un acte.
            </p>
            <p>
              C&apos;est toute la différence avec un estimateur qui extrapole
              depuis des annonces. Une annonce est une demande&nbsp;; un acte
              est un fait. Nous n&apos;avons jamais que des faits, et c&apos;est
              aussi ce qui borne ce que nous pouvons dire.
            </p>

            <h2 className="mt-6 font-display text-2xl text-ink">
              Ce que nous nous interdisons
            </h2>

            <ul className="flex flex-col gap-4">
              {RULES.map((rule) => (
                <li key={rule.title}>
                  <strong className="font-semibold text-ink">
                    {rule.title}
                  </strong>
                  <span className="mt-1 block">{rule.body}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 font-display text-2xl text-ink">
              D&apos;où viennent les données
            </h2>
            <p>{disclaimers.dvfSource}</p>
            <p>{disclaimers.dvfLimits}</p>
            <p>
              Le fond cartographique vient d&apos;OpenFreeMap et
              d&apos;OpenStreetMap&nbsp;; le géocodage d&apos;adresse, de la
              Géoplateforme IGN et de la base adresse nationale. Aucune de ces
              sources n&apos;est recopiée dans une base à nous.
            </p>

            <h2 className="mt-6 font-display text-2xl text-ink">Nous écrire</h2>
            <p>
              Une erreur dans un chiffre, une méthode contestable, une question
              sur une donnée vous concernant&nbsp;:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-primary underline"
              >
                {siteConfig.contactEmail}
              </a>
              .
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

/**
 * Les deux associés.
 *
 * Ce que ces notices doivent porter, et rien d'autre : des ANNÉES DE MÉTIER.
 * `facts` existe pour ça — les repères se lisent d'un coup d'œil, avant même
 * le paragraphe, parce que c'est ce qu'un visiteur cherche à vérifier.
 *
 * Les portraits viennent des profils LinkedIn, en 100 px de côté — d'où un
 * affichage à 60 px au plus, où cette résolution reste nette. Remplacer les
 * deux fichiers de `public/equipe/` par de la haute résolution suffit à
 * agrandir.
 */
const TEAM = [
  {
    name: "Mathieu Guicheteau",
    role: "Ex-analyste investissement · produit et méthode",
    photo: "/equipe/mathieu.png",
    linkedin: "https://www.linkedin.com/in/mathieu-guicheteau/",
    facts: ["6 ans chez Blot Immobilier", "1 000 lots gérés", "Fondateur de Scalenvia"],
    bio: "Six ans d'analyse d'investissement en immobilier d'entreprise — flux actualisés, études de marché, dossiers d'acquisition — après la gestion d'un portefeuille de mille lots. Il dirige aujourd'hui Scalenvia, agence de développement de solutions d'IA. À dix-sept ans, il avait déjà écrit un simulateur d'investissement immobilier, et l'avait donné.",
  },
  {
    name: "Gaël Colin",
    role: "Ex-analyste investissement · marché et données",
    photo: "/equipe/gael.png",
    linkedin: "https://www.linkedin.com/in/ga%C3%ABl-colin/",
    facts: ["BNP Paribas Real Estate", "Nantes", "IA pour l'immobilier"],
    bio: "Analyste investissement en immobilier d'entreprise, il a instruit des opérations d'acquisition pour des investisseurs institutionnels. Il conçoit aujourd'hui des solutions d'IA dédiées à l'immobilier. C'est de ce quotidien d'analyste que viennent les garde-fous statistiques du moteur.",
  },
] as const;

const RULES = [
  {
    title: "Jamais de repli silencieux.",
    body: "Si la source est indisponible, l'interface le dit et propose de réessayer. Elle ne substitue jamais une valeur inventée à une valeur manquante : un site qui bascule en douce sur des données fictives ne peut plus jamais être cru sur rien.",
  },
  {
    title: "Un plancher statistique de cinq mutations.",
    body: "En dessous, aucune valeur ni médiane n'est publiée. Une moyenne calculée sur trois ventes n'est pas une moyenne, et la publier reviendrait, dans un petit secteur, à désigner une vente précise.",
  },
  {
    title: "Aucun comparable ne pèse plus de 40 %.",
    body: "Sans ce plafond, une « valeur de marché » pourrait n'être, en pratique, que le prix d'une seule vente. C'est autant une exigence statistique qu'une exigence de secret.",
  },
  {
    title: "Le mot est estimation, jamais expertise.",
    body: "Un résultat algorithmique ne tient compte ni de l'état intérieur, ni des prestations, ni du contexte de la vente. Seul un professionnel ayant visité le bien peut établir une valeur vénale ferme.",
  },
] as const;
