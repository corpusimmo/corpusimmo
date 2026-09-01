import type { Metadata } from "next";

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
          <p className="eyebrow">À propos</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
            Un corpus, et ce qu&apos;on en fait
          </h1>

          <div className="mt-8 flex flex-col gap-5 leading-relaxed text-ink-muted">
            <p>
              Un <em>corpus</em>, en science comme en droit, n&apos;est pas un tas de données. C&apos;est
              un ensemble fini, clos et structuré de pièces authentiques, réunies pour être
              analysées&nbsp;: rien n&apos;y entre qui n&apos;ait été constaté. Un corpus
              linguistique ne contient que des énoncés réellement produits&nbsp;; le <em>corpus
              juris</em> ne contient que des textes en vigueur.
            </p>
            <p>
              Les Demandes de Valeurs Foncières sont exactement cela&nbsp;: l&apos;ensemble des
              mutations à titre onéreux enregistrées par la DGFiP, publiées en open data. Pas des
              prix demandés — des prix payés, portés à un acte.
            </p>
            <p>
              C&apos;est toute la différence avec un estimateur qui extrapole depuis des annonces.
              Une annonce est une demande&nbsp;; un acte est un fait. Nous n&apos;avons jamais que
              des faits, et c&apos;est aussi ce qui borne ce que nous pouvons dire.
            </p>

            <h2 className="mt-6 font-display text-2xl text-ink">Ce que nous nous interdisons</h2>

            <ul className="flex flex-col gap-4">
              {RULES.map((rule) => (
                <li key={rule.title}>
                  <strong className="font-semibold text-ink">{rule.title}</strong>
                  <span className="mt-1 block">{rule.body}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-6 font-display text-2xl text-ink">D&apos;où viennent les données</h2>
            <p>{disclaimers.dvfSource}</p>
            <p>{disclaimers.dvfLimits}</p>
            <p>
              Le fond cartographique vient d&apos;OpenFreeMap et d&apos;OpenStreetMap&nbsp;; le
              géocodage d&apos;adresse, de la Géoplateforme IGN et de la base adresse nationale.
              Aucune de ces sources n&apos;est recopiée dans une base à nous.
            </p>

            <h2 className="mt-6 font-display text-2xl text-ink">Nous écrire</h2>
            <p>
              Une erreur dans un chiffre, une méthode contestable, une question sur une donnée
              vous concernant&nbsp;:{" "}
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

const RULES = [
  {
    title: "Jamais de repli silencieux.",
    body: "Si la source est indisponible, l'interface le dit et propose de réessayer. Elle ne substitue jamais une valeur inventée à une valeur manquante — un site qui bascule en douce sur des données fictives ne peut plus jamais être cru sur rien.",
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
