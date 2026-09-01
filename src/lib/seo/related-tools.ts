/**
 * Les outils voisins d'un outil, calculés plutôt que listés.
 *
 * POURQUOI CE FICHIER EST DANS `seo/`
 *   Parce que c'est du MAILLAGE INTERNE, et que c'est sa seule raison d'être.
 *   Dix fiches outils reliées uniquement à `/outils` forment dix culs-de-sac :
 *   toute l'autorité entre par le sommaire et n'en ressort pas. Trois liens
 *   latéraux par fiche transforment la bibliothèque en réseau, ce qui est
 *   exactement le seul actif de référencement dont dispose un domaine neuf.
 *
 * POURQUOI PAS UNE TABLE DE VOISINS ÉCRITE À LA MAIN
 *   Quatre-vingt-dix couples à tenir à jour, dont personne ne saurait dire
 *   qu'ils sont devenus faux. Les axes existent déjà dans le catalogue (type
 *   d'actif × usage) : la proximité s'en déduit, et elle se met à jour toute
 *   seule quand un outil change d'axe.
 *
 * LA PONDÉRATION
 *   L'usage pèse deux fois plus que le type d'actif, parce que c'est lui qui
 *   décrit ce que la personne est en train de FAIRE. Quelqu'un qui monte un
 *   financement veut la capacité d'emprunt, pas un autre outil résidentiel.
 *   `tous-actifs` ne vaut qu'un demi-point : un outil universel est voisin de
 *   tout le monde, donc de personne en particulier.
 */

import { toolCatalogue } from "@/data/tools-catalogue";
import type { ToolCard } from "@/types/tool";

const USAGE_WEIGHT = 2;
const ASSET_WEIGHT = 1;
const UNIVERSAL_WEIGHT = 0.5;

function proximity(a: ToolCard, b: ToolCard): number {
  const sharedUsages = a.usages.filter((usage) => b.usages.includes(usage)).length;

  const sharedAssets = a.assetTypes.filter(
    (asset) => asset !== "tous-actifs" && b.assetTypes.includes(asset),
  ).length;

  const universal =
    a.assetTypes.includes("tous-actifs") || b.assetTypes.includes("tous-actifs")
      ? UNIVERSAL_WEIGHT
      : 0;

  return sharedUsages * USAGE_WEIGHT + sharedAssets * ASSET_WEIGHT + universal;
}

/**
 * Les outils les plus proches, du plus proche au moins proche.
 *
 * À égalité, l'ordre du catalogue tranche : le classement doit être le même à
 * chaque build, sans quoi le HTML de dix pages changerait sans raison.
 */
export function relatedTools(id: string, limit = 3): ToolCard[] {
  const source = toolCatalogue.find((tool) => tool.id === id);
  if (!source) return [];

  return toolCatalogue
    .filter((tool) => tool.id !== source.id)
    .map((tool, index) => ({ tool, index, score: proximity(source, tool) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.tool);
}
