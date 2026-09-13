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

import {
  anneesEntre,
  capitalFinancable,
  interetsCumules,
  pmt,
  ratio,
  tri,
  van,
  type ToolSpec,
} from "./spec";
import type { ToolId } from "@/types/tool";
import { arbitrageFiscal } from "./outils/arbitrage-fiscal";
import { avisDeValeur } from "./outils/avis-de-valeur";
import { capaciteEmprunt } from "./outils/capacite-emprunt";
import { chiffrageTravaux } from "./outils/chiffrage-travaux";
import { netVendeur } from "./outils/net-vendeur";
import { pretAmortissement } from "./outils/pret-amortissement";
import { rentabiliteLocative } from "./outils/rentabilite-locative";
import { wault } from "./outils/wault";

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

const dcf: ToolSpec = {
  id: "dcf",
  title: "DCF immobilier sur 10 ans",
  intro:
    "Flux actualisés, valeur terminale, TRI et valeur vénale : la lecture d'un investisseur professionnel.",
  sections: [
    {
      title: "L'actif",
      fields: [
        { id: "prix", label: "Prix d'acquisition, hors droits", value: 3200000, unit: "eur", hint: "Le prix inscrit à l'acte, hors frais. C'est la base de tout le reste : le majorer « pour arrondir » fausse les trois rendements." },
        { id: "droits", label: "Droits et frais d'acquisition", value: 6.9, unit: "pct", step: 0.1 },
        { id: "surface", label: "Surface locative", value: 1450, unit: "m2", min: 1, hint: "Surface habitable au sens Carrez pour un appartement. C'est le dénominateur du prix au m² : une erreur ici décale tous les repères de comparaison." },
        { id: "loyer", label: "Loyer facial annuel, année 1", value: 232000, unit: "eur", hint: "Hors charges, c'est-à-dire ce qui vous reste réellement. Le loyer charges comprises surestime la rentabilité de 10 à 15 %." },
      ],
    },
    {
      title: "Exploitation",
      fields: [
        { id: "indexation", label: "Indexation annuelle", value: 2, unit: "pct", step: 0.1 },
        { id: "vacance", label: "Vacance financière", value: 5, unit: "pct", step: 0.5, hint: "En pourcentage du loyer facial : vacance réelle, franchises et impayés confondus. 4 à 8 % en bureaux de seconde main." },
        { id: "cnr", label: "Charges non récupérables", value: 8, unit: "pct", hint: "En % du loyer facial." },
        { id: "gestion", label: "Frais de gestion et honoraires", value: 3, unit: "pct", hint: "7 à 9 % du loyer encaissé en agence. À zéro si vous gérez vous-même, mais comptez alors votre temps." },
        { id: "taxeFonciere", label: "Taxe foncière annuelle", value: 18500, unit: "eur", hint: "Elle figure sur l'avis d'imposition du vendeur : demandez-le avant l'offre. Elle augmente presque chaque année." },
        { id: "capex", label: "CAPEX annuel moyen", value: 12, unit: "eurm2", hint: "Par m² et par an. Exclu du NOI, c'est la convention de marché." },
      ],
    },
    {
      title: "Départ de locataire et relocation",
      fields: [
        {
          id: "anDepart",
          label: "Année du départ",
          value: 4,
          unit: "nombre",
          min: 0,
          max: 10,
          hint: "Prochaine échéance ferme du principal locataire. Zéro pour neutraliser le scénario.",
        },
        {
          id: "partDepart",
          label: "Part du loyer concernée",
          value: 45,
          unit: "pct",
          min: 0,
          max: 100,
          hint: "Poids du locataire partant dans le loyer facial.",
        },
        {
          id: "vacanceMois",
          label: "Vacance de relocation",
          value: 9,
          unit: "mois",
          min: 0,
          max: 36,
          hint: "6 à 12 mois en tertiaire de seconde main, franchise comprise.",
        },
        {
          id: "vlm",
          label: "Valeur locative de marché",
          value: 265,
          unit: "eurm2",
          hint: "Loyer auquel le lot se reloue. En dessous du loyer en place, la réversion est négative et ampute la valeur à l'échéance.",
        },
        {
          id: "travauxReloc",
          label: "Travaux de relocation",
          value: 145000,
          unit: "eur",
          hint: "Remise en état et aménagements preneur, payés l'année du départ.",
        },
      ],
    },
    {
      title: "Le financement",
      fields: [
        {
          id: "ltv",
          label: "Quotité financée (LTV)",
          value: 55,
          unit: "pct",
          min: 0,
          max: 90,
          hint: "En % de l'investissement total. 50 à 60 % en tertiaire ; au-delà, la banque exige un DSCR plus élevé.",
        },
        { id: "tauxDette", label: "Taux de la dette", value: 4.2, unit: "pct", step: 0.05 },
        {
          id: "dureeDette",
          label: "Durée du crédit",
          value: 15,
          unit: "an",
          min: 1,
          max: 25,
          hint: "En tertiaire, souvent plus court que la durée de détention modélisée.",
        },
        {
          id: "amortissable",
          label: "Type de crédit",
          value: "amortissable",
          options: [
            { value: "amortissable", label: "Amortissable" },
            { value: "infine", label: "In fine, intérêts seuls" },
          ],
          hint: "Un crédit in fine améliore le DSCR mais laisse tout le capital à rembourser à la sortie.",
        },
      ],
    },
    {
      title: "Sortie et actualisation",
      fields: [
        { id: "sortie", label: "Taux de capitalisation de sortie", value: 5.75, unit: "pct", step: 0.05, hint: "25 à 50 points de base au-dessus du taux d'entrée." },
        { id: "fraisCession", label: "Frais de cession", value: 1.5, unit: "pct", step: 0.1 },
        { id: "actualisation", label: "Taux d'actualisation", value: 7.5, unit: "pct", step: 0.1, hint: "Le coût du capital exigé. C'est LE paramètre qui fait la valeur." },
      ],
    },
  ],
  params: [],
  headlines: [
    {
      label: "Taux de rendement interne",
      unit: "pct",
      compute: (v) => {
        const t = tri([-investissement(v), ...fluxAnnuels(v)]);
        return Number.isNaN(t) ? 0 : t;
      },
      caption: (v) => {
        const t = tri([-investissement(v), ...fluxAnnuels(v)]);
        if (Number.isNaN(t)) return "Aucun taux n'annule la valeur actuelle nette sur cette configuration.";
        return t >= (v.actualisation ?? 0)
          ? "Au-dessus du taux d'actualisation exigé : l'opération crée de la valeur."
          : "En dessous du taux exigé : l'opération en détruit.";
      },
    },
    {
      label: "Valeur vénale hors droits",
      unit: "eur",
      compute: (v) => ratio(van(v.actualisation ?? 0, fluxAnnuels(v)), 1 + (v.droits ?? 0) / 100),
      caption: (v) => `Contre ${fr(v.prix ?? 0)} € demandés.`,
    },
  ],
  outputs: [
    { id: "invest", label: "Investissement total, droits compris", unit: "eur", compute: (v) => investissement(v), strong: true },
    { id: "capEntree", label: "Taux de capitalisation d'entrée", unit: "pct", compute: (v) => ratio(v.loyer ?? 0, investissement(v)) * 100 },
    { id: "noi1", label: "NOI de l'année 1", unit: "eur", compute: (v) => noi(v, 1), strong: true },
    { id: "noi10", label: "NOI de l'année 10", unit: "eur", compute: (v) => noi(v, 10) },
    { id: "vt", label: "Valeur terminale nette", unit: "eur", compute: (v) => valeurTerminale(v), hint: "NOI de l'année 11 capitalisé, net de frais de cession." },
    { id: "van", label: "Valeur actuelle nette", unit: "eur", compute: (v) => van(v.actualisation ?? 0, fluxAnnuels(v)) - investissement(v), strong: true },
    { id: "valeurDI", label: "Valeur vénale droits inclus", unit: "eur", compute: (v) => van(v.actualisation ?? 0, fluxAnnuels(v)) },
    { id: "part", label: "Part de la valeur portée par la sortie", unit: "pct", compute: (v) => ratio(valeurTerminale(v) / Math.pow(1 + (v.actualisation ?? 0) / 100, 10), van(v.actualisation ?? 0, fluxAnnuels(v))) * 100, hint: "Souvent 60 à 75 % : d'où l'importance du taux de sortie retenu." },
    {
      id: "dette",
      label: "Dette levée",
      unit: "eur",
      compute: (v) => (investissement(v) * (v.ltv ?? 0)) / 100,
    },
    {
      id: "fondsPropres",
      label: "Fonds propres engagés",
      unit: "eur",
      compute: (v) => investissement(v) * (1 - (v.ltv ?? 0) / 100),
      strong: true,
    },
    {
      id: "serviceDette",
      label: "Service de la dette annuel",
      unit: "eur",
      compute: (v, c) => serviceDette(v, c),
      hint: "Capital et intérêts. En crédit in fine, les intérêts seuls : le capital tombe à la sortie.",
    },
    {
      id: "dscr",
      label: "DSCR, couverture du service de la dette",
      unit: "fois",
      compute: (v, c) => ratio(noi(v, 1), serviceDette(v, c)),
      strong: true,
      hint: "NOI de l'année 1 sur le service de la dette. Les banques françaises exigent 1,20 au minimum, jusqu'à 1,50 sur un dossier jugé risqué. En dessous de 1, l'actif ne paie pas sa dette.",
    },
    {
      id: "debtYield",
      label: "Debt yield",
      unit: "pct",
      compute: (v) => ratio(noi(v, 1), (investissement(v) * (v.ltv ?? 0)) / 100) * 100,
      hint: "NOI rapporté à la dette. Contrairement au DSCR, il ne dépend ni du taux ni de la durée : c'est le ratio qui résiste à un montage habile. Un prêteur cherche 8 à 10 %.",
    },
    {
      id: "loanConstant",
      label: "Loan constant",
      unit: "pct",
      compute: (v, c) => ratio(serviceDette(v, c), (investissement(v) * (v.ltv ?? 0)) / 100) * 100,
      hint: "Le service de la dette rapporté au capital. L'effet de levier est positif tant que le taux de rendement de l'actif lui reste supérieur.",
    },
    {
      id: "cashOnCash",
      label: "Cash-on-cash de l'année 1",
      unit: "pct",
      compute: (v, c) =>
        ratio(noi(v, 1) - serviceDette(v, c) - (v.capex ?? 0) * (v.surface ?? 0), investissement(v) * (1 - (v.ltv ?? 0) / 100)) * 100,
      hint: "Trésorerie de l'année rapportée aux fonds propres. C'est ce que l'opération vous verse, avant toute plus-value.",
    },
    {
      id: "triLevier",
      label: "TRI sur fonds propres",
      unit: "pct",
      compute: (v, c) => {
        const t = tri(fluxFondsPropres(v, c));
        return Number.isNaN(t) ? 0 : t;
      },
      strong: true,
      hint: "Le TRI que touche l'investisseur, dette déduite. Supérieur au TRI de l'actif tant que le coût de la dette reste sous le rendement, c'est l'effet de levier, et il joue dans les deux sens.",
    },
    {
      id: "breakeven",
      label: "Taux d'occupation d'équilibre",
      unit: "pct",
      compute: (v, c) => {
        const facial = v.loyer ?? 0;
        const charges = facial - noi(v, 1);
        return ratio(charges + serviceDette(v, c), facial) * 100;
      },
      hint: "Le taux d'occupation en dessous duquel l'actif ne couvre plus ses charges et sa dette. C'est la marge de sécurité réelle.",
    },
  ],
  caveat:
    "Le service de la dette est calculé à taux fixe et sans différé. Il ne gère pas les échéanciers de baux réels, voir le rent roll, ni la fiscalité de l'investisseur, qui dépend du véhicule de détention.",
};

