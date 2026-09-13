/**
 * CHIFFRAGE DE TRAVAUX PAR LOT — la version en ligne de
 * `public/outils/matrices/chiffrage-de-travaux-par-lot.xlsx`, onglets
 * « Chiffrage » et « Référentiel ».
 *
 * CINQ ENTRÉES, VINGT-HUIT POSTES. La surface, les niveaux, la hauteur sous
 * plafond, les façades exposées et la part rénovée suffisent à déduire une
 * géométrie (emprise, périmètre, murs, toit), et la géométrie donne une
 * quantité à chaque poste. Chaque poste a un prix bas et un prix haut : le
 * curseur choisit où l'on se place entre les deux. Quantité et prix restent
 * forçables ligne à ligne, parce qu'un chiffrage qu'on ne peut pas corriger
 * avec son propre devis ne sert qu'une fois.
 *
 * Ce que la matrice révisée ajoute à la version précédente, qui chiffrait un
 * prix au m² global selon trois niveaux d'ampleur :
 *   · le détail poste par poste, avec son unité et son ratio ;
 *   · les honoraires de maîtrise d'œuvre, toujours à 20 % ;
 *   · la TVA QUALIFIÉE : taux par ligne (5,5 % pour l'énergétique, 10 % pour
 *     l'amélioration, 20 % pour la chaudière fossile), sauf si le chantier
 *     bascule tout entier à 20 % — local non habitable, logement de moins de
 *     deux ans, extension, ou immeuble rendu neuf ;
 *   · le contrôle de cohérence par famille de lots, qui signale le poste oublié.
 */

