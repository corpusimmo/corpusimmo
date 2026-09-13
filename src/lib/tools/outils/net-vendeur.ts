/**
 * NET VENDEUR, HONORAIRES ET QUALIFICATION DU MANDAT — la version en ligne de
 * `public/outils/matrices/net-vendeur-honoraires-et-qualification.xlsx`,
 * onglets « Net vendeur » et « Qualifier le mandat ».
 *
 * DU PRIX AFFICHÉ AU VIREMENT DU NOTAIRE. Un vendeur compare son estimation au
 * prix de l'annonce, puis découvre à la signature qu'il touche un tiers de
 * moins : honoraires, solde du prêt et son indemnité, diagnostics, et l'impôt
 * de plus-value que le notaire retient sur le prix. Le classeur les déroule
 * dans cet ordre, la page aussi.
 *
 * Ce que la matrice révisée ajoute à la version précédente :
 *   · la durée de détention calculée DE DATE À DATE, jour pour jour — c'est
 *     elle qui décide des abattements et du forfait travaux, et une année
 *     ronde se trompe d'un palier une fois sur deux ;
 *   · le mode d'acquisition, qui ferme le forfait de frais à une succession ou
 *     une donation ;
 *   · le forfait travaux de 15 %, ou les travaux réels, ou rien ;
 *   · la surtaxe sur les plus-values élevées, nulle pour un terrain à bâtir ;
 *   · les exonérations dans l'ordre où le code les examine ;
 *   · le plafond légal de l'indemnité de remboursement anticipé ;
 *   · la grille de qualification du mandat, avec son critère éliminatoire.
 */

import { fromISODate, ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;
type T = Record<string, number[][]>;

export const CHARGE_ACQUEREUR = "Acquéreur";
export const CHARGE_VENDEUR = "Vendeur";
export const LOGEMENT = "Logement ou immeuble bâti";
export const TERRAIN = "Terrain à bâtir";
export const MODES = ["Achat (à titre onéreux)", "Succession", "Donation"] as const;
export const FRAIS_FORFAIT = "Forfait de 7,5 %";
export const FRAIS_REELS = "Frais réels justifiés";
export const TRAVAUX_FORFAIT = "Forfait de 15 %";
export const TRAVAUX_REELS = "Travaux réels justifiés";
export const TRAVAUX_AUCUN = "Aucun travaux";
export const CAS = [
  "Aucun",
  "Démembrement de propriété",
  "Bien détenu par une société",
  "Bien situé à l'étranger",
  "Cession de parts de société",
] as const;

/** Paramètres!B19:D49 : abattements par années révolues, de 0 à 30. */
const ABT_IR = [0, 0, 0, 0, 0, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 100, 100, 100, 100, 100, 100, 100, 100, 100];
const ABT_PS = [0, 0, 0, 0, 0, 0, 1.65, 3.3, 4.95, 6.6, 8.25, 9.9, 11.55, 13.2, 14.85, 16.5, 18.15, 19.8, 21.45, 23.1, 24.75, 26.4, 28, 37, 46, 55, 64, 73, 82, 91, 100];

/** Paramètres!B53:E62. */
const SURTAXE: [number, number, number, number][] = [
  [50000, 0.02, 0.05, 60000], [60000, 0.02, 0, 0], [100000, 0.03, 0.1, 110000], [110000, 0.03, 0, 0],
  [150000, 0.04, 0.15, 160000], [160000, 0.04, 0, 0], [200000, 0.05, 0.2, 210000], [210000, 0.05, 0, 0],
  [250000, 0.06, 0.25, 260000], [260000, 0.06, 0, 0],
];

export const EXONERATIONS = {
  rp: "Exonération totale : résidence principale au jour de la vente",
  social: "Exonération totale : cession à un organisme de logement social",
  premiere: "Exonération totale : première cession d'un logement autre que la résidence principale",
  petite: "Exonération totale : prix de cession sous le seuil des petites cessions",
  trente: "Exonération totale : plus de trente ans de détention",
  vingtDeux: "Exonération d'impôt sur le revenu seulement : plus de vingt-deux ans de détention",
  aucune: "Aucune exonération : la plus-value est imposable",
} as const;

const TOTALES: string[] = [EXONERATIONS.rp, EXONERATIONS.social, EXONERATIONS.premiere, EXONERATIONS.petite];

const p = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

/* ── La vente (C7:C12) ───────────────────────────────────────────────────── */

/** C10 : charge acquéreur, les honoraires sont DANS le prix affiché. */
export function honoraires(v: V, c: C): number {
  const prix = v.prixAffiche ?? 0;
  const taux = p(v.tauxHonoraires, 4.5);
  return c.charge === CHARGE_ACQUEREUR ? prix - prix / (1 + taux) : prix * taux;
}

export function prixNetVendeur(v: V, c: C): number {
  return (v.prixAffiche ?? 0) - honoraires(v, c);
}

/* ── Le prêt (C15:C21) ───────────────────────────────────────────────────── */

/** C17 : le plus faible des deux plafonds du code de la consommation. */
export function plafondIndemnite(v: V): number {
  const crd = v.restantDu ?? 0;
  const taux = p(v.tauxPret, 3.2);
  const partCapital = crd * p(v.iraPart, 3);
  return taux > 0 ? Math.min(partCapital, (crd * taux * (v.iraMois ?? 6)) / 12) : partCapital;
}

/* ── Le bien (C24:C34) ───────────────────────────────────────────────────── */

/** C29 : années révolues, de date à date. */
export function dureeDetention(v: V): number {
  const a = new Date(v.dateAcquisition ?? 0);
  const b = new Date(v.dateVente ?? 0);
  let annees = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) {
    annees -= 1;
  }
  return annees;
}

