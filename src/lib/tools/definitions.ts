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
import { capaciteEmprunt } from "./outils/capacite-emprunt";
import { pretAmortissement } from "./outils/pret-amortissement";
import { rentabiliteLocative } from "./outils/rentabilite-locative";

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

const chiffrageTravaux: ToolSpec = {
  id: "chiffrage-travaux",
  title: "Chiffrage de travaux",
  intro:
    "Un budget de rénovation crédible avant d'avoir le moindre devis, avec sa fourchette assumée.",
  sections: [
    {
      title: "Le chantier",
      fields: [
        { id: "surface", label: "Surface du logement", value: 70, unit: "m2", min: 5, hint: "Surface habitable au sens Carrez pour un appartement. C'est le dénominateur du prix au m² : une erreur ici décale tous les repères de comparaison." },
        {
          id: "ampleur",
          label: "Ampleur des travaux",
          value: "renovation",
          options: [
            { value: "rafraichissement", label: "Rafraîchissement : peinture, sols" },
            { value: "renovation", label: "Rénovation : électricité, plomberie, cuisine, bains" },
            { value: "restructuration", label: "Restructuration : murs, réseaux, tout refait" },
          ],
        },
        {
          id: "curseur",
          label: "Positionnement dans la fourchette",
          value: 50,
          unit: "pct",
          hint: "0 % = artisans en direct en zone détendue. 100 % = entreprise générale en zone tendue.",
          min: 0,
          max: 100,
          step: 5,
        },
        { id: "aleas", label: "Provision pour aléas", value: 12, unit: "pct", hint: "10 à 15 % en rénovation lourde. En dessous de 10 %, vous pariez.", min: 0, max: 30 },
        {
          id: "tva",
          label: "Taux de TVA",
          value: "10",
          options: [
            { value: "20", label: "20 %, cas général" },
            { value: "10", label: "10 %, logement de plus de 2 ans" },
            { value: "5.5", label: "5,5 %, rénovation énergétique éligible" },
          ],
        },
      ],
    },
  ],
  params: [],
  headlines: [
    {
      label: "Budget travaux TTC",
      unit: "eur",
      compute: (v, c) => budgetTTC(v, c),
      caption: (v, c) => `Soit ${fr(ratio(budgetTTC(v, c), v.surface ?? 0))} € par m² habitable.`,
    },
  ],
  outputs: [
    { id: "bas", label: "Fourchette basse au m²", unit: "eurm2", compute: (v, c) => bornes(c)[0] },
    { id: "haut", label: "Fourchette haute au m²", unit: "eurm2", compute: (v, c) => bornes(c)[1] },
    { id: "retenu", label: "Prix au m² retenu", unit: "eurm2", compute: (v, c) => prixM2(v, c), strong: true },
    { id: "ht", label: "Sous-total des travaux", unit: "eur", compute: (v, c) => prixM2(v, c) * (v.surface ?? 0) },
    { id: "prov", label: "Provision pour aléas", unit: "eur", compute: (v, c) => (prixM2(v, c) * (v.surface ?? 0) * (v.aleas ?? 0)) / 100 },
    { id: "totalHT", label: "Total hors taxes", unit: "eur", compute: (v, c) => totalHT(v, c), strong: true },
    { id: "tva", label: "TVA", unit: "eur", compute: (v, c) => (totalHT(v, c) * Number(c.tva ?? "10")) / 100 },
    { id: "m2", label: "Coût au m² habitable", unit: "eurm2", compute: (v, c) => ratio(budgetTTC(v, c), v.surface ?? 0), strong: true, hint: "400 €/m² : on rafraîchit. 900 €/m² : on rénove. Au-delà de 1 500 €/m² : on restructure." },
  ],
  caveat:
    "Ce chiffrage ne remplace pas un devis : il sert à décider s'il vaut la peine d'en demander trois. Il ignore les contraintes de site, et ne chiffre ni le désamiantage, ni le plomb, ni les fondations. Le modèle Excel détaille les vingt-sept postes lot par lot.",
};