/**
 * Service annuel de la dette.
 *
 * En crédit in fine, seuls les intérêts courent : le DSCR paraît bien meilleur,
 * mais la totalité du capital reste due à la sortie. C'est exactement pour cela
 * qu'un prêteur regarde AUSSI le debt yield, que le montage ne peut pas
 * embellir.
 */
function serviceDette(v: Record<string, number>, c: Record<string, string>): number {
  const dette = (investissement(v) * (v.ltv ?? 0)) / 100;
  if (dette <= 0) return 0;
  if (c.amortissable === "infine") return (dette * (v.tauxDette ?? 0)) / 100;
  return pmt(v.tauxDette ?? 0, v.dureeDette ?? 0, dette) * 12;
}

/**
 * Flux revenant à l'investisseur : les fonds propres à l'entrée, puis le flux
 * d'exploitation diminué du service de la dette, et à la sortie le prix net du
 * capital restant dû.
 */
function fluxFondsPropres(v: Record<string, number>, c: Record<string, string>): number[] {
  const dette = (investissement(v) * (v.ltv ?? 0)) / 100;
  const service = serviceDette(v, c);
  const flux = fluxAnnuels(v).map((f) => f - service);

  // Capital restant dû à l'année 10 : nul si le crédit est plus court, la
  // totalité s'il est in fine.
  const duree = v.dureeDette ?? 0;
  const restant =
    c.amortissable === "infine"
      ? dette
      : duree <= 10
        ? 0
        : dette * (1 - 10 / duree);

  const dernier = flux[9] ?? 0;
  flux[9] = dernier - restant;
  return [-(investissement(v) - dette), ...flux];
}

