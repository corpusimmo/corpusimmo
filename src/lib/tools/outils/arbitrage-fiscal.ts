/**
 * ARBITRAGE FISCAL : NU, LMNP OU SCI À L'IS — la version en ligne de
 * `public/outils/matrices/arbitrage-fiscal-nu-lmnp-sci-is.xlsx`, onglets
 * « Hypothèses », « Pluriannuel » et « Comparateur ».
 *
 * LE MÊME BIEN SOUS CINQ RÉGIMES, SUR TOUTE LA DURÉE, REVENTE COMPRISE. La
 * version précédente comparait une année ; c'est la question la plus
 * trompeuse qui soit. Le LMNP réel écrase l'impôt pendant la détention et le
 * rattrape à la revente par la réintégration des amortissements ; la SCI à
 * l'IS paie peu tant que l'argent reste en société et beaucoup quand il en
 * sort. Seul le total net en poche, flux annuels ET revente, les départage.
 *
 * LE PLURIANNUEL EST DÉROULÉ ANNÉE PAR ANNÉE, comme les trente colonnes du
 * classeur : loyers et charges indexés, intérêts et capital de l'année,
 * amortissements, déficits fonciers reportés sur dix ans, amortissements
 * différés du LMNP (art. 39 C), déficit et trésorerie de la SCI, compte
 * courant d'associé. Chaque ligne porte la cellule qu'elle refait, et le test
 * compare année par année aux valeurs d'Excel.
 */

