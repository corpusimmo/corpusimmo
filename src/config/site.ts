/**
 * Source unique de la marque et des formulations qui se répètent dans l'app.
 *
 * Renommer le produit, changer la signature ou l'adresse de contact doit
 * signifier éditer CE fichier, et rien d'autre. Aucun composant n'écrit
 * « CorpusImmo » en dur.
 */

import { resolveAppUrl } from "./app-url";

export const siteConfig = {
  name: "CorpusImmo",
  legalName: "CorpusImmo",

  /**
   * La signature de marque.
   *
   * Trois verbes et une preuve. Les trois verbes sont le PARCOURS réel du
   * produit — on estime, on compare les ventes autour, on décide — et ils
   * disent l'étendue là où « l'immobilier sur pièces », la signature
   * précédente, ne parlait que de la preuve : juste, mais muette sur le fait
   * qu'il y a quatre outils derrière. La seconde phrase garde exactement ce
   * que l'ancienne portait : les concurrents extrapolent depuis des ANNONCES,
   * c'est-à-dire des prix demandés ; nous partons d'ACTES, c'est-à-dire de
   * prix payés.
   *
   * Elle est reprise telle quelle par le pied de page, l'image sociale, le
   * balisage `slogan` de schema.org et la signature des e-mails : la changer
   * ici la change partout, et c'est le seul endroit où elle est écrite.
   */
  signature: "Estimer, comparer, décider. Sur les ventes réelles.",

  /** La version descriptive, celle qui travaille pour le référencement. */
  tagline:
    "Estimation et observatoire de l'immobilier, à partir des ventes réellement enregistrées.",

  description:
    "Estimez un bien et explorez les transactions immobilières réellement enregistrées, " +
    "à partir des Demandes de Valeurs Foncières publiées par la DGFiP. Résidentiel et " +
    "professionnel, gratuit, sans abonnement.",

  url: resolveAppUrl(),
  locale: "fr_FR",
  contactEmail: "contact@corpus.immo",
} as const;

/**
 * Ce à quoi nous sommes engagés, éditorialement et juridiquement.
 * Un résultat algorithmique est une ESTIMATION, jamais une expertise.
 */
export const disclaimers = {
  short:
    "Estimation statistique indicative, calculée à partir des transactions publiques DVF. " +
    "Elle ne constitue pas une expertise immobilière.",

  long:
    "Cette estimation est produite automatiquement à partir des Demandes de Valeurs Foncières " +
    "(DVF) publiées en open data par la DGFiP. Elle repose sur des ventes passées de biens " +
    "comparables et ne tient pas compte des caractéristiques non publiées : état intérieur réel, " +
    "qualité des prestations, exposition, diagnostics, travaux récents ou contexte de la vente. " +
    "Le résultat est une fourchette indicative et non une expertise immobilière au sens " +
    "réglementaire. Seul un professionnel ayant visité le bien peut établir une valeur vénale " +
    "ferme.",

  dvfSource:
    "Source : Demandes de Valeurs Foncières (DVF), publiées par la DGFiP en open data sur " +
    "data.gouv.fr. Mutations à titre onéreux enregistrées en France, hors Alsace-Moselle et " +
    "Mayotte.",

  dvfLimits:
    "DVF ne publie ni l'état intérieur, ni le DPE, ni l'identité des parties. Les surfaces et le " +
    "nombre de pièces sont ceux déclarés lors de la mutation et peuvent être absents.",

  /** Affiché partout où un outil produit un chiffre à partir de vos saisies. */
  toolResult:
    "Ce calcul repose exclusivement sur les valeurs que vous saisissez. Il ne vaut ni conseil en " +
    "investissement, ni conseil fiscal, ni recommandation de financement.",
} as const;

export const dvfCoverage = {
  /** Départements non couverts par la publication DVF en open data. */
  excludedDepartments: ["57", "67", "68", "976"],
  excludedLabel: "Alsace-Moselle et Mayotte",
} as const;
