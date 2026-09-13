/**
 * DCF IMMOBILIER — la version en ligne de
 * `public/outils/matrices/dcf-valorisation.xlsx`, onglet « DCF ».
 *
 * LES FLUX DES FONDS PROPRES, PAS CEUX DE L'ACTIF. Le flux de la période 0
 * est l'apport, pas le prix : la dette in fine finance le reste, ses intérêts
 * sortent chaque année et son capital à la cession. Entre les deux, un
 * immeuble partiellement vacant se reloue selon un calendrier saisi, porte le
 * coût de ses surfaces vides, accorde des franchises, paie ses honoraires de
 * commercialisation et son programme de travaux. À la sortie, le loyer de la
 * dernière année est capitalisé au taux AEM, ramené hors droits, net des
 * honoraires d'investissement.
 *
 * Ce que la matrice révisée change par rapport à la version précédente, qui
 * projetait dix ans de NOI d'un actif sans dette :
 *   · un horizon de 1 à 7 ans, et des flux de FONDS PROPRES avec levier ;
 *   · la relocation de la vacance et l'engagement du capex période par
 *     période, avec leurs contrôles ;
 *   · le coût de la vacance, la franchise, les honoraires de relocation ;
 *   · l'ICR année par année, et les rendements AEM de contrôle.
 */

import { ratio, tri, type ToolSpec } from "../spec";

type V = Record<string, number>;
type T = Record<string, number[][]>;

export const PERIODES = 7;
const pc = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

export function acquisition(v: V) {
  const aem = v.prixAem ?? 0;
  const droits = pc(v.droits, 7.4);
  const hd = aem / (1 + droits);
  const montantDroits = aem - hd;
  const dette = (hd + montantDroits) * pc(v.ltv, 50);
  const fondsPropres = hd + montantDroits - dette;
  const surface = v.surface ?? 0;
  const vacante = surface - (v.surfaceLouee ?? 0);
  const capexTotal = (v.surfaceRenovee ?? 0) * (v.capexM2 ?? 0) + (v.capexComplementaire ?? 0);
  return { hd, montantDroits, hdM2: ratio(hd, surface), dette, fondsPropres, vacante, occupation: ratio(v.surfaceLouee ?? 0, surface), capexTotal };
}

export interface Periode {
  periode: number;
  annee: number;
  relouee: number;
  cumul: number;
  restante: number;
  loyerEnPlace: number;
  loyerReloue: number;
  loyers: number;
  vacance: number;
  franchise: number;
  capex: number;
  honorairesLocation: number;
  interets: number;
  remboursement: number;
  cession: number;
  cashFlow: number;
  actualise: number;
  icr: number;
}

export function flux(v: V, t: T): { zero: number; periodes: Periode[] } {
  const a = acquisition(v);
  const calendrier = t.calendrier ?? [];
  const index = pc(v.indexation, 2.5);
  const vlm = v.vlm ?? 0;
  const horizon = v.horizon ?? 7;
  const actu = pc(v.actualisation, 8);
  const periodes: Periode[] = [];
  let cumul = 0;
  for (let p = 1; p <= PERIODES; p += 1) {
    const [partRelouee = 0, partCapex = 0] = calendrier[p - 1] ?? [];
    const relouee = (partRelouee / 100) * a.vacante;
    cumul += relouee;
    const restante = a.vacante - cumul;
    const facteur = (1 + index) ** p;
    const loyerEnPlace = (v.loyer ?? 0) * facteur;
    const loyerReloue = cumul * vlm * facteur;
    const loyers = loyerEnPlace + loyerReloue;
    const vacance = restante * (v.chargesVacant ?? 0);
    const franchise = relouee * vlm * facteur * ((v.franchise ?? 0) / 12);
    const capex = (partCapex / 100) * a.capexTotal;
    const honorairesLocation = relouee * vlm * pc(v.honorairesLocation, 20);
    const interets = p <= horizon ? a.dette * pc(v.tauxDette, 4.5) : 0;
    const remboursement = p === horizon ? a.dette : 0;
    const cession = p === horizon ? (loyers / pc(v.tauxSortie, 7.1) / (1 + pc(v.droits, 7.4))) * (1 - pc(v.honorairesInvest, 2.5)) : 0;
    const cashFlow = p <= horizon ? loyers - vacance - franchise - capex - honorairesLocation - interets - remboursement + cession : 0;
    periodes.push({
      periode: p,
      annee: (v.anneeAcquisition ?? 2026) + p,
      relouee,
      cumul,
      restante,
      loyerEnPlace,
      loyerReloue,
      loyers,
      vacance,
      franchise,
      capex,
      honorairesLocation,
      interets,
      remboursement,
      cession,
      cashFlow,
      actualise: cashFlow / (1 + actu) ** p,
      icr: interets === 0 ? Number.NaN : loyers / interets,
    });
  }
  return { zero: -a.fondsPropres, periodes };
}

