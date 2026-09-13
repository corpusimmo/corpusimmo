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
    ["Calculateur", 1400, 1486],
    ["Paramètres", 1400, 1880],
    ["Méthode", 1400, 2366],
  ],
  "pret-amortissement": [
    ["Mon prêt", 1400, 1017],
    ["Échéancier", 1400, 7647],
    ["Comparateur", 1400, 910],
    ["Détail des offres", 1400, 4689],
    ["Paramètres", 1400, 1750],
    ["Méthode", 1400, 2336],
  ],
  "arbitrage-fiscal": [
    ["Hypothèses", 1400, 1291],
    ["Comparateur", 1400, 1248],
    ["Pluriannuel", 1400, 779],
    ["Paramètres", 1400, 3124],
    ["Méthode", 1400, 3802],
  ],
  "chiffrage-travaux": [
    ["Chiffrage", 1400, 2111],
    ["Référentiel", 1400, 2287],
    ["Méthode", 1400, 2616],
  ],
  "capacite-emprunt": [
    ["Capacité d'emprunt", 1400, 1378],
    ["Bilan patrimonial", 1400, 1138],
    ["Paramètres", 1400, 1883],
    ["Méthode", 1400, 2673],
  ],
  dcf: [
    ["DCF", 1400, 673],
    ["Méthode", 1400, 1109],
  ],
  wault: [
    ["Rent roll", 1400, 671],
    ["Synthèse", 1400, 1021],
    ["Échéancier", 1400, 645],
    ["Paramètres", 1400, 1753],
    ["Méthode", 1400, 2654],
  ],
  "avis-de-valeur": [
    ["Avis de valeur", 1400, 1105],
    ["Référentiel", 1400, 2948],
    ["Méthode", 1400, 2537],
  ],
  "net-vendeur": [
    ["Net vendeur", 1400, 1267],
    ["Qualifier le mandat", 1400, 1062],
    ["Paramètres", 1400, 2313],
    ["Méthode", 1400, 2621],
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
