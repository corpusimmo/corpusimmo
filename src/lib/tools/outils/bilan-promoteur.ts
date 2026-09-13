/**
 * BILAN PROMOTEUR ET CHARGE FONCIÈRE — la version en ligne de
 * `public/outils/matrices/bilan-promoteur-et-charge-fonciere.xlsx`, onglets
 * « Bilan » et « Sensibilité ».
 *
 * LE BILAN SE LIT À L'ENVERS. On ne cherche pas la marge d'un terrain au prix
 * demandé : on part du chiffre d'affaires, on retire les coûts hors foncier et
 * la marge cible, et ce qui reste est le prix maximal du terrain, frais
 * d'acquisition inclus. La contre-épreuve refait le calcul dans l'autre sens,
 * au prix réellement demandé. La grille de sensibilité croise les deux
 * variables qui font basculer une opération : le prix de vente et le coût de
 * construction.
 */

import { ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;

export function chiffreAffaires(v: V, prixVente = v.prixVente ?? 0): number {
  return (v.shab ?? 0) * prixVente + (v.parkings ?? 0) * (v.prixParking ?? 0);
}

/** Bilan!F8:F17. Les frais assis sur le CA suivent le prix de vente, pas les travaux. */
export function cascade(v: V, prixVente = v.prixVente ?? 0, construction = v.construction ?? 0) {
  const ca = chiffreAffaires(v, prixVente);
  const travaux = (v.sdp ?? 0) * construction + (v.vrd ?? 0);
  const honoraires = (travaux * (v.honoraires ?? 0)) / 100;
  const assurances = (travaux * (v.assurances ?? 0)) / 100;
  const aleas = (travaux * (v.aleas ?? 0)) / 100;
  const taxes = v.taxes ?? 0;
  const technique = travaux + honoraires + assurances + aleas + taxes;
  const commercialisation = (ca * (v.commercialisation ?? 0)) / 100;
  const financiers = (ca * (v.financiers ?? 0)) / 100;
  const structure = (ca * (v.structure ?? 0)) / 100;
  const horsFoncier = technique + commercialisation + financiers + structure;
  const margeValeur = (ca * (v.marge ?? 0)) / 100;
  const chargeFonciere = ca - horsFoncier - margeValeur;
  return { ca, travaux, honoraires, assurances, aleas, taxes, technique, commercialisation, financiers, structure, horsFoncier, margeValeur, chargeFonciere };
}

export function contreEpreuve(v: V) {
  const c = cascade(v);
  const margeValeur = c.ca - c.horsFoncier - (v.prixDemande ?? 0);
  return { margeValeur, margePct: ratio(margeValeur, c.ca) * 100, ecart: (v.prixDemande ?? 0) - c.chargeFonciere };
}

/** Sensibilité!B9:G14 : prix de vente ±200 €/m² par pas de 100, construction ±150 €/m² par pas de 75. */
export const PAS_VENTE = [-200, -100, 0, 100, 200];
export const PAS_CONSTRUCTION = [-150, -75, 0, 75, 150];

export function sensibilite(v: V): number[][] {
  return PAS_VENTE.map((dv) => PAS_CONSTRUCTION.map((dc) => cascade(v, (v.prixVente ?? 0) + dv, (v.construction ?? 0) + dc).chargeFonciere));
}

const fr = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));

