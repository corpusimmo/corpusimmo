/**
 * CALCULATEUR DE RENTABILITÉ LOCATIVE — la version en ligne de
 * `public/outils/matrices/calculateur-rentabilite-locative.xlsx`, onglet
 * « Calculateur ».
 *
 * CHAQUE FONCTION PORTE LA CELLULE QU'ELLE REFAIT. Quand le classeur change,
 * on retrouve la ligne à reprendre sans relire tout le fichier, et le test
 * `rentabilite-locative.test.ts` compare chaque résultat à la valeur qu'Excel a
 * calculée sur l'exemple livré.
 *
 * Ce que la matrice révisée ajoute à la version précédente, et que cette page
 * reprend donc :
 *   · cinq régimes fiscaux au lieu de trois, dont le LMNP réel avec
 *     amortissement et le meublé de tourisme non classé ;
 *   · des prélèvements sociaux DISTINCTS pour le foncier (17,2 %) et le meublé
 *     (18,6 % depuis la LFSS 2026) ;
 *   · le déficit foncier imputable sur le revenu global, plafonné, dont la part
 *     issue des intérêts est exclue ;
 *   · les plafonds des régimes micro, qui rendent un régime inapplicable ;
 *   · la comptabilité, les travaux déductibles, la part du terrain ;
 *   · le rendement brut « des annonces », pour comparer, et la part du loyer
 *     absorbée par la mensualité, premier regard d'un banquier.
 *
 * UN RÉGIME INAPPLICABLE NE PRODUIT PAS DE CHIFFRE. Le classeur laisse ses
 * résultats fiscaux vides tant que le contrôle est rouge ; la page fait de
 * même (NaN, affiché « – ») plutôt que de calculer un impôt sur un régime
 * auquel le bien n'a pas droit.
 */