import { tri, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;

/* ── Listes du classeur ──────────────────────────────────────────────────── */

export const REGIMES = [
  "Location nue, micro-foncier",
  "Location nue, réel foncier",
  "Meublé, LMNP micro-BIC",
  "Meublé, LMNP réel",
  "SCI à l'IS",
] as const;
export type Regime = (typeof REGIMES)[number];

export const MODES = ["Achat (à titre onéreux)", "Succession", "Donation"] as const;

export const MEUBLES = [
  { nom: "Meublé classique (bail d'habitation, étudiant, mobilité)", abattement: "abtMeubleClassique", plafond: "plafondMeubleClassique" },
  { nom: "Meublé de tourisme classé", abattement: "abtTourismeClasse", plafond: "plafondTourismeClasse" },
  { nom: "Meublé de tourisme non classé", abattement: "abtTourismeNonClasse", plafond: "plafondTourismeNonClasse" },
] as const;

export const FRAIS_IMMOBILISES = "Immobilisés (amortis avec le bâti)";
export const FRAIS_CHARGES = "Déduits en charges l'année 1";

/**
 * Pluriannuel!Paramètres!C41:D70 : abattements pour durée de détention sur la
 * plus-value des particuliers, IR puis prélèvements sociaux, année 1 à 30.
 */
const ABATTEMENT_IR = [0, 0, 0, 0, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 100, 100, 100, 100, 100, 100, 100, 100, 100];
const ABATTEMENT_PS = [0, 0, 0, 0, 0, 1.65, 3.3, 4.95, 6.6, 8.25, 9.9, 11.55, 13.2, 14.85, 16.5, 18.15, 19.8, 21.45, 23.1, 24.75, 26.4, 28, 37, 46, 55, 64, 73, 82, 91, 100];

/** Paramètres!B74:E83 : surtaxe sur les plus-values élevées, par tranches lissées. */
const SURTAXE: [seuil: number, taux: number, coefficient: number, borne: number][] = [
  [50000, 0.02, 0.05, 60000],
  [60000, 0.02, 0, 0],
  [100000, 0.03, 0.1, 110000],
  [110000, 0.03, 0, 0],
  [150000, 0.04, 0.15, 160000],
  [160000, 0.04, 0, 0],
  [200000, 0.05, 0.2, 210000],
  [210000, 0.05, 0, 0],
  [250000, 0.06, 0.25, 260000],
  [260000, 0.06, 0, 0],
];

export function surtaxe(pvIr: number): number {
  if (pvIr <= SURTAXE[0]![0]) return 0;
  let ligne = SURTAXE[0]!;
  for (const t of SURTAXE) if (t[0] <= pvIr) ligne = t;
  const [, taux, coefficient, borne] = ligne;
  return Math.max(0, taux * pvIr - coefficient * Math.max(0, borne - pvIr));
}

const p = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

/** L'IS au barème 15 % puis 25 %. */
function impotSocietes(benefice: number, v: V): number {
  const plafond = v.isPlafondReduit ?? 42500;
  return Math.min(benefice, plafond) * p(v.isReduit, 15) + Math.max(0, benefice - plafond) * p(v.isNormal, 25);
}

/* ── Le prêt, mois par mois, sans arrondi (CUMIPMT et CUMPRINC) ──────────── */

function pretParAnnee(v: V): { interets: number[]; capital: number[] } {
  const emprunt = v.emprunt ?? 0;
  const annees = Math.round(v.dureePret ?? 0);
  const interets: number[] = [];
  const capital: number[] = [];
  if (emprunt <= 0 || annees <= 0) return { interets, capital };
  const t = (v.taux ?? 0) / 100 / 12;
  const n = annees * 12;
  if (t === 0) {
    for (let a = 0; a < annees; a += 1) {
      interets.push(0);
      capital.push(emprunt / annees);
    }
    return { interets, capital };
  }
  const mensualite = (emprunt * t) / (1 - Math.pow(1 + t, -n));
  let restant = emprunt;
  for (let a = 0; a < annees; a += 1) {
    let i = 0;
    let c = 0;
    for (let m = 0; m < 12; m += 1) {
      const part = restant * t;
      i += part;
      c += mensualite - part;
      restant -= mensualite - part;
    }
    interets.push(i);
    capital.push(c);
  }
  return { interets, capital };
}

/* ── La simulation complète ──────────────────────────────────────────────── */

export interface ResultatRegime {
  regime: Regime;
  eligible: boolean;
  impot1: number;
  base1: number;
  flux1: number;
  impotsCumules: number;
  fluxCumules: number;
  reports: number;
  acquisitionRetenue: number;
  plusValue: number;
  impotRevente: number;
  netRevente: number;
  total: number;
  gain: number;
  tri: number;
  /** Les flux annuels en poche, année 1 à N, revente non comprise. */
  flux: number[];
}

export interface Simulation {
  duree: number;
  apport: number;
  cession: number;
  restantDu: number;
  regimes: ResultatRegime[];
  tresorerieSci: number;
  ccaSci: number;
}

const memo = new Map<string, Simulation>();

export function simuler(v: V, c: C): Simulation {
  const clef = JSON.stringify([v, c]);
  const connu = memo.get(clef);
  if (connu) return connu;
  const s = calculer(v, c);
  memo.set(clef, s);
  if (memo.size > 16) memo.delete(memo.keys().next().value as string);
  return s;
}

function calculer(v: V, c: C): Simulation {
  const prix = v.prix ?? 0;
  const frais = v.frais ?? 0;
  const travaux = v.travaux ?? 0;
  const mobilier = v.mobilier ?? 0;
  const cout = prix + frais + travaux + mobilier;
  const emprunt = v.emprunt ?? 0;
  const apport = cout - emprunt;
  const tmi = Number(c.tmi ?? "30") / 100;
  const index = p(v.indexation, 1);
  const autresRF = v.autresRevenusFonciers ?? 0;
  const dureeValide = Math.round(v.detention ?? 10);
  const N = dureeValide >= 1 && dureeValide <= 30 ? dureeValide : 1;
  const csgDeductible = c.csg === "Oui";
  const fraisImmobilises = c.fraisAcquisition !== FRAIS_CHARGES;
  const psFoncier = p(v.psFoncier, 17.2);
  const psMeuble = p(v.psMeuble, 18.6);
  const tauxCsg = p(v.csgDeductible, 6.8);
  const meuble = MEUBLES.find((m) => m.nom === c.meuble) ?? MEUBLES[0];
  const abtMeuble = p(v[meuble.abattement], meuble.abattement === "abtTourismeNonClasse" ? 30 : 50);
  const plafondMeuble = v[meuble.plafond] ?? (meuble.plafond === "plafondTourismeNonClasse" ? 15000 : 83600);
  const plafondDeficit = c.renovation === "Oui" ? (v.plafondDeficitMajore ?? 21400) : (v.plafondDeficit ?? 10700);
  const terrain = p(v.terrain, 15);
  const dBati = Math.round(v.dureeBati ?? 30);
  const dTravaux = Math.round(v.dureeTravaux ?? 15);
  const dMobilier = Math.round(v.dureeMobilier ?? 7);

  const pret = pretParAnnee(v);
  const annuiteMois = Math.round(v.dureePret ?? 0);

  // Cumuls et reports des cinq régimes.
  const r = {
    micro: { flux: [] as number[], impot: 0, csg: 0, base1: 0, impot1: 0 },
    reel: { flux: [] as number[], impot: 0, csg: 0, base1: 0, impot1: 0, report: 0 },
    bic: { flux: [] as number[], impot: 0, csg: 0, base1: 0, impot1: 0 },
    lmnp: { flux: [] as number[], impot: 0, csg: 0, base1: 0, impot1: 0, differes: 0, deficit: 0, reintegre: 0 },
    sci: { flux: [] as number[], impot: 0, pfu: 0, base1: 0, impot1: 0, deficit: 0, tresorerie: 0, cca: apport, reserves: 0, benefice: [] as number[], amortissements: 0 },
  };
  let restantDu = emprunt > 0 ? emprunt : 0;
  let basePrec = { micro: 0, reel: 0, bic: 0, lmnp: 0 };
  let loyerFin = 0;
  const loyer1 = v.loyer ?? 0;

  for (let a = 1; a <= N; a += 1) {
    const indice = Math.pow(1 + index, a - 1);
    const loyer = loyer1 * indice;
    const charges = (v.charges ?? 0) * indice;
    const cfe = (v.cfe ?? 0) * indice;
    const comptaLmnp = (v.comptaLmnp ?? 0) * indice;
    const comptaSci = (v.comptaSci ?? 0) * indice;
    loyerFin = loyer;

    const enPret = emprunt > 0 && a <= annuiteMois;
    const interets = enPret && (v.taux ?? 0) !== 0 ? (pret.interets[a - 1] ?? 0) : 0;
    const capital = enPret ? (pret.capital[a - 1] ?? 0) : 0;
    const assurance = enPret ? emprunt * p(v.assurance, 0.34) : 0;
    const annuite = interets + capital + assurance;
    restantDu = enPret ? restantDu - capital : 0;

    const amoBati = dBati > 0 && a <= dBati ? ((prix + (fraisImmobilises ? frais : 0)) * (1 - terrain)) / dBati : 0;
    const amoTravaux = dTravaux > 0 && a <= dTravaux ? travaux / dTravaux : 0;
    const amoMobilier = dMobilier > 0 && a <= dMobilier ? mobilier / dMobilier : 0;
    const amortissement = amoBati + amoTravaux + amoMobilier;
    r.sci.amortissements += amortissement;

    /* Micro-foncier (lignes 25 à 28). */
    const baseMicro = loyer * (1 - p(v.abtMicroFoncier, 30));
    const impotMicro = baseMicro * (tmi + psFoncier);
    const csgMicro = a >= 2 && csgDeductible ? Math.max(0, basePrec.micro) * tauxCsg * tmi : 0;
    r.micro.impot += impotMicro;
    r.micro.csg += csgMicro;
    r.micro.flux.push(loyer - charges - annuite - impotMicro + csgMicro);
    if (a === 1) {
      r.micro.base1 = baseMicro;
      r.micro.impot1 = impotMicro;
    }

    /* Réel foncier (lignes 31 à 44). */
    const resultat = loyer - charges - (interets + assurance) - (a === 1 ? travaux : 0);
    const deficitInterets = Math.max(0, interets + assurance - loyer);
    const deficitAutres = Math.max(0, -resultat - deficitInterets);
    const interetsApres = Math.max(0, deficitInterets - autresRF);
    const autresApres = Math.max(0, deficitAutres - Math.max(0, autresRF - deficitInterets));
    const impute = Math.min(autresApres, plafondDeficit);
    const foncierPositif = Math.max(0, autresRF + resultat);
    const reportDebut = r.reel.report;
    const reportImpute = Math.min(reportDebut, foncierPositif);
    r.reel.report = reportDebut - reportImpute + interetsApres + autresApres - impute;
    const baseReel = foncierPositif - reportImpute - autresRF;
    const impotReel = baseReel * (tmi + psFoncier) - impute * tmi;
    const csgReel = a >= 2 && csgDeductible ? Math.max(0, basePrec.reel) * tauxCsg * tmi : 0;
    r.reel.impot += impotReel;
    r.reel.csg += csgReel;
    r.reel.flux.push(loyer - charges - annuite - impotReel + csgReel);
    if (a === 1) {
      r.reel.base1 = baseReel;
      r.reel.impot1 = impotReel;
    }

    /* LMNP micro-BIC (lignes 47 à 50). */
    const baseBic = loyer * (1 - abtMeuble);
    const impotBic = baseBic * (tmi + psMeuble);
    const csgBic = a >= 2 && csgDeductible ? Math.max(0, basePrec.bic) * tauxCsg * tmi : 0;
    r.bic.impot += impotBic;
    r.bic.csg += csgBic;
    r.bic.flux.push(loyer - charges - cfe - annuite - impotBic + csgBic);
    if (a === 1) {
      r.bic.base1 = baseBic;
      r.bic.impot1 = impotBic;
    }

    /* LMNP réel (lignes 53 à 66). */
    const avantAmo = loyer - charges - cfe - comptaLmnp - (interets + assurance) - (a === 1 && !fraisImmobilises ? frais : 0);
    const differesDebut = r.lmnp.differes;
    const deduit = Math.min(amortissement + differesDebut, Math.max(0, avantAmo));
    r.lmnp.differes = differesDebut + amortissement - deduit;
    const deficitDebut = r.lmnp.deficit;
    const deficitCree = Math.max(0, -avantAmo);
    const deficitImpute = Math.min(deficitDebut, Math.max(0, avantAmo) - deduit);
    r.lmnp.deficit = deficitDebut + deficitCree - deficitImpute;
    const baseLmnp = Math.max(0, avantAmo) - deduit - deficitImpute;
    const impotLmnp = baseLmnp * (tmi + psMeuble);
    const baseAmortissable = (prix + (fraisImmobilises ? frais : 0)) * (1 - terrain);
    const partImmeuble =
      amortissement > 0
        ? (amoBati + amoTravaux) / amortissement
        : baseAmortissable + travaux + mobilier > 0
          ? (baseAmortissable + travaux) / (baseAmortissable + travaux + mobilier)
          : 0;
    r.lmnp.reintegre += deduit * partImmeuble;
    const csgLmnp = a >= 2 && csgDeductible ? Math.max(0, basePrec.lmnp) * tauxCsg * tmi : 0;
    r.lmnp.impot += impotLmnp;
    r.lmnp.csg += csgLmnp;
    r.lmnp.flux.push(loyer - charges - cfe - comptaLmnp - annuite - impotLmnp + csgLmnp);
    if (a === 1) {
      r.lmnp.base1 = baseLmnp;
      r.lmnp.impot1 = impotLmnp;
    }

    /* SCI à l'IS (lignes 69 à 89). */
    const cfeSci = mobilier > 0 ? cfe : 0;
    const resSci = loyer - charges - cfeSci - comptaSci - (interets + assurance) - amortissement - (a === 1 && !fraisImmobilises ? frais : 0);
    const defDebut = r.sci.deficit;
    const defImpute = Math.min(defDebut, Math.max(0, resSci));
    r.sci.deficit = defDebut + Math.max(0, -resSci) - defImpute;
    const benefice = Math.max(0, resSci) - defImpute;
    r.sci.benefice.push(benefice);
    const is = impotSocietes(benefice, v);
    const apresIs = resSci - is;
    const reservesDebut = r.sci.reserves;
    const tresoGeneree = loyer - charges - cfeSci - comptaSci - annuite - is;
    const tresoDebut = r.sci.tresorerie;
    const apportCca = Math.max(0, -(tresoDebut + tresoGeneree));
    const disponible = tresoDebut + tresoGeneree + apportCca;
    const ccaDebut = r.sci.cca;
    const distribue = c.distribution === "Oui";
    const rembCca = distribue ? Math.min(disponible, ccaDebut + apportCca) : 0;
    const dividende = distribue ? Math.max(0, Math.min(disponible - rembCca, Math.max(0, reservesDebut + apresIs))) : 0;
    const pfu = dividende * p(v.pfu, 31.4);
    r.sci.tresorerie = disponible - rembCca - dividende;
    r.sci.cca = ccaDebut + apportCca - rembCca;
    r.sci.reserves = reservesDebut + apresIs - dividende;
    r.sci.impot += is;
    r.sci.pfu += pfu;
    r.sci.flux.push(rembCca + dividende - pfu - apportCca);
    if (a === 1) {
      r.sci.base1 = benefice;
      r.sci.impot1 = is;
    }

    basePrec = { micro: baseMicro, reel: baseReel, bic: baseBic, lmnp: baseLmnp };
  }

  /* ── Revente (Comparateur, lignes 20 à 31) ──────────────────────────── */

  const cession = (v.prixForce ?? 0) > 0 ? (v.prixForce ?? 0) : prix * Math.pow(1 + p(v.revalorisation, 1.5), N);
  const acquisitionParticulier =
    prix +
    (c.mode === MODES[0] ? Math.max(frais, prix * p(v.forfaitFrais, 7.5)) : frais) +
    (N > (v.dureeForfaitTravaux ?? 5) ? prix * p(v.forfaitTravaux, 15) : 0);
  const abIr = (ABATTEMENT_IR[N - 1] ?? 100) / 100;
  const abPs = (ABATTEMENT_PS[N - 1] ?? 100) / 100;

  function reventeParticulier(acquisition: number) {
    const pv = Math.max(0, cession - acquisition);
    const pvIr = pv * (1 - abIr);
    const impot = pvIr * p(v.irPlusValue, 19) + pv * (1 - abPs) * p(v.psPlusValue, 17.2) + surtaxe(pvIr);
    return { pv, impot, net: cession - restantDu - impot };
  }

  const eligMicro = Math.max(loyer1, loyerFin) <= (v.plafondMicroFoncier ?? 15000);
  const eligBic = Math.max(loyer1, loyerFin) <= plafondMeuble;

  const regimes: ResultatRegime[] = [];
  const pousser = (
    regime: Regime,
    eligible: boolean,
    x: { flux: number[]; base1: number; impot1: number },
    impotsCumules: number,
    reports: number,
    acquisition: number,
    revente: { pv: number; impot: number; net: number },
  ) => {
    const fluxCumules = x.flux.reduce((s, f) => s + f, 0);
    const total = fluxCumules + revente.net;
    const flux = [-apport, ...x.flux.map((f, i) => (i === N - 1 ? f + revente.net : f))];
    const aNeg = flux.some((f) => f < 0);
    const aPos = flux.some((f) => f > 0);
    regimes.push({
      regime,
      eligible,
      base1: x.base1,
      impot1: x.impot1,
      flux1: x.flux[0] ?? 0,
      impotsCumules,
      fluxCumules,
      reports,
      acquisitionRetenue: acquisition,
      plusValue: revente.pv,
      impotRevente: revente.impot,
      netRevente: revente.net,
      total: eligible ? total : Number.NaN,
      gain: eligible ? total - apport : Number.NaN,
      tri: eligible && aNeg && aPos ? tri(flux) : Number.NaN,
      flux: x.flux,
    });
  };

  const rvParticulier = reventeParticulier(acquisitionParticulier);
  pousser(REGIMES[0], eligMicro, r.micro, r.micro.impot - r.micro.csg, 0, acquisitionParticulier, rvParticulier);
  pousser(REGIMES[1], true, r.reel, r.reel.impot - r.reel.csg, r.reel.report, acquisitionParticulier, rvParticulier);
  pousser(REGIMES[2], eligBic, r.bic, r.bic.impot - r.bic.csg, 0, acquisitionParticulier, rvParticulier);
  const acquisitionLmnp = acquisitionParticulier - r.lmnp.reintegre;
  pousser(REGIMES[3], true, r.lmnp, r.lmnp.impot - r.lmnp.csg, r.lmnp.differes + r.lmnp.deficit, acquisitionLmnp, reventeParticulier(acquisitionLmnp));

  /* SCI : plus-value professionnelle sur valeur nette comptable, IS, boni. */
  const vnc = prix + (fraisImmobilises ? frais : 0) + travaux + mobilier - r.sci.amortissements;
  const pvSci = cession - vnc;
  const beneficeN = r.sci.benefice[N - 1] ?? 0;
  const isPv = impotSocietes(Math.max(0, beneficeN + pvSci - r.sci.deficit), v) - impotSocietes(beneficeN, v);
  const liquidation = r.sci.tresorerie + cession - restantDu - isPv;
  const rembCca = Math.min(liquidation, r.sci.cca);
  const boni = Math.max(0, liquidation - r.sci.cca);
  pousser(REGIMES[4], true, r.sci, r.sci.impot + r.sci.pfu, r.sci.deficit, vnc, {
    pv: pvSci,
    impot: isPv + boni * p(v.pfu, 31.4),
    net: rembCca + boni * (1 - p(v.pfu, 31.4)),
  });

  return { duree: N, apport, cession, restantDu, regimes, tresorerieSci: r.sci.tresorerie, ccaSci: r.sci.cca };
}

/** Comparateur!C41:C42. */
export function verdict(v: V, c: C): { meilleur: string; ecart: number } {
  const valides = simuler(v, c).regimes.filter((x) => !Number.isNaN(x.total));
  if (valides.length === 0) return { meilleur: "–", ecart: Number.NaN };
  const tries = [...valides].sort((a, b) => b.total - a.total);
  return { meilleur: tries[0]!.regime, ecart: tries.length >= 2 ? tries[0]!.total - tries[1]!.total : 0 };
}

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const frPct = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

const oui = [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }];