/** Fourchettes au m² habitable, cohérentes avec les prix de référence du fichier. */
function bornes(c: Record<string, string>): [number, number] {
  if (c.ampleur === "rafraichissement") return [180, 520];
  if (c.ampleur === "restructuration") return [1100, 2200];
  return [550, 1300];
}
function prixM2(v: Record<string, number>, c: Record<string, string>): number {
  const [bas, haut] = bornes(c);
  return bas + ((haut - bas) * (v.curseur ?? 50)) / 100;
}
function totalHT(v: Record<string, number>, c: Record<string, string>): number {
  const sous = prixM2(v, c) * (v.surface ?? 0);
  return sous * (1 + (v.aleas ?? 0) / 100);
}
function budgetTTC(v: Record<string, number>, c: Record<string, string>): number {
  return totalHT(v, c) * (1 + Number(c.tva ?? "10") / 100);
}

/* -------------------------------------------------------------------------- */

const arbitrageFiscal: ToolSpec = {
  id: "arbitrage-fiscal",
  title: "Nu, LMNP ou SCI à l'IS ?",
  intro:
    "Cinq régimes appliqués au même bien, et le classement par revenu net après impôt, la première année.",
  sections: [
    {
      title: "Le bien et son exploitation",
      fields: [
        { id: "prix", label: "Prix d'acquisition, frais inclus", value: 220000, unit: "eur", hint: "Le prix inscrit à l'acte, hors frais. C'est la base de tout le reste : le majorer « pour arrondir » fausse les trois rendements." },
        { id: "mobilier", label: "Dont mobilier et équipement", value: 8000, unit: "eur", hint: "Compte pour le coût total mais s'amortit à part, plus vite que le bâti. Indispensable pour louer en meublé." },
        { id: "loyer", label: "Loyer annuel encaissé", value: 13200, unit: "eur", hint: "Hors charges, c'est-à-dire ce qui vous reste réellement. Le loyer charges comprises surestime la rentabilité de 10 à 15 %." },
        { id: "charges", label: "Charges annuelles déductibles", value: 3100, unit: "eur" },
        { id: "interets", label: "Intérêts d'emprunt de l'année", value: 5400, unit: "eur" },
        { id: "tmi", label: "Tranche marginale d'imposition", value: 30, unit: "pct", min: 0, max: 45 },
      ],
    },
  ],
  params: [
    { id: "ps", label: "Prélèvements sociaux", value: 17.2, unit: "pct" },
    { id: "abtMF", label: "Abattement micro-foncier", value: 30, unit: "pct" },
    { id: "abtBIC", label: "Abattement LMNP micro-BIC", value: 50, unit: "pct" },
    { id: "plafondDeficit", label: "Plafond du déficit foncier imputable", value: 10700, unit: "eur" },
    { id: "dureeBati", label: "Durée d'amortissement du bâti", value: 30, unit: "an" },
    { id: "dureeMobilier", label: "Durée d'amortissement du mobilier", value: 7, unit: "an" },
    { id: "partTerrain", label: "Part du terrain dans le prix", value: 15, unit: "pct", hint: "Le terrain ne s'amortit jamais." },
    { id: "isReduit", label: "IS, taux réduit", value: 15, unit: "pct" },
    { id: "isSeuil", label: "IS, seuil du taux réduit", value: 42500, unit: "eur" },
    { id: "isNormal", label: "IS, taux normal", value: 25, unit: "pct" },
  ],
  headlines: [
    {
      label: "Régime le plus favorable",
      unit: "texte",
      compute: (v) => meilleurRegime(v).nom,
      caption: (v) => `Revenu net de ${fr(meilleurRegime(v).net)} € la première année.`,
    },
  ],
  outputs: [
    { id: "resultat", label: "Résultat avant impôt et amortissement", unit: "eur", compute: (v) => resultatBrut(v), strong: true },
    { id: "amoBati", label: "Amortissement annuel du bâti", unit: "eur", compute: (v) => amoBati(v) },
    { id: "amoMob", label: "Amortissement annuel du mobilier", unit: "eur", compute: (v) => ratio(v.mobilier ?? 0, v.dureeMobilier ?? 7) },
    { id: "r1", label: "Micro-foncier, revenu net", unit: "eur", compute: (v) => regimes(v)[0]!.net },
    { id: "r2", label: "Réel foncier, revenu net", unit: "eur", compute: (v) => regimes(v)[1]!.net },
    { id: "r3", label: "LMNP micro-BIC, revenu net", unit: "eur", compute: (v) => regimes(v)[2]!.net },
    { id: "r4", label: "LMNP au réel, revenu net", unit: "eur", compute: (v) => regimes(v)[3]!.net, strong: true },
    { id: "r5", label: "SCI à l'IS, revenu net", unit: "eur", compute: (v) => regimes(v)[4]!.net },
    { id: "ecart", label: "Écart entre le meilleur et le pire régime", unit: "eur", compute: (v) => { const n = regimes(v).map((r) => r.net); return Math.max(...n) - Math.min(...n); }, strong: true },
  ],
  caveat:
    "La comparaison porte sur la première année, pas sur la durée de détention. Elle ne modélise pas la plus-value de revente, qui inverse souvent le classement, d'autant que depuis le 15 février 2025, les amortissements déduits en LMNP réel sont réintégrés dans la plus-value. Consultez un expert-comptable avant tout passage à l'IS.",
};

