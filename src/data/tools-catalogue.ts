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
 * LES CLASSEURS EXCEL — aucun n'est versionné dans cette version. Les matrices
 * sont en cours de révision ; chaque fiche l'annonce (`matrix: "coming"`)
 * plutôt que d'exposer un bouton de téléchargement qui ne téléchargerait rien.
 */

import { toolSpecs } from "@/lib/tools/definitions";
import type { ToolCard, ToolId } from "@/types/tool";

/** Ce que le catalogue ajoute à la spécification. */
type ToolEditorial = Omit<ToolCard, "id" | "title" | "summary">;

const EDITORIAL: Record<ToolId, ToolEditorial> = {
  "rentabilite-locative": {
    audience: "Investisseur particulier, conseiller en gestion de patrimoine",
    assetTypes: ["residentiel"],
    usages: ["acquisition", "financement"],
    body: [
      "Un bien peut afficher 7 % de rendement brut et vous coûter de l'argent chaque mois. L'écart tient à trois choses que le brut ignore : les charges non récupérables, la vacance, et la mensualité de crédit.",
      "Cet outil calcule les trois rendements (brut, net de charges, net-net après impôt) et surtout le cash-flow mensuel, qui est le seul chiffre que votre compte en banque connaisse.",
    ],
    contents: [
      "Rendement brut, net de charges et net-net après fiscalité",
      "Mensualité de crédit, assurance emprunteur comprise",
      "Cash-flow mensuel et annuel, vacance déduite",
      "Coût total de l'opération, frais de notaire et travaux inclus",
      "Prix au m² de revient, à comparer aux ventes du secteur",
    ],
    limits:
      "Le calcul est une photographie de la première année. Il n'anticipe ni la revalorisation des loyers, ni l'augmentation de la taxe foncière, ni un changement de régime fiscal en cours de détention.",
    matrix: "coming",
  },

  "pret-amortissement": {
    audience: "Emprunteur, courtier, conseiller bancaire",
    assetTypes: ["tous-actifs"],
    usages: ["financement"],
    body: [
      "Le taux affiché ne dit pas ce que le crédit coûte. L'assurance emprunteur pèse souvent plus que dix points de base de taux, les frais de dossier et de garantie s'ajoutent, et deux offres au même taux peuvent différer de plusieurs milliers d'euros.",
      "L'outil dresse le tableau d'amortissement complet et compare trois offres sur le seul critère qui vaille : le coût total du crédit.",
    ],
    contents: [
      "Mensualité, assurance comprise et hors assurance",
      "Tableau d'amortissement, capital et intérêts année par année",
      "Coût total du crédit, frais de dossier et de garantie inclus",
      "Comparaison de trois offres à durée égale",
      "Capital restant dû à n'importe quelle date",
    ],
    limits:
      "Les taux sont fixes sur toute la durée. Un prêt à taux variable, un prêt relais ou un différé d'amortissement demandent un autre calcul.",
    matrix: "coming",
  },

  "capacite-emprunt": {
    audience: "Primo-accédant, investisseur, courtier",
    assetTypes: ["residentiel"],
    usages: ["financement"],
    body: [
      "Le taux d'endettement de 35 % est une règle, pas une loi : ce qui décide vraiment, c'est le reste à vivre, et il dépend de la composition du foyer autant que des revenus.",
      "L'outil part des revenus et des charges réelles, applique le taux d'effort et le reste à vivre, puis remonte au prix d'achat maximal, frais de notaire déduits.",
    ],
    contents: [
      "Capacité de remboursement mensuelle",
      "Montant empruntable selon la durée et le taux",
      "Reste à vivre, par personne au foyer",
      "Prix d'achat maximal, frais de notaire déduits",
      "Effet d'un apport supplémentaire sur le prix accessible",
    ],
    limits:
      "Une banque tient compte d'éléments que ce calcul ignore : stabilité professionnelle, épargne résiduelle, historique bancaire, politique commerciale du moment. Le résultat est un ordre de grandeur, pas un accord de principe.",
    matrix: "coming",
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
    matrix: "coming",
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
    matrix: "coming",
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
    matrix: "coming",
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
    matrix: "coming",
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
    matrix: "coming",
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
    matrix: "coming",
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