/** Les sorties d'un régime : une ligne de synthèse, puis les chiffres qui la font. */
function sortiesRegime(rang: number): ToolSpec["outputs"] {
  const nom = REGIMES[rang]!;
  const court = ["Micro-foncier", "Réel foncier", "LMNP micro-BIC", "LMNP réel", "SCI à l'IS"][rang]!;
  const de = (v: V, c: C) => simuler(v, c).regimes[rang]!;
  return [
    {
      id: `synthese${rang}`,
      label: nom,
      unit: "texte",
      strong: true,
      compute: (v, c) => {
        const x = de(v, c);
        if (!x.eligible) return "Non éligible : plafond de recettes du régime micro dépassé";
        const t = Number.isNaN(x.tri) ? "TRI non défini" : `TRI ${frPct(x.tri)} %`;
        return `${fr(x.total)} € nets après revente, ${t}`;
      },
    },
    { id: `impot1_${rang}`, label: `${court} : impôt, année 1`, unit: "eur", compute: (v, c) => de(v, c).impot1 },
    { id: `flux1_${rang}`, label: `${court} : flux net en poche, année 1`, unit: "eur", compute: (v, c) => de(v, c).flux1 },
    { id: `impots_${rang}`, label: `${court} : impôts cumulés sur la détention`, unit: "eur", compute: (v, c) => de(v, c).impotsCumules },
    { id: `impotRevente_${rang}`, label: `${court} : impôt à la revente`, unit: "eur", compute: (v, c) => de(v, c).impotRevente },
    { id: `total_${rang}`, label: `${court} : total net après revente`, unit: "eur", compute: (v, c) => de(v, c).total },
    { id: `tri_${rang}`, label: `${court} : TRI après impôt`, unit: "pct", compute: (v, c) => de(v, c).tri },
  ];
}