function resultatBrut(v: Record<string, number>): number {
  return (v.loyer ?? 0) - (v.charges ?? 0) - (v.interets ?? 0);
}
function amoBati(v: Record<string, number>): number {
  const base = Math.max(0, ((v.prix ?? 0) - (v.mobilier ?? 0)) * (1 - (v.partTerrain ?? 15) / 100));
  return ratio(base, v.dureeBati ?? 30);
}
function regimes(v: Record<string, number>): { nom: string; net: number }[] {
  const brut = resultatBrut(v);
  const amo = amoBati(v) + ratio(v.mobilier ?? 0, v.dureeMobilier ?? 7);
  const tauxIR = ((v.tmi ?? 0) + (v.ps ?? 17.2)) / 100;

  const baseMF = (v.loyer ?? 0) * (1 - (v.abtMF ?? 30) / 100);
  const baseReel = Math.max(-(v.plafondDeficit ?? 10700), brut);
  const baseBIC = (v.loyer ?? 0) * (1 - (v.abtBIC ?? 50) / 100);
  const baseAmorti = Math.max(0, brut - amo);

  const impotIS =
    Math.min(baseAmorti, v.isSeuil ?? 42500) * ((v.isReduit ?? 15) / 100) +
    Math.max(0, baseAmorti - (v.isSeuil ?? 42500)) * ((v.isNormal ?? 25) / 100);

  return [
    { nom: "Micro-foncier", net: brut - Math.max(0, baseMF) * tauxIR },
    // Un déficit s'impute sur le revenu global au seul taux de l'IR : les
    // prélèvements sociaux ne créent pas d'économie sur un résultat négatif.
    { nom: "Réel foncier", net: brut - (baseReel < 0 ? baseReel * ((v.tmi ?? 0) / 100) : baseReel * tauxIR) },
    { nom: "LMNP micro-BIC", net: brut - Math.max(0, baseBIC) * tauxIR },
    { nom: "LMNP au réel", net: brut - baseAmorti * tauxIR },
    { nom: "SCI à l'IS", net: brut - impotIS },
  ];
}
function meilleurRegime(v: Record<string, number>): { nom: string; net: number } {
  return regimes(v).reduce((a, b) => (b.net > a.net ? b : a));
}

/* -------------------------------------------------------------------------- */