import { estVide, ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;
type T = Record<string, number[][]>;

/** Référentiel!B69:H69 : d'où vient la quantité automatique d'un poste. */
type Base = "traitee" | "benne" | "habitable" | "habitableMin1" | "toit" | "emprise" | "logement" | "murs" | "cloisons";

interface Poste {
  prestation: string;
  lot: string;
  unite: string;
  bas: number;
  haut: number;
  tva: number;
  base: Base;
  ratio: number;
}

const p = (prestation: string, lot: string, unite: string, bas: number, haut: number, tva: number, base: Base, r: number): Poste => ({
  prestation, lot, unite, bas, haut, tva, base, ratio: r,
});

/** Référentiel!B70:I100, millésime 2026. Fournitures et pose, hors taxes. */
export const POSTES: Poste[] = [
  p("Dépose de cloisons, sols et sanitaires", "Dépose et démolition", "m² au sol", 25, 60, 10, "traitee", 1),
  p("Évacuation en benne", "Dépose et démolition", "forfait", 400, 1200, 10, "benne", 0.0083),
  p("Ouverture dans un mur porteur avec IPN", "Gros œuvre", "unité", 1800, 4500, 10, "habitable", 0),
  p("Reprise de maçonnerie et rebouchage", "Gros œuvre", "m²", 45, 110, 10, "habitable", 0),
  p("Réfection de couverture en tuiles", "Charpente et toiture", "m² de toit", 90, 190, 10, "toit", 1),
  p("Traitement de charpente", "Charpente et toiture", "m² au sol", 25, 55, 10, "emprise", 1),
  p("Fenêtre PVC double vitrage posée", "Menuiseries extérieures", "unité", 550, 1400, 5.5, "habitable", 0.0769),
  p("Porte d'entrée", "Menuiseries extérieures", "unité", 900, 2600, 5.5, "logement", 1),
  p("Isolation des murs par l'intérieur", "Isolation", "m² de mur", 45, 95, 5.5, "murs", 1),
  p("Isolation des combles perdus", "Isolation", "m² au sol", 25, 60, 5.5, "emprise", 1),
  p("Cloison placo sur ossature", "Cloisons et plâtrerie", "m²", 45, 95, 10, "cloisons", 0.2),
  p("Doublage et enduit de finition", "Cloisons et plâtrerie", "m²", 30, 65, 10, "murs", 1),
  p("Électricité complète, NF C 15-100", "Électricité", "m² au sol", 90, 165, 10, "traitee", 1),
  p("Tableau électrique neuf", "Électricité", "unité", 900, 2200, 10, "logement", 1),
  p("Réseau plomberie complet", "Plomberie et chauffage", "m² au sol", 55, 120, 10, "traitee", 1),
  p("Pompe à chaleur air/eau ou air/air", "Plomberie et chauffage", "unité", 3500, 14000, 5.5, "logement", 1),
  p("Chaudière gaz ou fioul posée", "Plomberie et chauffage", "unité", 4000, 7000, 20, "logement", 1),
  p("Radiateurs posés", "Plomberie et chauffage", "unité", 250, 800, 10, "habitable", 0.0625),
  p("VMC hygroréglable ou double flux", "Ventilation", "logement", 700, 5500, 5.5, "logement", 1),
  p("Parquet stratifié ou contrecollé posé", "Revêtements de sol", "m²", 35, 110, 10, "traitee", 0.7),
  p("Carrelage posé", "Revêtements de sol", "m²", 55, 140, 10, "traitee", 0.3),
  p("Peinture murs et plafonds", "Peinture et finitions", "m² au sol", 52, 112, 10, "traitee", 1),
  p("Bloc-porte posé", "Menuiseries intérieures", "unité", 250, 650, 10, "habitable", 0.0625),
  p("Cuisine équipée posée", "Cuisine", "unité", 3500, 15000, 10, "logement", 1),
  p("Salle de bains complète", "Salle de bains", "unité", 4000, 14000, 10, "habitableMin1", 0.0143),
  p("WC suspendu posé", "Salle de bains", "unité", 450, 1100, 10, "habitableMin1", 0.0167),
  p("Ravalement de façade", "Extérieurs", "m² de façade", 50, 130, 10, "murs", 1),
  p("Reprise de VRD et abords", "Extérieurs", "m²", 40, 120, 10, "habitable", 0),
  p("Poste libre 1 (à compléter)", "Autre", "unité", 0, 0, 10, "habitable", 0),
  p("Poste libre 2 (à compléter)", "Autre", "unité", 0, 0, 10, "habitable", 0),
  p("Poste libre 3 (à compléter)", "Autre", "unité", 0, 0, 10, "habitable", 0),
];

/** Référentiel!B36:D41 et B45:C60. */
export const FAMILLES: { nom: string; contenu: string; bas: number; haut: number; lots: string[] }[] = [
  { nom: "Dépose et gros œuvre", contenu: "Dépose et démolition, gros œuvre", bas: 5, haut: 12, lots: ["Dépose et démolition", "Gros œuvre"] },
  { nom: "Enveloppe", contenu: "Toiture, menuiseries extérieures, isolation, extérieurs", bas: 10, haut: 30, lots: ["Charpente et toiture", "Menuiseries extérieures", "Isolation", "Extérieurs"] },
  { nom: "Technique", contenu: "Électricité, plomberie, chauffage, ventilation", bas: 25, haut: 35, lots: ["Électricité", "Plomberie et chauffage", "Ventilation"] },
  { nom: "Cloisons et finitions", contenu: "Plâtrerie, sols, peinture, menuiseries intérieures", bas: 15, haut: 28, lots: ["Cloisons et plâtrerie", "Revêtements de sol", "Peinture et finitions", "Menuiseries intérieures"] },
  { nom: "Cuisine et salle de bains", contenu: "Cuisine équipée, salle de bains, WC", bas: 12, haut: 25, lots: ["Cuisine", "Salle de bains"] },
  { nom: "Postes libres", contenu: "Désamiantage, plomb, ascenseur, escalier, diagnostics", bas: 0, haut: 15, lots: ["Autre"] },
];

export const HABITATION = "Habitation";
export const LOCAL_AUTRE = "Local autre";
export const TOUT_A_20 = "TOUT À 20 %";
export const TAUX_PAR_LIGNE = "Taux par ligne";
const oui = (x: string | undefined) => x === "Oui";
const pc = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

/* ── Géométrie (D19:D23) ─────────────────────────────────────────────────── */

export function geometrie(v: V) {
  const surface = v.surface ?? 0;
  const niveaux = v.niveaux ?? 1;
  const emprise = surface > 0 && niveaux > 0 ? surface / niveaux : Number.NaN;
  const perimetre = (v.coefPerimetre ?? 4.2) * Math.sqrt(emprise);
  const murs = (perimetre * (v.hsp ?? 2.5) * niveaux * (v.facades ?? 0)) / (v.nombreFacades ?? 4);
  const traitee = surface * pc(v.partRenovee, 100);
  const toit = emprise * (v.coefToiture ?? 1.2);
  return { emprise, perimetre, murs, traitee, toit };
}

/** ROUND d'Excel : au plus proche, les demis s'éloignent de zéro. */
const arrondi = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);