export function resultats(v: V, t: T) {
  const { zero, periodes } = flux(v, t);
  const calendrier = t.calendrier ?? [];
  const sommeRelouee = calendrier.reduce((s, r) => s + (r[0] ?? 0), 0);
  const sommeCapex = calendrier.reduce((s, r) => s + (r[1] ?? 0), 0);
  const horizon = v.horizon ?? 7;
  const a = acquisition(v);
  const detenues = periodes.filter((p) => p.periode <= horizon);
  return {
    van: zero + periodes.reduce((s, p) => s + p.actualise, 0),
    tri: tri([zero, ...periodes.map((p) => p.cashFlow)]),
    cession: periodes.find((p) => p.periode === horizon)?.cession ?? 0,
    icrMin: detenues.length ? Math.min(...detenues.map((p) => p.icr)) : Number.NaN,
    sommeRelouee,
    sommeCapex,
    horizonOk: horizon >= 1 && horizon <= PERIODES && Number.isInteger(horizon),
    rendementInitial: ratio(v.loyer ?? 0, a.hd + a.montantDroits),
    rendementPotentiel: ratio((v.surface ?? 0) * (v.vlm ?? 0), a.hd + a.montantDroits),
    periodes,
    zero,
  };
}

/* ── La spécification ────────────────────────────────────────────────────── */

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const fr1 = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);