const avisDeValeur: ToolSpec = {
  id: "avis-de-valeur",
  title: "Avis de valeur par comparaison",
  intro:
    "Des ventes comparables réelles, des ajustements explicites et signés, une fourchette défendable devant un vendeur.",
  sections: [
    {
      title: "Le bien à évaluer",
      fields: [
        {
          id: "dateRef",
          label: "Date de l'avis",
          value: 1788609600000,
          unit: "date",
          hint: "Les ventes plus anciennes sont ramenées à cette date par le coefficient de dérive du marché.",
        },
        { id: "surface", label: "Surface habitable", value: 75, unit: "m2", min: 5 },
        {
          id: "etatRef",
          label: "État du bien",
          value: "3",
          options: [
            { value: "1", label: "À rénover entièrement" },
            { value: "2", label: "À rafraîchir" },
            { value: "3", label: "Bon état" },
            { value: "4", label: "Refait à neuf" },
          ],
        },
        { id: "etageRef", label: "Étage", value: 2, unit: "nombre", min: -2, max: 40 },
        {
          id: "extRef",
          label: "Extérieur",
          value: "1",
          options: [
            { value: "0", label: "Aucun" },
            { value: "1", label: "Balcon, terrasse ou jardin" },
          ],
        },
        {
          id: "dpeRef",
          label: "Étiquette DPE",
          value: "4",
          options: [
            { value: "1", label: "A" },
            { value: "2", label: "B" },
            { value: "3", label: "C" },
            { value: "4", label: "D" },
            { value: "5", label: "E" },
            { value: "6", label: "F" },
            { value: "7", label: "G" },
          ],
        },
        {
          id: "parkRef",
          label: "Stationnement",
          value: "0",
          options: [
            { value: "0", label: "Aucun" },
            { value: "1", label: "Place ou garage" },
          ],
        },
      ],
    },
  ],
  tables: [
    {
      id: "comparables",
      title: "Les ventes comparables",
      hint:
        "Une ligne par vente réelle. Chacune est corrigée pour être rendue SEMBLABLE au bien évalué : si le comparable est mieux placé ou en meilleur état, son prix est tiré vers le bas. Cinq ventes retenues minimum, sinon aucune valeur n'est produite.",
      addLabel: "Ajouter une vente",
      min: 1,
      extraLabel: "Vente",
      columns: [
        { id: "prix", label: "Prix de vente (€)", short: "Prix", value: 300000, unit: "eur" },
        { id: "surface", label: "Surface (m²)", short: "Surface", value: 70, unit: "m2" },
        { id: "date", label: "Date de vente", short: "Date", value: 1770292800000, unit: "date" },
        { id: "etat", label: "État (1 à rénover … 4 refait)", short: "État", value: 3, unit: "nombre" },
        { id: "etage", label: "Étage", short: "Étage", value: 2, unit: "nombre" },
        { id: "ext", label: "Extérieur (0 non, 1 oui)", short: "Extérieur", value: 0, unit: "nombre" },
        { id: "dpe", label: "DPE (1 = A … 7 = G)", short: "DPE", value: 4, unit: "nombre" },
        { id: "park", label: "Stationnement (0 non, 1 oui)", short: "Parking", value: 0, unit: "nombre" },
      ],
      rows: [
        [318000, 72, 1773057600000, 3, 3, 1, 4, 1],
        [349000, 78, 1764676800000, 4, 1, 1, 3, 1],
        [289000, 68, 1769040000000, 2, 4, 0, 5, 0],
        [372000, 81, 1778025600000, 3, 2, 1, 3, 1],
        [275000, 65, 1760788800000, 1, 5, 0, 6, 0],
        [331000, 74, 1772020800000, 3, 3, 1, 4, 1],
      ],
    },
  ],
  params: [
    { id: "cEtat", label: "Écart d'un cran d'état", value: 6, unit: "pct" },
    { id: "cEtage", label: "Écart d'un étage", value: 1.2, unit: "pct" },
    { id: "cExt", label: "Présence d'un extérieur", value: 5, unit: "pct" },
    {
      id: "cDpe",
      label: "Écart d'une lettre de DPE",
      value: 2.5,
      unit: "pct",
      hint: "Se creuse fortement sous E depuis les interdictions de location.",
    },
    { id: "cParking", label: "Présence d'un stationnement", value: 4, unit: "pct" },
    {
      id: "cDerive",
      label: "Dérive du marché, par mois",
      value: 0.15,
      unit: "pct",
      hint: "Positive en marché haussier, négative en marché baissier.",
    },
    {
      id: "ajustMax",
      label: "Ajustement total maximal admis",
      value: 25,
      unit: "pct",
      hint: "Au-delà, le bien n'est pas comparable : la vente est écartée.",
    },
    { id: "minComp", label: "Nombre minimal de ventes retenues", value: 5, unit: "nombre" },
    { id: "fourchette", label: "Demi-fourchette affichée", value: 5, unit: "pct" },
  ],
  headlines: [
    {
      label: "Valeur retenue",
      unit: "eur",
      compute: (v, c, t) => {
        const r = evaluer(v, c, t);
        return r.retenus < (v.minComp ?? 5) ? "Comparables insuffisants" : r.valeur;
      },
      caption: (v, c, t) => {
        const r = evaluer(v, c, t);
        if (r.retenus < (v.minComp ?? 5)) {
          return `${r.retenus} vente${r.retenus > 1 ? "s" : ""} retenue${r.retenus > 1 ? "s" : ""} sur ${r.total} : il en faut ${v.minComp ?? 5}. Élargissez la recherche plutôt que de conclure.`;
        }
        const d = (v.fourchette ?? 5) / 100;
        return `Fourchette à présenter : ${fr(r.valeur * (1 - d))} € à ${fr(r.valeur * (1 + d))} €.`;
      },
    },
  ],
  outputs: [
    { id: "total", label: "Ventes saisies", unit: "nombre", compute: (v, c, t) => evaluer(v, c, t).total },
    {
      id: "retenus",
      label: "Ventes retenues",
      unit: "nombre",
      compute: (v, c, t) => evaluer(v, c, t).retenus,
      strong: true,
      hint: "Une vente dont l'ajustement dépasse le plafond est écartée : trop corrigée, elle n'est plus comparable.",
    },
    {
      id: "m2",
      label: "Prix au m² retenu",
      unit: "eurm2",
      compute: (v, c, t) => evaluer(v, c, t).prixM2,
      strong: true,
    },
    {
      id: "dispersion",
      label: "Écart entre la vente la moins chère et la plus chère",
      unit: "pct",
      compute: (v, c, t) => evaluer(v, c, t).dispersion,
      hint: "Au-delà de 25 %, vos comparables ne décrivent pas le même marché.",
    },
    {
      id: "bas",
      label: "Bas de fourchette",
      unit: "eur",
      compute: (v, c, t) => evaluer(v, c, t).valeur * (1 - (v.fourchette ?? 5) / 100),
    },
    {
      id: "haut",
      label: "Haut de fourchette",
      unit: "eur",
      compute: (v, c, t) => evaluer(v, c, t).valeur * (1 + (v.fourchette ?? 5) / 100),
    },
  ],
  caveat:
    "Présentez la fourchette, jamais la valeur centrale seule : un prix unique devient le plancher de la négociation dans la tête du vendeur. Aucune grille ne voit une vue, un vis-à-vis ou une nuisance, et ceci n'est pas une expertise au sens de la charte de l'expertise en évaluation immobilière.",
};

