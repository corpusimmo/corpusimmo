import type { Metadata } from "next";

import { OfferPage } from "@/components/marketing/offer-page";
import { siteConfig } from "@/config/site";

const TITLE = "Automatisation sur mesure pour agences immobilières";
const DESCRIPTION =
  "Les tâches qui reviennent chaque semaine — qualifier les demandes, relancer, mettre à jour, " +
  "produire le reporting — exécutées automatiquement, en parallèle de votre process actuel.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/solutions/automatisation" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/solutions/automatisation`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AutomatisationPage() {
  return (
    <OfferPage
      eyebrow="Automatisation"
      title="Ce qui vous prend six heures par semaine peut en prendre zéro"
      lede="Nous ne remplaçons rien du premier coup. L'automatisme tourne d'abord en parallèle de votre process actuel, sur les mêmes dossiers, jusqu'à ce que les deux produisent le même résultat. Vous ne basculez que le jour où vous n'avez plus de raison de ne pas le faire."
      delivers={[
        {
          title: "Un chronométrage avant de toucher à quoi que ce soit",
          body: "Une demi-journée à mesurer ce que coûtent réellement les tâches répétitives de l'agence, poste par poste. Sans cette mesure, aucune promesse de gain n'est vérifiable — ni par vous, ni par nous.",
        },
        {
          title: "L'automatisme, monté sur vos outils",
          body: "Pas de logiciel supplémentaire à adopter. Ce qui est automatisé s'accroche à ce que vous utilisez déjà : votre boîte, votre logiciel de transaction, vos tableurs.",
        },
        {
          title: "La période de doublure",
          body: "L'automatisme et l'humain traitent les mêmes dossiers en parallèle, et les écarts sont relevés. C'est la seule façon honnête de savoir si la machine tient, avant de lui confier quoi que ce soit.",
        },
        {
          title: "La passation",
          body: "Documentation écrite, accès transférés, et la capacité de tout arrêter sans nous appeler. Un automatisme dont vous ne détenez pas les clés est une dépendance, pas un gain.",
        },
      ]}
      notYet={[
        "La commande en ligne n'est pas ouverte : chaque mission se cadre en entretien, parce que le périmètre décide du prix.",
        "Aucune intégration n'est pré-construite pour un logiciel de transaction particulier. Le premier chantier de chaque mission est le raccordement.",
        "Aucun engagement de résultat chiffré n'est publié ici : un gain de temps dépend autant de vos process que de notre travail, et une promesse invérifiable ne vaut rien.",
      ]}
      proof={[
        {
          href: "/estimer",
          label: "L'estimateur",
          body: "Six étapes, un moteur dont chaque pondération est documentée et testée.",
        },
        {
          href: "/observatoire",
          label: "L'observatoire",
          body: "Des millions de mutations interrogées à la volée, sans base de données à nous.",
        },
        {
          href: "/outils/dcf",
          label: "Le DCF sur dix ans",
          body: "Un modèle financier complet, avec ses barèmes affichés et modifiables.",
        },
      ]}
    />
  );
}