function quantiteAuto(poste: Poste, v: V): number {
  const g = geometrie(v);
  const s = v.surface ?? 0;
  switch (poste.base) {
    case "logement": return arrondi(poste.ratio);
    case "traitee": return arrondi(g.traitee * poste.ratio);
    case "benne": return Math.ceil(s * poste.ratio - 1e-9);
    case "habitable": return arrondi(s * poste.ratio);
    case "habitableMin1": return Math.max(1, arrondi(s * poste.ratio));
    case "toit": return arrondi(g.toit * poste.ratio);
    case "emprise": return arrondi(g.emprise * poste.ratio);
    case "murs": return arrondi(g.murs * poste.ratio);
    case "cloisons": return arrondi(g.traitee * (v.hsp ?? 2.5) * poste.ratio);
  }
}

/* ── La TVA du chantier (D62:D83) ────────────────────────────────────────── */

export const SECOND_OEUVRE = ["planchers", "huisseries", "cloisons", "plomberie", "electricite", "chauffage"] as const;

export function secondOeuvreDeclare(c: C): number {
  return SECOND_OEUVRE.filter((id) => oui(c[id])).length;
}

export function immeubleRenduNeuf(c: C): boolean {
  return oui(c.fondations) || oui(c.structure) || oui(c.facadesRefaites) || secondOeuvreDeclare(c) === SECOND_OEUVRE.length;
}

export function toutA20(c: C): boolean {
  return c.nature === LOCAL_AUTRE || !oui(c.ancien) || oui(c.extension) || immeubleRenduNeuf(c);
}

/** D78 puis M29:M59 : le taux appliqué à une ligne, en pourcentage. */
function tauxLigne(poste: Poste, v: V, c: C): number {
  if (toutA20(c)) return v.tvaNormale ?? 20;
  if (c.tauxForce && c.tauxForce !== "") return Number(c.tauxForce);
  return poste.tva === 20 ? (v.tvaNormale ?? 20) : poste.tva === 5.5 ? (v.tvaReduite ?? 5.5) : (v.tvaIntermediaire ?? 10);
}

/* ── Les lignes (E29:N59) ────────────────────────────────────────────────── */

export interface Ligne {
  poste: Poste;
  quantite: number;
  puRetenu: number;
  puForce: boolean;
  totalHT: number;
  tva: number;
  totalTTC: number;
}

export function lignes(v: V, c: C, t: T): Ligne[] {
  const saisies = t.postes ?? [];
  const curseur = pc(v.curseur, 50);
  return POSTES.map((poste, i) => {
    const [qForcee, puForce] = saisies[i] ?? [];
    const quantite = estVide(qForcee) ? quantiteAuto(poste, v) : (qForcee as number);
    const force = !estVide(puForce);
    const puRetenu = force ? (puForce as number) : poste.bas + (poste.haut - poste.bas) * curseur;
    const totalHT = quantite * puRetenu;
    const tva = tauxLigne(poste, v, c);
    return { poste, quantite, puRetenu, puForce: force, totalHT, tva, totalTTC: totalHT * (1 + tva / 100) };
  });
}

/* ── Contrôles (D24, D83) ────────────────────────────────────────────────── */

export function saisiesValides(v: V, t: T): boolean {
  const s = v.surface ?? 0;
  const n = v.niveaux ?? 0;
  const h = v.hsp ?? 0;
  const f = v.facades ?? 0;
  const dansBornes = (x: number | undefined, max: number) => x !== undefined && x >= 0 && x <= max;
  const forcages = (t.postes ?? []).every(([q, pu]) => (estVide(q) || (q as number) >= 0) && (estVide(pu) || (pu as number) >= 0));
  return (
    s >= 9 && s <= 5000 &&
    n >= 1 && n <= 6 && Number.isInteger(n) &&
    h >= 2 && h <= 5 &&
    f >= 0 && f <= 4 && Number.isInteger(f) &&
    dansBornes(v.partRenovee, 100) &&
    dansBornes(v.curseur, 100) &&
    dansBornes(v.aleas, 50) &&
    dansBornes(v.honoraires, 50) &&
    forcages
  );
}