export const bilanPromoteur: ToolSpec = {
  id: "bilan-promoteur",
  title: "Charge foncière admissible",
  intro:
    "Combien puis-je payer ce terrain pour que l'opération tienne ma marge ? La question posée dans le bon sens.",
  sections: [
    {
      title: "Le programme",
      fields: [
        { id: "sdp", label: "Surface de plancher constructible", value: 2400, unit: "m2", min: 1, hint: "Issue du PLU : emprise × hauteur × COS résiduel." },
        { id: "shab", label: "Surface habitable vendable", value: 2040, unit: "m2", min: 1, hint: "Environ 85 % de la surface de plancher." },
        { id: "logements", label: "Nombre de logements", value: 32, unit: "nombre", min: 0, step: 1 },
        { id: "prixVente", label: "Prix de vente moyen TTC", value: 4200, unit: "eurm2", hint: "Au m² habitable. Le paramètre le plus sensible." },
        { id: "parkings", label: "Parkings vendus", value: 28, unit: "nombre", min: 0, step: 1 },
        { id: "prixParking", label: "Prix de vente d'un parking", value: 18000, unit: "eur" },
      ],
    },
    {
      title: "Les coûts",
      fields: [
        { id: "construction", label: "Coût de construction", value: 1950, unit: "eurm2", hint: "Au m² de surface de plancher, tous corps d'état." },
        { id: "vrd", label: "VRD, espaces verts et fondations spéciales", value: 180000, unit: "eur" },
        { id: "honoraires", label: "Honoraires techniques", value: 12, unit: "pct", hint: "Architecte, BET, contrôle, OPC, en % du coût de construction." },
        { id: "assurances", label: "Assurances et garanties", value: 2.5, unit: "pct", hint: "Dommage-ouvrage, GFA, RC, en % du coût de construction." },
        { id: "taxes", label: "Taxes d'aménagement et raccordements", value: 95000, unit: "eur" },
        { id: "commercialisation", label: "Frais de commercialisation", value: 4.5, unit: "pct", hint: "En % du chiffre d'affaires TTC." },
        { id: "financiers", label: "Frais financiers", value: 3, unit: "pct", hint: "En % du chiffre d'affaires. Portage sur 24 à 30 mois." },
        { id: "structure", label: "Frais de structure du promoteur", value: 5, unit: "pct", hint: "En % du chiffre d'affaires." },
        { id: "aleas", label: "Aléas et imprévus", value: 3, unit: "pct", hint: "En % du coût de construction. Jamais zéro." },
      ],
    },
    {
      title: "La marge et le prix demandé",
      fields: [
        { id: "marge", label: "Marge cible sur chiffre d'affaires", value: 8, unit: "pct", hint: "6 à 10 % en logement libre. En dessous de 6 %, aucun financeur ne suit." },
        { id: "prixDemande", label: "Prix du terrain réellement demandé", value: 1250000, unit: "eur", hint: "Frais d'acquisition compris. C'est lui qu'on confronte à la charge foncière admissible." },
      ],
    },
  ],
  params: [],
  headlines: [
    {
      label: "Charge foncière admissible",
      unit: "eur",
      compute: (v) => cascade(v).chargeFonciere,
      caption: (v) => {
        const c = cascade(v);
        return `Soit ${fr(ratio(c.chargeFonciere, v.sdp ?? 0))} € par m² de plancher et ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(ratio(c.chargeFonciere, c.ca) * 100)} % du chiffre d'affaires. Repères : 12 à 20 % en zone détendue, 25 à 35 % en zone tendue.`;
      },
    },
    {
      label: "Marge au prix de terrain demandé",
      unit: "pct",
      compute: (v) => contreEpreuve(v).margePct,
      caption: (v) => {
        const e = contreEpreuve(v).ecart;
        return e > 0 ? `Le terrain est ${fr(e)} € trop cher pour la marge visée.` : `Vous gardez ${fr(-e)} € de marge de négociation sur le terrain.`;
      },
    },
  ],
  outputs: [
    { id: "ca", label: "Chiffre d'affaires TTC", unit: "eur", compute: (v) => cascade(v).ca, strong: true },
    { id: "travaux", label: "Travaux, construction et VRD", unit: "eur", compute: (v) => cascade(v).travaux },
    { id: "honorairesMontant", label: "Honoraires techniques", unit: "eur", compute: (v) => cascade(v).honoraires },
    { id: "assurancesMontant", label: "Assurances et garanties", unit: "eur", compute: (v) => cascade(v).assurances },
    { id: "aleasMontant", label: "Aléas", unit: "eur", compute: (v) => cascade(v).aleas },
    { id: "technique", label: "Coût technique total", unit: "eur", compute: (v) => cascade(v).technique, strong: true },
    { id: "commercialisationMontant", label: "Commercialisation", unit: "eur", compute: (v) => cascade(v).commercialisation },
    { id: "financiersMontant", label: "Frais financiers", unit: "eur", compute: (v) => cascade(v).financiers },
    { id: "structureMontant", label: "Frais de structure", unit: "eur", compute: (v) => cascade(v).structure },
    { id: "horsFoncier", label: "Coûts hors foncier", unit: "eur", compute: (v) => cascade(v).horsFoncier, strong: true },
    { id: "margeValeur", label: "Marge cible en valeur", unit: "eur", compute: (v) => cascade(v).margeValeur },
    { id: "cfM2", label: "Charge foncière au m² de plancher", unit: "eurm2", compute: (v) => ratio(cascade(v).chargeFonciere, v.sdp ?? 0) },
    { id: "cfPct", label: "Charge foncière en % du chiffre d'affaires", unit: "pct", compute: (v) => ratio(cascade(v).chargeFonciere, cascade(v).ca) * 100 },
    { id: "margeResultante", label: "Marge résultante au prix demandé", unit: "eur", compute: (v) => contreEpreuve(v).margeValeur },
    { id: "ecart", label: "Écart au prix admissible", unit: "eur", compute: (v) => contreEpreuve(v).ecart, strong: true, hint: "Positif : le terrain est trop cher pour la marge visée." },
    ...PAS_VENTE.map((dv, i) => ({
      id: `sensibilite${i}`,
      label: `Sensibilité, vente à ${dv >= 0 ? "+" : ""}${dv} €/m²`,
      unit: "texte" as const,
      compute: (v: V) =>
        sensibilite(v)[i]!
          .map((cf, j) => `construction ${PAS_CONSTRUCTION[j]! >= 0 ? "+" : ""}${PAS_CONSTRUCTION[j]} : ${fr(cf)} €`)
          .join(" · "),
      hint: i === 0 ? "Charge foncière admissible quand le prix de vente et le coût de construction bougent, à marge cible constante." : undefined,
    })),
  ],
  caveat:
    "Le modèle ne traite ni la TVA sur marge, ni le phasage des appels de fonds, ni la vente en bloc. Il suppose la commercialisation intégrale et ne vérifie ni la faisabilité réglementaire, ni les servitudes, ni la dépollution.",
};