/**
 * C46 : le forfait travaux exige un immeuble bâti détenu STRICTEMENT plus de
 * cinq ans : à cinq ans jour pour jour il n'est pas acquis, il l'est le
 * lendemain. EDATE avance de soixante mois en gardant le jour.
 */
function forfaitTravauxOuvert(v: V, c: C): boolean {
  if (c.nature !== LOGEMENT) return false;
  const acquisition = new Date(v.dateAcquisition ?? 0);
  const seuil = Date.UTC(
    acquisition.getUTCFullYear() + (v.dureeForfaitTravaux ?? 5),
    acquisition.getUTCMonth(),
    acquisition.getUTCDate(),
    12,
  );
  return (v.dateVente ?? 0) > seuil;
}

/** C12, C21, C34, C42, et le cas particulier : le contrôle global C65. */
export function saisiesCoherentes(v: V, c: C): boolean {
  const tauxHon = v.tauxHonoraires ?? 0;
  const tauxPret = v.tauxPret ?? 0;
  const plancher = v.plancherTaux ?? 0.1;
  const vente =
    (v.prixAffiche ?? 0) > 0 &&
    tauxHon >= 0 && tauxHon <= 15 &&
    (tauxHon <= 0 || tauxHon >= plancher) &&
    (c.charge === CHARGE_ACQUEREUR || c.charge === CHARGE_VENDEUR);
  const pret =
    (v.restantDu ?? 0) >= 0 &&
    tauxPret >= 0 && tauxPret <= 20 &&
    (tauxPret <= 0 || tauxPret >= plancher) &&
    (v.indemnite ?? 0) >= 0 &&
    (v.indemnite ?? 0) <= plafondIndemnite(v) &&
    (v.diagnostics ?? 0) >= 0 &&
    (v.autresFrais ?? 0) >= 0;
  const bien =
    (v.prixAcquisition ?? 0) > 0 &&
    (v.dateVente ?? 0) >= (v.dateAcquisition ?? 0) &&
    (c.fraisRetenus !== FRAIS_FORFAIT || c.mode === MODES[0]) &&
    (c.travauxRetenus !== TRAVAUX_FORFAIT || forfaitTravauxOuvert(v, c));
  const exonerations = c.cas === CAS[0] && !(c.residencePrincipale === "Oui" && c.premiereCession === "Oui");
  return vente && pret && bien && exonerations;
}

/* ── La plus-value (C45:C59) ─────────────────────────────────────────────── */

export function prixAcquisitionMajore(v: V, c: C): number {
  const prix = v.prixAcquisition ?? 0;
  const frais = c.fraisRetenus === FRAIS_FORFAIT ? prix * p(v.forfaitFrais, 7.5) : (v.fraisReels ?? 0);
  const travaux =
    c.travauxRetenus === TRAVAUX_FORFAIT
      ? forfaitTravauxOuvert(v, c) ? prix * p(v.forfaitTravaux, 15) : 0
      : c.travauxRetenus === TRAVAUX_REELS ? (v.travauxReels ?? 0) : 0;
  return prix + frais + travaux;
}

