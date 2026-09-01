import type { Metadata } from "next";

import { OfferPage } from "@/components/marketing/offer-page";
import { siteConfig } from "@/config/site";

const TITLE = "Formation à l'IA appliquée à l'immobilier";
const DESCRIPTION =
  "Quelles tâches confier à une IA, comment vérifier ce qu'elle produit, où sont les pièges. " +
  "Des sessions courtes, animées par des analystes qui ont exercé le métier.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/solutions/formation" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/solutions/formation`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function FormationPage() {
  return (
    <OfferPage
      eyebrow="Formation"
      title="Apprendre à faire faire, et surtout à vérifier"
      lede="La compétence rare n'est pas de savoir rédiger une consigne : c'est de savoir reconnaître, en trente secondes, qu'un résultat est faux. C'est ce que la formation travaille, sur vos propres dossiers plutôt que sur des cas d'école."
      delivers={[
        {
          title: "La carte des tâches",
          body: "Ce qui se délègue bien à une machine, ce qui ne se délègue pas, et ce qui se délègue à condition d'être relu. Pour un métier où une erreur de chiffre engage une responsabilité, la troisième catégorie est la plus importante.",
        },
        {
          title: "La relecture critique",
          body: "Comment repérer un chiffre inventé, une source absente, une extrapolation déguisée en constat. Exercices sur des productions réelles, y compris fausses.",
        },
        {
          title: "Les outils de la bibliothèque en support",
          body: "Les dix calculateurs du site servent de terrain : ils exposent leurs barèmes et leurs limites, ce qui en fait de bons objets pour apprendre à interroger un résultat.",
        },
        {
          title: "Un mémo écrit, à garder",
          body: "Les règles de vérification, sur une page, affichable près d'un poste. La formation qui ne survit pas à la semaine suivante n'a servi à rien.",
        },
      ]}
      notYet={[
        "Aucune session n'est programmée et le calendrier n'est pas publié.",
        "L'organisme n'est pas référencé Qualiopi : la formation n'est donc pas finançable par un OPCO à ce stade.",
        "Le support n'est pas encore écrit sous une forme diffusable en dehors d'une session animée.",
      ]}
      proof={[
        {
          href: "/outils/arbitrage-fiscal",
          label: "L'arbitrage fiscal",
          body: "Cinq régimes appliqués au même bien — et la limite du calcul énoncée aussi clairement que le résultat.",
        },
        {
          href: "/outils/avis-de-valeur",
          label: "L'avis de valeur",
          body: "Des ajustements explicites et signés, parce qu'un chiffre qu'on ne peut pas défendre ne vaut rien.",
        },
        {
          href: "/carte",
          label: "La carte des ventes",
          body: "La donnée brute, sans interprétation : le meilleur terrain pour apprendre à la lire.",
        },
      ]}
    />
  );
}
