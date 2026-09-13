/**
 * Le catalogue éditorial des dix outils.
 *
 * Le titre et le résumé ne sont PAS recopiés ici : ils sont lus dans la
 * `ToolSpec` correspondante. Recopier un titre, c'est garantir qu'un jour la
 * page et l'outil ne diront plus la même chose.
 *
 * Ce fichier ne porte donc que ce que la spécification ne sait pas dire : à qui
 * l'outil parle, sous quels axes il se filtre, et où s'arrête honnêtement ce
 * qu'il calcule.
 *
 * LES CLASSEURS EXCEL vivent dans `public/outils/matrices/`, servis tels que
 * livrés. Neuf sont disponibles ; le bilan promoteur annonce encore le sien
 * (`matrix: "coming"`) plutôt que d'exposer un bouton qui ne téléchargerait
 * rien.
 */

import { toolSpecs } from "@/lib/tools/definitions";
import type { ToolCard, ToolId } from "@/types/tool";

/** Ce que le catalogue ajoute à la spécification. */
type ToolEditorial = Omit<ToolCard, "id" | "title" | "summary">;

const EDITORIAL: Record<ToolId, ToolEditorial> = {
  "rentabilite-locative": {
    audience: "Investisseur particulier, conseiller en gestion de patrimoine",
    assetTypes: ["residentiel"],
    usages: ["acquisition", "financement", "fiscalite"],
    body: [
      "Un bien peut afficher 7 % de rendement brut et vous coûter de l'argent chaque mois. L'écart tient à ce que le brut ignore : les charges non récupérables, la vacance, la mensualité de crédit et l'impôt, qui change du tout au tout selon le régime.",
      "L'outil calcule le coût complet de l'achat, le loyer réellement encaissé et l'impôt de la première année sous cinq régimes fiscaux, puis les trois rendements et le cash-flow mensuel, qui est le seul chiffre que votre compte en banque connaisse.",
    ],
    contents: [
      "Cinq régimes : micro-foncier, réel foncier, LMNP micro-BIC, LMNP réel avec amortissement, meublé de tourisme non classé",
      "Déficit foncier imputable sur le revenu global, plafonné, et reports sur les années suivantes",
      "Rendement brut, net de charges et net-net après impôt, et le rendement « des annonces » pour comparer",
      "Cash-flow mensuel après impôt et effort d'épargne",
      "Part du loyer absorbée par la mensualité, le premier regard d'un banquier",
    ],
    limits:
      "Il ne compare pas les régimes dans la durée ni la détention en SCI à l'impôt sur les sociétés : c'est le travail de l'arbitrage fiscal. Il ne tient pas compte de la plus-value à la revente, que le LMNP réel alourdit par la réintégration des amortissements.",
    matrix: "available",
    matrixFile: "calculateur-rentabilite-locative.xlsx",
  },

  "pret-amortissement": {
    audience: "Emprunteur, courtier, conseiller bancaire",
    assetTypes: ["tous-actifs"],
    usages: ["financement"],
    body: [
      "Le taux affiché ne dit pas ce que le crédit coûte. L'assurance emprunteur pèse souvent plus que dix points de base de taux, les frais de dossier et de garantie s'ajoutent, et deux offres au même taux peuvent différer de plusieurs milliers d'euros.",
      "L'outil déroule l'échéancier mois par mois, arrondi au centime comme la banque, calcule le TAEG réglementaire et le confronte au taux d'usure, puis compare trois offres sur le critère qui les départage à toute durée : le TAEG.",
    ],
    contents: [
      "Mensualité, coût total et TAEG, avec et sans assurance",
      "Différé d'amortissement et assurance sur capital initial ou restant dû",
      "Taux d'usure de la tranche de durée et repères HCSF : taux d'effort, durée maximale",
      "Remboursement anticipé : capital restant dû et indemnité maximale",
      "Trois offres classées par TAEG, et par coût total à durée égale",
    ],
    limits:
      "Il ne traite ni les prêts à paliers, ni les prêts in fine, ni les taux variables, ni un prêt relais. Le déblocage est supposé en une fois, sans intérêts intercalaires.",
    matrix: "available",
    matrixFile: "tableau-amortissement-et-comparateur-de-prets.xlsx",
  },

  "capacite-emprunt": {
    audience: "Primo-accédant, investisseur, courtier",
    assetTypes: ["residentiel"],
    usages: ["financement"],
    body: [
      "Le taux d'endettement de 35 % est une règle, pas une loi : ce qui décide vraiment, c'est le reste à vivre, et il dépend de la composition du foyer autant que des revenus. Un dossier à 33 % avec quatre enfants peut être refusé, un dossier à 37 % confortable peut passer.",
      "L'outil calcule la mensualité permise par chacune des deux règles et retient la plus contraignante, remonte au capital empruntable, déduit garantie, dossier et frais de notaire réels pour donner le prix d'achat maximal, puis dresse le bilan patrimonial du foyer avant et après l'achat.",
    ],
    contents: [
      "Mensualité tenable, et la règle qui limite le dossier : taux d'effort ou reste à vivre",
      "Taux d'effort HCSF strict et taux de charges tout compris",
      "Prix d'achat maximal, frais de notaire calculés : droits de mutation, émoluments, débours",
      "Contrôles : durée HCSF, taux d'usure, apport face aux frais",
      "Bilan patrimonial avant et après l'opération : patrimoine net, endettement, épargne résiduelle",
    ],
    limits:
      "Une banque tient compte de la stabilité professionnelle, de l'historique bancaire et de sa politique commerciale du moment, que ce calcul ignore. Le résultat est un ordre de grandeur, pas un accord de principe.",
    matrix: "available",
    matrixFile: "capacite-emprunt-et-bilan-patrimonial.xlsx",
  },

  "chiffrage-travaux": {
    audience: "Investisseur en rénovation, marchand de biens, maître d'ouvrage",
    assetTypes: ["residentiel", "tous-actifs"],
    usages: ["acquisition"],
    body: [
      "Le budget travaux est le premier poste qui dérape, et c'est presque toujours pour la même raison : il a été estimé au ratio global (« comptons 800 € du m² ») au lieu d'être décomposé par lot.",
      "L'outil chiffre poste par poste (gros œuvre, second œuvre, lots techniques, finitions) et assume une fourchette plutôt qu'un chiffre unique.",
    ],
    contents: [
      "Chiffrage par lot, avec quantité et prix unitaire",
      "Provision pour aléas, en pourcentage assumé",
      "Fourchette basse et haute du budget total",
      "Coût au m² rénové, à comparer au marché",
      "Part de chaque lot dans le budget",
    ],
    limits:
      "Les prix unitaires proposés sont des ordres de grandeur nationaux, hors Île-de-France et hors sites contraints. Ils ne remplacent pas un devis d'entreprise, et ne couvrent ni les travaux structurels imprévus, ni les frais de maîtrise d'œuvre.",
    matrix: "available",
    matrixFile: "chiffrage-de-travaux-par-lot.xlsx",
  },

  "arbitrage-fiscal": {
    audience: "Investisseur locatif, conseiller en gestion de patrimoine",
    assetTypes: ["residentiel"],
    usages: ["fiscalite"],
    body: [
      "Location nue au réel, micro-foncier, LMNP au réel, micro-BIC, SCI à l'impôt sur les sociétés : le même bien, le même loyer, et jusqu'à plusieurs milliers d'euros d'écart de revenu net par an.",
      "L'outil applique les cinq régimes au même jeu de données et les classe par revenu net après impôt.",
    ],
    contents: [
      "Revenu net après impôt sous cinq régimes",
      "Impôt sur le revenu et prélèvements sociaux, séparément",
      "Effet de l'amortissement en LMNP au réel",
      "Impôt sur les sociétés et coût de la sortie des dividendes en SCI à l'IS",
      "Classement des régimes, du plus au moins favorable",
    ],
    limits:
      "Comparaison sur la PREMIÈRE ANNÉE uniquement. Le LMNP amortit, la SCI à l'IS reporte : leur avantage relatif se déplace avec le temps, et la fiscalité de la revente diffère radicalement d'un régime à l'autre. Ce calcul ne vaut pas conseil fiscal.",
    matrix: "available",
    matrixFile: "arbitrage-fiscal-nu-lmnp-sci-is.xlsx",
  },

  "avis-de-valeur": {
    audience: "Agent immobilier, mandataire, expert",
    assetTypes: ["residentiel", "tous-actifs"],
    usages: ["valorisation"],
    body: [
      "Un avis de valeur se défend devant un vendeur qui a une idée en tête. Ce qui le tient, ce n'est pas le chiffre : ce sont les ventes citées et les ajustements assumés, ligne par ligne.",
      "L'outil part de comparables réels, applique des ajustements explicites (surface, état, étage, extérieur) et produit une fourchette dont on peut expliquer chaque euro.",
    ],
    contents: [
      "Prix au m² pondéré des comparables retenus",
      "Ajustements par comparable, chacun signé et motivé",
      "Valeur centrale et fourchette",
      "Dispersion du jeu de comparables",
      "Trame d'argumentaire pour l'entretien vendeur",
    ],
    limits:
      "Un avis de valeur n'est pas une expertise au sens réglementaire. Seul un professionnel ayant visité le bien peut établir une valeur vénale ferme, et DVF ne publie ni l'état intérieur, ni le DPE, ni le contexte de la vente.",
    matrix: "available",
    matrixFile: "avis-de-valeur-par-comparaison.xlsx",
  },

  "net-vendeur": {
    audience: "Vendeur particulier, agent immobilier",
    assetTypes: ["residentiel"],
    usages: ["valorisation"],
    body: [
      "Entre le prix affiché sur l'annonce et le virement du notaire, il y a les honoraires, le solde du prêt, l'indemnité de remboursement anticipé et, souvent, l'impôt de plus-value.",
      "L'outil remonte la chaîne dans les deux sens : du prix affiché au net perçu, et du net souhaité au prix à afficher.",
    ],
    contents: [
      "Net vendeur à partir d'un prix affiché",
      "Prix à afficher pour un net vendeur visé",
      "Honoraires d'agence, charge vendeur ou acquéreur",
      "Solde de prêt et indemnité de remboursement anticipé",
      "Impôt de plus-value, abattements pour durée de détention appliqués",
    ],
    limits:
      "La plus-value est calculée dans le régime de droit commun des particuliers. Elle ne couvre ni la résidence principale exonérée, ni les cessions par une société, ni les régimes dérogatoires.",
    matrix: "available",
    matrixFile: "net-vendeur-honoraires-et-qualification.xlsx",
  },

  dcf: {
    audience: "Investisseur institutionnel, asset manager, analyste",
    assetTypes: ["bureaux", "commerce", "industriel"],
    usages: ["valorisation", "acquisition"],
    body: [
      "En immobilier d'entreprise, la valeur ne se lit pas au prix au m² : elle se lit dans les flux. Un actif se tient par son revenu, sa durée ferme et la valeur qu'on lui prête à la sortie.",
      "L'outil projette dix ans de flux, actualise, ajoute une valeur terminale par capitalisation, et sort le TRI comme la valeur vénale.",
    ],
    contents: [
      "Projection de flux sur dix ans, indexation comprise",
      "Valeur terminale par capitalisation du revenu de sortie",
      "Valeur actuelle nette au taux d'actualisation retenu",
      "Taux de rendement interne, avec et sans effet de levier",
      "Ratios de couverture attendus par un prêteur",
    ],
    limits:
      "Un DCF vaut ce que valent ses hypothèses. Le taux de sortie et le taux d'actualisation portent l'essentiel du résultat, et aucun des deux ne s'observe : ils se justifient. À manier avec une analyse de sensibilité, jamais seul.",
    matrix: "available",
    matrixFile: "dcf-valorisation.xlsx",
  },

  "bilan-promoteur": {
    audience: "Promoteur, aménageur, marchand de biens",
    assetTypes: ["terrain"],
    usages: ["acquisition"],
    body: [
      "La bonne question n'est pas « ce terrain vaut-il son prix ? » mais « combien puis-je le payer pour que l'opération tienne ma marge ? ». Le bilan promoteur se lit à l'envers : du chiffre d'affaires vers la charge foncière.",
      "L'outil part du prix de vente attendu, déduit les coûts de construction, les honoraires, les frais financiers et la marge visée, et fait tomber ce qui reste pour le foncier.",
    ],
    contents: [
      "Chiffre d'affaires prévisionnel, par typologie",
      "Coût de construction et honoraires de maîtrise d'œuvre",
      "Frais financiers et frais de commercialisation",
      "Marge en valeur et en pourcentage du chiffre d'affaires",
      "Charge foncière admissible, au global et au m² de surface de plancher",
    ],
    limits:
      "Le modèle raisonne sur une opération unique et un phasage simple. Il n'intègre ni la TVA sur marge, ni les participations d'urbanisme locales, ni le risque de recours contre le permis.",
    matrix: "coming",
  },

  wault: {
    audience: "Asset manager, property manager, investisseur en immobilier d'entreprise",
    assetTypes: ["bureaux", "commerce", "industriel"],
    usages: ["gestion", "valorisation"],
    body: [
      "Un WAULT de six ans peut cacher un mur d'échéances à trois ans si un locataire pèse la moitié des loyers. La moyenne pondérée ne dit rien de la concentration.",
      "L'outil calcule la durée moyenne pondérée jusqu'à la fin des baux et jusqu'à la prochaine option de sortie, puis affiche l'échéancier réel et le poids du premier locataire.",
    ],
    contents: [
      "WAULT jusqu'à échéance et jusqu'à la prochaine option de sortie",
      "Échéancier des baux, année par année",
      "Part du loyer portée par le premier locataire",
      "Loyer annuel total et loyer moyen au m²",
      "Taux de vacance sur le portefeuille",
    ],
    limits:
      "Le calcul suppose des baux à loyer fixe et n'intègre ni les franchises, ni les paliers, ni les loyers variables indexés sur le chiffre d'affaires du preneur.",
    matrix: "available",
    matrixFile: "rent-roll-et-wault.xlsx",
  },
};

/** Le catalogue complet, titre et résumé lus dans la spécification. */
export const toolCatalogue: ToolCard[] = (Object.keys(EDITORIAL) as ToolId[]).map((id) => {
  const spec = toolSpecs[id];
  const editorial = EDITORIAL[id];
  return { id, title: spec.title, summary: spec.intro, ...editorial };
});

export function getToolCard(id: string): ToolCard | undefined {
  return toolCatalogue.find((tool) => tool.id === id);
}
