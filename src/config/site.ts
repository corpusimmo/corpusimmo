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
   * Un *corpus* est un ensemble fini, clos et structuré de pièces authentiques,
   * réunies pour être analysées : rien n'y entre qui n'ait été constaté. C'est
   * exactement ce qu'est DVF. « Sur pièces » est le pendant juridique — juger
   * sur pièces, c'est juger sur documents produits, par opposition à juger sur
   * parole. Les concurrents extrapolent depuis des ANNONCES, c'est-à-dire des
   * prix demandés ; nous partons d'ACTES, c'est-à-dire de prix payés.
   */
  signature: "L'immobilier sur pièces.",

  /** La version descriptive, celle qui travaille pour le référencement. */
  tagline: "Estimation et observatoire de l'immobilier, à partir des ventes réellement enregistrées.",

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
    "Source : Demandes de Valeurs Foncières (DVF) — DGFiP, diffusées en open data sur " +
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
