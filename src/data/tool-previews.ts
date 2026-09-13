/**
 * LES APERÇUS DES CLASSEURS.
 *
 * Une capture par onglet du fichier Excel qui double l'outil en ligne. Montrer
 * le fichier réel prouve en une seconde ce qu'aucune description ne prouve :
 * qu'il existe, qu'il calcule, et à quoi il ressemble.
 *
 * ELLES SONT TIRÉES DES CLASSEURS TÉLÉCHARGEABLES, pas refaites à la main :
 * `scripts/outils/apercus.py` ouvre chaque matrice de `public/outils/matrices/`,
 * la met en page et photographie chaque onglet, mode d'emploi excepté. Quand
 * une matrice change, on relance le script et on recopie ici le relevé qu'il
 * imprime. La première capture sert d'illustration dans la bibliothèque : elle
 * montre le calculateur, jamais la prose.
 *
 * Le bilan promoteur fait exception : sa matrice n'est pas encore livrée, et
 * ses captures datent de la version précédente.
 *
 * Les dimensions sont MESURÉES sur les fichiers, pas estimées : elles réservent
 * la place exacte à l'affichage et évitent que la page saute au chargement.
 */

import type { ToolId } from "@/types/tool";

export interface ToolPreviewShot {
  /** Chemin public du fichier, sous `public/outils/apercus/`. */
  src: string;
  /** Nom de l'onglet du classeur. */
  label: string;
  /** Dimensions réelles du fichier, en pixels. */
  width: number;
  height: number;
}

/**
 * Au-delà de ce rapport hauteur / largeur, la capture est présentée rognée par
 * le haut plutôt que déroulée : un échéancier de trois cents lignes n'a pas à
 * pousser le reste de la page hors de l'écran. Le lien « taille réelle » reste
 * disponible pour qui veut tout voir.
 */
export const MAX_PREVIEW_TALLNESS = 1.35;

const SHOTS: Partial<Record<ToolId, Array<[label: string, width: number, height: number]>>> = {
  "rentabilite-locative": [
    ["Calculateur", 1400, 1545],
    ["Paramètres", 1400, 1897],
    ["Méthode", 1400, 2372],
  ],
  "pret-amortissement": [
    ["Mon prêt", 1400, 1054],
    ["Échéancier", 1400, 8028],
    ["Comparateur", 1400, 944],
    ["Détail des offres", 1400, 4921],
    ["Paramètres", 1400, 1762],
    ["Méthode", 1400, 2341],
  ],
  "arbitrage-fiscal": [
    ["Hypothèses", 1400, 1343],
    ["Comparateur", 1400, 1256],
    ["Pluriannuel", 1400, 813],
    ["Paramètres", 1400, 3165],
    ["Méthode", 1400, 3809],
  ],
  "chiffrage-travaux": [
    ["Chiffrage", 1400, 2188],
    ["Référentiel", 1400, 2315],
    ["Méthode", 1400, 2622],
  ],
  "capacite-emprunt": [
    ["Capacité d'emprunt", 1400, 1433],
    ["Bilan patrimonial", 1400, 1181],
    ["Paramètres", 1400, 1897],
    ["Méthode", 1400, 2678],
  ],
  dcf: [
    ["DCF", 1400, 615],
    ["Méthode", 1400, 1099],
  ],
  wault: [
    ["Rent roll", 1400, 683],
    ["Synthèse", 1400, 1057],
    ["Échéancier", 1400, 670],
    ["Paramètres", 1400, 1768],
    ["Méthode", 1400, 2659],
  ],
  "avis-de-valeur": [
    ["Avis de valeur", 1400, 1148],
    ["Référentiel", 1400, 2970],
    ["Méthode", 1400, 2542],
  ],
  "net-vendeur": [
    ["Net vendeur", 1400, 1318],
    ["Qualifier le mandat", 1400, 1077],
    ["Paramètres", 1400, 2351],
    ["Méthode", 1400, 2627],
  ],
  "bilan-promoteur": [
    ["Bilan", 1400, 1095],
    ["Sensibilité", 1400, 1440],
    ["Méthode", 1400, 1127],
  ],
};

/**
 * Les captures d'un outil, dans l'ordre des onglets. Tableau vide quand le
 * classeur n'a pas encore été photographié : l'appelant n'a rien à vérifier.
 */
export function getToolPreviews(id: ToolId): ToolPreviewShot[] {
  return (SHOTS[id] ?? []).map(([label, width, height], index) => ({
    src: `/outils/apercus/${id}-${index + 1}.jpg`,
    label,
    width,
    height,
  }));
}