/**
 * Corrige chaque vente pour la rendre SEMBLABLE au bien évalué, puis moyenne
 * les prix au m² ajustés.
 *
 * Le sens des ajustements est la faute classique du métier : on corrige le
 * COMPARABLE, pas le bien. Un comparable en meilleur état s'est vendu plus cher
 * pour cette raison — on tire donc son prix vers le bas. Inverser le signe
 * double l'écart au lieu de l'annuler.
 */
function evaluer(
  v: Record<string, number>,
  c: Record<string, string>,
  t: Record<string, number[][]>,
): { total: number; retenus: number; prixM2: number; valeur: number; dispersion: number } {
  const lignes = t.comparables ?? [];
  const mois = 30.44 * 24 * 3600 * 1000;

  const ajustes: number[] = [];
  for (const r of lignes) {
    const [prix = 0, surface = 0, date = 0, etat = 0, etage = 0, ext = 0, dpe = 0, park = 0] = r;
    if (prix <= 0 || surface <= 0) continue;

    const ecartMois = ((v.dateRef ?? 0) - date) / mois;
    const ajustement =
      (Number(c.etatRef ?? "3") - etat) * (v.cEtat ?? 6) +
      ((v.etageRef ?? 0) - etage) * (v.cEtage ?? 1.2) +
      (Number(c.extRef ?? "0") - ext) * (v.cExt ?? 5) +
      // Le DPE se soustrait à l'envers : un rang plus élevé est une moins bonne
      // étiquette, donc un prix plus bas, à corriger vers le haut.
      (dpe - Number(c.dpeRef ?? "4")) * (v.cDpe ?? 2.5) +
      (Number(c.parkRef ?? "0") - park) * (v.cParking ?? 4) +
      ecartMois * (v.cDerive ?? 0.15);

    if (Math.abs(ajustement) > (v.ajustMax ?? 25)) continue;
    ajustes.push(ratio(prix, surface) * (1 + ajustement / 100));
  }

  const prixM2 = ajustes.length === 0 ? 0 : ajustes.reduce((a, b) => a + b, 0) / ajustes.length;
  const dispersion =
    ajustes.length < 2 ? 0 : ratio(Math.max(...ajustes) - Math.min(...ajustes), prixM2) * 100;

  return {
    total: lignes.length,
    retenus: ajustes.length,
    prixM2,
    valeur: prixM2 * (v.surface ?? 0),
    dispersion,
  };
}

/* -------------------------------------------------------------------------- */

