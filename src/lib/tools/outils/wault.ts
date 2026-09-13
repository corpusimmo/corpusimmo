/**
 * RENT ROLL ET WAULT — la version en ligne de
 * `public/outils/matrices/rent-roll-et-wault.xlsx`, onglets « Rent roll »,
 * « Synthèse » et « Échéancier ».
 *
 * L'ÉTAT LOCATIF LOT PAR LOT, PUIS CE QU'IL DIT DE L'IMMEUBLE. Une ligne par
 * lot, loué ou vacant : surface, loyer facial, valeur locative de marché,
 * dates du bail, périodicité de sortie, franchise. Le reste se calcule :
 * occupation physique et financière, loyer économique, réversion, WAULT et
 * WALB pondérés par le loyer, concentration par signature, échéancier.
 *
 * Ce que la matrice révisée ajoute à la version précédente, qui prenait trois
 * baux déjà réduits à un loyer et deux dates :
 *   · la prochaine sortie CALCULÉE depuis la prise d'effet et la périodicité
 *     (triennale par défaut, 6 ou 9 ans sur dérogation), ou forcée ;
 *   · les lots vacants et le taux d'occupation financier EPRA ;
 *   · le loyer économique, franchise étalée sur la période ferme ;
 *   · la réversion face à la valeur locative de marché ;
 *   · la concentration par locataire, tous ses lots additionnés ;
 *   · l'échéancier année par année, au terme et à la sortie, avec l'alerte
 *     de concentration.
 */

