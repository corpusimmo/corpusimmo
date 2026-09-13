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

import { ratio, type ToolSpec } from "./spec";
import type { ToolId } from "@/types/tool";
import { arbitrageFiscal } from "./outils/arbitrage-fiscal";
import { avisDeValeur } from "./outils/avis-de-valeur";
import { capaciteEmprunt } from "./outils/capacite-emprunt";
import { chiffrageTravaux } from "./outils/chiffrage-travaux";
import { dcf } from "./outils/dcf";
import { netVendeur } from "./outils/net-vendeur";
import { pretAmortissement } from "./outils/pret-amortissement";
import { rentabiliteLocative } from "./outils/rentabilite-locative";
import { wault } from "./outils/wault";

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

const bilanPromoteur: ToolSpec = {
  id: "bilan-promoteur",
  title: "Charge foncière admissible",
  intro:
    "Combien puis-je payer ce terrain pour que l'opération tienne ma marge ? La question posée dans le bon sens.",
  sections: [
    {
      title: "Le programme",
      fields: [
        { id: "sdp", label: "Surface de plancher constructible", value: 2400, unit: "m2", min: 1 },
        { id: "shab", label: "Surface habitable vendable", value: 2040, unit: "m2", min: 1, hint: "Environ 85 % de la surface de plancher." },
        { id: "prixVente", label: "Prix de vente moyen TTC", value: 4200, unit: "eurm2", hint: "Au m² habitable. Le paramètre le plus sensible." },
        { id: "parkings", label: "Parkings vendus", value: 28, unit: "nombre" },
        { id: "prixParking", label: "Prix d'un parking", value: 18000, unit: "eur" },
      ],
    },
    {
      title: "Les coûts",
      fields: [
        { id: "construction", label: "Coût de construction", value: 1950, unit: "eurm2", hint: "Au m² de surface de plancher, tous corps d'état." },
        { id: "vrd", label: "VRD et fondations spéciales", value: 180000, unit: "eur" },
        { id: "honoraires", label: "Honoraires techniques", value: 12, unit: "pct", hint: "En % des travaux." },
        { id: "assurances", label: "Assurances et garanties", value: 2.5, unit: "pct" },
        { id: "aleas", label: "Aléas et imprévus", value: 3, unit: "pct", hint: "Jamais zéro." },
        { id: "taxes", label: "Taxes d'aménagement et raccordements", value: 95000, unit: "eur" },
        { id: "commercialisation", label: "Frais de commercialisation", value: 4.5, unit: "pct", hint: "En % du chiffre d'affaires." },
        { id: "financiers", label: "Frais financiers", value: 3, unit: "pct" },
        { id: "structure", label: "Frais de structure", value: 5, unit: "pct" },
      ],
    },
    {
      title: "La marge et le prix demandé",
      fields: [
        { id: "marge", label: "Marge cible sur chiffre d'affaires", value: 8, unit: "pct", hint: "6 à 10 % en logement libre. En dessous de 6 %, aucun financeur ne suit." },
        { id: "prixDemande", label: "Prix du terrain demandé", value: 1250000, unit: "eur", hint: "Le prix affiché par le propriétaire, frais d'acquisition compris. C'est lui qu'on confronte à la charge foncière admissible." },
      ],
    },
  ],
  params: [],
  headlines: [
    {
      label: "Charge foncière admissible",
      unit: "eur",
      compute: (v) => chargeFonciere(v),
      caption: (v) =>
        `Soit ${fr(ratio(chargeFonciere(v), v.sdp ?? 0))} € par m² de plancher, ` +
        `et ${(ratio(chargeFonciere(v), chiffreAffaires(v)) * 100).toFixed(0)} % du chiffre d'affaires.`,
    },
    {
      label: "Marge au prix demandé",
      unit: "pct",
      compute: (v) => ratio(chiffreAffaires(v) - coutsHorsFoncier(v) - (v.prixDemande ?? 0), chiffreAffaires(v)) * 100,
      caption: (v) => {
        const ecart = (v.prixDemande ?? 0) - chargeFonciere(v);
        return ecart > 0
          ? `Le terrain est ${fr(ecart)} € trop cher pour la marge visée.`
          : `Vous avez ${fr(-ecart)} € de marge de négociation.`;
      },
    },
  ],
  outputs: [
    { id: "ca", label: "Chiffre d'affaires TTC", unit: "eur", compute: (v) => chiffreAffaires(v), strong: true },
    { id: "travaux", label: "Travaux, construction et VRD", unit: "eur", compute: (v) => travauxTotal(v) },
    { id: "technique", label: "Coût technique total", unit: "eur", compute: (v) => coutTechnique(v) },
    { id: "horsFoncier", label: "Coûts hors foncier", unit: "eur", compute: (v) => coutsHorsFoncier(v), strong: true },
    { id: "margeValeur", label: "Marge cible en valeur", unit: "eur", compute: (v) => (chiffreAffaires(v) * (v.marge ?? 0)) / 100 },
    { id: "cfM2", label: "Charge foncière au m² de plancher", unit: "eurm2", compute: (v) => ratio(chargeFonciere(v), v.sdp ?? 0) },
    { id: "ecart", label: "Écart au prix admissible", unit: "eur", compute: (v) => (v.prixDemande ?? 0) - chargeFonciere(v), strong: true },
  ],
  caveat:
    "Le modèle ne traite ni la TVA sur marge, ni le phasage des appels de fonds, ni la vente en bloc. Il suppose la commercialisation intégrale et ne vérifie ni la faisabilité réglementaire, ni les servitudes, ni la dépollution.",
};

function chiffreAffaires(v: Record<string, number>): number {
  return (v.shab ?? 0) * (v.prixVente ?? 0) + (v.parkings ?? 0) * (v.prixParking ?? 0);
}
function travauxTotal(v: Record<string, number>): number {
  return (v.sdp ?? 0) * (v.construction ?? 0) + (v.vrd ?? 0);
}
function coutTechnique(v: Record<string, number>): number {
  const t = travauxTotal(v);
  return t * (1 + ((v.honoraires ?? 0) + (v.assurances ?? 0) + (v.aleas ?? 0)) / 100) + (v.taxes ?? 0);
}
function coutsHorsFoncier(v: Record<string, number>): number {
  const ca = chiffreAffaires(v);
  return (
    coutTechnique(v) +
    (ca * ((v.commercialisation ?? 0) + (v.financiers ?? 0) + (v.structure ?? 0))) / 100
  );
}
function chargeFonciere(v: Record<string, number>): number {
  const ca = chiffreAffaires(v);
  return ca - coutsHorsFoncier(v) - (ca * (v.marge ?? 0)) / 100;
}

/* -------------------------------------------------------------------------- */

function fr(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

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
