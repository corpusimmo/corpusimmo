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
      "L'outil part de cinq mesures du bien, en déduit la géométrie et une quantité pour chacun des vingt-huit postes, puis place chaque prix dans sa fourchette. Quantités et prix restent forçables avec vos devis, et la TVA du chantier est qualifiée.",
    ],
    contents: [
      "Vingt-huit postes : quantité automatique ou forcée, prix dans la fourchette ou forcé",
      "Bas de fourchette, chiffrage retenu et haut de fourchette",
      "Provision pour aléas et honoraires de maîtrise d'œuvre",
      "TVA à 5,5, 10 ou 20 % par ligne, et bascule à 20 % d'un immeuble rendu neuf",
      "Part de chaque famille de lots, pour repérer le poste oublié",
    ],
    limits:
      "Les fourchettes sont des ordres de grandeur 2026, hors Paris intra-muros et hors sites contraints. Elles ne remplacent pas un devis d'entreprise, et ne couvrent ni le désamiantage, ni le plomb, ni les reprises de structure imprévues.",
    matrix: "available",
    matrixFile: "chiffrage-de-travaux-par-lot.xlsx",
  },

  "arbitrage-fiscal": {
    audience: "Investisseur locatif, conseiller en gestion de patrimoine",
    assetTypes: ["residentiel"],
    usages: ["fiscalite"],
    body: [
      "Location nue au micro-foncier ou au réel, meublé au micro-BIC ou au LMNP réel, SCI à l'impôt sur les sociétés : sur la première année, le LMNP réel écrase presque toujours les autres. C'est la comparaison la plus trompeuse qui soit.",
      "Le LMNP réel rattrape son avantage à la revente par la réintégration des amortissements, la SCI paie peu tant que l'argent reste en société et beaucoup quand il en sort. L'outil déroule les cinq régimes année par année sur toute la détention, revente comprise, et les classe sur le seul chiffre qui compte : le total net en poche.",
    ],
    contents: [
      "Cinq régimes, année par année : loyers indexés, intérêts, amortissements, déficits et reports",
      "Déficit foncier plafonné, amortissements différés du LMNP, déficit et trésorerie de la SCI",
      "Plus-value à la revente : abattements pour durée, surtaxe, amortissements réintégrés, IS et boni de liquidation",
      "Total net en poche après revente et TRI après impôt de chaque régime",
      "Le régime le plus favorable et son avance sur le suivant",
    ],
    limits:
      "Le même loyer sert aux cinq régimes, ce qui avantage la location nue. L'IS suppose le taux réduit des PME, l'option pour le barème des dividendes et la TVA ne sont pas modélisées, et la plus-value des particuliers retient les forfaits de frais et de travaux.",
    matrix: "available",
    matrixFile: "arbitrage-fiscal-nu-lmnp-sci-is.xlsx",
  },

  "avis-de-valeur": {
    audience: "Agent immobilier, mandataire, expert",
    assetTypes: ["residentiel", "tous-actifs"],
    usages: ["valorisation"],
    body: [
      "Un avis de valeur se défend devant un vendeur qui a une idée en tête. Ce qui le tient, ce n'est pas le chiffre : ce sont les ventes citées et les ajustements assumés, ligne par ligne.",
      "L'outil ramène chaque vente au bien évalué (état, étage, extérieur, DPE, stationnement, dérive du marché), pondère par la similarité, et tire la largeur de la fourchette de la dispersion mesurée.",
    ],
    contents: [
      "Ajustement calculé par comparable, avec la valeur verte du DPE",
      "Verrous : ajustement plafonné, vente trop ancienne, panel trop mince, comparable dominant",
      "Prix au m² retenu, pondéré par la similarité",
      "Écart type pondéré et coefficient de variation",
      "Valeur centrale et fourchette à présenter au vendeur",
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
      "L'outil déroule la chaîne dans cet ordre, avec une durée de détention calculée de date à date. Puis une grille de huit critères pondérés dit si le mandat vaut le temps qu'il va coûter.",
    ],
    contents: [
      "Honoraires d'agence, charge vendeur ou acquéreur",
      "Solde du prêt et plafond légal de l'indemnité de remboursement anticipé",
      "Frais et travaux au forfait ou au réel, selon le mode d'acquisition",
      "Abattements, exonérations dans l'ordre du code, surtaxe sur les plus-values élevées",
      "Grille de qualification du mandat, avec l'écart de prix éliminatoire",
    ],
    limits:
      "Le modèle traite la vente en pleine propriété par un particulier résident. Le démembrement, les biens détenus en société ou à l'étranger et les cessions de parts sortent de son périmètre.",
    matrix: "available",
    matrixFile: "net-vendeur-honoraires-et-qualification.xlsx",
  },

  dcf: {
    audience: "Investisseur institutionnel, asset manager, analyste",
    assetTypes: ["bureaux", "commerce", "industriel"],
    usages: ["valorisation", "acquisition"],
    body: [
      "En immobilier d'entreprise, la valeur ne se lit pas au prix au m² : elle se lit dans les flux. Un actif se tient par son revenu, sa vacance à relouer, ses travaux, sa dette et la valeur qu'on lui prête à la sortie.",
      "L'outil projette jusqu'à sept ans de flux revenant aux fonds propres : loyers indexés, relocation de la vacance, franchises, capex, intérêts de la dette in fine, puis cession au taux de sortie. Il en tire la VAN et le TRI.",
    ],
    contents: [
      "Calendrier de relocation de la vacance et d'engagement du capex",
      "Coût de la vacance, franchises et honoraires de relocation",
      "Dette in fine, LTV et ICR année par année",
      "Prix de cession net vendeur, capitalisé au taux de sortie",
      "VAN et TRI des fonds propres, rendements AEM de contrôle",
    ],
    limits:
      "Un DCF vaut ce que valent ses hypothèses. Le taux de sortie et le taux d'actualisation portent l'essentiel du résultat, et aucun des deux ne s'observe : ils se justifient. Le modèle ne gère pas les échéances de bail et n'intègre aucune fiscalité.",
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
      "Contre-épreuve au prix de terrain demandé, et grille de sensibilité vente × construction",
    ],
    limits:
      "Le modèle raisonne sur une opération unique et un phasage simple. Il n'intègre ni la TVA sur marge, ni les participations d'urbanisme locales, ni le risque de recours contre le permis.",
    matrix: "available",
    matrixFile: "bilan-promoteur-et-charge-fonciere.xlsx",
  },

  wault: {
    audience: "Asset manager, property manager, investisseur en immobilier d'entreprise",
    assetTypes: ["bureaux", "commerce", "industriel"],
    usages: ["gestion", "valorisation"],
    body: [
      "Un WAULT de six ans peut cacher un mur d'échéances à trois ans si un locataire pèse la moitié des loyers. La moyenne pondérée ne dit rien de la concentration.",
      "L'outil part du rent roll lot par lot, loués et vacants. Il calcule la prochaine faculté de sortie de chaque bail, le loyer économique net des franchises, la réversion face au marché, puis le WAULT, le WALB et l'échéancier des sorties.",
    ],
    contents: [
      "Rent roll : surface, loyer facial, valeur locative de marché, dates, franchise",
      "Occupation physique et occupation financière EPRA",
      "Loyer économique, effet des franchises et réversion",
      "WAULT et WALB, sur loyer facial et sur loyer économique",
      "Concentration par locataire et échéancier des sorties, année par année",
    ],
    limits:
      "Le calcul ne juge pas la qualité de signature des locataires et n'indexe pas les loyers. Les paliers et les loyers variables sur chiffre d'affaires ne sont pas modélisés.",
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
