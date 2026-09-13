/**
 * Les dix outils en ligne, définis comme des données.
 *
 * Chacun refait le calcul du modèle Excel du même nom. Quand les deux
 * divergeraient, c'est ici qu'on corrige, parce que la page web est ce que le
 * visiteur voit en premier.
 *
 * Les taux réglementaires sont dans `params`, jamais dans une formule. Ils sont
 * affichés et modifiables à l'écran, comme l'onglet « Paramètres » du fichier :
 * un modèle qui cache ses barèmes devient faux sans que personne ne le voie.
 * Millésime vérifié : 2026.
 */

import type { ToolSpec } from "./spec";
import type { ToolId } from "@/types/tool";
import { arbitrageFiscal } from "./outils/arbitrage-fiscal";
import { avisDeValeur } from "./outils/avis-de-valeur";
import { bilanPromoteur } from "./outils/bilan-promoteur";
import { capaciteEmprunt } from "./outils/capacite-emprunt";
import { chiffrageTravaux } from "./outils/chiffrage-travaux";
import { dcf } from "./outils/dcf";
import { netVendeur } from "./outils/net-vendeur";
import { pretAmortissement } from "./outils/pret-amortissement";
import { rentabiliteLocative } from "./outils/rentabilite-locative";
import { wault } from "./outils/wault";

export const toolSpecs: Record<ToolId, ToolSpec> = {
  "rentabilite-locative": rentabiliteLocative,
  "pret-amortissement": pretAmortissement,
  "arbitrage-fiscal": arbitrageFiscal,
  "chiffrage-travaux": chiffrageTravaux,
  "capacite-emprunt": capaciteEmprunt,
  dcf,
  "bilan-promoteur": bilanPromoteur,
  wault,
  "avis-de-valeur": avisDeValeur,
  "net-vendeur": netVendeur,
};

export function getToolSpec(id: ToolId): ToolSpec {
  return toolSpecs[id];
}
