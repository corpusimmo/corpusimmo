/**
 * LES APERÇUS DES CLASSEURS.
 *
 * Une capture par onglet du fichier Excel qui double l'outil en ligne. Montrer
 * le fichier réel prouve en une seconde ce qu'aucune description ne prouve :
 * qu'il existe, qu'il calcule, et à quoi il ressemble.
 *
 * DEUX AVERTISSEMENTS, tenus par le code plutôt que par la mémoire :
 *
 * 1. Ces captures datent de la version précédente des classeurs. Les matrices
 *    ont été révisées depuis (voir `matrix: "coming"` dans le catalogue). La
 *    légende de la galerie le dit à voix haute : mieux vaut une capture datée
 *    et annoncée qu'une promesse floue.
 *
 * 2. Elles ont été prises quand le projet portait un autre nom. Le bandeau et
 *    la mention de bas de page ont été recomposés au nom de CorpusImmo, à
 *    l'identique de la typographie d'origine. Aucun chiffre n'a été touché.
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
    ["Calculateur", 1400, 1021],
    ["Paramètres", 1400, 1191],
    ["Méthode", 1400, 1140],
  ],
  "pret-amortissement": [
    ["Mon prêt", 1400, 986],
    ["Échéancier", 1400, 3000],
    ["Comparer trois offres", 1400, 1229],
    ["Méthode", 1400, 1140],
  ],
  "arbitrage-fiscal": [
    ["Comparateur", 1400, 1113],
    ["Paramètres", 1400, 1132],
    ["Méthode", 1400, 1140],
  ],
  "chiffrage-travaux": [
    ["Chiffrage", 1400, 1436],
    ["Prix de référence", 1400, 1271],
    ["Méthode", 1400, 1140],
  ],
  "capacite-emprunt": [
    ["Capacité d'emprunt", 1400, 1085],
    ["Bilan patrimonial", 1400, 1229],
    ["Paramètres", 1400, 1132],
    ["Méthode", 1400, 1140],
  ],
  dcf: [
    ["Hypothèses", 1400, 1213],
    ["Flux actualisés", 1400, 893],
    ["Sensibilité", 1400, 1498],
    ["Méthode", 1400, 1132],
  ],
  "bilan-promoteur": [
    ["Bilan", 1400, 1095],
    ["Sensibilité", 1400, 1440],
    ["Méthode", 1400, 1127],
  ],
  wault: [
    ["Rent roll", 1400, 1480],
    ["Échéancier des baux", 1400, 1418],
    ["Méthode", 1400, 1140],
  ],
  "avis-de-valeur": [
    ["Avis de valeur", 1400, 1087],
    ["Barème", 1400, 1176],
    ["Méthode", 1400, 1127],
  ],
  "net-vendeur": [
    ["Net vendeur", 1400, 961],
    ["Qualifier le mandat", 1400, 1197],
    ["Paramètres", 1400, 1146],
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