import { interetsCumules, pmt, ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;

/* ── Les régimes, libellés comme la liste déroulante du classeur ─────────── */

export const REGIMES = {
  microFoncier: "Location nue, micro-foncier",
  reelFoncier: "Location nue, réel foncier",
  microBic: "Meublé, LMNP micro-BIC",
  lmnpReel: "Meublé, LMNP réel (amortissement)",
  tourisme: "Meublé de tourisme non classé, micro-BIC",
} as const;

const MEUBLES: string[] = [REGIMES.microBic, REGIMES.lmnpReel, REGIMES.tourisme];

/* ── Le bien (C7:C14) ────────────────────────────────────────────────────── */

/** C13 : dénominateur de tous les rendements. */
export function coutTotal(v: V): number {
  return (v.prix ?? 0) + (v.agence ?? 0) + (v.notaire ?? 0) + (v.travaux ?? 0) + (v.mobilier ?? 0);
}

/* ── Revenus (C17:C20) ───────────────────────────────────────────────────── */

/** C19 : loyer × 12, diminué de la vacance. */
export function loyerAnnuel(v: V): number {
  return (v.loyer ?? 0) * 12 * (1 - (v.vacance ?? 0) / 52);
}

/* ── Charges (C23:C30) ───────────────────────────────────────────────────── */

function gestionAnnuelle(v: V): number {
  return (loyerAnnuel(v) * (v.gestion ?? 0)) / 100;
}

/** C29 : charges fixes plus gestion locative. */
export function chargesAnnuelles(v: V): number {
  return (
    (v.taxeFonciere ?? 0) +
    (v.pno ?? 0) +
    (v.copro ?? 0) +
    (v.comptabilite ?? 0) +
    (v.entretien ?? 0) +
    gestionAnnuelle(v)
  );
}

/** C30 : avant impôt et avant crédit. */
export function revenuNetDeCharges(v: V): number {
  return loyerAnnuel(v) - chargesAnnuelles(v);
}

/* ── Financement (C33:C44) ───────────────────────────────────────────────── */

/** C37. */
export function montantEmprunte(v: V): number {
  return Math.max(0, coutTotal(v) - (v.apport ?? 0));
}

/** C38 : NaN quand la durée manque alors qu'il y a un emprunt. */
function mensualiteHorsAssurance(v: V): number {
  const emprunt = montantEmprunte(v);
  if (emprunt === 0) return 0;
  if (!((v.duree ?? 0) > 0)) return Number.NaN;
  return pmt(v.taux ?? 0, v.duree ?? 0, emprunt);
}

/** C39 : capital emprunté × taux d'assurance / 12, constant. */
function assuranceMensuelle(v: V): number {
  if (Number.isNaN(mensualiteHorsAssurance(v))) return Number.NaN;
  return (montantEmprunte(v) * (v.assurance ?? 0)) / 100 / 12;
}

/** C40 : ce que la banque prélève. */
export function mensualiteTotale(v: V): number {
  return mensualiteHorsAssurance(v) + assuranceMensuelle(v);
}

/** C41 : intérêts des douze premières échéances. */
export function interetsAnnee1(v: V): number {
  if (Number.isNaN(mensualiteHorsAssurance(v))) return Number.NaN;
  if (montantEmprunte(v) === 0 || (v.taux ?? 0) === 0) return 0;
  return interetsCumules(v.taux ?? 0, v.duree ?? 0, montantEmprunte(v), 12);
}

/** C42 : déductible au réel foncier et au LMNP réel. */
function assuranceAnnee1(v: V): number {
  return assuranceMensuelle(v) * 12;
}

/** C43. */
function financementCoherent(v: V): boolean {
  const apport = v.apport ?? 0;
  return apport >= 0 && apport <= coutTotal(v) && (montantEmprunte(v) === 0 || (v.duree ?? 0) > 0);
}

/**
 * C44 : un taux strictement positif sous le plancher de plausibilité trahit
 * presque toujours une saisie en fraction (0,034 tapé pour 3,4 %). Zéro
 * exactement reste permis : prêt à taux zéro, ou pas d'assurance.
 */
function tauxVraisemblable(v: V): boolean {
  const plancher = v.plancherTaux ?? 0.1;
  const ok = (t: number) => t <= 0 || t >= plancher;
  return ok(v.taux ?? 0) && ok(v.assurance ?? 0);
}

/* ── Fiscalité (C47:C57) ─────────────────────────────────────────────────── */

/** C51 : le loyer annuel théorique ne dépasse pas le plafond du micro choisi. */
export function regimeAutorise(v: V, c: C): boolean {
  const loyerTheorique = (v.loyer ?? 0) * 12;
  switch (c.regime) {
    case REGIMES.reelFoncier:
    case REGIMES.lmnpReel:
      return true;
    case REGIMES.microFoncier:
      return loyerTheorique <= (v.plafondMicroFoncier ?? 15000);
    case REGIMES.microBic:
      return loyerTheorique <= (v.plafondMicroBic ?? 83600);
    case REGIMES.tourisme:
      return loyerTheorique <= (v.plafondTourisme ?? 15000);
    default:
      return false;
  }
}

/** C52 : bâti hors terrain, travaux et mobilier, sur les durées des paramètres. */
export function amortissementAnnuel(v: V, c: C): number {
  if (c.regime !== REGIMES.lmnpReel) return 0;
  const bati = ((v.prix ?? 0) + (v.agence ?? 0) + (v.notaire ?? 0)) * (1 - (v.terrain ?? 0) / 100);
  return (
    ratio(bati, v.dureeBati ?? 30) +
    ratio(v.travaux ?? 0, v.dureeTravaux ?? 15) +
    ratio(v.mobilier ?? 0, v.dureeMobilier ?? 7)
  );
}

/**
 * C53 : NaN tant que le régime n'est pas autorisé, comme le classeur laisse
 * la cellule vide. Chaque régime a sa propre base : le réel foncier ne déduit
 * ni la comptabilité ni la provision d'entretien, le LMNP réel déduit la
 * comptabilité et l'amortissement.
 */
export function resultatFiscal(v: V, c: C): number {
  if (!regimeAutorise(v, c) || Number.isNaN(interetsAnnee1(v))) return Number.NaN;
  const loyer = loyerAnnuel(v);
  const financier = interetsAnnee1(v) + assuranceAnnee1(v);
  const chargesReel =
    (v.taxeFonciere ?? 0) + (v.pno ?? 0) + (v.copro ?? 0) + gestionAnnuelle(v);

  switch (c.regime) {
    case REGIMES.microFoncier:
      return loyer * (1 - (v.abtMicroFoncier ?? 30) / 100);
    case REGIMES.reelFoncier:
      return loyer - chargesReel - financier - (v.travauxDeductibles ?? 0);
    case REGIMES.microBic:
      return loyer * (1 - (v.abtMicroBic ?? 50) / 100);
    case REGIMES.lmnpReel:
      return loyer - (chargesReel + (v.comptabilite ?? 0)) - financier - amortissementAnnuel(v, c);
    default:
      return loyer * (1 - (v.abtTourisme ?? 30) / 100);
  }
}

/**
 * C55 : réel foncier seulement, plafonné, et SANS la part du déficit qui vient
 * des intérêts — celle-là ne s'impute que sur les revenus fonciers.
 */
export function deficitImpute(v: V, c: C): number {
  const res = resultatFiscal(v, c);
  if (Number.isNaN(res)) return Number.NaN;
  if (c.regime !== REGIMES.reelFoncier) return 0;
  const financier = interetsAnnee1(v) + assuranceAnnee1(v);
  const horsInterets = Math.max(0, -res - Math.max(0, financier - loyerAnnuel(v)));
  return Math.min(v.plafondDeficit ?? 10700, horsInterets);
}

/** C56 : déficit foncier reportable, ou amortissement LMNP non imputé. */
export function reporte(v: V, c: C): number {
  const res = resultatFiscal(v, c);
  if (Number.isNaN(res)) return Number.NaN;
  if (c.regime === REGIMES.reelFoncier) return Math.max(0, -res) - deficitImpute(v, c);
  if (c.regime === REGIMES.lmnpReel) return Math.max(0, -res);
  return 0;
}

/** C57 : négatif quand le déficit foncier fait économiser de l'impôt. */
export function impotAnnee1(v: V, c: C): number {
  const res = resultatFiscal(v, c);
  if (Number.isNaN(res)) return Number.NaN;
  const tmi = Number(c.tmi ?? "0") / 100;
  const ps = (MEUBLES.includes(c.regime ?? "") ? (v.psMeuble ?? 18.6) : (v.psFoncier ?? 17.2)) / 100;
  return Math.max(0, res) * (tmi + ps) - deficitImpute(v, c) * tmi;
}

/* ── Résultats (C60:C68) ─────────────────────────────────────────────────── */

export function cashFlowAnnuel(v: V, c: C): number {
  return revenuNetDeCharges(v) - impotAnnee1(v, c) - mensualiteTotale(v) * 12;
}

/** C60 : ce que le contrôle global du classeur vérifie, ramené à la page. */
function saisiesCoherentes(v: V, c: C): boolean {
  return (
    (v.prix ?? 0) > 0 &&
    (v.surface ?? 0) >= 1 &&
    (v.loyer ?? 0) > 0 &&
    (v.vacance ?? 0) >= 0 &&
    (v.vacance ?? 0) <= 52 &&
    (v.travauxDeductibles ?? 0) <= (v.travaux ?? 0) &&
    financementCoherent(v) &&
    tauxVraisemblable(v) &&
    regimeAutorise(v, c)
  );
}

const fr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));