const netVendeur: ToolSpec = {
  id: "net-vendeur",
  title: "Net vendeur",
  intro:
    "Du prix affiché au virement du notaire : honoraires, solde de prêt et impôt de plus-value.",
  sections: [
    {
      title: "La vente",
      fields: [
        { id: "prix", label: "Prix affiché, honoraires inclus", value: 385000, unit: "eur", hint: "Le prix inscrit à l'acte, hors frais. C'est la base de tout le reste : le majorer « pour arrondir » fausse les trois rendements." },
        { id: "honoraires", label: "Honoraires d'agence", value: 4.5, unit: "pct", hint: "En % du prix net vendeur.", step: 0.1 },
        {
          id: "charge",
          label: "Honoraires à la charge de",
          value: "acquereur",
          options: [
            { value: "acquereur", label: "L'acquéreur" },
            { value: "vendeur", label: "Le vendeur" },
          ],
        },
        { id: "crd", label: "Capital restant dû du prêt", value: 148000, unit: "eur", hint: "Le capital restant dû au jour de la vente, pas le montant emprunté à l'origine. Votre banque le fournit sur demande." },
        { id: "ira", label: "Indemnité de remboursement anticipé", value: 2200, unit: "eur", hint: "Plafonnée à 6 mois d'intérêts et à 3 % du capital restant dû." },
        { id: "diag", label: "Diagnostics et frais divers", value: 750, unit: "eur" },
      ],
    },
    {
      title: "L'acquisition d'origine",
      fields: [
        { id: "achat", label: "Prix d'achat d'origine", value: 268000, unit: "eur" },
        { id: "detention", label: "Durée de détention", value: 13, unit: "an", min: 0, max: 40, hint: "Comptée en années pleines depuis l'acte d'achat. Les abattements ne démarrent qu'après la cinquième année." },
        { id: "travaux", label: "Travaux justifiés sur factures", value: 24000, unit: "eur", hint: "Le budget TTC, provision pour aléas comprise. Notre chiffrage de travaux par lot le calcule poste par poste." },
        {
          id: "rp",
          label: "S'agit-il de la résidence principale ?",
          value: "non",
          options: [
            { value: "non", label: "Non" },
            { value: "oui", label: "Oui, plus-value exonérée" },
          ],
        },
      ],
    },
  ],
  params: [
    { id: "tauxIR", label: "Impôt sur la plus-value", value: 19, unit: "pct" },
    { id: "tauxPS", label: "Prélèvements sociaux sur la plus-value", value: 17.2, unit: "pct" },
    { id: "exoIR", label: "Exonération totale, impôt", value: 22, unit: "an" },
    { id: "exoPS", label: "Exonération totale, prélèvements sociaux", value: 30, unit: "an" },
    { id: "forfaitTravaux", label: "Forfait travaux au-delà de 5 ans", value: 15, unit: "pct" },
    { id: "forfaitFrais", label: "Forfait frais d'acquisition", value: 7.5, unit: "pct" },
  ],
  headlines: [
    {
      label: "Net en poche pour le vendeur",
      unit: "eur",
      compute: (v, c) => netEnPoche(v, c),
      caption: (v, c) =>
        `Soit ${(ratio(netEnPoche(v, c), v.prix ?? 0) * 100).toFixed(0)} % du prix affiché.`,
    },
  ],
  outputs: [
    { id: "hono", label: "Honoraires d'agence TTC", unit: "eur", compute: (v, c) => honoraires(v, c), strong: true },
    { id: "netVente", label: "Prix net vendeur", unit: "eur", compute: (v, c) => (v.prix ?? 0) - honoraires(v, c), strong: true },
    { id: "acqMaj", label: "Prix d'acquisition majoré", unit: "eur", compute: (v) => acquisitionMajoree(v), hint: "Forfait de frais, et le plus favorable du réel ou du forfait travaux." },
    { id: "pvBrute", label: "Plus-value brute", unit: "eur", compute: (v, c) => Math.max(0, (v.prix ?? 0) - honoraires(v, c) - acquisitionMajoree(v)) },
    { id: "abtIR", label: "Abattement, impôt", unit: "pct", compute: (v) => abattement(v.detention ?? 0, v.exoIR ?? 22) },
    { id: "abtPS", label: "Abattement, prélèvements sociaux", unit: "pct", compute: (v) => abattement(v.detention ?? 0, v.exoPS ?? 30) },
    { id: "impot", label: "Impôt de plus-value", unit: "eur", compute: (v, c) => impotPlusValue(v, c), strong: true },
  ],
  caveat:
    "Les abattements réels sont progressifs par paliers annuels ; ce calcul les approxime linéairement. Il ignore la surtaxe sur les plus-values élevées et les exonérations particulières. Le calcul qui fait foi est celui du notaire : ce chiffre sert à annoncer un ordre de grandeur en rendez-vous.",
};