export const dcf: ToolSpec = {
  id: "dcf",
  title: "DCF immobilier avec levier",
  intro:
    "Les flux des fonds propres sur sept ans au plus : relocation, travaux, dette in fine, cession, VAN et TRI.",
  sections: [
    {
      title: "L'acquisition",
      fields: [
        { id: "prixAem", label: "Prix d'acquisition acte en main", value: 10000000, unit: "eur", min: 0, hint: "Droits inclus. Le prix hors droits s'en déduit." },
        { id: "droits", label: "Droits d'enregistrement", value: 7.4, unit: "pct", min: 0, max: 20, step: 0.1 },
        { id: "surface", label: "Surface totale", value: 5000, unit: "m2", min: 1 },
        { id: "anneeAcquisition", label: "Année d'acquisition", value: 2026, unit: "nombre", step: 1 },
      ],
    },
    {
      title: "La situation locative",
      fields: [
        { id: "loyer", label: "Loyer actuel HT HC par an", value: 600000, unit: "eur", min: 0, hint: "Supposé courir et s'indexer sur tout l'horizon, sans break ni échéance." },
        { id: "surfaceLouee", label: "Surface louée", value: 4000, unit: "m2", min: 0 },
        { id: "indexation", label: "Indexation annuelle", value: 2.5, unit: "pct", step: 0.1 },
        { id: "vlm", label: "Valeur locative de marché", value: 140, unit: "eurm2", min: 0, hint: "€ HT HC par m² et par an, pour les surfaces relouées." },
        { id: "chargesVacant", label: "Charges et fiscalité sur le vacant", value: 38, unit: "eurm2", min: 0, hint: "€ par m² vacant et par an, à la charge du propriétaire." },
        { id: "franchise", label: "Franchise accordée à la relocation", value: 4, unit: "mois", min: 0, max: 36, step: 1 },
        { id: "honorairesLocation", label: "Honoraires de relocation", value: 20, unit: "pct", min: 0, hint: "En part du loyer annuel reloué." },
      ],
    },
    {
      title: "Les travaux",
      fields: [
        { id: "surfaceRenovee", label: "Surface à rénover", value: 1000, unit: "m2", min: 0 },
        { id: "capexM2", label: "Capex de rénovation", value: 330, unit: "eurm2", min: 0 },
        { id: "capexComplementaire", label: "Capex complémentaires, global", value: 250000, unit: "eur", min: 0 },
      ],
    },
    {
      title: "La sortie, le financement et l'actualisation",
      fields: [
        { id: "horizon", label: "Horizon de détention", value: 7, unit: "an", min: 1, max: 7, step: 1, hint: "De 1 à 7 ans. La cession a lieu la dernière année." },
        { id: "tauxSortie", label: "Taux de sortie acte en main", value: 7.1, unit: "pct", min: 0.1, step: 0.05, hint: "Le loyer de la dernière année est capitalisé à ce taux : convention prudente." },
        { id: "honorairesInvest", label: "Honoraires d'investissement à la cession", value: 2.5, unit: "pct", min: 0, step: 0.1 },
        { id: "ltv", label: "LTV", value: 50, unit: "pct", min: 0, max: 100, step: 1, hint: "Dette in fine, en part du prix acte en main." },
        { id: "tauxDette", label: "Taux d'intérêt de la dette", value: 4.5, unit: "pct", min: 0, step: 0.05 },
        { id: "actualisation", label: "Taux d'actualisation des fonds propres", value: 8, unit: "pct", min: 0, step: 0.25, hint: "Nettement au-dessus du taux de la dette : les fonds propres portent le risque." },
      ],
    },
  ],
  tables: [
    {
      id: "calendrier",
      title: "Le calendrier de relocation et de travaux",
      hint: "Par période : la part de la surface vacante relouée (100 % au plus sur l'horizon) et la part du capex engagée (100 % au total). Les surfaces sont relouées au premier jour de la période.",
      addLabel: "Ajouter une période",
      min: PERIODES,
      max: PERIODES,
      rowLabels: Array.from({ length: PERIODES }, (_, i) => `Période ${i + 1}`),
      columns: [
        { id: "relouee", label: "Surface vacante relouée (%)", short: "Vacant reloué %", value: 0, unit: "pct" },
        { id: "capex", label: "Capex engagé (%)", short: "Capex engagé %", value: 0, unit: "pct" },
      ],
      rows: [[0, 60], [50, 40], [30, 0], [20, 0], [0, 0], [0, 0], [0, 0]],
    },
  ],
  params: [],
  headlines: [
    {
      label: "TRI des fonds propres",
      unit: "pct",
      compute: (v, c, t) => resultats(v, t).tri,
      caption: (v, c, t) => {
        const r = resultats(v, t);
        if (!r.horizonOk) return "Horizon hors de 1 à 7 ans : aucune cession n'est simulée.";
        return `VAN de ${fr(r.van)} € au taux de ${fr1(v.actualisation ?? 8)} %, pour ${fr(acquisition(v).fondsPropres)} € de fonds propres.`;
      },
    },
    {
      label: "Prix de cession net vendeur",
      unit: "eur",
      compute: (v, c, t) => resultats(v, t).cession,
      caption: (v) => `En année ${(v.anneeAcquisition ?? 2026) + (v.horizon ?? 7)}, dette de ${fr(acquisition(v).dette)} € remboursée sur ce prix.`,
    },
  ],
  outputs: [
    { id: "hd", label: "Prix d'acquisition hors droits", unit: "eur", compute: (v) => acquisition(v).hd },
    { id: "droitsMontant", label: "Montant des droits", unit: "eur", compute: (v) => acquisition(v).montantDroits },
    { id: "hdM2", label: "Prix hors droits au m²", unit: "eurm2", compute: (v) => acquisition(v).hdM2 },
    { id: "vacante", label: "Surface vacante", unit: "m2", compute: (v) => acquisition(v).vacante },
    { id: "occupation", label: "Taux d'occupation", unit: "pct", compute: (v) => acquisition(v).occupation * 100 },
    { id: "capexTotal", label: "Capex total du programme", unit: "eur", compute: (v) => acquisition(v).capexTotal },
    { id: "dette", label: "Dette in fine", unit: "eur", compute: (v) => acquisition(v).dette },
    { id: "fondsPropres", label: "Fonds propres investis", unit: "eur", compute: (v) => acquisition(v).fondsPropres, strong: true, hint: "Le flux de la période 0." },
    { id: "rendementInitial", label: "Rendement initial AEM sur loyer actuel", unit: "pct", compute: (v, c, t) => resultats(v, t).rendementInitial * 100 },
    { id: "rendementPotentiel", label: "Rendement potentiel AEM sur VLM, 100 % loué", unit: "pct", compute: (v, c, t) => resultats(v, t).rendementPotentiel * 100 },
    {
      id: "cashFlows",
      label: "Cash-flows des fonds propres, par année",
      unit: "texte",
      compute: (v, c, t) => {
        const r = resultats(v, t);
        return [`${v.anneeAcquisition ?? 2026} : ${fr(r.zero)} €`, ...r.periodes.filter((p) => p.periode <= (v.horizon ?? 7)).map((p) => `${p.annee} : ${fr(p.cashFlow)} €`)].join(" · ");
      },
    },
    {
      id: "loyers",
      label: "Loyers, par année",
      unit: "texte",
      compute: (v, c, t) => resultats(v, t).periodes.filter((p) => p.periode <= (v.horizon ?? 7)).map((p) => `${p.annee} : ${fr(p.loyers)} €`).join(" · "),
    },
    { id: "van", label: "VAN des fonds propres", unit: "eur", compute: (v, c, t) => resultats(v, t).van, strong: true },
    { id: "tri", label: "TRI des fonds propres", unit: "pct", compute: (v, c, t) => resultats(v, t).tri, strong: true },
    { id: "icrMin", label: "ICR le plus bas sur la détention", unit: "fois", compute: (v, c, t) => resultats(v, t).icrMin, hint: "Loyers bruts sur intérêts. Une banque raisonne sur un revenu net : son ICR sera plus bas." },
    { id: "controleRelouee", label: "Surface vacante relouée sur l'horizon", unit: "texte", compute: (v, c, t) => { const s = resultats(v, t).sommeRelouee; return s <= 100 ? `${fr1(s)} %, OK` : `${fr1(s)} %, au-delà de 100 % : à corriger`; } },
    { id: "controleCapex", label: "Capex engagé", unit: "texte", compute: (v, c, t) => { const s = resultats(v, t).sommeCapex; return Math.abs(s - 100) < 1e-9 ? "100 %, OK" : `${fr1(s)} %, doit faire 100 % : à corriger`; } },
    { id: "controleHorizon", label: "Horizon de détention", unit: "texte", compute: (v, c, t) => (resultats(v, t).horizonOk ? "OK" : "Erreur : entre 1 et 7 ans") },
  ],
  caveat:
    "Le modèle ne gère aucune échéance de bail : le loyer en place court et s'indexe sur tout l'horizon. Il n'intègre ni fiscalité, ni frais de structure, ni baux à paliers. Le taux de sortie et le taux d'actualisation portent l'essentiel du résultat : ils se justifient.",
};
