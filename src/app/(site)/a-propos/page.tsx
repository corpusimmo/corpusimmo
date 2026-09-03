import type { Metadata } from "next";
import Image from "next/image";

import { disclaimers, siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "À propos",
  description:
    "Pourquoi CorpusImmo part d'actes et non d'annonces, d'où viennent les données DVF, et " +
    "les quatre règles que nous nous sommes fixées sur ce que nous affichons.",
  path: "/a-propos",
  socialTitle: "Un corpus, et ce qu'on en fait",
});

export default function AProposPage() {
  return (
    <div className="bg-canvas py-12 md:py-16">
      <div className="container-page">
        <article className="mx-auto max-w-2xl">
          {/* Une rue vue d'une fenêtre : le point de vue de quelqu'un qui
              observe un marché, pas de quelqu'un qui vend un bien. C'est la
              posture du produit, et c'est pour ça que l'image ouvre cette page
              et aucune autre. Illustration générée (voir docs/images.md). */}
          <figure className="reveal mb-10">
            <div className="relative aspect-[21/9] overflow-hidden rounded-lg border border-border bg-surface-3 shadow-xs">
              <Image
                src="/illustrations/ville-rue-fenetre.webp"
                alt="Illustration : une rue de maisons de ville du XIXe siècle vue d'une fenêtre du premier étage, en fin d'après-midi."
                fill
                priority
                sizes="(min-width: 768px) 672px, 100vw"
                className="object-cover object-[50%_35%]"
              />
            </div>
            <figcaption className="mt-2 text-xs text-ink-subtle">
              Illustration. Aucune adresse réelle n&apos;est identifiable, et
              aucun bien du corpus n&apos;est photographié.
            </figcaption>
          </figure>

          <p className="eyebrow">À propos</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
            Un corpus, et ce qu&apos;on en fait
          </h1>

          <div className="mt-8 flex flex-col gap-5 leading-relaxed text-ink-muted">
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

            <h2 className="mt-6 font-display text-2xl text-ink">
              Qui nous sommes
            </h2>
            <p>
              Nous ne venons pas de la technologie. Nous venons de
              l&apos;analyse d&apos;investissement immobilier, où nous avons
              passé nos premières années professionnelles à faire exactement ce
              que ce site automatise&nbsp;: chercher des références de marché,
              écarter celles qui ne comparent rien, et défendre un chiffre
              devant quelqu&apos;un qui allait engager son argent dessus.
            </p>
            <p>
              CorpusImmo est né de la lassitude de refaire ce travail à la main,
              et de la conviction qu&apos;un estimateur honnête doit montrer ses
              ventes plutôt que son résultat.
            </p>

            {/* Les deux parcours côte à côte, pas l'un sous l'autre : ils se
                répondent — le même métier, deux maisons différentes. */}
            <ul className="not-prose mt-2 grid gap-5 sm:grid-cols-2">
              {TEAM.map((member) => (
                <li
                  key={member.name}
                  className="panel flex flex-col gap-3 p-5"
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={member.photo}
                      alt={`Portrait de ${member.name}`}
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-full border border-border object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-ink">
                        {member.name}
                      </p>
                      <p className="text-xs text-ink-subtle">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {member.bio}
                  </p>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-auto text-xs font-semibold text-primary underline"
                  >
                    Parcours détaillé sur LinkedIn
                  </a>
                </li>
              ))}
            </ul>

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
 * Un estimateur en ligne se juge sur la méthode, et la méthode se juge sur qui
 * l'a écrite. Dire « analyste investissement chez BNP Paribas Real Estate »
 * vaut mieux que n'importe quelle promesse sur la qualité des données.
 *
 * Les portraits viennent des profils LinkedIn, en 100 px de côté — d'où un
 * affichage à 56 px, où cette résolution reste nette. Remplacer les deux
 * fichiers de `public/equipe/` par de la haute résolution suffit à agrandir.
 */
const TEAM = [
  {
    name: "Mathieu Guicheteau",
    role: "Analyste investissement · produit et méthode",
    photo: "/equipe/mathieu.png",
    linkedin: "https://www.linkedin.com/in/mathieu-guicheteau/",
    bio: "Six ans d'analyse d'investissement en immobilier d'entreprise chez Blot Immobilier — flux actualisés, études de marché, dossiers d'acquisition — après la gestion d'un portefeuille de mille lots. À dix-sept ans, il avait déjà écrit un simulateur d'investissement immobilier, donné gratuitement.",
  },
  {
    name: "Gaël Colin",
    role: "Analyste investissement · marché et données",
    photo: "/equipe/gael.png",
    linkedin: "https://www.linkedin.com/in/ga%C3%ABl-colin/",
    bio: "Analyste investissement chez BNP Paribas Real Estate à Nantes, diplômé de l'ESPI. Il a instruit des opérations d'acquisition pour des investisseurs institutionnels : c'est de ce quotidien que viennent les garde-fous statistiques du moteur.",
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
