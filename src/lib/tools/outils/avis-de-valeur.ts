/**
 * AVIS DE VALEUR PAR COMPARAISON — la version en ligne de
 * `public/outils/matrices/avis-de-valeur-par-comparaison.xlsx`, onglets
 * « Avis de valeur » et « Référentiel ».
 *
 * CINQ VENTES AU MINIMUM, DES AJUSTEMENTS EXPLICITES, UNE FOURCHETTE LARGE
 * COMME LA DISPERSION. Chaque vente comparable est ramenée au bien évalué :
 * un cran d'état, un étage (dont le sens s'inverse sans ascenseur), un
 * extérieur, une étiquette DPE lue dans la grille de valeur verte, un
 * stationnement, et la dérive du marché depuis la date de vente. Les prix au
 * m² ajustés sont moyennés, pondérés par la similarité ; la demi-fourchette
 * est l'écart type pondéré rapporté à cette moyenne, avec un plancher.
 *
 * Ce que la matrice révisée ajoute à la version précédente :
 *   · l'ajustement calculé caractéristique par caractéristique, au lieu d'un
 *     pourcentage saisi à la main ;
 *   · la valeur verte du DPE, différente pour un appartement et une maison ;
 *   · la dérive du marché appliquée à l'ancienneté de chaque vente ;
 *   · les verrous : ajustement plafonné, vente trop ancienne, panel trop
 *     mince, comparable dominant ;
 *   · la fourchette fondée sur la dispersion mesurée, et non sur un
 *     pourcentage fixe.
 */

import { ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;
type T = Record<string, number[][]>;

export const TYPES = ["Appartement", "Maison"] as const;
export const ETATS = ["À rénover", "À rafraîchir", "Bon", "Refait"] as const;
export const DPE = ["A", "B", "C", "D", "E", "F", "G"] as const;

/** Référentiel!C13:D19 : écart de prix par étiquette, par rapport à une étiquette D. */
const VALEUR_VERTE: Record<(typeof TYPES)[number], number[]> = {
  Appartement: [0.16, 0.12, 0.06, 0, -0.04, -0.08, -0.12],
  Maison: [0.2, 0.15, 0.08, 0, -0.08, -0.16, -0.25],
};

const COL = { date: 0, prix: 1, surface: 2, etat: 3, etage: 4, exterieur: 5, dpe: 6, stationnement: 7, similarite: 8 } as const;
const MOIS = 365.25 / 12;
const JOUR = 86_400_000;
const pc = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

function bienIncomplet(v: V, c: C): string {
  const etageMin = v.etageMin ?? -2;
  const etageMax = v.etageMax ?? 30;
  if (!((v.surface ?? 0) > 0)) return "surface habitable";
  if (!TYPES.includes(c.type as never)) return "type de bien";
  if (!ETATS.includes(c.etat as never)) return "état";
  const etage = v.etage ?? Number.NaN;
  if (!(etage >= etageMin && etage <= etageMax)) return "étage";
  if (!DPE.includes(c.dpe as never)) return "étiquette DPE";
  if (!v.dateAvis) return "date de l'avis";
  return "";
}

export interface Comparable {
  rang: number;
  prixM2: number;
  ajustement: number;
  prixM2Ajuste: number;
  poids: number;
  statut: string;
  retenu: boolean;
}

export function comparables(v: V, c: C, t: T): Comparable[] {
  const bienOk = bienIncomplet(v, c) === "";
  const type = (TYPES.includes(c.type as never) ? c.type : "Appartement") as (typeof TYPES)[number];
  const verte = VALEUR_VERTE[type];
  const etatBien = ETATS.indexOf(c.etat as never);
  const dpeBien = DPE.indexOf(c.dpe as never);
  const sensEtage = c.ascenseur === "Non" ? -1 : 1;
  const oui = (x: string | undefined) => (x === "Oui" ? 1 : 0);
  const dateAvis = v.dateAvis ?? 0;

  return (t.comparables ?? []).map((r, rang) => {
    const prix = r[COL.prix] ?? 0;
    const surface = r[COL.surface] ?? 0;
    const date = r[COL.date] ?? 0;
    const etage = r[COL.etage] ?? 0;
    const similarite = r[COL.similarite] ?? 0;
    const prixM2 = prix > 0 && surface > 0 ? prix / surface : 0;
    const anciennete = (dateAvis - date) / JOUR / MOIS;

    const ajustement = !bienOk || !date
      ? 0
      : (etatBien - (r[COL.etat] ?? 0)) * pc(v.coefEtat, 6) +
        ((v.etage ?? 0) - etage) * pc(v.coefEtage, 1.2) * sensEtage +
        (oui(c.exterieur) - (r[COL.exterieur] ?? 0)) * pc(v.coefExterieur, 5) +
        ((verte[dpeBien] ?? 0) - (verte[r[COL.dpe] ?? 3] ?? 0)) +
        (oui(c.stationnement) - (r[COL.stationnement] ?? 0)) * pc(v.coefStationnement, 4) +
        anciennete * (pc(v.derive, 0.1) / 12);

    let statut = "Retenu";
    const plafondMois = v.ancienneteMax ?? 24;
    const simMax = v.similariteMax ?? 100;
    if (!bienOk) statut = "À compléter : le bien est incomplet";
    else if (!(prix > 0)) statut = "À compléter : prix net vendeur manquant";
    else if (!(surface > 0)) statut = "À compléter : surface manquante";
    else if (!date) statut = "À compléter : date de vente non exploitable";
    else if (date > dateAvis) statut = "À compléter : vente postérieure à la date de l'avis";
    else if (!(etage >= (v.etageMin ?? -2) && etage <= (v.etageMax ?? 30))) statut = "À compléter : étage hors bornes";
    else if (!(similarite >= 0 && similarite <= simMax)) statut = `À compléter : similarité hors de 0 à ${simMax}`;
    else if (similarite === 0) statut = "À compléter : similarité nulle, le comparable ne pèserait rien";
    else if (anciennete > plafondMois) statut = `Écarté : vente de ${Math.round(anciennete)} mois, au-delà du plafond`;
    else if (Math.abs(ajustement) > pc(v.ajustementMax, 25))
      statut = `Écarté : ajustement de ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.round(ajustement * 1000) / 10)} %, au-delà du plafond`;

    const retenu = statut === "Retenu";
    return { rang, prixM2, ajustement, prixM2Ajuste: prixM2 > 0 ? prixM2 * (1 + ajustement) : 0, poids: retenu ? similarite : 0, statut, retenu };
  });
}

export function panel(v: V, c: C, t: T) {
  const lignes = comparables(v, c, t);
  const retenus = lignes.filter((l) => l.retenu);
  const aCompleter = lignes.filter((l) => l.statut.startsWith("À compléter"));
  const ecartes = lignes.filter((l) => l.statut.startsWith("Écarté"));
  const avecPrix = lignes.filter((l) => l.prixM2 > 0);
  const moyenneSimple = avecPrix.length ? avecPrix.reduce((s, l) => s + l.prixM2, 0) / avecPrix.length : 0;
  const ecartMax = moyenneSimple > 0 ? Math.max(0, ...avecPrix.map((l) => Math.abs(l.prixM2 - moyenneSimple))) / moyenneSimple : 0;
  const lignePlusEloignee = avecPrix.reduce<Comparable | undefined>((m, l) => (!m || Math.abs(l.prixM2 - moyenneSimple) > Math.abs(m.prixM2 - moyenneSimple) ? l : m), undefined);
  const sommePoids = lignes.reduce((s, l) => s + l.poids, 0);
  const dominant = sommePoids > 0 ? Math.max(...lignes.map((l) => l.poids)) / sommePoids : 0;
  const prixRetenu = sommePoids > 0 ? lignes.reduce((s, l) => s + l.prixM2Ajuste * l.poids, 0) / sommePoids : 0;
  const n = retenus.length;
  const minDispersion = v.minDispersion ?? 3;
  const ecartType =
    n >= minDispersion && prixRetenu > 0
      ? Math.sqrt((lignes.reduce((s, l) => s + l.poids * (l.prixM2Ajuste - prixRetenu) ** 2, 0) / sommePoids) * (n / (n - 1)))
      : 0;
  const cv = prixRetenu > 0 ? ecartType / prixRetenu : 0;
  const demi = n < minDispersion ? pc(v.demiRepli, 10) : Math.max(pc(v.demiPlancher, 3), cv);
  const bien = bienIncomplet(v, c);

  let verrou = "";
  if (bien) verrou = "Bien incomplet";
  else if (aCompleter.length > 0) verrou = "Lignes à compléter";
  else if (n < (v.minComparables ?? 5)) verrou = "Trop peu de comparables";
  else if (dominant > pc(v.poidsMax, 40)) verrou = "Un comparable domine";

  const centrale = verrou ? Number.NaN : prixRetenu * (v.surface ?? 0);
  return {
    lignes,
    renseignes: lignes.length,
    retenus: n,
    aCompleter,
    ecartes: ecartes.length,
    eloignes: retenus.filter((l) => Math.abs(l.ajustement) > pc(v.ajustementSignal, 15)).length,
    moyenneSimple,
    ecartMax,
    lignePlusEloignee,
    dominant,
    prixRetenu,
    min: n > 0 ? Math.min(...retenus.map((l) => l.prixM2Ajuste)) : 0,
    max: n > 0 ? Math.max(...retenus.map((l) => l.prixM2Ajuste)) : 0,
    ecartType,
    cv,
    demi,
    dispersionOk: n >= minDispersion && cv <= pc(v.dispersionMax, 12),
    verrou,
    bien,
    centrale,
    bas: centrale * (1 - demi),
    haut: centrale * (1 + demi),
  };
}

/* ── La spécification ────────────────────────────────────────────────────── */

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const pct1 = (x: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.round(x * 1000) / 10);
const liste = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));
const ouiNon = [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }];
const optNum = (xs: readonly string[]) => xs.map((x, i) => ({ value: i, label: x }));
const ADRESSES = ["12 rue des Lilas", "4 avenue du Parc", "27 rue Victor Hugo", "8 place Carnot", "15 rue Pasteur", "31 boulevard Gambetta"];
const D = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