function honoraires(v: Record<string, number>, c: Record<string, string>): number {
  const prix = v.prix ?? 0;
  const taux = (v.honoraires ?? 0) / 100;
  // Honoraires à la charge de l'acquéreur : le prix affiché les CONTIENT, donc
  // on divise. Les soustraire directement est l'erreur qui décale le calcul de
  // plusieurs centaines d'euros.
  return c.charge === "acquereur" ? prix - prix / (1 + taux) : prix * taux;
}
function acquisitionMajoree(v: Record<string, number>): number {
  const achat = v.achat ?? 0;
  const forfait = (v.detention ?? 0) >= 5 ? (achat * (v.forfaitTravaux ?? 15)) / 100 : 0;
  return achat * (1 + (v.forfaitFrais ?? 7.5) / 100) + Math.max(v.travaux ?? 0, forfait);
}
function abattement(detention: number, seuil: number): number {
  if (detention <= 5) return 0;
  return Math.min(100, ((detention - 5) / (seuil - 5)) * 100);
}
function impotPlusValue(v: Record<string, number>, c: Record<string, string>): number {
  if (c.rp === "oui") return 0;
  const pv = Math.max(0, (v.prix ?? 0) - honoraires(v, c) - acquisitionMajoree(v));
  return (
    (pv * (1 - abattement(v.detention ?? 0, v.exoIR ?? 22) / 100) * (v.tauxIR ?? 19)) / 100 +
    (pv * (1 - abattement(v.detention ?? 0, v.exoPS ?? 30) / 100) * (v.tauxPS ?? 17.2)) / 100
  );
}
function netEnPoche(v: Record<string, number>, c: Record<string, string>): number {
  return (
    (v.prix ?? 0) - honoraires(v, c) - (v.crd ?? 0) - (v.ira ?? 0) - (v.diag ?? 0) -
    impotPlusValue(v, c)
  );
}

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