/* ── La spécification ────────────────────────────────────────────────────── */

export const rentabiliteLocative: ToolSpec = {
  id: "rentabilite-locative",
  title: "Calculateur de rentabilité locative",
  intro:
    "Rendement brut, net de charges et net-net après impôt, avec le cash-flow réel de la première année, sur cinq régimes fiscaux.",
  sections: [
    {
      title: "Le bien",
      fields: [
        { id: "prix", label: "Prix net vendeur", value: 90000, unit: "eur", min: 0, hint: "Prix hors honoraires d'agence et hors frais de notaire." },
        { id: "agence", label: "Frais d'agence", value: 9200, unit: "eur", min: 0, hint: "Honoraires à la charge de l'acquéreur. 0 s'ils sont à la charge du vendeur ou sans agence." },
        { id: "notaire", label: "Frais de notaire", value: 7500, unit: "eur", min: 0, hint: "Ordre de grandeur : 8 % du prix net vendeur dans l'ancien, 2,5 % dans le neuf. Prenez le chiffre de votre notaire si vous l'avez." },
        { id: "travaux", label: "Travaux", value: 20000, unit: "eur", min: 0, hint: "Montant total des travaux, déductibles ou non. La part déductible au réel foncier se précise dans la fiscalité." },
        { id: "mobilier", label: "Mobilier et équipement", value: 3000, unit: "eur", min: 0, hint: "Uniquement en location meublée. 0 en location nue." },
        { id: "surface", label: "Surface habitable", value: 72, unit: "m2", min: 1, hint: "Surface habitable au sens de la loi Boutin, pas la surface Carrez." },
      ],
    },
    {
      title: "Revenus locatifs",
      fields: [
        { id: "loyer", label: "Loyer mensuel hors charges", value: 950, unit: "eur", min: 0, hint: "Le loyer du bail, hors charges et hors provision sur charges." },
        { id: "vacance", label: "Vacance locative", value: 3, unit: "nombre", min: 0, max: 52, hint: "En semaines par an, de 0 à 52. Un mois de vacance = 4,33 semaines." },
      ],
    },
    {
      title: "Charges annuelles",
      fields: [
        { id: "taxeFonciere", label: "Taxe foncière hors TEOM", value: 900, unit: "eur", min: 0, hint: "Sans la taxe d'enlèvement des ordures ménagères, récupérable sur le locataire." },
        { id: "pno", label: "Assurance propriétaire non occupant (PNO)", value: 180, unit: "eur", min: 0, hint: "Ordre de grandeur : 120 € par an pour un appartement." },
        { id: "copro", label: "Charges de copropriété non récupérables", value: 600, unit: "eur", min: 0, hint: "La part qui reste au bailleur : syndic, assurance de l'immeuble, gros entretien." },
        { id: "comptabilite", label: "Comptabilité", value: 400, unit: "eur", min: 0, hint: "Expert-comptable, surtout en LMNP réel : repère 500 € par an. 0 sans expert-comptable, le cas courant en location nue." },
        { id: "entretien", label: "Provision entretien et travaux", value: 500, unit: "eur", min: 0, hint: "Réserve annuelle pour l'entretien courant. Compte dans le cash-flow, pas dans l'impôt." },
        { id: "gestion", label: "Gestion locative", value: 0, unit: "pct", min: 0, max: 100, step: 0.5, hint: "En % du loyer encaissé. Repère en agence : 7 %. 0 en gestion directe." },
      ],
    },
    {
      title: "Financement",
      fields: [
        { id: "apport", label: "Apport personnel", value: 5000, unit: "eur", min: 0, hint: "0 pour un financement à 100 %. Si vous partez du prêt proposé par la banque : apport = coût total moins ce prêt." },
        { id: "taux", label: "Taux du prêt, hors assurance", value: 3.4, unit: "pct", min: 0, max: 20, step: 0.05, hint: "Taux nominal annuel. Repère : 3,27 % sur 20 ans, 3,35 % sur 25 ans (Crédit Logement, août 2026)." },
        { id: "duree", label: "Durée du prêt", value: 22, unit: "an", min: 1, max: 30, step: 1, hint: "Années entières, de 1 à 30. Le HCSF limite les prêts à 25 ans." },
        { id: "assurance", label: "Taux d'assurance emprunteur, sur capital initial", value: 0.34, unit: "pct", min: 0, max: 5, step: 0.01, hint: "Taux annuel sur le capital emprunté. Repère : 0,36 % en contrat groupe, 0,17 % en délégation." },
      ],
    },
    {
      title: "Fiscalité, année 1",
      fields: [
        {
          id: "regime",
          label: "Régime fiscal",
          value: REGIMES.lmnpReel,
          options: Object.values(REGIMES).map((r) => ({ value: r, label: r })),
          hint: "Les régimes meublés supposent du mobilier. Un régime micro dont le plafond est dépassé n'est pas applicable : les résultats fiscaux restent vides.",
        },
        {
          id: "tmi",
          label: "Tranche marginale d'imposition",
          value: "30",
          options: ["0", "11", "30", "41", "45"].map((t) => ({ value: t, label: `${t} %` })),
          hint: "Le taux de la tranche la plus haute de votre foyer, sur votre avis d'impôt.",
        },
        { id: "travauxDeductibles", label: "Travaux déductibles au réel foncier, année 1", value: 20000, unit: "eur", min: 0, hint: "Part d'entretien, de réparation et d'amélioration des travaux. N'agit qu'au réel foncier, et ne peut pas dépasser le montant des travaux." },
        { id: "terrain", label: "Part du terrain dans le prix", value: 15, unit: "pct", min: 0, max: 50, step: 1, hint: "Non amortissable. Sans effet hors LMNP réel. Usage : 15 % pour un appartement, davantage en zone tendue ou pour une maison." },
      ],
    },
  ],
  params: [
    { id: "psFoncier", label: "Prélèvements sociaux, revenus fonciers", value: 17.2, unit: "pct", hint: "CSS art. L136-6 et L136-8, CRDS, solidarité. Inchangé par la LFSS 2026." },
    { id: "psMeuble", label: "Prélèvements sociaux, BIC de location meublée", value: 18.6, unit: "pct", hint: "LFSS 2026 : CSG portée de 9,2 à 10,6 % dès les revenus 2025." },
    { id: "abtMicroFoncier", label: "Abattement micro-foncier", value: 30, unit: "pct", hint: "CGI art. 32." },
    { id: "plafondMicroFoncier", label: "Plafond du micro-foncier", value: 15000, unit: "eur", hint: "Revenus bruts fonciers annuels du foyer. Le calcul compare le loyer mensuel × 12." },
    { id: "abtMicroBic", label: "Abattement micro-BIC, meublé longue durée ou classé", value: 50, unit: "pct", hint: "CGI art. 50-0, loi Le Meur." },
    { id: "plafondMicroBic", label: "Plafond du micro-BIC, meublé longue durée ou classé", value: 83600, unit: "eur", hint: "Revalorisation triennale 2026-2028." },
    { id: "abtTourisme", label: "Abattement micro-BIC, tourisme non classé", value: 30, unit: "pct", hint: "Loi Le Meur, revenus 2025 et suivants." },
    { id: "plafondTourisme", label: "Plafond du micro-BIC, tourisme non classé", value: 15000, unit: "eur" },
    { id: "plafondDeficit", label: "Plafond d'imputation du déficit foncier", value: 10700, unit: "eur", hint: "CGI art. 156. Le rehaussement temporaire à 21 400 € ne couvre que des travaux payés avant fin 2025." },
    { id: "dureeBati", label: "Amortissement du bâti, LMNP réel", value: 30, unit: "an" },
    { id: "dureeTravaux", label: "Amortissement des travaux, LMNP réel", value: 15, unit: "an" },
    { id: "dureeMobilier", label: "Amortissement du mobilier, LMNP réel", value: 7, unit: "an" },
    { id: "quotiteBanque", label: "Part des loyers retenue par les banques", value: 70, unit: "pct", hint: "Pratique du calcul de taux d'effort HCSF." },
    { id: "plancherTaux", label: "Plancher de plausibilité d'un taux saisi", value: 0.1, unit: "pct", hint: "Un taux positif en dessous signale presque toujours une saisie en fraction." },
  ],
  headlines: [
    {
      label: "Rendement net-net après impôt, année 1",
      unit: "pct",
      compute: (v, c) => ratio(revenuNetDeCharges(v) - impotAnnee1(v, c), coutTotal(v)) * 100,
      caption: (v, c) =>
        regimeAutorise(v, c)
          ? `Le seul rendement qui dépend de votre régime et de votre tranche, sur ${fr(coutTotal(v))} € investis.`
          : "Régime non applicable à ce loyer : le plafond du micro est dépassé.",
    },
    {
      label: "Cash-flow mensuel après impôt, année 1",
      unit: "eur",
      compute: (v, c) => cashFlowAnnuel(v, c) / 12,
      caption: (v, c) => {
        const cf = cashFlowAnnuel(v, c) / 12;
        if (Number.isNaN(cf)) return "À calculer une fois le régime et le financement cohérents.";
        return cf >= 0
          ? "Le bien s'autofinance et dégage un excédent."
          : `Effort d'épargne de ${fr(-cf)} € à sortir chaque mois.`;
      },
    },
  ],
  outputs: [
    { id: "cout", label: "Coût total de l'opération", unit: "eur", compute: (v) => coutTotal(v), strong: true, hint: "Dénominateur de tous les rendements." },
    { id: "revient", label: "Prix de revient au m²", unit: "eurm2", compute: (v) => ratio(coutTotal(v), v.surface ?? 0) },
    { id: "loyerAn", label: "Loyer annuel encaissé", unit: "eur", compute: (v) => loyerAnnuel(v), hint: "Loyer × 12, diminué de la vacance." },
    { id: "loyerM2", label: "Loyer mensuel au m²", unit: "eurm2", compute: (v) => ratio(v.loyer ?? 0, v.surface ?? 0), hint: "À comparer aux loyers de marché du quartier." },
    { id: "charges", label: "Total des charges", unit: "eur", compute: (v) => chargesAnnuelles(v) },
    { id: "netCharges", label: "Revenu net de charges", unit: "eur", compute: (v) => revenuNetDeCharges(v), strong: true, hint: "Avant impôt et avant crédit." },
    { id: "emprunt", label: "Montant emprunté", unit: "eur", compute: (v) => montantEmprunte(v) },
    { id: "mensualite", label: "Mensualité totale, assurance comprise", unit: "eur", compute: (v) => mensualiteTotale(v), strong: true },
    { id: "interets", label: "Intérêts de la 1re année", unit: "eur", compute: (v) => interetsAnnee1(v) },
    { id: "amortissement", label: "Amortissement annuel, LMNP réel", unit: "eur", compute: (v, c) => amortissementAnnuel(v, c) },
    { id: "resultat", label: "Résultat fiscal avant plafonnement", unit: "eur", compute: (v, c) => resultatFiscal(v, c), hint: "Négatif : déficit foncier ou amortissement non imputé." },
    { id: "deficit", label: "Déficit imputé sur le revenu global", unit: "eur", compute: (v, c) => deficitImpute(v, c), hint: "Réel foncier seulement. La part du déficit issue des intérêts n'est jamais imputée sur le revenu global." },
    { id: "reporte", label: "Reporté sur les années suivantes", unit: "eur", compute: (v, c) => reporte(v, c), hint: "Réel foncier : reportable 10 ans sur les revenus fonciers. LMNP réel : amortissement reporté sans limite." },
    { id: "impot", label: "Impôt et prélèvements sociaux, année 1", unit: "eur", compute: (v, c) => impotAnnee1(v, c), strong: true, hint: "Négatif : économie d'impôt sur le revenu global grâce au déficit foncier." },
    { id: "brut", label: "Rendement brut, loyer encaissé sur coût total", unit: "pct", compute: (v) => ratio(loyerAnnuel(v), coutTotal(v)) * 100, hint: "Après vacance, frais et travaux inclus : plus sévère que les annonces." },
    { id: "brutAffiche", label: "Rendement brut « des annonces »", unit: "pct", compute: (v) => ratio((v.loyer ?? 0) * 12, v.prix ?? 0) * 100, hint: "Loyer théorique sur prix net vendeur. Pour comparer, pas pour décider." },
    { id: "net", label: "Rendement net de charges", unit: "pct", compute: (v) => ratio(revenuNetDeCharges(v), coutTotal(v)) * 100 },
    { id: "cfAn", label: "Cash-flow annuel après impôt, année 1", unit: "eur", compute: (v, c) => cashFlowAnnuel(v, c) },
    { id: "effort", label: "Effort d'épargne mensuel", unit: "eur", compute: (v, c) => Math.max(0, -cashFlowAnnuel(v, c) / 12), hint: "Ce qu'il faut sortir de sa poche chaque mois. 0 si le cash-flow est positif." },
    {
      id: "partLoyer",
      label: "Part du loyer absorbée par la mensualité",
      unit: "pct",
      compute: (v) => ratio(mensualiteTotale(v), v.loyer ?? 0) * 100,
      hint: "Au-delà de la part des loyers retenue par les banques (70 %), le bien ne se finance pas seul.",
    },
    {
      id: "controle",
      label: "Saisies complètes et cohérentes",
      unit: "texte",
      compute: (v, c) => (saisiesCoherentes(v, c) ? "OK" : "À corriger"),
      hint: "À corriger si un régime micro dépasse son plafond, si l'apport dépasse le coût total, si un taux semble saisi en fraction ou si les travaux déductibles dépassent les travaux.",
    },
  ],
  caveat:
    "Le calcul porte sur la première année. Les intérêts baissent ensuite, le déficit reporté et l'amortissement non imputé allègent les années suivantes, et ni la revalorisation des loyers ni la plus-value ne sont modélisées.",
};