/** D79 : éléments de second œuvre que le chiffrage refait, sur cinq. */
export function secondOeuvreChiffre(v: V, c: C, t: T): number {
  if (pc(v.partRenovee, 100) < 2 / 3) return 0;
  const l = lignes(v, c, t);
  const actif = (...idx: number[]) => (idx.reduce((s, i) => s + l[i]!.totalHT, 0) > 0 ? 1 : 0);
  return actif(6, 7) + actif(10) + actif(14, 24, 25) + actif(12, 13) + actif(15, 16, 17);
}

/* ── Récapitulatif (D87:F100) ────────────────────────────────────────────── */

export type Scenario = "bas" | "retenu" | "haut";

/** Un chiffrage rendu au curseur 0 % ou 100 %, forçages de prix conservés. */
function lignesScenario(s: Scenario, v: V, c: C, t: T): Ligne[] {
  if (s === "retenu") return lignes(v, c, t);
  return lignes({ ...v, curseur: s === "bas" ? 0 : 100 }, c, t);
}

export function recapitulatif(s: Scenario, v: V, c: C, t: T) {
  if (!saisiesValides(v, t)) {
    const vide = Number.NaN;
    return { lots: vide, aleas: vide, honoraires: vide, ht: vide, tva55: vide, tva10: vide, tva20: vide, tva: vide, ttc: vide };
  }
  const l = lignesScenario(s, v, c, t);
  const lots = l.reduce((x, y) => x + y.totalHT, 0);
  const aleas = lots * pc(v.aleas, 12);
  const honoraires = lots * pc(v.honoraires, 10);
  const parTaux = (taux: number) =>
    l.filter((y) => y.tva === taux).reduce((x, y) => x + y.totalHT, 0) * (1 + pc(v.aleas, 12)) * (taux / 100);
  const normal = v.tvaNormale ?? 20;
  const tva55 = parTaux(v.tvaReduite ?? 5.5);
  const tva10 = parTaux(v.tvaIntermediaire ?? 10);
  const tva20 = parTaux(normal) + honoraires * (normal / 100);
  const ht = lots + aleas + honoraires;
  const tva = tva55 + tva10 + tva20;
  return { lots, aleas, honoraires, ht, tva55, tva10, tva20, tva, ttc: ht + tva };
}

export function niveauRenovation(v: V, c: C, t: T): string {
  const m2 = ratio(recapitulatif("retenu", v, c, t).ttc, v.surface ?? 0);
  if (!Number.isFinite(m2)) return "–";
  if (m2 < (v.seuilRenovation ?? 750)) return "Rafraîchissement";
  if (m2 < (v.seuilLourde ?? 1500)) return "Rénovation";
  return "Rénovation lourde ou restructuration";
}

/* ── Contrôle par famille (D104:H110) ────────────────────────────────────── */

export function famille(i: number, v: V, c: C, t: T): { montant: number; part: number; verdict: string } {
  const f = FAMILLES[i]!;
  const l = lignes(v, c, t);
  const total = l.reduce((x, y) => x + y.totalHT, 0);
  const montant = l.filter((y) => f.lots.includes(y.poste.lot)).reduce((x, y) => x + y.totalHT, 0);
  const part = total > 0 ? montant / total : 0;
  const verdict =
    montant === 0 ? "Non traité" : part < f.bas / 100 ? "Bas : poste oublié ?" : part > f.haut / 100 ? "Élevé : à justifier" : "Dans la norme";
  return { montant, part, verdict };
}

/* ── La spécification ────────────────────────────────────────────────────── */

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const ouiNon = [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }];
const pct1 = (x: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x * 100);
const siValide = (f: (v: V, c: C, t: T) => number) => (v: V, c: C, t: T) => (saisiesValides(v, t) ? f(v, c, t) : Number.NaN);

/** Les forçages livrés dans l'exemple du classeur (Chiffrage!F29:F59). */
const FORCAGES: Record<number, number> = { 2: 1, 3: 20, 4: 0, 5: 0, 9: 0, 16: 0, 26: 0, 27: 0 };

