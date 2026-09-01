/**
 * Les rubriques du journal, et rien d'autre.
 *
 * La liste est fermée pour une raison de fond&nbsp;: une rubrique n'existe que
 * si elle peut porter plusieurs articles. Laisser un en-tête de fichier créer
 * sa propre catégorie produirait, en six mois, huit rubriques d'un article
 * chacune, c'est-à-dire huit pages faibles à référencer.
 *
 * Les ÉTIQUETTES sont l'inverse&nbsp;: libres, plates, sans page dédiée pour
 * l'instant. Elles servent à relier des articles entre eux, pas à ranger.
 */

import type { BlogCategoryId } from "@/types/blog";

export interface BlogCategory {
  id: BlogCategoryId;
  label: string;
  /** Une phrase, affichée là où la rubrique a besoin d'être expliquée. */
  description: string;
}

export const blogCategories: readonly BlogCategory[] = [
  {
    id: "methode",
    label: "Méthode",
    description: "Comment une estimation se construit, et où elle s'arrête.",
  },
  {
    id: "donnees",
    label: "Données publiques",
    description: "Ce que contiennent DVF et les fichiers fonciers, ce qu'ils ignorent.",
  },
  {
    id: "marche",
    label: "Lecture de marché",
    description: "Lire des volumes et des prix sans leur faire dire plus qu'ils ne disent.",
  },
  {
    id: "pratique",
    label: "Guides pratiques",
    description: "Vendre, acheter, arbitrer\u00A0: les gestes concrets, chiffres à l'appui.",
  },
] as const;

const BY_ID = new Map<string, BlogCategory>(blogCategories.map((entry) => [entry.id, entry]));

export function isBlogCategory(value: string): value is BlogCategoryId {
  return BY_ID.has(value);
}

/**
 * Le libellé d'une rubrique. Retourne l'identifiant brut si la rubrique est
 * inconnue&nbsp;: un affichage dégradé vaut mieux qu'une page en erreur, et la
 * validation à la lecture a déjà refusé ce cas en amont.
 */
export function blogCategoryLabel(id: BlogCategoryId): string {
  return BY_ID.get(id)?.label ?? id;
}

/** La liste des identifiants, pour les messages d'erreur de validation. */
export const blogCategoryIds: readonly string[] = blogCategories.map((entry) => entry.id);