const wault: ToolSpec = {
  id: "wault",
  title: "WAULT et durée ferme d'un portefeuille",
  intro:
    "La durée moyenne pondérée des baux, et ce qu'elle vaut vraiment une fois la concentration prise en compte.",
  sections: [
    {
      title: "Le portefeuille",
      fields: [
        {
          id: "dateRef",
          label: "Date d'analyse",
          // 1er septembre 2026, à midi UTC. Une date d'analyse n'est pas
          // forcément aujourd'hui : on valorise souvent à une date d'arrêté,
          // de closing ou de fin d'exercice.
          value: 1788609600000,
          unit: "date",
          hint: "Toutes les durées sont comptées à partir de cette date. Mettez la date d'arrêté ou de closing, pas forcément aujourd'hui.",
        },
        { id: "surfaceTotale", label: "Surface totale", value: 1450, unit: "m2", min: 1 },
        {
          id: "surfaceLouee",
          label: "Surface louée",
          value: 1310,
          unit: "m2",
          min: 0,
          hint: "Somme des surfaces occupées. L'écart avec la surface totale donne la vacance physique.",
        },
      ],
    },
  ],
  tables: [
    {
      id: "baux",
      title: "L'état locatif",
      hint:
        "Une ligne par bail, autant que nécessaire. La durée jusqu'au terme est celle du bail ; celle jusqu'à la sortie est la prochaine échéance triennale, et c'est elle qui porte le risque.",
      addLabel: "Ajouter un bail",
      min: 1,
      extraLabel: "Bail",
      columns: [
        { id: "loyer", label: "Loyer annuel (€)", short: "Loyer annuel", value: 60000, unit: "eur" },
        {
          id: "terme",
          label: "Échéance du bail",
          short: "Échéance",
          value: 1978300800000,
          unit: "date",
        },
        {
          id: "sortie",
          label: "Prochaine faculté de sortie",
          short: "Prochaine sortie",
          value: 1883304000000,
          unit: "date",
        },
      ],
      // Horodatages à midi UTC. Échéances au 30/06/2032, 31/12/2030,
      // 31/03/2031 ; sorties triennales au 30/06/2029, 31/12/2027, 31/03/2028.
      rows: [
        [119700, 1972648800000, 1877904000000],
        [85250, 1924948800000, 1830384000000],
        [75600, 1932897600000, 1838332800000],
      ],
    },
  ],
  params: [],
  headlines: [
    {
      label: "WAULB, durée ferme moyenne",
      unit: "annees",
      compute: (v, c, t) => pondere(t.baux, 2, v.dateRef ?? 0),
      caption: (v, c, t) => {
        const b = pondere(t.baux, 2, v.dateRef ?? 0);
        const terme = pondere(t.baux, 1, v.dateRef ?? 0);
        return `Le WAULT jusqu'au terme affiche ${terme.toFixed(2)} ans, soit ${(terme - b).toFixed(2)} ans de plus. C'est le WAULB que retient un investisseur.`;
      },
    },
  ],
  outputs: [
    {
      id: "nbBaux",
      label: "Nombre de baux",
      unit: "nombre",
      compute: (v, c, t) => (t.baux ?? []).length,
    },
    {
      id: "loyerTotal",
      label: "Loyer annuel en place",
      unit: "eur",
      compute: (v, c, t) => totalLoyer(t.baux),
      strong: true,
    },
    {
      id: "wault",
      label: "WAULT, jusqu'au terme des baux",
      unit: "annees",
      compute: (v, c, t) => pondere(t.baux, 1, v.dateRef ?? 0),
    },
    {
      id: "waulb",
      label: "WAULB, jusqu'à la prochaine sortie",
      unit: "annees",
      compute: (v, c, t) => pondere(t.baux, 2, v.dateRef ?? 0),
      strong: true,
    },
    {
      id: "occupation",
      label: "Taux d'occupation physique",
      unit: "pct",
      compute: (v) => ratio(v.surfaceLouee ?? 0, v.surfaceTotale ?? 0) * 100,
    },
    {
      id: "dominant",
      label: "Poids du premier locataire",
      unit: "pct",
      compute: (v, c, t) => {
        const loyers = (t.baux ?? []).map((r) => r[0] ?? 0);
        return loyers.length === 0 ? 0 : ratio(Math.max(...loyers), totalLoyer(t.baux)) * 100;
      },
      strong: true,
      hint: "Au-delà de 40 %, l'immeuble n'est plus un actif : c'est un pari sur une signature.",
    },
    {
      id: "sousDeuxAns",
      label: "Part du loyer dont la sortie tombe sous deux ans",
      unit: "pct",
      compute: (v, c, t) => {
        const proche = (t.baux ?? [])
          .filter((r) => anneesEntre(v.dateRef ?? 0, r[2] ?? 0) < 2)
          .reduce((somme, r) => somme + (r[0] ?? 0), 0);
        return ratio(proche, totalLoyer(t.baux)) * 100;
      },
      hint: "Un WAULB confortable peut masquer une échéance massive : c'est la concentration qui inquiète un banquier.",
    },
    {
      id: "loyerM2",
      label: "Loyer moyen au m² loué",
      unit: "eurm2",
      compute: (v, c, t) => ratio(totalLoyer(t.baux), v.surfaceLouee ?? 0),
    },
  ],
  caveat:
    "Le calcul ne juge pas la qualité de signature des locataires et ne compare pas le loyer en place au loyer de marché : une réversion négative ampute la valeur à l'échéance. Le modèle Excel ajoute l'échéancier année par année et les dates réelles.",
};

function totalLoyer(baux: number[][] | undefined): number {
  return (baux ?? []).reduce((somme, r) => somme + (r[0] ?? 0), 0);
}

/**
 * Moyenne des durées PONDÉRÉE PAR LE LOYER, jamais par la surface : c'est le
 * loyer qui paie la dette, pas les mètres carrés. `colonne` vaut 1 pour le
 * terme du bail, 2 pour la prochaine faculté de sortie.
 */
function pondere(
  baux: number[][] | undefined,
  colonne: 1 | 2,
  dateRef: number,
): number {
  const lignes = baux ?? [];
  const somme = lignes.reduce(
    (acc, r) => acc + (r[0] ?? 0) * anneesEntre(dateRef, r[colonne] ?? 0),
    0,
  );
  return ratio(somme, totalLoyer(lignes));
}

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