export function plusValueBrute(v: V, c: C): number {
  return Math.max(0, prixNetVendeur(v, c) - prixAcquisitionMajore(v, c));
}

const abattement = (table: number[], v: V) => (table[Math.min(Math.max(dureeDetention(v), 0), 30)] ?? 100) / 100;

/** C51 : dans l'ordre où le code les examine. */
export function exoneration(v: V, c: C): string {
  if (c.residencePrincipale === "Oui") return EXONERATIONS.rp;
  if (c.social === "Oui") return EXONERATIONS.social;
  if (c.premiereCession === "Oui") return EXONERATIONS.premiere;
  if ((v.prixAffiche ?? 0) <= (v.seuilPetitesCessions ?? 15000)) return EXONERATIONS.petite;
  const ir = abattement(ABT_IR, v);
  const ps = abattement(ABT_PS, v);
  if (ir >= 1 && ps >= 1) return EXONERATIONS.trente;
  if (ir >= 1) return EXONERATIONS.vingtDeux;
  return EXONERATIONS.aucune;
}

function baseIr(v: V, c: C): number {
  return TOTALES.includes(exoneration(v, c)) ? 0 : plusValueBrute(v, c) * (1 - abattement(ABT_IR, v));
}

function basePs(v: V, c: C): number {
  return TOTALES.includes(exoneration(v, c)) ? 0 : plusValueBrute(v, c) * (1 - abattement(ABT_PS, v));
}

function surtaxe(v: V, c: C): number {
  const base = baseIr(v, c);
  if (c.nature === TERRAIN || base <= SURTAXE[0]![0]) return 0;
  let ligne = SURTAXE[0]!;
  for (const t of SURTAXE) if (t[0] <= base) ligne = t;
  const [, taux, coef, borne] = ligne;
  return taux * base - coef * Math.max(0, borne - base);
}

export function impotPlusValue(v: V, c: C): number {
  return baseIr(v, c) * p(v.irPlusValue, 19) + basePs(v, c) * p(v.psPlusValue, 17.2) + surtaxe(v, c);
}

/** C62. */
export function netEnPoche(v: V, c: C): number {
  return (
    prixNetVendeur(v, c) -
    (v.restantDu ?? 0) -
    (v.indemnite ?? 0) -
    (v.diagnostics ?? 0) -
    (v.autresFrais ?? 0) -
    impotPlusValue(v, c)
  );
}

/** Les sorties vides tant que le contrôle global est rouge, comme le classeur. */
const siValide = (f: (v: V, c: C) => number) => (v: V, c: C) => (saisiesCoherentes(v, c) ? f(v, c) : Number.NaN);

/* ── Qualifier le mandat ─────────────────────────────────────────────────── */

export const CRITERES = [
  "Le vendeur est-il vraiment décidé à vendre ?",
  "Son prix espéré est-il compatible avec le marché ?",
  "L'échéance est-elle datée et contrainte ?",
  "Le bien est-il présentable en l'état ?",
  "Le titre et les diagnostics sont-ils prêts ?",
  "Le mandat est-il exclusif ?",
  "Les signatures nécessaires sont-elles réunies ?",
  "Le bien correspond-il à votre fichier acquéreurs ?",
];

const VERDICTS: [seuil: number, texte: string][] = [
  [0, "Passez votre chemin : ce mandat coûtera plus qu'il ne rapporte"],
  [40, "Mandat à risque : exigez l'exclusivité et une baisse de prix datée"],
  [55, "Prenez-le, mais négociez le prix avant de signer"],
  [75, "Prenez-le, et en exclusivité"],
];

export function scoreMandat(t: T, v: V): number {
  const lignes = t.criteres ?? [];
  const total = lignes.reduce((s, [note = 0, poids = 0]) => s + note * poids, 0);
  const maximum = lignes.reduce((s, [, poids = 0]) => s + poids, 0) * (v.noteMax ?? 5);
  return ratio(total, maximum) * 100;
}