export const chiffrageTravaux: ToolSpec = {
  id: "chiffrage-travaux",
  title: "Chiffrage de travaux par lot",
  intro:
    "Vingt-huit postes chiffrés en fourchette depuis cinq mesures du bien, avec la TVA du chantier qualifiée.",
  sections: [
    {
      title: "Le bien",
      fields: [
        { id: "surface", label: "Surface habitable", value: 90, unit: "m2", min: 9, max: 5000, hint: "Le pivot : elle pilote la plupart des quantités." },
        { id: "niveaux", label: "Nombre de niveaux", value: 1, unit: "nombre", min: 1, max: 6, step: 1, hint: "Sert à déduire l'emprise au sol : toiture, combles, charpente." },
        { id: "hsp", label: "Hauteur sous plafond", value: 2.5, unit: "nombre", min: 2, max: 5, step: 0.05, hint: "En mètres. Sert aux murs et aux cloisons. Mesurez-la sur place." },
        { id: "facades", label: "Façades exposées", value: 2, unit: "nombre", min: 0, max: 4, step: 1, hint: "4 pour une maison, 2 pour un appartement traversant, 1 sinon." },
        { id: "partRenovee", label: "Part du logement rénovée", value: 100, unit: "pct", min: 0, max: 100, step: 5, hint: "100 % = rénovation complète. Pilote dépose, électricité, plomberie, sols, peinture, cloisons." },
      ],
    },
    {
      title: "Le chiffrage",
      fields: [
        { id: "curseur", label: "Positionnement dans la fourchette", value: 50, unit: "pct", min: 0, max: 100, step: 5, hint: "0 % = bas, 100 % = haut. Repères : province 40 à 60 %, Île-de-France 60 à 80 %, Paris 70 à 100 %." },
        { id: "aleas", label: "Provision pour aléas", value: 12, unit: "pct", min: 0, max: 50, step: 1, hint: "Rénovation dans l'ancien : 10 à 15 %. En dessous, vous pariez." },
        { id: "honoraires", label: "Honoraires de maîtrise d'œuvre", value: 10, unit: "pct", min: 0, max: 50, step: 1, hint: "Maîtrise d'œuvre d'exécution 8 à 12 %, architecte en mission complète 12 à 18 %. TVA à 20 %." },
      ],
    },
    {
      title: "La TVA du chantier",
      fields: [
        { id: "nature", label: "Nature du local", value: HABITATION, options: [{ value: HABITATION, label: HABITATION }, { value: LOCAL_AUTRE, label: "Local autre (bureau, commerce, entrepôt)" }], hint: "Un local autre qu'une habitation est à 20 % sur tout le chantier." },
        { id: "ancien", label: "Logement achevé depuis plus de 2 ans au début des travaux ?", value: "Oui", options: ouiNon, hint: "Non : 20 % sur tout le chantier." },
        { id: "extension", label: "Extension de surface de plancher de plus de 10 % ?", value: "Non", options: ouiNon, hint: "Surélévation, addition, combles créant de la surface : 20 % sur tout." },
        { id: "fondations", label: "Gros œuvre : majorité des fondations refaite ?", value: "Non", options: ouiNon, hint: "Un seul critère de gros œuvre rend l'immeuble neuf : 20 % sur tout." },
        { id: "structure", label: "Gros œuvre : majorité de la structure refaite ?", value: "Non", options: ouiNon, hint: "Murs porteurs, planchers porteurs, charpente." },
        { id: "facadesRefaites", label: "Gros œuvre : majorité des façades refaite (hors ravalement) ?", value: "Non", options: ouiNon },
        { id: "planchers", label: "Second œuvre : planchers non porteurs refaits aux deux tiers ?", value: "Non", options: ouiNon, hint: "Les six éléments de second œuvre ensemble rendent l'immeuble neuf." },
        { id: "huisseries", label: "Second œuvre : huisseries extérieures refaites aux deux tiers ?", value: "Oui", options: ouiNon },
        { id: "cloisons", label: "Second œuvre : cloisons intérieures refaites aux deux tiers ?", value: "Oui", options: ouiNon },
        { id: "plomberie", label: "Second œuvre : plomberie et sanitaires refaits aux deux tiers ?", value: "Oui", options: ouiNon },
        { id: "electricite", label: "Second œuvre : électricité refaite aux deux tiers ?", value: "Oui", options: ouiNon },
        { id: "chauffage", label: "Second œuvre : chauffage refait aux deux tiers ?", value: "Oui", options: ouiNon },
        { id: "tauxForce", label: "Taux de TVA forcé", value: "", options: [{ value: "", label: "Aucun : chaque ligne garde son taux" }, { value: "5.5", label: "5,5 %" }, { value: "10", label: "10 %" }, { value: "20", label: "20 %" }], hint: "Ignoré si le chantier bascule à 20 %." },
      ],
    },
  ],
  tables: [
    {
      id: "postes",
      title: "Les postes : quantité et prix forçables",
      hint: "Laissez vide pour garder la quantité déduite du bien et le prix pris dans la fourchette. Un 0 en quantité désactive le poste. Un prix forcé vaut pour les trois scénarios.",
      addLabel: "Ajouter un poste",
      min: POSTES.length,
      max: POSTES.length,
      rowLabels: POSTES.map((x) => `${x.prestation} (${x.unite})`),
      columns: [
        { id: "quantite", label: "Quantité forcée", short: "Quantité forcée", value: 0, unit: "nombre", optional: true, placeholder: "auto" },
        { id: "prix", label: "Prix unitaire HT forcé", short: "PU HT forcé", value: 0, unit: "eur", optional: true, placeholder: "fourchette" },
      ],
      rows: POSTES.map((_, i) => [FORCAGES[i] ?? Number.NaN, Number.NaN]),
    },
  ],
  params: [
    { id: "tvaNormale", label: "TVA, taux normal", value: 20, unit: "pct" },
    { id: "tvaIntermediaire", label: "TVA, taux intermédiaire (amélioration d'un logement de plus de 2 ans)", value: 10, unit: "pct" },
    { id: "tvaReduite", label: "TVA, taux réduit (rénovation énergétique éligible)", value: 5.5, unit: "pct" },
    { id: "coefPerimetre", label: "Coefficient de périmètre (× racine de l'emprise)", value: 4.2, unit: "nombre", hint: "4,0 pour un carré, 4,24 pour un rectangle 2:1." },
    { id: "nombreFacades", label: "Nombre de façades d'un bâtiment", value: 4, unit: "nombre" },
    { id: "coefToiture", label: "Coefficient de toiture (× emprise)", value: 1.2, unit: "nombre", hint: "1,20 pour une pente de 30 à 35°. Toit plat : 1,00." },
    { id: "seuilRenovation", label: "Coût TTC au m² au-dessus duquel on rénove", value: 750, unit: "eurm2" },
    { id: "seuilLourde", label: "Coût TTC au m² de la rénovation lourde", value: 1500, unit: "eurm2" },
  ],
  headlines: [
    {
      label: "Budget travaux TTC retenu",
      unit: "eur",
      compute: (v, c, t) => recapitulatif("retenu", v, c, t).ttc,
      caption: (v, c, t) => {
        if (!saisiesValides(v, t)) return "À calculer une fois les saisies dans leurs bornes.";
        const bas = recapitulatif("bas", v, c, t).ttc;
        const haut = recapitulatif("haut", v, c, t).ttc;
        return `Fourchette de ${fr(bas)} € à ${fr(haut)} €, aléas et honoraires compris. ${niveauRenovation(v, c, t)}.`;
      },
    },
    {
      label: "Coût TTC au m² habitable",
      unit: "eurm2",
      compute: (v, c, t) => ratio(recapitulatif("retenu", v, c, t).ttc, v.surface ?? 0),
      caption: (v, c) =>
        toutA20(c)
          ? "Tout le chantier est à 20 % de TVA : les taux réduits ne s'appliquent pas."
          : "Taux réduits admis : chaque ligne garde son taux de TVA.",
    },
  ],
  outputs: [
    { id: "emprise", label: "Emprise au sol", unit: "m2", compute: (v) => geometrie(v).emprise },
    { id: "perimetre", label: "Périmètre estimé", unit: "nombre", compute: (v) => geometrie(v).perimetre, hint: "En mètres. Le périmètre n'est pas proportionnel à la surface." },
    { id: "murs", label: "Murs de façade", unit: "m2", compute: (v) => geometrie(v).murs, hint: "Pilote isolation, doublage, ravalement." },
    { id: "toit", label: "Surface de toit", unit: "m2", compute: (v) => geometrie(v).toit },
    { id: "lotsBas", label: "Sous-total des lots HT, bas de fourchette", unit: "eur", compute: (v, c, t) => recapitulatif("bas", v, c, t).lots },
    { id: "lots", label: "Sous-total des lots HT, retenu", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).lots, strong: true, hint: "Le chiffre à comparer à un devis d'entreprise générale." },
    { id: "lotsHaut", label: "Sous-total des lots HT, haut de fourchette", unit: "eur", compute: (v, c, t) => recapitulatif("haut", v, c, t).lots },
    { id: "aleasMontant", label: "Provision pour aléas", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).aleas },
    { id: "honorairesMontant", label: "Honoraires de maîtrise d'œuvre", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).honoraires },
    { id: "ht", label: "Total HT", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).ht, strong: true },
    { id: "tva55", label: "dont TVA à 5,5 %", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).tva55 },
    { id: "tva10", label: "dont TVA à 10 %", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).tva10 },
    { id: "tva20", label: "dont TVA à 20 %", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).tva20, hint: "Honoraires compris." },
    { id: "tva", label: "Total TVA", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).tva },
    { id: "ttc", label: "Total TTC", unit: "eur", compute: (v, c, t) => recapitulatif("retenu", v, c, t).ttc, strong: true },
    { id: "ttcLignes", label: "Somme des TTC de ligne, hors aléas et honoraires", unit: "eur", compute: siValide((v, c, t) => lignes(v, c, t).reduce((x, y) => x + y.totalTTC, 0)), hint: "À rapprocher de la somme des devis d'entreprises." },
    { id: "lotsM2", label: "Lots seuls HT au m² habitable", unit: "eurm2", compute: (v, c, t) => ratio(recapitulatif("retenu", v, c, t).lots, v.surface ?? 0) },
    { id: "htM2", label: "Coût au m² HT, aléas et honoraires compris", unit: "eurm2", compute: (v, c, t) => ratio(recapitulatif("retenu", v, c, t).ht, v.surface ?? 0) },
    { id: "niveau", label: "Niveau de rénovation", unit: "texte", compute: niveauRenovation },
    { id: "regime", label: "Taux réduits admis sur ce chantier", unit: "texte", compute: (v, c) => (toutA20(c) ? TOUT_A_20 : TAUX_PAR_LIGNE), hint: "Tout à 20 % pour un local autre, un logement de moins de deux ans, une extension ou un immeuble rendu neuf." },
    { id: "renduNeuf", label: "Immeuble rendu à l'état neuf", unit: "texte", compute: (v, c) => (immeubleRenduNeuf(c) ? "Oui" : "Non"), hint: "Oui dès qu'un critère de gros œuvre est rempli, ou que les six éléments de second œuvre le sont." },
    { id: "secondDeclare", label: "Éléments de second œuvre déclarés refaits, sur 6", unit: "nombre", compute: (v, c) => secondOeuvreDeclare(c), hint: "À cinq, un seul élément de plus fait basculer tout le chantier à 20 %." },
    { id: "coherenceTva", label: "Réponses TVA cohérentes avec le chiffrage", unit: "texte", compute: (v, c, t) => (secondOeuvreDeclare(c) >= secondOeuvreChiffre(v, c, t) ? "OK" : "À vérifier"), hint: "À vérifier : le chiffrage refait plus d'éléments de second œuvre que vous n'en déclarez." },
    ...FAMILLES.map((f, i) => ({
      id: `famille${i}`,
      label: `Part ${f.nom.toLowerCase()} (${f.bas} à ${f.haut} %)`,
      unit: "texte" as const,
      compute: (v: V, c: C, t: T) => {
        if (!saisiesValides(v, t)) return "–";
        const r = famille(i, v, c, t);
        return r.montant === 0 ? r.verdict : `${pct1(r.part)} %, ${r.verdict.charAt(0).toLowerCase()}${r.verdict.slice(1)}`;
      },
      hint: f.contenu,
    })),
    { id: "controle", label: "Saisies complètes et dans leurs bornes", unit: "texte", compute: (v, c, t) => (saisiesValides(v, t) ? "OK" : "À corriger") },
  ],
  caveat:
    "Ce chiffrage ne remplace pas un devis : il sert à décider s'il vaut la peine d'en demander trois. Les fourchettes valent pour la France hors Paris intra-muros, et les ratios de quantité sont des conventions à caler sur vos propres chantiers.",
};