import { estVide, fromISODate, ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type T = Record<string, number[][]>;

export const NATURES = ["Bureaux", "Commerce", "Activité", "Logistique", "Parking", "Autre"] as const;
export const STATUTS = ["Loué", "Vacant"] as const;

/** Colonnes du tableau `lots`, dans l'ordre. */
const COL = { nature: 0, statut: 1, locataire: 2, surface: 3, loyer: 4, vlm: 5, effet: 6, echeance: 7, periodicite: 8, sortie: 9, franchise: 10 } as const;

const JOUR = 86_400_000;
const d = (x: number) => new Date(x);
const vide = (x: number | undefined) => estVide(x);
const num = (x: number | undefined) => (vide(x) ? 0 : (x as number));

/** EDATE d'Excel : même jour, n mois plus loin, ramené au dernier jour du mois s'il n'existe pas. */
export function edate(ts: number, mois: number): number {
  const x = d(ts);
  const total = x.getUTCFullYear() * 12 + x.getUTCMonth() + mois;
  const annee = Math.floor(total / 12);
  const m = total - annee * 12;
  const dernier = new Date(Date.UTC(annee, m + 1, 0)).getUTCDate();
  return Date.UTC(annee, m, Math.min(x.getUTCDate(), dernier), x.getUTCHours());
}

/** Mois révolus entre deux dates, comme la formule du classeur. */
function moisRevolus(debut: number, fin: number): number {
  const a = d(debut);
  const b = d(fin);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

export interface Lot {
  rang: number;
  loue: boolean;
  locataire: number;
  surface: number;
  loyerFacial: number;
  vlm: number;
  vlmRenseignee: boolean;
  echeance: number;
  prochaineSortie: number;
  loyerEconomique: number;
  dureeTerme: number;
  dureeSortie: number;
  motif: string;
  ok: boolean;
}

function periodicite(r: number[], v: V): number {
  return vide(r[COL.periodicite]) ? (v.periodiciteLegale ?? 3) : (r[COL.periodicite] as number);
}

/** S11 : mois de la période d'engagement ferme initiale. */
function periodeFerme(r: number[], v: V): number {
  const m = num(r[COL.effet]);
  const n = num(r[COL.echeance]);
  if (!m || !n || n <= m) return 0;
  const a = d(m);
  const b = d(n);
  return Math.min(12 * periodicite(r, v), (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1);
}

/** V11:W11 : le premier motif qui empêche de retenir la ligne, ou vide. */
function motif(r: number[], v: V): string {
  const loue = r[COL.statut] === 0;
  const surface = num(r[COL.surface]);
  const loyer = num(r[COL.loyer]);
  const vlm = r[COL.vlm];
  const m = num(r[COL.effet]);
  const n = num(r[COL.echeance]);
  const o = r[COL.periodicite];
  const p = r[COL.sortie];
  const f = r[COL.franchise];
  const loyerMax = v.loyerMax ?? 5000;
  const dureeMax = v.dureeMax ?? 99;
  if (!v.dateAnalyse) return "Date d'analyse manquante.";
  if (!(surface > 0)) return "Surface manquante ou nulle.";
  if (surface > (v.surfaceMax ?? 100000)) return "Surface au-delà du garde-fou de saisie.";
  if (!vide(vlm) && !((vlm as number) >= 0 && (vlm as number) <= loyerMax)) return "Valeur locative de marché hors bornes.";
  if (loue) {
    if (!(num(r[COL.locataire]) > 0)) return "Lot déclaré loué sans locataire.";
    if (!(loyer > 0)) return "Loyer facial manquant ou nul.";
    if (loyer > loyerMax) return "Loyer facial au-delà du garde-fou de saisie.";
    if (!m) return "Date de prise d'effet manquante.";
    if (!n) return "Date d'échéance manquante.";
    if (n <= m) return "Échéance antérieure ou égale à la prise d'effet.";
    if ((n - m) / JOUR / 365.25 > dureeMax) return "Durée du bail au-delà du garde-fou de saisie.";
    if (!vide(o) && !((o as number) >= 1 && (o as number) <= dureeMax && Number.isInteger(o))) return "Périodicité de sortie hors bornes.";
    if (!vide(p) && !((p as number) > v.dateAnalyse && (p as number) <= n)) return "Sortie forcée hors de l'intervalle admis.";
    if (!vide(f) && !((f as number) >= 0 && (f as number) <= (v.franchiseMax ?? 24) && (f as number) <= periodeFerme(r, v)))
      return "Franchise hors bornes ou plus longue que la période ferme.";
  } else {
    if (num(r[COL.locataire]) > 0) return "Lot vacant avec un locataire renseigné.";
    if (loyer !== 0) return "Lot vacant avec un loyer renseigné.";
  }
  return "";
}

export function lots(v: V, t: T): Lot[] {
  const c7 = v.dateAnalyse ?? 0;
  return (t.lots ?? []).map((r, rang) => {
    const loue = r[COL.statut] === 0;
    const surface = num(r[COL.surface]);
    const loyerFacial = surface * (loue ? num(r[COL.loyer]) : 0);
    const vlm = surface * num(r[COL.vlm]);
    const m = num(r[COL.effet]);
    const n = num(r[COL.echeance]);
    let prochaineSortie = Number.NaN;
    if (c7 && m && n) {
      if (!vide(r[COL.sortie])) prochaineSortie = r[COL.sortie] as number;
      else {
        const per = periodicite(r, v);
        if (per > 0) {
          const pas = 12 * per;
          const k = Math.max(1, Math.floor(moisRevolus(m, c7 + JOUR) / pas) + 1);
          prochaineSortie = Math.min(edate(m, pas * k) - JOUR, n);
        }
      }
    }
    const franchise = r[COL.franchise];
    const ferme = periodeFerme(r, v);
    const loyerEconomique =
      loyerFacial === 0 ? 0
      : vide(franchise) || franchise === 0 ? loyerFacial
      : ferme <= 0 ? 0
      : Math.max(0, loyerFacial * (1 - (franchise as number) / ferme));
    const m0 = motif(r, v);
    return {
      rang,
      loue,
      locataire: num(r[COL.locataire]),
      surface,
      loyerFacial,
      vlm,
      vlmRenseignee: !vide(r[COL.vlm]),
      echeance: loue ? n : Number.NaN,
      prochaineSortie: loue ? prochaineSortie : Number.NaN,
      loyerEconomique,
      dureeTerme: loue && n && c7 ? Math.max(0, (n - c7) / JOUR / 365.25) : 0,
      dureeSortie: loue && Number.isFinite(prochaineSortie) && c7 ? Math.max(0, (prochaineSortie - c7) / JOUR / 365.25) : 0,
      motif: m0 || (vide(r[COL.vlm]) ? "Valeur locative de marché non renseignée." : ""),
      ok: m0 === "",
    };
  });
}

/* ── Synthèse ────────────────────────────────────────────────────────────── */

export function synthese(v: V, t: T) {
  const tous = lots(v, t);
  const ok = tous.filter((l) => l.ok);
  const loues = ok.filter((l) => l.loue);
  const somme = (ls: Lot[], f: (l: Lot) => number) => ls.reduce((s, l) => s + f(l), 0);
  const surfaceTotale = somme(ok, (l) => l.surface);
  const surfaceLouee = somme(loues, (l) => l.surface);
  const vlmRenseignee = ok.length > 0 && ok.every((l) => l.vlmRenseignee);
  const vlmTotale = somme(ok, (l) => l.vlm);
  const vlmVacante = somme(ok.filter((l) => !l.loue), (l) => l.vlm);
  const facial = somme(loues, (l) => l.loyerFacial);
  const economique = somme(loues, (l) => l.loyerEconomique);
  const vlmLouee = somme(loues, (l) => l.vlm);
  const aCorriger = tous.filter((l) => l.motif !== "");
  const c7 = v.dateAnalyse ?? 0;
  const echus = loues.filter((l) => l.echeance < c7);

  // X11 : le loyer de chaque signature, tous ses lots additionnés.
  const parLocataire = new Map<number, number>();
  for (const l of loues) parLocataire.set(l.locataire, (parLocataire.get(l.locataire) ?? 0) + l.loyerFacial);
  let premier = 0;
  let poidsPremier = 0;
  for (const [loc, loyer] of parLocataire) if (loyer > poidsPremier) [premier, poidsPremier] = [loc, loyer];

  return {
    surfaceTotale,
    surfaceLouee,
    surfaceVacante: surfaceTotale - surfaceLouee,
    occupationPhysique: surfaceTotale === 0 ? Number.NaN : surfaceLouee / surfaceTotale,
    vlmTotale,
    vlmVacante,
    occupationFinanciere: !vlmRenseignee || vlmTotale === 0 ? Number.NaN : 1 - vlmVacante / vlmTotale,
    facial,
    economique,
    effetFranchises: facial - economique,
    partFranchises: facial === 0 ? Number.NaN : (facial - economique) / facial,
    loyerM2: surfaceLouee === 0 ? Number.NaN : facial / surfaceLouee,
    vlmLouee: vlmRenseignee ? vlmLouee : Number.NaN,
    reversion: !vlmRenseignee || facial === 0 || vlmLouee === 0 ? Number.NaN : vlmLouee - facial,
    partReversion: !vlmRenseignee || facial === 0 || vlmLouee === 0 ? Number.NaN : vlmLouee / facial - 1,
    baux: loues.length,
    aCorriger: aCorriger.length,
    premiereACorriger: aCorriger[0],
    echus: echus.length,
    loyerEchus: somme(echus, (l) => l.loyerFacial),
    wault: facial === 0 ? Number.NaN : somme(loues, (l) => l.loyerFacial * l.dureeTerme) / facial,
    walb: facial === 0 ? Number.NaN : somme(loues, (l) => l.loyerFacial * l.dureeSortie) / facial,
    waultEco: economique === 0 ? Number.NaN : somme(loues, (l) => l.loyerEconomique * l.dureeTerme) / economique,
    walbEco: economique === 0 ? Number.NaN : somme(loues, (l) => l.loyerEconomique * l.dureeSortie) / economique,
    locataires: parLocataire.size,
    premierLocataire: premier,
    poidsPremier: facial === 0 ? Number.NaN : poidsPremier / facial,
    exploitable: Boolean(c7) && loues.length > 0 && aCorriger.length === 0,
  };
}

/* ── Échéancier ──────────────────────────────────────────────────────────── */

export interface Periode {
  libelle: string;
  auTerme: number;
  bauxTerme: number;
  aLaSortie: number;
  bauxSortie: number;
}

export function echeancier(v: V, t: T): Periode[] {
  const c7 = v.dateAnalyse ?? 0;
  if (!c7) return [];
  const loues = lots(v, t).filter((l) => l.ok && l.loue);
  const annee0 = d(c7).getUTCFullYear();
  const periode = (libelle: string, dans: (x: number) => boolean): Periode => {
    const terme = loues.filter((l) => dans(l.echeance));
    const sortie = loues.filter((l) => dans(l.prochaineSortie));
    return {
      libelle,
      auTerme: terme.reduce((s, l) => s + l.loyerFacial, 0),
      bauxTerme: terme.length,
      aLaSortie: sortie.reduce((s, l) => s + l.loyerFacial, 0),
      bauxSortie: sortie.length,
    };
  };
  // Les critères de date d'Excel comparent des jours entiers : la date
  // d'analyse compte à partir de minuit.
  const minuit = (x: number) => Math.floor(x / JOUR) * JOUR;
  const debut = minuit(c7);
  const lignes = [periode("Baux échus, en tacite prolongation", (x) => x < debut)];
  for (let i = 0; i < 15; i += 1) {
    const a = annee0 + i;
    const bas = Math.max(Date.UTC(a, 0, 1), debut);
    const haut = Date.UTC(a, 11, 31) + JOUR;
    lignes.push(periode(String(a), (x) => x >= bas && x < haut));
  }
  const fin = Date.UTC(annee0 + 14, 11, 31) + JOUR;
  lignes.push(periode(`Au-delà de ${annee0 + 14}`, (x) => x >= fin));
  return lignes;
}

/* ── La spécification ────────────────────────────────────────────────────── */

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const pc1 = (x: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x * 100);
const LOTS = ["R+1 Plateau A", "R+1 Plateau B", "RDC Local 1", "RDC Local 2", "R+2 Plateau C", "R+2 Plateau D", "RDC Local 3"];
const nomLot = (rang: number) => LOTS[rang] ?? `Lot ${rang + 1 - LOTS.length}`;
const D = fromISODate;
const N = Number.NaN;

export const wault: ToolSpec = {
  id: "wault",
  title: "Rent roll et WAULT",
  intro:
    "L'état locatif lot par lot, puis l'occupation, la réversion, le WAULT, la durée ferme et l'échéancier des sorties.",
  sections: [
    {
      title: "L'analyse",
      fields: [
        { id: "dateAnalyse", label: "Date d'analyse", value: D("2026-06-30"), unit: "date", hint: "Toutes les durées résiduelles et l'échéancier partent de cette date. Date d'arrêté ou de closing, pas forcément aujourd'hui." },
      ],
    },
  ],
  tables: [
    {
      id: "lots",
      title: "Le rent roll",
      hint: "Une ligne par lot, loué ou vacant. Le même numéro de locataire sur deux lots additionne leurs loyers dans la concentration. Loyer et valeur locative en €/m²/an HT HC. Périodicité vide : triennale. Sortie forcée : seulement pour imposer une date connue.",
      addLabel: "Ajouter un lot",
      min: 1,
      max: 40,
      rowLabels: LOTS,
      extraLabel: "Lot",
      columns: [
        { id: "nature", label: "Nature", value: 0, unit: "nombre", options: NATURES.map((x, i) => ({ value: i, label: x })) },
        { id: "statut", label: "Statut", value: 0, unit: "nombre", options: STATUTS.map((x, i) => ({ value: i, label: x })) },
        { id: "locataire", label: "Locataire (numéro)", short: "Locataire n°", value: 1, unit: "nombre", optional: true, placeholder: "vacant" },
        { id: "surface", label: "Surface", value: 100, unit: "m2" },
        { id: "loyer", label: "Loyer facial €/m²/an", short: "Loyer €/m²/an", value: 250, unit: "eurm2", optional: true },
        { id: "vlm", label: "Valeur locative de marché €/m²/an", short: "VLM €/m²/an", value: 250, unit: "eurm2", optional: true },
        { id: "effet", label: "Prise d'effet", value: D("2026-01-01"), unit: "date", optional: true },
        { id: "echeance", label: "Échéance", value: D("2034-12-31"), unit: "date", optional: true },
        { id: "periodicite", label: "Périodicité de sortie (ans)", short: "Périodicité", value: 3, unit: "an", optional: true, placeholder: "3" },
        { id: "sortie", label: "Sortie forcée", value: 0, unit: "date", optional: true },
        { id: "franchise", label: "Franchise (mois)", short: "Franchise", value: 0, unit: "mois", optional: true },
      ],
      rows: [
        [0, 0, 1, 420, 285, 300, D("2023-07-01"), D("2032-06-30"), N, N, 3],
        [0, 0, 2, 310, 275, 300, D("2021-01-01"), D("2029-12-31"), N, N, N],
        [1, 0, 3, 180, 420, 400, D("2021-09-01"), D("2030-08-31"), N, N, N],
        [1, 1, N, 95, N, 380, N, N, N, N, N],
        [0, 0, 4, 400, 268, 300, D("2024-04-01"), D("2033-03-31"), 6, N, 6],
        [0, 0, 1, 210, 278, 300, D("2023-07-01"), D("2032-06-30"), N, N, 3],
        [1, 0, 5, 140, 390, 400, D("2017-10-01"), D("2026-09-30"), N, N, N],
      ],
    },
  ],
  params: [
    { id: "periodiciteLegale", label: "Périodicité légale des facultés de sortie d'un bail commercial", value: 3, unit: "an", hint: "Code de commerce, art. L145-4." },
    { id: "preavis", label: "Préavis de congé d'un bail commercial", value: 6, unit: "mois", hint: "Code de commerce, art. L145-9." },
    { id: "seuilAnnee", label: "Seuil d'alerte de concentration d'une année de sortie", value: 33, unit: "pct" },
    { id: "seuilLocataire", label: "Seuil de dépendance au premier locataire", value: 40, unit: "pct" },
    { id: "repereBureaux", label: "Repère : durée ferme d'une foncière de bureaux (Icade, 2025)", value: 3.4, unit: "an" },
    { id: "repereDiversifiee", label: "Repère : durée ferme d'une foncière diversifiée (Covivio, 2025)", value: 6.4, unit: "an" },
    { id: "loyerMax", label: "Loyer et valeur locative maximaux admis à la saisie", value: 5000, unit: "eurm2" },
    { id: "surfaceMax", label: "Surface maximale admise pour un lot", value: 100000, unit: "m2" },
    { id: "dureeMax", label: "Durée maximale d'un bail et d'une périodicité", value: 99, unit: "an" },
    { id: "franchiseMax", label: "Franchise maximale admise à la saisie", value: 24, unit: "mois" },
  ],
  headlines: [
    {
      label: "WALB, durée résiduelle ferme",
      unit: "annees",
      compute: (v, c, t) => synthese(v, t).walb,
      caption: (v, c, t) => {
        const s = synthese(v, t);
        if (!s.exploitable) return s.premiereACorriger ? `À corriger, ${nomLot(s.premiereACorriger.rang)} : ${s.premiereACorriger.motif}` : "Aucun bail retenu.";
        return `WAULT jusqu'au terme : ${s.wault.toFixed(2).replace(".", ",")} ans. Repères de place : ${String(v.repereBureaux ?? 3.4).replace(".", ",")} ans en bureaux, ${String(v.repereDiversifiee ?? 6.4).replace(".", ",")} ans en diversifié.`;
      },
    },
    {
      label: "Poids du premier locataire",
      unit: "pct",
      compute: (v, c, t) => synthese(v, t).poidsPremier * 100,
      caption: (v, c, t) => {
        const s = synthese(v, t);
        if (!Number.isFinite(s.poidsPremier)) return "";
        return s.poidsPremier <= (v.seuilLocataire ?? 40) / 100
          ? `Locataire n° ${s.premierLocataire}, sous le seuil d'alerte de ${fr(v.seuilLocataire ?? 40)} %.`
          : `Locataire n° ${s.premierLocataire}, au-delà du seuil de ${fr(v.seuilLocataire ?? 40)} % : l'immeuble se valorise comme un pari sur une signature.`;
      },
    },
  ],
  outputs: [
    { id: "surfaceTotale", label: "Surface totale", unit: "m2", compute: (v, c, t) => synthese(v, t).surfaceTotale },
    { id: "surfaceLouee", label: "Surface louée", unit: "m2", compute: (v, c, t) => synthese(v, t).surfaceLouee },
    { id: "surfaceVacante", label: "Surface vacante", unit: "m2", compute: (v, c, t) => synthese(v, t).surfaceVacante },
    { id: "occupationPhysique", label: "Taux d'occupation physique", unit: "pct", compute: (v, c, t) => synthese(v, t).occupationPhysique * 100 },
    { id: "occupationFinanciere", label: "Taux d'occupation financier (EPRA)", unit: "pct", compute: (v, c, t) => synthese(v, t).occupationFinanciere * 100, strong: true, hint: "Un moins la valeur locative des surfaces vacantes rapportée à celle de l'immeuble. Vide tant qu'un lot n'a pas de valeur locative." },
    { id: "vlmTotale", label: "Valeur locative de marché de l'immeuble", unit: "eur", compute: (v, c, t) => synthese(v, t).vlmTotale },
    { id: "vlmVacante", label: "Valeur locative des surfaces vacantes", unit: "eur", compute: (v, c, t) => synthese(v, t).vlmVacante },
    { id: "facial", label: "Loyer facial annuel en place", unit: "eur", compute: (v, c, t) => synthese(v, t).facial, strong: true, hint: "Hors taxes hors charges, avant franchise." },
    { id: "economique", label: "Loyer économique annuel en place", unit: "eur", compute: (v, c, t) => synthese(v, t).economique, hint: "Franchises étalées sur la période d'engagement ferme." },
    { id: "franchises", label: "Effet des franchises", unit: "eur", compute: (v, c, t) => synthese(v, t).effetFranchises },
    { id: "partFranchises", label: "Effet des franchises, en part du loyer facial", unit: "pct", compute: (v, c, t) => synthese(v, t).partFranchises * 100 },
    { id: "loyerM2", label: "Loyer facial moyen au m² loué", unit: "eurm2", compute: (v, c, t) => synthese(v, t).loyerM2 },
    { id: "vlmLouee", label: "Valeur locative des surfaces louées", unit: "eur", compute: (v, c, t) => synthese(v, t).vlmLouee },
    { id: "reversion", label: "Réversion", unit: "eur", compute: (v, c, t) => synthese(v, t).reversion, hint: "Positive : les loyers en place sont sous le marché. Négative : ils seront renégociés à la baisse." },
    { id: "partReversion", label: "Réversion, en part du loyer facial", unit: "pct", compute: (v, c, t) => synthese(v, t).partReversion * 100 },
    { id: "wault", label: "WAULT, durée résiduelle jusqu'au terme", unit: "annees", compute: (v, c, t) => synthese(v, t).wault, strong: true },
    { id: "walb", label: "WALB, durée résiduelle ferme", unit: "annees", compute: (v, c, t) => synthese(v, t).walb, strong: true, hint: "Jusqu'à la prochaine faculté de sortie du locataire, pondérée par le loyer facial." },
    { id: "waultEco", label: "WAULT sur base de loyer économique", unit: "annees", compute: (v, c, t) => synthese(v, t).waultEco },
    { id: "walbEco", label: "WALB sur base de loyer économique", unit: "annees", compute: (v, c, t) => synthese(v, t).walbEco },
    { id: "ecart", label: "Écart entre le WAULT et le WALB", unit: "annees", compute: (v, c, t) => synthese(v, t).wault - synthese(v, t).walb },
    { id: "baux", label: "Baux retenus dans les moyennes", unit: "nombre", compute: (v, c, t) => synthese(v, t).baux },
    { id: "echus", label: "Baux échus, en tacite prolongation", unit: "texte", compute: (v, c, t) => { const s = synthese(v, t); return s.echus === 0 ? "Aucun" : `${s.echus}, ${fr(s.loyerEchus)} € de loyer, congé possible à tout moment avec ${fr(v.preavis ?? 6)} mois de préavis`; } },
    { id: "locataires", label: "Nombre de locataires", unit: "nombre", compute: (v, c, t) => synthese(v, t).locataires },
    {
      id: "sorties",
      label: "Loyer qui peut sortir, année par année",
      unit: "texte",
      compute: (v, c, t) => {
        const s = synthese(v, t);
        const lignes = echeancier(v, t).filter((p) => p.aLaSortie > 0);
        if (lignes.length === 0) return "–";
        return lignes.map((p) => `${p.libelle} : ${fr(p.aLaSortie)} € (${pc1(p.aLaSortie / s.facial)} %)`).join(" · ");
      },
      hint: "Au terme des baux ou à la prochaine faculté de sortie. Un WALB de cinq ans ne vaut rien si tout tombe la même année.",
    },
    {
      id: "termes",
      label: "Loyer qui arrive au terme, année par année",
      unit: "texte",
      compute: (v, c, t) => {
        const s = synthese(v, t);
        const lignes = echeancier(v, t).filter((p) => p.auTerme > 0);
        if (lignes.length === 0) return "–";
        return lignes.map((p) => `${p.libelle} : ${fr(p.auTerme)} € (${pc1(p.auTerme / s.facial)} %)`).join(" · ");
      },
    },
    {
      id: "alerte",
      label: "Années de sortie en concentration forte",
      unit: "texte",
      compute: (v, c, t) => {
        const s = synthese(v, t);
        const seuil = (v.seuilAnnee ?? 33) / 100;
        const fortes = echeancier(v, t).slice(1).filter((p) => s.facial > 0 && p.aLaSortie / s.facial > seuil);
        return fortes.length === 0 ? "Aucune" : fortes.map((p) => p.libelle).join(", ");
      },
      hint: "Une année où plus d'un tiers du loyer peut sortir est un risque de refinancement.",
    },
    {
      id: "controle",
      label: "État locatif exploitable",
      unit: "texte",
      compute: (v, c, t) => {
        const s = synthese(v, t);
        if (s.exploitable) return "OK";
        return s.premiereACorriger ? `À corriger, ${nomLot(s.premiereACorriger.rang)} : ${s.premiereACorriger.motif}` : "À corriger : aucun bail retenu";
      },
    },
  ],
  caveat:
    "Le calcul ne juge pas la qualité de signature des locataires et n'indexe pas les loyers. Un bail échu compte zéro an dans les moyennes. La franchise est étalée sur la période ferme initiale, sans actualisation.",
};