export const avisDeValeur: ToolSpec = {
  id: "avis-de-valeur",
  title: "Avis de valeur par comparaison",
  intro:
    "Des ventes comparables ajustées caractéristique par caractéristique, et une fourchette aussi large que leur dispersion.",
  sections: [
    {
      title: "Le bien à évaluer",
      fields: [
        { id: "type", label: "Type de bien", value: "Appartement", options: liste(TYPES), hint: "Pilote la grille de valeur verte du DPE." },
        { id: "surface", label: "Surface habitable", value: 75, unit: "m2", min: 1, hint: "Toute la valeur en dépend." },
        { id: "etat", label: "État", value: "Bon", options: liste(ETATS), hint: "Un cran d'écart vaut le coefficient d'état." },
        { id: "etage", label: "Étage", value: 2, unit: "nombre", min: -2, max: 30, step: 1, hint: "0 pour un rez-de-chaussée, négatif en sous-sol." },
        { id: "exterieur", label: "Extérieur (balcon, terrasse, jardin)", value: "Oui", options: ouiNon },
        { id: "dpe", label: "Étiquette DPE", value: "D", options: liste(DPE), hint: "La lettre, pas le rang : la grille de valeur verte n'est pas linéaire." },
        { id: "stationnement", label: "Stationnement compris", value: "Non", options: ouiNon },
        { id: "ascenseur", label: "Ascenseur", value: "Oui", options: ouiNon, hint: "Sans ascenseur, un étage élevé devient une décote : le sens de l'ajustement s'inverse." },
        { id: "dateAvis", label: "Date de l'avis", value: D("2026-08-16"), unit: "date", hint: "Elle pilote la dérive du marché appliquée à chaque vente." },
      ],
    },
  ],
  tables: [
    {
      id: "comparables",
      title: "Les ventes comparables",
      hint: "Prix net vendeur, hors honoraires et hors droits. Similarité de 0 à 100 : c'est le poids de la vente dans la moyenne. Cinq ventes retenues au minimum.",
      addLabel: "Ajouter une vente",
      min: 1,
      max: 8,
      rowLabels: ADRESSES,
      extraLabel: "Vente",
      columns: [
        { id: "date", label: "Date de vente", value: D("2026-01-01"), unit: "date" },
        { id: "prix", label: "Prix net vendeur", short: "Prix net vendeur", value: 300000, unit: "eur" },
        { id: "surface", label: "Surface", value: 70, unit: "m2" },
        { id: "etat", label: "État", value: 2, unit: "nombre", options: optNum(ETATS) },
        { id: "etage", label: "Étage", value: 1, unit: "nombre" },
        { id: "exterieur", label: "Extérieur", value: 0, unit: "nombre", options: optNum(["Non", "Oui"]) },
        { id: "dpe", label: "DPE", value: 3, unit: "nombre", options: optNum(DPE) },
        { id: "stationnement", label: "Stationnement", value: 0, unit: "nombre", options: optNum(["Non", "Oui"]) },
        { id: "similarite", label: "Similarité (0 à 100)", short: "Similarité", value: 70, unit: "nombre" },
      ],
      rows: [
        [D("2026-03-14"), 318000, 72, 2, 3, 1, 3, 1, 85],
        [D("2025-12-02"), 349000, 78, 3, 1, 1, 2, 1, 70],
        [D("2026-01-21"), 289000, 68, 1, 4, 0, 4, 0, 80],
        [D("2026-05-09"), 372000, 81, 2, 2, 1, 2, 1, 75],
        [D("2025-10-18"), 275000, 65, 0, 5, 0, 5, 0, 60],
        [D("2026-02-27"), 331000, 74, 2, 3, 1, 3, 1, 90],
      ],
    },
  ],
  params: [
    { id: "derive", label: "Dérive du marché, sur un an", value: 0.1, unit: "pct", hint: "Indice Notaires INSEE, 1er trimestre 2026 : plus 0,1 % sur un an, France entière." },
    { id: "coefEtat", label: "Écart d'un cran d'état", value: 6, unit: "pct" },
    { id: "coefEtage", label: "Écart d'un étage", value: 1.2, unit: "pct" },
    { id: "coefExterieur", label: "Présence d'un extérieur", value: 5, unit: "pct" },
    { id: "coefStationnement", label: "Présence d'un stationnement", value: 4, unit: "pct" },
    { id: "ajustementSignal", label: "Ajustement au-delà duquel un comparable est signalé", value: 15, unit: "pct" },
    { id: "ajustementMax", label: "Ajustement total maximal admis par comparable", value: 25, unit: "pct" },
    { id: "minComparables", label: "Nombre minimal de comparables retenus", value: 5, unit: "nombre" },
    { id: "poidsMax", label: "Poids maximal d'un comparable dans la moyenne", value: 40, unit: "pct" },
    { id: "ancienneteMax", label: "Ancienneté maximale d'une vente comparable", value: 24, unit: "mois" },
    { id: "minDispersion", label: "Nombre minimal de comparables pour mesurer une dispersion", value: 3, unit: "nombre" },
    { id: "demiPlancher", label: "Demi-fourchette : plancher", value: 3, unit: "pct" },
    { id: "demiRepli", label: "Demi-fourchette de repli, échantillon trop faible", value: 10, unit: "pct" },
    { id: "dispersionMax", label: "Dispersion au-delà de laquelle le panel est hétérogène", value: 12, unit: "pct" },
    { id: "ecartPrixMax", label: "Écart au prix au m² moyen au-delà duquel une ligne est signalée", value: 35, unit: "pct" },
    { id: "etageMin", label: "Étage le plus bas admis", value: -2, unit: "nombre" },
    { id: "etageMax", label: "Étage le plus haut admis", value: 30, unit: "nombre" },
    { id: "similariteMax", label: "Similarité maximale", value: 100, unit: "nombre" },
  ],
  headlines: [
    {
      label: "Fourchette à présenter",
      unit: "texte",
      compute: (v, c, t) => {
        const p = panel(v, c, t);
        return p.verrou ? p.verrou : `${fr(p.bas)} € à ${fr(p.haut)} €`;
      },
      caption: (v, c, t) => {
        const p = panel(v, c, t);
        if (p.bien) return `À compléter : ${p.bien}.`;
        if (p.aCompleter[0]) return `${ADRESSES[p.aCompleter[0].rang] ?? `Vente ${p.aCompleter[0].rang + 1}`} : ${p.aCompleter[0].statut}.`;
        if (p.verrou) return `${p.retenus} comparable(s) retenu(s) sur ${p.renseignes}. Aucune valeur n'est produite tant que ce verrou joue.`;
        return p.retenus < (v.minDispersion ?? 3)
          ? `Échantillon trop faible pour mesurer une dispersion : demi-fourchette de repli de ${pct1(p.demi)} %.`
          : `Demi-fourchette de ${pct1(p.demi)} %, fondée sur l'écart type pondéré des ${p.retenus} comparables retenus, plancher de ${pct1(pc(v.demiPlancher, 3))} %.`;
      },
    },
    {
      label: "Valeur centrale",
      unit: "eur",
      compute: (v, c, t) => panel(v, c, t).centrale,
      caption: () => "Présentez la fourchette, jamais la valeur centrale seule : un prix unique devient le plancher de la négociation.",
    },
  ],
  outputs: [
    { id: "renseignes", label: "Comparables renseignés", unit: "nombre", compute: (v, c, t) => panel(v, c, t).renseignes },
    { id: "retenus", label: "Comparables retenus", unit: "nombre", compute: (v, c, t) => panel(v, c, t).retenus, strong: true },
    { id: "ecartes", label: "Comparables écartés", unit: "nombre", compute: (v, c, t) => panel(v, c, t).ecartes, hint: "Ajustement au-delà du plafond, ou vente trop ancienne." },
    {
      id: "statuts",
      label: "Statut de chaque vente",
      unit: "texte",
      compute: (v, c, t) =>
        comparables(v, c, t)
          .map((l) => `${ADRESSES[l.rang] ?? `Vente ${l.rang + 1}`} : ${l.retenu ? `retenue, ajustement ${l.ajustement >= 0 ? "+" : ""}${pct1(l.ajustement)} %, ${fr(l.prixM2Ajuste)} €/m²` : l.statut}`)
          .join(" · "),
    },
    { id: "eloignes", label: "Comparables retenus mais éloignés", unit: "nombre", compute: (v, c, t) => panel(v, c, t).eloignes, hint: "Ajustement au-delà du seuil de vigilance : la vente reste retenue, mais ressemble déjà peu au bien." },
    { id: "moyenneSimple", label: "Prix au m² moyen des lignes saisies, avant ajustement", unit: "eurm2", compute: (v, c, t) => panel(v, c, t).moyenneSimple },
    {
      id: "coherence",
      label: "Cohérence des prix saisis",
      unit: "texte",
      compute: (v, c, t) => {
        const p = panel(v, c, t);
        if (p.moyenneSimple <= 0 || p.ecartMax <= pc(v.ecartPrixMax, 35)) return "Prix au m² cohérents entre eux.";
        const l = p.lignePlusEloignee!;
        return `${ADRESSES[l.rang] ?? `Vente ${l.rang + 1}`} : son prix au m² s'écarte de ${Math.round(p.ecartMax * 100)} % de la moyenne. Vérifiez qu'il s'agit d'un prix net vendeur.`;
      },
    },
    { id: "dominant", label: "Poids du comparable dominant", unit: "pct", compute: (v, c, t) => panel(v, c, t).dominant * 100 },
    { id: "prixRetenu", label: "Prix au m² retenu", unit: "eurm2", compute: (v, c, t) => panel(v, c, t).prixRetenu, strong: true, hint: "Moyenne des prix au m² ajustés, pondérée par la similarité." },
    { id: "min", label: "Le plus bas des prix au m² ajustés", unit: "eurm2", compute: (v, c, t) => panel(v, c, t).min },
    { id: "max", label: "Le plus haut des prix au m² ajustés", unit: "eurm2", compute: (v, c, t) => panel(v, c, t).max },
    { id: "ecartType", label: "Écart type pondéré des prix au m² ajustés", unit: "eurm2", compute: (v, c, t) => panel(v, c, t).ecartType },
    { id: "cv", label: "Coefficient de variation", unit: "pct", compute: (v, c, t) => panel(v, c, t).cv * 100 },
    { id: "demi", label: "Demi-fourchette retenue", unit: "pct", compute: (v, c, t) => panel(v, c, t).demi * 100 },
    { id: "dispersion", label: "Dispersion sous le seuil", unit: "texte", compute: (v, c, t) => (panel(v, c, t).dispersionOk ? "OK" : "À justifier") },
    { id: "bas", label: "Bas de fourchette", unit: "eur", compute: (v, c, t) => panel(v, c, t).bas },
    { id: "haut", label: "Haut de fourchette", unit: "eur", compute: (v, c, t) => panel(v, c, t).haut },
    { id: "prixM2Centre", label: "Valeur centrale au m²", unit: "eurm2", compute: (v, c, t) => ratio(panel(v, c, t).centrale, v.surface ?? 0) },
  ],
  caveat:
    "Cet avis de valeur n'est pas une expertise en évaluation immobilière. Les coefficients d'ajustement sont des repères nationaux, à recaler sur votre secteur : le stationnement et l'extérieur surtout sont très locaux.",
};