export function verdictMandat(t: T, v: V): string {
  if ((v.ecartPrix ?? 0) > (v.ecartEliminatoire ?? 15)) {
    return "Éliminatoire : reprenez le prix avant de parler de mandat";
  }
  const score = scoreMandat(t, v);
  let verdict = VERDICTS[0]![1];
  for (const [seuil, texte] of VERDICTS) if (score >= seuil) verdict = texte;
  return verdict;
}

/* ── La spécification ────────────────────────────────────────────────────── */

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const oui = [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }];
const liste = (valeurs: readonly string[]) => valeurs.map((x) => ({ value: x, label: x }));

export const netVendeur: ToolSpec = {
  id: "net-vendeur",
  title: "Net vendeur et qualification du mandat",
  intro:
    "Du prix affiché au virement du notaire, impôt de plus-value compris. Puis la grille qui dit si le mandat vaut le coup.",
  sections: [
    {
      title: "La vente",
      fields: [
        { id: "prixAffiche", label: "Prix affiché dans l'annonce", value: 385000, unit: "eur", min: 0, hint: "Honoraires inclus quand ils sont à la charge de l'acquéreur, exclus quand ils sont à la charge du vendeur." },
        { id: "tauxHonoraires", label: "Taux d'honoraires d'agence TTC", value: 4.5, unit: "pct", min: 0, max: 15, step: 0.1, hint: "Fourchette usuelle : 3 à 7 %. Les gros montants se négocient." },
        { id: "charge", label: "Honoraires à la charge de", value: CHARGE_ACQUEREUR, options: liste([CHARGE_ACQUEREUR, CHARGE_VENDEUR]) },
      ],
    },
    {
      title: "Le prêt en cours et les frais de la vente",
      fields: [
        { id: "restantDu", label: "Capital restant dû du prêt", value: 148000, unit: "eur", min: 0, hint: "Ce que la banque réclamera le jour de la vente. 0 s'il n'y a plus de prêt." },
        { id: "tauxPret", label: "Taux nominal du prêt en cours", value: 3.2, unit: "pct", min: 0, max: 20, step: 0.05, hint: "Sert au plafond légal de l'indemnité. 0 si vous ne le connaissez pas." },
        { id: "indemnite", label: "Indemnité de remboursement anticipé réclamée", value: 2200, unit: "eur", min: 0, hint: "Ne peut pas dépasser le plus faible de six mois d'intérêts et 3 % du capital restant dû. Aucune n'est due en cas de mutation professionnelle, de décès ou de cessation forcée d'activité." },
        { id: "diagnostics", label: "Dossier de diagnostic technique", value: 750, unit: "eur", min: 0, hint: "300 à 800 € selon la surface et l'âge du bien." },
        { id: "autresFrais", label: "Mainlevée, état daté et autres frais", value: 700, unit: "eur", min: 0 },
      ],
    },
    {
      title: "Le bien et son acquisition d'origine",
      fields: [
        { id: "nature", label: "Nature du bien vendu", value: LOGEMENT, options: liste([LOGEMENT, TERRAIN]), hint: "Un terrain à bâtir n'ouvre droit ni au forfait travaux, ni à la surtaxe." },
        { id: "mode", label: "Comment le bien a été acquis", value: MODES[0], options: liste(MODES) },
        { id: "prixAcquisition", label: "Prix d'acquisition, ou valeur retenue pour les droits", value: 268000, unit: "eur", min: 0, hint: "Succession ou donation : la valeur qui a servi de base aux droits de mutation." },
        { id: "dateAcquisition", label: "Date d'acquisition", value: fromISODate("2013-09-20"), unit: "date", hint: "Date de l'acte, du décès pour une succession." },
        { id: "dateVente", label: "Date de la vente", value: fromISODate("2026-09-04"), unit: "date", hint: "Elle fixe la durée de détention, jour pour jour." },
        { id: "fraisRetenus", label: "Frais d'acquisition retenus", value: FRAIS_FORFAIT, options: liste([FRAIS_FORFAIT, FRAIS_REELS]), hint: "Le forfait de 7,5 % est réservé aux acquisitions à titre onéreux." },
        { id: "fraisReels", label: "Frais d'acquisition réels justifiés", value: 19400, unit: "eur", min: 0 },
        { id: "travauxRetenus", label: "Travaux retenus", value: TRAVAUX_FORFAIT, options: liste([TRAVAUX_FORFAIT, TRAVAUX_REELS, TRAVAUX_AUCUN]), hint: "Le forfait de 15 % exige un bâti détenu strictement plus de cinq ans." },
        { id: "travauxReels", label: "Travaux réels justifiés", value: 24000, unit: "eur", min: 0, hint: "Construction, agrandissement, amélioration. L'entretien est exclu." },
      ],
    },
    {
      title: "Les exonérations",
      fields: [
        { id: "cas", label: "Cas particulier de la cession", value: CAS[0], options: liste(CAS), hint: "Tout autre cas qu'« Aucun » sort du périmètre du modèle : aucun impôt n'est affiché." },
        { id: "residencePrincipale", label: "Le bien est-il votre résidence principale ?", value: "Non", options: oui },
        { id: "premiereCession", label: "Première cession d'un logement autre que la résidence principale ?", value: "Non", options: oui },
        { id: "social", label: "Vente à un organisme de logement social ?", value: "Non", options: oui },
      ],
    },
    {
      title: "Qualifier le mandat",
      fields: [
        { id: "ecartPrix", label: "Écart entre le prix espéré et votre estimation", value: 8, unit: "pct", min: 0, max: 100, step: 1, hint: "Critère éliminatoire : au-delà de 15 %, le mandat ne se vend pas au prix demandé, quel que soit le reste." },
      ],
    },
  ],
  tables: [
    {
      id: "criteres",
      title: "Les huit critères du mandat",
      hint: "Notez chaque critère de 0 à 5 pendant le rendez-vous. Les poids comptent autant que les notes : recalez-les sur vos douze derniers mandats.",
      addLabel: "Ajouter un critère",
      min: 8,
      max: 8,
      rowLabels: CRITERES,
      columns: [
        { id: "note", label: "Note (0 à 5)", short: "Note", value: 3, unit: "nombre" },
        { id: "poids", label: "Poids (0 à 5)", short: "Poids", value: 2, unit: "nombre" },
      ],
      rows: [[4, 3], [2, 3], [4, 2], [3, 2], [3, 1], [2, 3], [4, 2], [4, 2]],
    },
  ],
  params: [
    { id: "irPlusValue", label: "Impôt sur le revenu, plus-value des particuliers", value: 19, unit: "pct" },
    { id: "psPlusValue", label: "Prélèvements sociaux sur la plus-value", value: 17.2, unit: "pct", hint: "La hausse de CSG des revenus du patrimoine ne vise pas la plus-value immobilière." },
    { id: "forfaitFrais", label: "Forfait de frais d'acquisition", value: 7.5, unit: "pct" },
    { id: "forfaitTravaux", label: "Forfait travaux", value: 15, unit: "pct" },
    { id: "dureeForfaitTravaux", label: "Détention minimale pour le forfait travaux", value: 5, unit: "an" },
    { id: "seuilPetitesCessions", label: "Seuil d'exonération des petites cessions", value: 15000, unit: "eur" },
    { id: "iraPart", label: "Plafond de l'indemnité, part du capital", value: 3, unit: "pct" },
    { id: "iraMois", label: "Plafond de l'indemnité, mois d'intérêts", value: 6, unit: "mois" },
    { id: "plancherTaux", label: "Plancher de plausibilité d'un taux saisi", value: 0.1, unit: "pct" },
    { id: "noteMax", label: "Note maximale de la grille", value: 5, unit: "nombre" },
    { id: "ecartEliminatoire", label: "Écart de prix éliminatoire", value: 15, unit: "pct" },
  ],
  headlines: [
    {
      label: "Net en poche pour le vendeur",
      unit: "eur",
      compute: siValide(netEnPoche),
      caption: (v, c) =>
        saisiesCoherentes(v, c)
          ? `Sur ${fr(v.prixAffiche ?? 0)} € affichés, dont ${fr(impotPlusValue(v, c))} € d'impôt de plus-value retenu par le notaire.`
          : c.cas !== CAS[0]
            ? `Cas hors du périmètre de ce modèle : ${c.cas}. Aucun impôt n'est affiché.`
            : "À calculer une fois les saisies cohérentes.",
    },
    {
      label: "Verdict sur le mandat",
      unit: "texte",
      compute: (v, c, t) => verdictMandat(t, v),
      caption: (v, c, t) => `Score ${Math.round(scoreMandat(t, v))} %, entre le seuil de refus à 40 % et le mandat solide à 75 %.`,
    },
  ],
  outputs: [
    { id: "honoraires", label: "Honoraires d'agence TTC", unit: "eur", compute: siValide(honoraires) },
    { id: "prixNetVendeur", label: "Prix net vendeur", unit: "eur", compute: siValide(prixNetVendeur), strong: true, hint: "La base de la plus-value, et le chiffre à comparer à l'estimation." },
    { id: "plafondIra", label: "Plafond légal de l'indemnité de remboursement anticipé", unit: "eur", compute: (v) => plafondIndemnite(v) },
    { id: "detention", label: "Durée de détention, de date à date", unit: "annees", compute: siValide((v) => dureeDetention(v)) },
    { id: "acquisitionMajoree", label: "Prix d'acquisition majoré", unit: "eur", compute: siValide(prixAcquisitionMajore), hint: "Prix, plus frais retenus, plus travaux retenus." },
    { id: "plusValue", label: "Plus-value brute", unit: "eur", compute: siValide(plusValueBrute), hint: "Une moins-value vaut zéro : elle n'est pas imputable." },
    { id: "abtIr", label: "Abattement pour durée, impôt sur le revenu", unit: "pct", compute: siValide((v) => abattement(ABT_IR, v) * 100), hint: "Nul jusqu'à cinq ans révolus, total à vingt-deux ans." },
    { id: "abtPs", label: "Abattement pour durée, prélèvements sociaux", unit: "pct", compute: siValide((v) => abattement(ABT_PS, v) * 100), hint: "Total à trente ans seulement : ce décalage de huit ans surprend tous les vendeurs." },
    { id: "exoneration", label: "Exonération applicable", unit: "texte", compute: (v, c) => (saisiesCoherentes(v, c) ? exoneration(v, c) : "–") },
    { id: "baseIr", label: "Plus-value imposable à l'impôt sur le revenu", unit: "eur", compute: siValide(baseIr) },
    { id: "basePs", label: "Plus-value imposable aux prélèvements sociaux", unit: "eur", compute: siValide(basePs) },
    { id: "ir", label: "Impôt sur le revenu", unit: "eur", compute: siValide((v, c) => baseIr(v, c) * p(v.irPlusValue, 19)) },
    { id: "ps", label: "Prélèvements sociaux", unit: "eur", compute: siValide((v, c) => basePs(v, c) * p(v.psPlusValue, 17.2)) },
    { id: "surtaxe", label: "Surtaxe sur les plus-values élevées", unit: "eur", compute: siValide(surtaxe) },
    { id: "impot", label: "Impôt total de plus-value", unit: "eur", compute: siValide(impotPlusValue), strong: true },
    { id: "partAffiche", label: "Part du prix affiché qui revient au vendeur", unit: "pct", compute: siValide((v, c) => ratio(prixNetVendeur(v, c), v.prixAffiche ?? 0) * 100), hint: "Le coût de l'intermédiation, et rien d'autre." },
    { id: "partApresImpot", label: "Part du net vendeur conservée après impôt", unit: "pct", compute: siValide((v, c) => ratio(prixNetVendeur(v, c) - impotPlusValue(v, c), prixNetVendeur(v, c)) * 100), hint: "Le coût fiscal de la vente. Le remboursement du prêt n'y entre pas : c'est votre dette, pas un coût de la vente." },
    { id: "controle", label: "Saisies complètes et cohérentes", unit: "texte", compute: (v, c) => (saisiesCoherentes(v, c) ? "OK" : "À corriger"), hint: "À corriger si l'indemnité dépasse son plafond, si le forfait de frais vise un bien reçu, si le forfait travaux n'est pas ouvert, ou pour un cas hors périmètre." },
    { id: "score", label: "Score du mandat", unit: "pct", compute: (v, c, t) => scoreMandat(t, v), strong: true },
  ],
  caveat:
    "Le seuil des petites cessions est comparé au prix affiché, l'hypothèse la moins favorable au vendeur. Les notes et les poids de la grille sont des repères : recalez-les sur vos propres mandats.",
};
