import type { Metadata } from "next";

import { OfferPage } from "@/components/marketing/offer-page";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * NON PUBLIÉE, donc hors index.
 *
 * L'offre professionnelle est écrite mais elle n'est pas ouverte : elle a été
 * retirée du menu (`unpublishedNav` dans `src/config/navigation.ts`). Indexer
 * une page qui vend un rendez-vous qu'on ne peut pas encore honorer serait la
 * même faute que promettre un prix qu'on ne sait pas tenir.
 *
 * `follow` reste vrai : les liens vers l'estimateur, la carte et les outils
 * doivent continuer d'irriguer le reste du site. Le sitemap l'exclut tout seul,
 * en lisant ce `index: false` (voir `src/lib/seo/routes.ts`).
 */
export const metadata: Metadata = pageMetadata({
  title: "Leads vendeurs qualifiés pour agences immobilières",
  description:
    "Des propriétaires qui ont estimé leur bien sur CorpusImmo et accepté explicitement, "
    + "par une case distincte et horodatée, d'être contactés par un professionnel.",
  path: "/solutions/leads-vendeurs",
  socialTitle: "Des propriétaires qui ont demandé qu'on les rappelle",
  index: false,
});

export default function LeadsVendeursPage() {
  return (
    <OfferPage
      eyebrow="Leads vendeurs"
      title="Des propriétaires qui ont demandé qu'on les rappelle"
      lede="Un contact qui n'a pas dit oui n'est pas un lead, c'est un problème juridique. Sur CorpusImmo, l'accord d'être contacté par un professionnel est une case distincte, jamais pré-cochée, jamais groupée avec l'envoi de l'estimation, et horodatée côté serveur."
      delivers={[
        {
          title: "Le consentement, comme un événement daté",
          body: "Trois accords séparés — recevoir l'estimation, être contacté par un professionnel, recevoir nos informations — dont seul le premier est requis. L'absence d'une case est un refus, et le serveur ne déduit jamais l'un de l'autre.",
        },
        {
          title: "Le bien, tel qu'il a été décrit",
          body: "Commune, code INSEE, typologie, surface déclarée et motif de la démarche. Assez pour savoir si le dossier est pour vous, sans transmettre l'adresse exacte avant que le contact ne soit pris.",
        },
        {
          title: "Un score d'intention",
          body: "Calculé sur le motif déclaré, la complétude du dossier, la fraîcheur de la demande et l'accord de contact. Le détail du calcul est transmis avec le contact : vous jugez le score, vous ne le subissez pas.",
        },
        {
          title: "Un volume borné par secteur",
          body: "Le même vendeur transmis à dix agences ne vaut rien pour personne. Le nombre de destinataires par commune est plafonné.",
        },
      ]}
      notYet={[
        "Aucun contact n'est transmis à ce jour : la place de marché, la facturation et les contrats de destinataire ne sont pas construits.",
        "Rien n'est encore conservé côté serveur. Le consentement est vérifié et journalisé, mais aucune base de contacts n'existe — donc aucun stock à vendre.",
        "Le contrat destinataire reste à écrire, notamment l'obligation d'informer la personne dans le mois qui suit la transmission, et la responsabilité propre de l'agence en matière de démarchage téléphonique.",
      ]}
      proof={[
        {
          href: "/estimer",
          label: "Le parcours d'estimation",
          body: "Allez jusqu'à la dernière étape : les cases de consentement sont visibles, séparées, et aucune n'est cochée.",
        },
        {
          href: "/confidentialite",
          label: "Notre politique de données",
          body: "Ce que nous collectons, pourquoi, et pendant combien de temps.",
        },
        {
          href: "/observatoire",
          label: "L'observatoire",
          body: "Le marché de votre secteur, pour juger vous-même du potentiel avant d'acheter quoi que ce soit.",
        },
      ]}
    />
  );
}