function investissement(v: Record<string, number>): number {
  return (v.prix ?? 0) * (1 + (v.droits ?? 0) / 100);
}
function noi(v: Record<string, number>, annee: number): number {
  const index = Math.pow(1 + (v.indexation ?? 0) / 100, annee - 1);
  const depart = v.anDepart ?? 0;
  const part = (v.partDepart ?? 0) / 100;

  // À partir de l'année du départ, la part concernée cesse d'être indexée sur
  // le loyer en place et bascule à la valeur locative de marché. C'est la
  // RÉVERSION — le vrai sujet d'un actif tertiaire, que l'indexation masque
  // pendant toute la durée ferme.
  const loyerMarche = (v.vlm ?? 0) * (v.surface ?? 0) * part;
  const facial =
    depart === 0 || annee < depart
      ? (v.loyer ?? 0) * index
      : (v.loyer ?? 0) * index * (1 - part) +
        loyerMarche * Math.pow(1 + (v.indexation ?? 0) / 100, annee - depart);

  // Les mois de vide, l'année du départ, débordent sur la suivante au-delà de
  // douze : une relocation de quinze mois ne tient pas dans un exercice.
  const moisVides =
    depart === 0
      ? 0
      : annee === depart
        ? Math.min(12, v.vacanceMois ?? 0)
        : annee === depart + 1
          ? Math.max(0, Math.min(12, (v.vacanceMois ?? 0) - 12))
          : 0;

  const effectif =
    facial * (1 - (v.vacance ?? 0) / 100) - loyerMarche * (moisVides / 12);
  return (
    effectif -
    (facial * (v.cnr ?? 0)) / 100 -
    (effectif * (v.gestion ?? 0)) / 100 -
    (v.taxeFonciere ?? 0) * index
  );
}
function fluxAnnuels(v: Record<string, number>): number[] {
  const flux: number[] = [];
  for (let a = 1; a <= 10; a += 1) {
    const index = Math.pow(1 + (v.indexation ?? 0) / 100, a - 1);
    let f =
      noi(v, a) -
      (v.capex ?? 0) * (v.surface ?? 0) * index -
      (a === (v.anDepart ?? 0) ? (v.travauxReloc ?? 0) : 0);
    if (a === 10) f += valeurTerminale(v);
    flux.push(f);
  }
  return flux;
}
function valeurTerminale(v: Record<string, number>): number {
  // Le NOI de l'année 11, pas celui de l'année 10 : un acquéreur achète les
  // revenus à venir, pas ceux de l'exercice écoulé.
  const noi11 = noi(v, 10) * (1 + (v.indexation ?? 0) / 100);
  return ratio(noi11, (v.sortie ?? 0) / 100) * (1 - (v.fraisCession ?? 0) / 100);
}

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
