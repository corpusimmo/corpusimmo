/**
 * COÛT RÉEL D'UN PRÊT IMMOBILIER — la version en ligne de
 * `public/outils/matrices/tableau-amortissement-et-comparateur-de-prets.xlsx`,
 * onglets « Mon prêt », « Échéancier », « Comparateur » et « Détail des offres ».
 *
 * L'ÉCHÉANCIER EST REFAIT MOIS PAR MOIS, ARRONDI AU CENTIME COMME LA BANQUE.
 * Le classeur arrondit chaque intérêt, chaque cotisation et chaque capital
 * restant dû au centime, et fait absorber l'arrondi par la dernière échéance.
 * Une formule fermée (mensualité × nombre d'échéances − capital) donne un
 * total d'intérêts faux de quelques euros ; sur un TAEG, l'écart se voit au
 * troisième chiffre. On déroule donc les échéances une par une, et le test
 * compare les trois cents lignes à celles d'Excel.
 *
 * Ce que la matrice révisée ajoute à la version précédente :
 *   · la durée en mois et le différé d'amortissement (VEFA, construction) ;
 *   · l'assurance sur capital initial OU sur capital restant dû (délégation) ;
 *   · le TAEG réglementaire, avec et sans assurance, et le taux d'usure de la
 *     tranche de durée ;
 *   · les repères HCSF : taux d'effort et durée maximale ;
 *   · la part du fonds mutuel de garantie restituée en fin de prêt ;
 *   · le remboursement anticipé : capital restant dû et indemnité maximale ;
 *   · le comparateur de trois offres, classées par TAEG, et par coût total
 *     seulement quand les durées sont identiques.
 */

import { ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type T = Record<string, number[][]>;

/**
 * L'arrondi au centime d'Excel.
 *
 * `Math.round(x * 100)` se trompe sur les valeurs que le binaire ne représente
 * pas exactement (502,495 × 100 = 50249,49999…). Excel arrondit la valeur
 * affichée sur quinze chiffres significatifs : on fait de même avant
 * d'arrondir.
 */
export function arrondi2(x: number): number {
  const centimes = Number((x * 100).toPrecision(15));
  return (Math.sign(centimes) * Math.round(Math.abs(centimes))) / 100;
}

export interface LignePret {
  mois: number;
  echeance: number;
  interets: number;
  capital: number;
  assurance: number;
  restantDu: number;
}

export interface Pret {
  capital: number;
  /** Taux nominal annuel, en pourcent. */
  taux: number;
  mois: number;
  differe: number;
  /** Taux d'assurance annuel, en pourcent. */
  assurance: number;
  /** Vrai quand l'assurance cotise sur le capital restant dû. */
  surRestantDu: boolean;
}

/** Mon prêt!C22 : échéance constante hors différé, arrondie au centime. */
export function mensualitePret(p: Pret): number {
  const n = p.mois - p.differe;
  if (n <= 0 || p.capital <= 0) return 0;
  const t = p.taux / 100 / 12;
  return arrondi2(t === 0 ? p.capital / n : (p.capital * t) / (1 - Math.pow(1 + t, -n)));
}

/**
 * Échéancier!B8:J367. Pendant le différé, l'échéance ne paie que les intérêts ;
 * la dernière solde le capital restant dû, arrondi compris. L'assurance du mois
 * se calcule sur le capital restant dû DU MOIS PRÉCÉDENT, comme la cellule J7.
 */
export function echeancier(p: Pret): LignePret[] {
  const clef = JSON.stringify(p);
  const connu = memoEcheancier.get(clef);
  if (connu) return connu;
  const lignes = deroulerEcheancier(p);
  retenir(memoEcheancier, clef, lignes);
  return lignes;
}

/**
 * UN SEUL CALCUL PAR JEU DE SAISIES.
 *
 * Chaque résultat affiché relit l'échéancier, et chaque TAEG le parcourt deux
 * cents fois : sans mémoire, une frappe au clavier déroulait l'échéancier une
 * trentaine de fois et le TAEG une douzaine. La mémoire est bornée : elle ne
 * garde que les derniers jeux de saisies, ce qui suffit à une page qui ne
 * change qu'une valeur à la fois.
 */
const MEMOIRE = 24;
const memoEcheancier = new Map<string, LignePret[]>();
const memoTaeg = new Map<string, number>();

function retenir<K, W>(memo: Map<K, W>, clef: K, valeur: W): void {
  memo.set(clef, valeur);
  if (memo.size > MEMOIRE) memo.delete(memo.keys().next().value as K);
}

function deroulerEcheancier(p: Pret): LignePret[] {
  const lignes: LignePret[] = [];
  if (p.capital <= 0 || p.mois <= 0) return lignes;
  const t = p.taux / 100 / 12;
  const mensualite = mensualitePret(p);
  let restant = p.capital;

  for (let mois = 1; mois <= p.mois; mois += 1) {
    const interets = arrondi2(restant * t);
    const echeance =
      mois === p.mois ? restant + interets : mois <= p.differe ? interets : mensualite;
    const capital = echeance - interets;
    const assurance = arrondi2(((p.surRestantDu ? restant : p.capital) * p.assurance) / 100 / 12);
    restant = arrondi2(restant - capital);
    lignes.push({ mois, echeance, interets, capital, assurance, restantDu: restant });
  }
  return lignes;
}

/**
 * Taux de rendement interne MENSUEL, par bissection.
 *
 * La bissection converge sans jamais diverger, ce que Newton ne garantit pas
 * sur trois cents flux. Deux cents itérations ramènent l'intervalle sous la
 * précision du double : bien au-delà de ce qu'un TAEG affiché à deux
 * décimales demande.
 */
export function triMensuel(flux: number[]): number {
  const van = (r: number) => flux.reduce((s, f, k) => s + f / Math.pow(1 + r, k), 0);
  let bas = -0.99;
  let haut = 1;
  if (van(bas) * van(haut) > 0) return Number.NaN;
  for (let k = 0; k < 200; k += 1) {
    const milieu = (bas + haut) / 2;
    if (van(bas) * van(milieu) <= 0) haut = milieu;
    else bas = milieu;
  }
  return (bas + haut) / 2;
}

/**
 * Mon prêt!C34:C35. Le TAEG se calcule sur ce que l'emprunteur reçoit
 * vraiment — le capital MOINS les frais de dossier et de garantie — et ce qu'il
 * rembourse chaque mois, assurance comprise ou non. Taux mensuel annualisé
 * de façon composée, comme l'exige l'article R314-3 du Code de la consommation.
 */
export function taeg(p: Pret, frais: number, avecAssurance: boolean): number {
  const clef = JSON.stringify([p, frais, avecAssurance]);
  const connu = memoTaeg.get(clef);
  if (connu !== undefined) return connu;
  const valeur = calculerTaeg(p, frais, avecAssurance);
  retenir(memoTaeg, clef, valeur);
  return valeur;
}

function calculerTaeg(p: Pret, frais: number, avecAssurance: boolean): number {
  const lignes = echeancier(p);
  if (lignes.length === 0) return Number.NaN;
  const flux = [
    -(p.capital - frais),
    ...lignes.map((l) => l.echeance + (avecAssurance ? l.assurance : 0)),
  ];
  const r = triMensuel(flux);
  return Number.isNaN(r) ? Number.NaN : (Math.pow(1 + r, 12) - 1) * 100;
}

/** Mon prêt!C37 : la tranche d'usure dépend de la durée du prêt. */
export function tauxUsure(mois: number, v: V): number {
  if (mois < (v.seuilUsure1 ?? 120)) return v.usureCourt ?? 4.07;
  if (mois < (v.seuilUsure2 ?? 240)) return v.usureMoyen ?? 4.57;
  return v.usureLong ?? 5.29;
}

/* ── Mon prêt ────────────────────────────────────────────────────────────── */

function monPret(v: V, c: Record<string, string>): Pret {
  return {
    capital: v.capital ?? 0,
    taux: v.taux ?? 0,
    mois: Math.round(v.mois ?? 0),
    differe: Math.round(v.differe ?? 0),
    assurance: v.assurance ?? 0,
    surRestantDu: c.assiette === "restant",
  };
}

const frais = (v: V) => (v.dossier ?? 0) + (v.garantie ?? 0);

/** Mon prêt!C17 : les bornes que le classeur contrôle. */
function saisieCoherente(v: V, c: Record<string, string>): boolean {
  const p = monPret(v, c);
  return (
    p.capital > 0 &&
    p.taux >= 0 &&
    p.taux <= (v.tauxMax ?? 20) &&
    p.mois >= 1 &&
    p.mois <= 360 &&
    p.differe >= 0 &&
    p.differe < p.mois &&
    p.assurance >= 0 &&
    p.assurance <= (v.assuranceMax ?? 5) &&
    (v.fmg ?? 0) <= (v.garantie ?? 0) &&
    ((v.moisAnticipe ?? 0) === 0 || ((v.moisAnticipe ?? 0) >= 1 && (v.moisAnticipe ?? 0) <= p.mois))
  );
}

function tauxVraisemblable(v: V): boolean {
  const t = v.taux ?? 0;
  return t === 0 || t >= (v.tauxMin ?? 0.1);
}

const totalInterets = (p: Pret) => echeancier(p).reduce((s, l) => s + l.interets, 0);
const totalAssurance = (p: Pret) => echeancier(p).reduce((s, l) => s + l.assurance, 0);

/** Mon prêt!C28. */
export function coutTotal(v: V, c: Record<string, string>): number {
  const p = monPret(v, c);
  return totalInterets(p) + totalAssurance(p) + frais(v);
}

/** Mon prêt!C25 : la première échéance d'amortissement, assurance comprise. */
export function mensualiteTotale(v: V, c: Record<string, string>): number {
  const p = monPret(v, c);
  const ligne = echeancier(p)[p.differe];
  return mensualitePret(p) + (ligne?.assurance ?? 0);
}

/** Mon prêt!C48 : capital restant dû après l'échéance envisagée. */
function restantDuApres(v: V, c: Record<string, string>): number {
  const m = Math.round(v.moisAnticipe ?? 0);
  if (m <= 0) return Number.NaN;
  return echeancier(monPret(v, c))[m - 1]?.restantDu ?? Number.NaN;
}

/**
 * Mon prêt!C49 : le plus bas des deux plafonds légaux — six mois d'intérêts
 * au taux du prêt, ou 3 % du capital restant dû.
 */
function indemniteAnticipee(v: V, c: Record<string, string>): number {
  const crd = restantDuApres(v, c);
  if (Number.isNaN(crd)) return Number.NaN;
  return Math.min(
    (crd * ((v.taux ?? 0) / 100) * (v.iraMois ?? 6)) / 12,
    (crd * (v.iraPart ?? 3)) / 100,
  );
}

/* ── Comparateur ─────────────────────────────────────────────────────────── */

export const ASSIETTE_INITIAL = 0;
export const ASSIETTE_RESTANT = 1;

interface Offre {
  nom: string;
  pret: Pret;
  frais: number;
  fmg: number;
  valide: boolean;
}

/** Comparateur!C9:E17, une offre par ligne du tableau. */
function lireOffres(t: T, v: V): Offre[] {
  const noms = ["Offre A", "Offre B", "Offre C"];
  return (t.offres ?? []).slice(0, 3).map((ligne, i) => {
    const [capital = 0, taux = 0, mois = 0, assiette = 0, assurance = 0, dossier = 0, garantie = 0, fmg = 0] = ligne;
    const pret: Pret = {
      capital,
      taux,
      mois: Math.round(mois),
      differe: 0,
      assurance,
      surRestantDu: assiette === ASSIETTE_RESTANT,
    };
    const valide =
      capital > 0 &&
      taux >= 0 &&
      taux <= (v.tauxMax ?? 20) &&
      (taux === 0 || taux >= (v.tauxMin ?? 0.1)) &&
      pret.mois >= 1 &&
      pret.mois <= 360 &&
      assurance >= 0 &&
      assurance <= (v.assuranceMax ?? 5) &&
      dossier >= 0 &&
      garantie >= 0 &&
      fmg >= 0 &&
      fmg <= garantie;
    return { nom: noms[i] ?? `Offre ${i + 1}`, pret, frais: dossier + garantie, fmg, valide };
  });
}

interface OffreChiffree extends Offre {
  mensualite: number;
  cout: number;
  taeg: number;
}

function chiffrer(t: T, v: V): OffreChiffree[] {
  return lireOffres(t, v)
    .filter((o) => o.valide)
    .map((o) => ({
      ...o,
      mensualite: mensualitePret(o.pret) + (echeancier(o.pret)[0]?.assurance ?? 0),
      cout: totalInterets(o.pret) + totalAssurance(o.pret) + o.frais,
      taeg: taeg(o.pret, o.frais, true),
    }));
}

/** Comparateur!C43 : le classement par coût total n'a de sens qu'à durée égale. */
function dureesIdentiques(offres: OffreChiffree[]): boolean {
  return offres.length >= 2 && offres.every((o) => o.pret.mois === offres[0]!.pret.mois);
}

const fr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const frPct = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Une ligne de synthèse par offre, lisible sans le tableau. */
function resumeOffre(t: T, v: V, rang: number): string {
  const brute = lireOffres(t, v)[rang];
  if (!brute) return "–";
  if (!brute.valide) return "À corriger : une saisie sort de ses bornes";
  const o = chiffrer(t, v).find((x) => x.nom === brute.nom)!;
  const usure = tauxUsure(o.pret.mois, v);
  const alerte = o.taeg > usure ? ", TAEG au-dessus de l'usure" : "";
  return `TAEG ${frPct(o.taeg)} %, coût ${fr(o.cout)} €, ${fr(o.mensualite)} € par mois${alerte}`;
}

/* ── La spécification ────────────────────────────────────────────────────── */

export const pretAmortissement: ToolSpec = {
  id: "pret-amortissement",
  title: "Coût réel d'un prêt immobilier",
  intro:
    "Mensualité, coût total, TAEG face au taux d'usure, repères HCSF, remboursement anticipé, et trois offres comparées sur le seul critère qui les départage.",
  sections: [
    {
      title: "L'emprunt",
      fields: [
        { id: "capital", label: "Montant emprunté", value: 180000, unit: "eur", min: 0, hint: "Capital débloqué par la banque, hors frais." },
        { id: "taux", label: "Taux nominal annuel, hors assurance", value: 3.35, unit: "pct", min: 0, max: 20, step: 0.05, hint: "0 pour un prêt à taux zéro. Repères : 3,27 % sur 20 ans, 3,35 % sur 25 ans." },
        { id: "mois", label: "Durée totale du prêt", value: 300, unit: "mois", min: 1, max: 360, step: 1, hint: "En mois, différé compris. 240 = 20 ans, 300 = 25 ans." },
        { id: "differe", label: "Différé d'amortissement", value: 0, unit: "mois", min: 0, step: 1, hint: "VEFA, construction, travaux : pendant ces mois vous ne payez que les intérêts et l'assurance. Inférieur à la durée." },
        {
          id: "assiette",
          label: "Assurance calculée sur",
          value: "initial",
          options: [
            { value: "initial", label: "Capital initial" },
            { value: "restant", label: "Capital restant dû" },
          ],
          hint: "Capital initial : contrat groupe, cotisation constante. Capital restant dû : délégation, cotisation dégressive.",
        },
        { id: "assurance", label: "Taux d'assurance annuel", value: 0.28, unit: "pct", min: 0, max: 5, step: 0.01, hint: "Repères 2026 : 0,36 % en contrat groupe, 0,17 % en délégation. 0 si aucune assurance." },
        { id: "dossier", label: "Frais de dossier", value: 1200, unit: "eur", min: 0, hint: "Négociables. Fourchette usuelle : 0 à 2 500 €." },
        { id: "garantie", label: "Frais de garantie", value: 2100, unit: "eur", min: 0, hint: "Caution ou hypothèque. Ordre de grandeur : 1,2 % du capital pour une caution, 1,5 % pour une hypothèque." },
        { id: "fmg", label: "Dont versement au fonds mutuel de garantie", value: 1500, unit: "eur", min: 0, hint: "Part d'une caution Crédit Logement restituée en partie en fin de prêt. 0 pour une hypothèque. Au plus les frais de garantie." },
      ],
    },
    {
      title: "Repères HCSF et remboursement anticipé",
      fields: [
        { id: "revenus", label: "Revenus nets mensuels du foyer", value: 3400, unit: "eur", min: 0, hint: "Facultatif. Revenus nets avant impôt, tels que la banque les retient. 0 : le taux d'effort n'est pas calculé." },
        { id: "moisAnticipe", label: "Mois du remboursement anticipé envisagé", value: 84, unit: "mois", min: 0, step: 1, hint: "Facultatif. Numéro d'échéance : 84 = après 7 ans. 0 : rien n'est calculé." },
      ],
    },
  ],
  tables: [
    {
      id: "offres",
      title: "Comparer trois offres",
      hint:
        "Le taux nominal ne suffit pas : le TAEG départage à toute durée, le coût total seulement à durée égale. Même montant pour les trois offres, sinon la comparaison n'a pas de sens.",
      addLabel: "Ajouter une offre",
      min: 2,
      max: 3,
      rowLabels: ["Offre A", "Offre B", "Offre C"],
      columns: [
        { id: "capital", label: "Montant emprunté (€)", short: "Montant", value: 180000, unit: "eur" },
        { id: "taux", label: "Taux nominal (%)", short: "Taux", value: 3.35, unit: "pct" },
        { id: "mois", label: "Durée (mois)", short: "Mois", value: 300, unit: "mois" },
        {
          id: "assiette",
          label: "Assurance calculée sur",
          short: "Assiette",
          value: ASSIETTE_INITIAL,
          unit: "nombre",
          options: [
            // Courts : la colonne tient dans un tableau de huit colonnes.
            { value: ASSIETTE_INITIAL, label: "Initial" },
            { value: ASSIETTE_RESTANT, label: "Restant" },
          ],
        },
        { id: "assurance", label: "Taux d'assurance (%)", short: "Assurance", value: 0.3, unit: "pct" },
        { id: "dossier", label: "Frais de dossier (€)", short: "Dossier", value: 0, unit: "eur" },
        { id: "garantie", label: "Frais de garantie (€)", short: "Garantie", value: 2100, unit: "eur" },
        { id: "fmg", label: "Dont fonds mutuel de garantie (€)", short: "Dont FMG", value: 1500, unit: "eur" },
      ],
      rows: [
        [180000, 3.25, 300, ASSIETTE_INITIAL, 0.42, 1500, 2100, 1500],
        [180000, 3.4, 300, ASSIETTE_RESTANT, 0.18, 900, 2100, 1500],
        [180000, 3.55, 300, ASSIETTE_INITIAL, 0.2, 0, 2700, 0],
      ],
    },
  ],
  params: [
    { id: "usureCourt", label: "Taux d'usure, moins de 10 ans", value: 4.07, unit: "pct", hint: "Banque de France, 3e trimestre 2026. Mise à jour trimestrielle." },
    { id: "usureMoyen", label: "Taux d'usure, 10 à moins de 20 ans", value: 4.57, unit: "pct" },
    { id: "usureLong", label: "Taux d'usure, 20 ans et plus", value: 5.29, unit: "pct" },
    { id: "seuilUsure1", label: "Seuil entre les deux premières tranches d'usure", value: 120, unit: "mois" },
    { id: "seuilUsure2", label: "Seuil entre les deux dernières tranches d'usure", value: 240, unit: "mois" },
    { id: "effortMax", label: "Taux d'effort maximal (HCSF)", value: 35, unit: "pct", hint: "Assurance comprise." },
    { id: "dureeMax", label: "Durée maximale d'un prêt (HCSF)", value: 300, unit: "mois", hint: "25 ans, hors différé." },
    { id: "differeMax", label: "Différé toléré en plus (HCSF)", value: 24, unit: "mois", hint: "VEFA, construction, travaux." },
    { id: "iraMois", label: "Indemnité de remboursement anticipé : plafond en mois d'intérêts", value: 6, unit: "mois" },
    { id: "iraPart", label: "Indemnité de remboursement anticipé : plafond en part du capital", value: 3, unit: "pct", hint: "Le plus bas des deux plafonds s'applique." },
    { id: "partFmg", label: "Part du fonds mutuel de garantie restituée", value: 70, unit: "pct", hint: "0 % pour une hypothèque ou une caution sans restitution." },
    { id: "tauxMin", label: "Taux nominal minimal vraisemblable", value: 0.1, unit: "pct", hint: "Garde-fou de saisie : en dessous, sauf 0 exactement, vous avez sans doute tapé une fraction." },
    { id: "tauxMax", label: "Taux nominal maximal admis", value: 20, unit: "pct" },
    { id: "assuranceMax", label: "Taux d'assurance maximal admis", value: 5, unit: "pct" },
  ],
  headlines: [
    {
      label: "Mensualité totale, assurance comprise",
      unit: "eur",
      compute: (v, c) => mensualiteTotale(v, c),
      caption: (v, c) => {
        const ligne = echeancier(monPret(v, c))[Math.round(v.differe ?? 0)];
        return `Dont ${fr(ligne?.assurance ?? 0)} € d'assurance, que le taux nominal ne montre pas.`;
      },
    },
    {
      label: "TAEG, assurance comprise",
      unit: "pct",
      compute: (v, c) => taeg(monPret(v, c), frais(v), true),
      caption: (v, c) => {
        const p = monPret(v, c);
        const t = taeg(p, frais(v), true);
        const usure = tauxUsure(p.mois, v);
        if (Number.isNaN(t)) return "À calculer une fois la saisie cohérente.";
        return t <= usure
          ? `Sous le taux d'usure de ${frPct(usure)} % de sa tranche de durée.`
          : `Au-dessus du taux d'usure de ${frPct(usure)} % : la banque ne peut pas prêter à ces conditions.`;
      },
    },
  ],
  outputs: [
    { id: "controle", label: "Saisie complète et cohérente", unit: "texte", compute: (v, c) => (saisieCoherente(v, c) && tauxVraisemblable(v) ? "OK" : "À corriger"), hint: "À corriger si un taux semble saisi en fraction, si le différé atteint la durée ou si le fonds mutuel dépasse les frais de garantie." },
    { id: "mensualite", label: "Mensualité, capital et intérêts, hors différé", unit: "eur", compute: (v, c) => mensualitePret(monPret(v, c)), hint: "Arrondie au centime comme dans l'offre. La dernière échéance absorbe l'arrondi." },
    {
      id: "echeanceDiffere",
      label: "Échéance pendant le différé",
      unit: "eur",
      compute: (v) =>
        Math.round(v.differe ?? 0) === 0
          ? Number.NaN
          : arrondi2(((v.capital ?? 0) * (v.taux ?? 0)) / 100 / 12) + arrondi2(((v.capital ?? 0) * (v.assurance ?? 0)) / 100 / 12),
      hint: "Intérêts et assurance seulement. Vide sans différé.",
    },
    { id: "interets", label: "Total des intérêts", unit: "eur", compute: (v, c) => totalInterets(monPret(v, c)) },
    { id: "totalAssurance", label: "Total de l'assurance", unit: "eur", compute: (v, c) => totalAssurance(monPret(v, c)) },
    { id: "cout", label: "Coût total du crédit", unit: "eur", compute: (v, c) => coutTotal(v, c), strong: true, hint: "Intérêts, assurance, dossier et garantie. Comparable entre offres à durée égale seulement." },
    { id: "coutPour100", label: "Coût pour 100 € empruntés", unit: "eur", compute: (v, c) => ratio(coutTotal(v, c), v.capital ?? 0) * 100 },
    { id: "restitution", label: "Garantie restituée en fin de prêt, estimation", unit: "eur", compute: (v) => ((v.fmg ?? 0) * (v.partFmg ?? 70)) / 100, hint: "Ne réduit pas le TAEG, qui compte la garantie en entier." },
    { id: "coutNet", label: "Coût total net de la restitution", unit: "eur", compute: (v, c) => coutTotal(v, c) - ((v.fmg ?? 0) * (v.partFmg ?? 70)) / 100 },
    { id: "taegHors", label: "TAEG hors assurance", unit: "pct", compute: (v, c) => taeg(monPret(v, c), frais(v), false), hint: "Le coût de la banque seule, frais compris." },
    { id: "taea", label: "TAEA, coût de l'assurance en points de taux", unit: "pct", compute: (v, c) => taeg(monPret(v, c), frais(v), true) - taeg(monPret(v, c), frais(v), false) },
    { id: "usure", label: "Taux d'usure de la tranche de durée", unit: "pct", compute: (v) => tauxUsure(Math.round(v.mois ?? 0), v) },
    {
      id: "usureOk",
      label: "TAEG inférieur ou égal au taux d'usure",
      unit: "texte",
      compute: (v, c) => (taeg(monPret(v, c), frais(v), true) <= tauxUsure(Math.round(v.mois ?? 0), v) ? "OK" : "Dépassé"),
      hint: "Dépassé : la banque ne peut pas prêter à ces conditions. Baissez l'assurance ou les frais, ou allongez la durée.",
    },
    { id: "effort", label: "Taux d'effort, assurance comprise", unit: "pct", compute: (v, c) => ((v.revenus ?? 0) > 0 ? ratio(mensualiteTotale(v, c), v.revenus ?? 0) * 100 : Number.NaN), hint: "Ne compte que ce prêt : ajoutez vos autres crédits pour le taux d'effort complet." },
    {
      id: "effortOk",
      label: "Taux d'effort dans la norme HCSF",
      unit: "texte",
      compute: (v, c) => ((v.revenus ?? 0) > 0 ? (ratio(mensualiteTotale(v, c), v.revenus ?? 0) * 100 <= (v.effortMax ?? 35) ? "OK" : "Hors norme") : "Sans objet"),
    },
    {
      id: "dureeOk",
      label: "Durée dans la norme HCSF",
      unit: "texte",
      compute: (v) =>
        Math.round(v.mois ?? 0) <= (v.dureeMax ?? 300) + Math.min(Math.round(v.differe ?? 0), v.differeMax ?? 24) ? "OK" : "Hors norme",
      hint: "25 ans, différé toléré en plus jusqu'à 2 ans.",
    },
    { id: "crdAnticipe", label: "Capital restant dû après l'échéance envisagée", unit: "eur", compute: (v, c) => restantDuApres(v, c), hint: "Ce qu'il faut rembourser pour solder le prêt, avant indemnité." },
    { id: "ira", label: "Indemnité de remboursement anticipé maximale", unit: "eur", compute: (v, c) => indemniteAnticipee(v, c) },
    { id: "solde", label: "À débourser pour solder le prêt", unit: "eur", compute: (v, c) => restantDuApres(v, c) + indemniteAnticipee(v, c), hint: "Capital et indemnité maximale, hors intérêts courus depuis la dernière échéance." },
    { id: "offreA", label: "Offre A", unit: "texte", compute: (v, c, t) => resumeOffre(t, v, 0) },
    { id: "offreB", label: "Offre B", unit: "texte", compute: (v, c, t) => resumeOffre(t, v, 1) },
    { id: "offreC", label: "Offre C", unit: "texte", compute: (v, c, t) => resumeOffre(t, v, 2) },
    {
      id: "meilleureTaeg",
      label: "Meilleure offre par TAEG",
      unit: "texte",
      strong: true,
      compute: (v, c, t) => {
        const offres = chiffrer(t, v);
        if (offres.length < 2) return "Renseignez au moins deux offres";
        return offres.reduce((a, b) => (b.taeg < a.taeg ? b : a)).nom;
      },
      hint: "Le verdict de référence : à tout horizon, la plus économique par euro emprunté.",
    },
    {
      id: "moinsChere",
      label: "Moins chère en coût total, à durée égale",
      unit: "texte",
      compute: (v, c, t) => {
        const offres = chiffrer(t, v);
        if (offres.length < 2) return "Renseignez au moins deux offres";
        if (!dureesIdentiques(offres)) return "Durées différentes : comparez le TAEG";
        return offres.reduce((a, b) => (b.cout < a.cout ? b : a)).nom;
      },
    },
    {
      id: "ecartCout",
      label: "Écart de coût entre la moins chère et la plus chère",
      unit: "eur",
      strong: true,
      compute: (v, c, t) => {
        const offres = chiffrer(t, v);
        if (!dureesIdentiques(offres)) return Number.NaN;
        const couts = offres.map((o) => o.cout);
        return Math.max(...couts) - Math.min(...couts);
      },
      hint: "Ce que le choix de la banque vaut en euros, sur toute la durée.",
    },
  ],
  caveat:
    "Le TAEG calculé ici est celui de l'échéancier, pas celui de l'offre signée : la banque peut compter des frais que vous n'avez pas saisis. Les taux d'usure changent chaque trimestre, vérifiez les paramètres avant de conclure qu'une offre est légale.",
};
