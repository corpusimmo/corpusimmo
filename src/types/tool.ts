/**
 * Le contrat de la bibliothèque d'outils.
 *
 * UNE bibliothèque, pas des rubriques : un outil porte plusieurs axes à la fois
 * — type d'actif × usage. Les filtres croisent ces axes ; la navigation ne les
 * découpe jamais en branches (voir `src/config/navigation.ts`).
 *
 * Deux couches, délibérément séparées :
 *   · `ToolSpec` (`src/lib/tools/spec.ts`) — la MÉCANIQUE : champs, formules,
 *     paramètres réglementaires, résultats. C'est ce que le moteur exécute.
 *   · `ToolCard` (ici) — l'ÉDITORIAL : ce que la page publique raconte, à qui
 *     elle parle, ce que l'outil ne fait pas. C'est ce que le référencement lit.
 *
 * Les mélanger reviendrait à devoir toucher une formule pour corriger une
 * phrase.
 */

import type { ToolAssetType, ToolUsage } from "@/config/navigation";

/** Les dix outils de calcul disponibles sous `/outils/[slug]`. */
export type ToolId =
  | "rentabilite-locative"
  | "pret-amortissement"
  | "arbitrage-fiscal"
  | "chiffrage-travaux"
  | "capacite-emprunt"
  | "dcf"
  | "bilan-promoteur"
  | "wault"
  | "avis-de-valeur"
  | "net-vendeur";

/**
 * L'état du classeur Excel qui double l'outil en ligne.
 *
 * Les matrices sont en cours de révision et ne sont pas encore versionnées. On
 * l'affiche plutôt que de le taire : promettre un téléchargement qui n'arrive
 * pas coûte plus cher que d'annoncer une date.
 */
export type MatrixStatus = "coming" | "available";

export interface ToolCard {
  /** Segment d'URL sous `/outils/`. Identique à `ToolId` : une seule clé à retenir. */
  id: ToolId;
  /** Titre de la page. Reprend celui de la `ToolSpec`, jamais recopié à la main. */
  title: string;
  /** Une phrase : ce que l'outil répond. Sous-titre de carte et méta-description. */
  summary: string;
  /** Corps de la landing, un paragraphe par entrée. */
  body: string[];
  /** À qui ça parle, en toutes lettres. « Investisseur particulier », « Marchand de biens ». */
  audience: string;
  /** Un outil marqué `tous-actifs` répond à tous les filtres de type d'actif. */
  assetTypes: readonly ToolAssetType[];
  usages: readonly ToolUsage[];
  /** Ce que l'outil calcule, poste par poste. */
  contents: string[];
  /** La frontière honnête : ce que l'outil ne fait PAS. */
  limits: string;
  /** État du classeur Excel équivalent. */
  matrix: MatrixStatus;
}

/** Facettes actives, toutes optionnelles, toutes lues dans la query string. */
export interface ToolFilters {
  assetType?: ToolAssetType;
  usage?: ToolUsage;
  /** Recherche plein texte sur le titre et le résumé. */
  query?: string;
}

/** Une option de facette avec le nombre de résultats qu'elle donnerait. */
export interface ToolFacetOption<Id extends string> {
  id: Id;
  label: string;
  count: number;
  active: boolean;
}