export const arbitrageFiscal: ToolSpec = {
  id: "arbitrage-fiscal",
  title: "Arbitrage fiscal : nu, LMNP ou SCI à l'IS",
  intro:
    "Le même bien sous cinq régimes, sur toute la détention, revente comprise : là où les régimes se départagent.",
  sections: [
    {
      title: "Le bien",
      fields: [
        { id: "prix", label: "Prix net vendeur", value: 200000, unit: "eur", min: 0, hint: "Hors frais de notaire et hors honoraires d'agence. Bien reçu : la valeur retenue pour les droits de mutation à titre gratuit." },
        { id: "mode", label: "Comment le bien a été acquis", value: MODES[0], options: MODES.map((m) => ({ value: m, label: m })), hint: "Un achat ouvre le forfait de 7,5 % de frais pour la plus-value ; une succession ou une donation retient les frais réels." },
        { id: "frais", label: "Frais d'acquisition, notaire et agence", value: 16000, unit: "eur", min: 0 },
        { id: "travaux", label: "Travaux à l'acquisition", value: 5000, unit: "eur", min: 0, hint: "Déduits l'année 1 au réel foncier, amortis au LMNP réel et à l'IS." },
        { id: "mobilier", label: "Mobilier et équipements", value: 8000, unit: "eur", min: 0, hint: "Amorti au LMNP réel et à l'IS. 0 si vous ne comparez que des locations nues." },
      ],
    },
    {
      title: "L'exploitation",
      fields: [
        { id: "loyer", label: "Loyer annuel encaissé, année 1", value: 13200, unit: "eur", min: 0, hint: "Hors charges récupérables, net de vacance. Le même loyer sert aux cinq régimes." },
        { id: "charges", label: "Charges annuelles déductibles hors intérêts", value: 3100, unit: "eur", min: 0, hint: "Taxe foncière hors TEOM, PNO, copropriété non récupérable, gestion, entretien courant." },
        { id: "cfe", label: "CFE annuelle, régimes meublés", value: 400, unit: "eur", min: 0 },
        { id: "comptaLmnp", label: "Honoraires comptables, LMNP réel", value: 500, unit: "eur", min: 0 },
        { id: "comptaSci", label: "Honoraires comptables, SCI à l'IS", value: 1200, unit: "eur", min: 0 },
        { id: "indexation", label: "Indexation annuelle des loyers et des charges", value: 1, unit: "pct", min: -5, max: 10, step: 0.1, hint: "À partir de l'année 2. 0 pour raisonner en euros constants." },
      ],
    },
    {
      title: "Le financement et le foyer",
      fields: [
        { id: "emprunt", label: "Montant emprunté", value: 200000, unit: "eur", min: 0, hint: "0 pour un achat comptant. L'apport est la différence avec le coût total." },
        { id: "taux", label: "Taux du prêt, hors assurance", value: 3.25, unit: "pct", min: 0, max: 20, step: 0.05 },
        { id: "dureePret", label: "Durée du prêt", value: 20, unit: "an", min: 1, max: 30, step: 1 },
        { id: "assurance", label: "Taux d'assurance emprunteur, sur capital initial", value: 0.34, unit: "pct", min: 0, max: 5, step: 0.01 },
        { id: "tmi", label: "Tranche marginale d'imposition", value: "30", options: ["0", "11", "30", "41", "45"].map((t) => ({ value: t, label: `${t} %` })), hint: "Celle de votre foyer après les revenus de ce bien." },
        { id: "autresRevenusFonciers", label: "Autres revenus fonciers nets du foyer", value: 0, unit: "eur", min: 0, hint: "Ils absorbent d'abord un déficit foncier et les reports." },
      ],
    },
    {
      title: "La détention et les options",
      fields: [
        { id: "detention", label: "Durée de détention", value: 10, unit: "an", min: 1, max: 30, step: 1, hint: "La revente a lieu à la fin de cette année." },
        { id: "revalorisation", label: "Revalorisation annuelle du bien", value: 1.5, unit: "pct", min: -10, max: 20, step: 0.1 },
        { id: "prixForce", label: "Prix de revente forcé", value: 0, unit: "eur", min: 0, hint: "Facultatif. 0 : le prix vient de la revalorisation." },
        { id: "meuble", label: "Type de meublé, régime micro-BIC", value: MEUBLES[0].nom, options: MEUBLES.map((m) => ({ value: m.nom, label: m.nom })) },
        { id: "distribution", label: "SCI à l'IS : distribution annuelle", value: "Non", options: oui, hint: "Oui : la trésorerie rembourse le compte courant puis verse un dividende, imposé au PFU." },
        { id: "fraisAcquisition", label: "Frais d'acquisition au LMNP réel et à l'IS", value: FRAIS_IMMOBILISES, options: [FRAIS_IMMOBILISES, FRAIS_CHARGES].map((f) => ({ value: f, label: f })), hint: "Option comptable irrévocable." },
        { id: "renovation", label: "Travaux de rénovation énergétique", value: "Non", options: oui, hint: "Oui : plafond du déficit foncier majoré à 21 400 €, sous conditions." },
        { id: "csg", label: "Tenir compte de la CSG déductible", value: "Non", options: oui, hint: "Oui : économie d'impôt l'année suivante sur 6,8 points de CSG, régimes au barème. Non : ignorée, prudent." },
        { id: "terrain", label: "Part du terrain dans le prix", value: 15, unit: "pct", min: 0, max: 50, step: 1 },
        { id: "dureeBati", label: "Durée d'amortissement du bâti", value: 30, unit: "an", min: 1, max: 100, step: 1 },
        { id: "dureeTravaux", label: "Durée d'amortissement des travaux", value: 15, unit: "an", min: 1, max: 100, step: 1, hint: "Usage : 10 à 20 ans selon la nature." },
        { id: "dureeMobilier", label: "Durée d'amortissement du mobilier", value: 7, unit: "an", min: 1, max: 100, step: 1, hint: "Usage : 5 à 10 ans." },
      ],
    },
  ],
  params: [
    { id: "psFoncier", label: "Prélèvements sociaux, revenus fonciers", value: 17.2, unit: "pct" },
    { id: "psMeuble", label: "Prélèvements sociaux, BIC de location meublée", value: 18.6, unit: "pct", hint: "LFSS 2026." },
    { id: "csgDeductible", label: "CSG déductible l'année suivante", value: 6.8, unit: "pct" },
    { id: "abtMicroFoncier", label: "Abattement micro-foncier", value: 30, unit: "pct" },
    { id: "plafondMicroFoncier", label: "Plafond du micro-foncier", value: 15000, unit: "eur" },
    { id: "plafondDeficit", label: "Plafond d'imputation du déficit foncier", value: 10700, unit: "eur" },
    { id: "plafondDeficitMajore", label: "Plafond majoré, rénovation énergétique", value: 21400, unit: "eur" },
    { id: "abtMeubleClassique", label: "Abattement micro-BIC, meublé classique", value: 50, unit: "pct" },
    { id: "plafondMeubleClassique", label: "Plafond micro-BIC, meublé classique", value: 83600, unit: "eur" },
    { id: "abtTourismeClasse", label: "Abattement micro-BIC, tourisme classé", value: 50, unit: "pct" },
    { id: "plafondTourismeClasse", label: "Plafond micro-BIC, tourisme classé", value: 83600, unit: "eur" },
    { id: "abtTourismeNonClasse", label: "Abattement micro-BIC, tourisme non classé", value: 30, unit: "pct" },
    { id: "plafondTourismeNonClasse", label: "Plafond micro-BIC, tourisme non classé", value: 15000, unit: "eur" },
    { id: "isReduit", label: "IS, taux réduit des PME", value: 15, unit: "pct" },
    { id: "isPlafondReduit", label: "IS, plafond de bénéfice au taux réduit", value: 42500, unit: "eur" },
    { id: "isNormal", label: "IS, taux normal", value: 25, unit: "pct" },
    { id: "pfu", label: "PFU sur les dividendes", value: 31.4, unit: "pct", hint: "12,8 % d'IR et 18,6 % de prélèvements sociaux." },
    { id: "irPlusValue", label: "IR sur la plus-value des particuliers", value: 19, unit: "pct" },
    { id: "psPlusValue", label: "Prélèvements sociaux sur la plus-value", value: 17.2, unit: "pct" },
    { id: "forfaitFrais", label: "Forfait de frais d'acquisition, plus-value", value: 7.5, unit: "pct" },
    { id: "forfaitTravaux", label: "Forfait travaux, plus-value", value: 15, unit: "pct" },
    { id: "dureeForfaitTravaux", label: "Détention minimale pour le forfait travaux", value: 5, unit: "an", hint: "Strictement plus de cinq années." },
  ],
  headlines: [
    {
      label: "Régime le plus favorable sur la durée",
      unit: "texte",
      compute: (v, c) => verdict(v, c).meilleur,
      caption: (v, c) => {
        const { ecart } = verdict(v, c);
        return `${fr(ecart)} € d'avance sur le suivant, flux et revente compris. Un écart inférieur au coût d'une comptabilité ou d'une structure ne tranche rien.`;
      },
    },
    {
      label: "Total net en poche, meilleur régime",
      unit: "eur",
      compute: (v, c) => {
        const s = simuler(v, c);
        const m = verdict(v, c).meilleur;
        return s.regimes.find((x) => x.regime === m)?.total ?? Number.NaN;
      },
      caption: (v, c) => {
        const s = simuler(v, c);
        return `Sur ${s.duree} ans, pour ${fr(s.apport)} € d'apport et une revente à ${fr(s.cession)} €.`;
      },
    },
  ],
  outputs: [
    { id: "cout", label: "Coût total de l'opération", unit: "eur", compute: (v) => (v.prix ?? 0) + (v.frais ?? 0) + (v.travaux ?? 0) + (v.mobilier ?? 0) },
    { id: "apport", label: "Apport personnel", unit: "eur", compute: (v, c) => simuler(v, c).apport, hint: "À l'IS, il est placé en compte courant d'associé, remboursable sans impôt." },
    { id: "cession", label: "Prix de cession retenu", unit: "eur", compute: (v, c) => simuler(v, c).cession },
    { id: "restantDu", label: "Capital restant dû à la revente", unit: "eur", compute: (v, c) => simuler(v, c).restantDu },
    ...REGIMES.flatMap((_, i) => sortiesRegime(i)),
    { id: "tresorerieSci", label: "SCI à l'IS : trésorerie restant en société", unit: "eur", compute: (v, c) => simuler(v, c).tresorerieSci, hint: "L'argent qui n'est pas un revenu tant qu'il n'est pas distribué." },
  ],
  caveat:
    "Un écart de quelques milliers d'euros sur dix ans ne justifie pas une structure plus lourde : une SCI coûte en comptabilité, en formalités et en souplesse de sortie ce que ce total ne compte pas. Ce calcul éclaire un choix, il ne remplace pas l'avis d'un conseil fiscal sur votre situation.",
};
