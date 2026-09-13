/**
 * CAPACITÉ D'EMPRUNT ET BILAN PATRIMONIAL — la version en ligne de
 * `public/outils/matrices/capacite-emprunt-et-bilan-patrimonial.xlsx`, onglets
 * « Capacité d'emprunt » et « Bilan patrimonial ».
 *
 * DEUX RÈGLES, ET LA PLUS CONTRAIGNANTE GAGNE. Le taux d'effort de 35 % est
 * une norme du HCSF, le reste à vivre est une pratique bancaire : un dossier à
 * 33 % avec quatre enfants peut être refusé, un dossier à 37 % confortable
 * peut passer. Le classeur calcule la mensualité permise par chacune et retient
 * la plus basse ; la page fait de même et dit laquelle a limité.
 *
 * Ce que la matrice révisée ajoute à la version précédente :
 *   · la distinction résidence principale / investissement locatif, qui décide
 *     si le loyer actuel disparaît et si le loyer attendu compte ;
 *   · les primes pondérées, les loyers pondérés à 70 % ;
 *   · le taux d'effort HCSF strict (crédits seuls) à côté du taux de charges
 *     tout compris ;
 *   · des frais de notaire CALCULÉS — droits de mutation selon le neuf ou le
 *     droit départemental majoré, contribution de sécurité immobilière,
 *     émoluments TTC, débours — au lieu d'un pourcentage forfaitaire ;
 *   · la garantie et le dossier retirés du budget avant le prix d'achat ;
 *   · la durée HCSF avec différé, le taux d'usure, l'apport face aux frais ;
 *   · tout le bilan patrimonial, avant et après l'opération.
 */

import { ratio, type ToolSpec } from "../spec";

type V = Record<string, number>;
type C = Record<string, string>;

export const OBJET_RP = "Résidence principale";
export const OBJET_LOCATIF = "Investissement locatif";

const oui = (x: string | undefined) => x === "Oui";
const pct = (x: number | undefined, defaut: number) => (x ?? defaut) / 100;

/* ── Revenus et charges (C7:C19) ─────────────────────────────────────────── */

/** C12 : ce que le foyer encaisse, avant pondération. */
export function revenusFoyer(v: V): number {
  return (v.salaire1 ?? 0) + (v.salaire2 ?? 0) + (v.primes ?? 0) + (v.loyersActuels ?? 0) + (v.autresRevenus ?? 0);
}

/** C19 : les seules charges du taux d'effort HCSF strict. */
function creditsEnCours(v: V): number {
  return (v.creditsImmo ?? 0) + (v.creditsConso ?? 0);
}

/* ── Ce que la banque retient (C38:C50) ──────────────────────────────────── */

/** C38 : loyers actuels, plus le loyer attendu d'un bien locatif, pondérés. */
function loyersRetenus(v: V, c: C): number {
  const attendu = c.objet === OBJET_LOCATIF ? (v.loyerAttendu ?? 0) : 0;
  return ((v.loyersActuels ?? 0) + attendu) * pct(v.ponderationLoyers, 70);
}

/** C39 : le dénominateur de tous les ratios. */
export function revenusRetenus(v: V, c: C): number {
  return (
    (v.salaire1 ?? 0) +
    (v.salaire2 ?? 0) +
    (v.autresRevenus ?? 0) +
    (v.primes ?? 0) * pct(v.ponderationPrimes, 100) +
    loyersRetenus(v, c)
  );
}

/** C41 : crédits, pension versée, et loyer actuel s'il continue. */
function chargesRetenues(v: V, c: C): number {
  const loyerConserve = c.objet === OBJET_RP ? 0 : (v.loyerActuel ?? 0);
  return creditsEnCours(v) + (v.pension ?? 0) + loyerConserve;
}

function mensualiteEffort(v: V, c: C): number {
  return revenusRetenus(v, c) * pct(v.effortMax, 35) - chargesRetenues(v, c);
}

/** C43 : un repère bancaire, pas une règle légale. */
function resteAVivreMinimal(v: V): number {
  return (v.adultes ?? 0) * (v.ravAdulte ?? 800) + (v.enfants ?? 0) * (v.ravEnfant ?? 300);
}

function mensualiteResteAVivre(v: V, c: C): number {
  return revenusRetenus(v, c) - chargesRetenues(v, c) - resteAVivreMinimal(v);
}

/** C45 : le chiffre à présenter à la banque. */
export function mensualiteTenable(v: V, c: C): number {
  return Math.max(0, Math.min(mensualiteEffort(v, c), mensualiteResteAVivre(v, c)));
}

/* ── Capital, frais et prix (C53:C69) ────────────────────────────────────── */

/**
 * C53 : le capital K tel que la mensualité PMT(K) + assurance sur capital
 * initial égale la mensualité tenable. Avec a le facteur d'actualisation d'une
 * annuité de 1 €, K = a × mensualité / (1 + a × assurance / 12).
 */
export function capitalEmpruntable(v: V, c: C): number {
  const n = Math.round((v.duree ?? 0) * 12);
  if (n <= 0) return Number.NaN;
  const t = (v.taux ?? 0) / 100 / 12;
  const a = t === 0 ? n : (1 - Math.pow(1 + t, -n)) / t;
  return (a * mensualiteTenable(v, c)) / (1 + (a * (v.assurance ?? 0)) / 100 / 12);
}

function fraisGarantie(v: V, c: C): number {
  return capitalEmpruntable(v, c) * pct(v.garantiePct, 1.2);
}

function fraisDossier(v: V, c: C): number {
  return capitalEmpruntable(v, c) > 0 ? (v.dossierForfait ?? 2000) : 0;
}

/**
 * C61 : droits de mutation (ou taxe de publicité foncière dans le neuf),
 * contribution de sécurité immobilière et taux marginal des émoluments TTC.
 */
export function partProportionnelleNotaire(v: V, c: C): number {
  const droits = oui(c.neuf)
    ? pct(v.tpfNeuf, 0.715)
    : oui(c.droitMajore)
      ? pct(v.dmtoMajore, 6.32)
      : pct(v.dmtoStandard, 5.81);
  return droits + pct(v.csi, 0.1) + pct(v.emolumentsTaux, 0.799) * (1 + pct(v.tva, 20));
}

/** C62 : part fixe des émoluments TTC et débours. */
function partFixeNotaire(v: V): number {
  return (v.emolumentsFixe ?? 397.25) * (1 + pct(v.tva, 20)) + (v.debours ?? 1000);
}

/** C63 : budget moins garantie, dossier et notaire. */
export function prixMaximal(v: V, c: C): number {
  const budget = capitalEmpruntable(v, c) + (v.apport ?? 0);
  return Math.max(
    0,
    (budget - fraisGarantie(v, c) - fraisDossier(v, c) - partFixeNotaire(v)) /
      (1 + partProportionnelleNotaire(v, c)),
  );
}

function fraisNotaire(v: V, c: C): number {
  const prix = prixMaximal(v, c);
  return prix > 0 ? prix * partProportionnelleNotaire(v, c) + partFixeNotaire(v) : 0;
}

/** C66 : ce que l'apport doit couvrir au minimum. */
export function fraisAFinancer(v: V, c: C): number {
  return fraisNotaire(v, c) + fraisGarantie(v, c) + fraisDossier(v, c);
}

/** C59 : la tranche d'usure selon la durée en années. */
function tauxUsure(v: V): number {
  const d = v.duree ?? 0;
  if (d < (v.seuilUsure1 ?? 10)) return v.usureCourt ?? 4.07;
  if (d < (v.seuilUsure2 ?? 20)) return v.usureMoyen ?? 4.57;
  return v.usureLong ?? 5.29;
}

/* ── Bilan patrimonial ───────────────────────────────────────────────────── */

const immobilier = (v: V) => (v.rp ?? 0) + (v.locatifs ?? 0) + (v.autresBiens ?? 0);
const placements = (v: V) =>
  (v.livrets ?? 0) + (v.assuranceVie ?? 0) + (v.pea ?? 0) + (v.retraite ?? 0) + (v.parts ?? 0) + (v.autresActifs ?? 0);
/** Bilan!C20 : ce que la banque accepte comme apport disponible. */
const mobilisables = (v: V) => (v.livrets ?? 0) + (v.assuranceVie ?? 0) + (v.pea ?? 0);
const encoursImmo = (v: V) => (v.crdRp ?? 0) + (v.crdLocatifs ?? 0);
const passif = (v: V) =>
  encoursImmo(v) + (v.crdConso ?? 0) + (v.decouverts ?? 0) + (v.impots ?? 0) + (v.autresDettes ?? 0);
const actif = (v: V) => immobilier(v) + placements(v);

const fr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));

/* ── La spécification ────────────────────────────────────────────────────── */

export const capaciteEmprunt: ToolSpec = {
  id: "capacite-emprunt",
  title: "Capacité d'emprunt",
  intro:
    "Jusqu'où la banque peut vous suivre, ce qu'il vous reste pour vivre, le prix d'achat maximal frais réels déduits, et votre patrimoine avant et après l'achat.",
  sections: [
    {
      title: "Revenus mensuels nets du foyer",
      fields: [
        { id: "salaire1", label: "Salaire net, emprunteur 1", value: 2600, unit: "eur", min: 0, hint: "Net avant impôt, hors primes exceptionnelles : la ligne « net à payer avant impôt sur le revenu »." },
        { id: "salaire2", label: "Salaire net, emprunteur 2", value: 1900, unit: "eur", min: 0, hint: "0 s'il n'y a qu'un emprunteur. Indépendant : moyenne des derniers bilans." },
        { id: "primes", label: "Primes et variables, moyenne mensuelle", value: 200, unit: "eur", min: 0 },
        { id: "loyersActuels", label: "Revenus locatifs actuels, loyers bruts", value: 700, unit: "eur", min: 0 },
        { id: "autresRevenus", label: "Autres revenus pérennes", value: 0, unit: "eur", min: 0, hint: "Pensions reçues, rentes, allocations pérennes. Pas les aides temporaires." },
      ],
    },
    {
      title: "Charges mensuelles actuelles",
      fields: [
        { id: "creditsImmo", label: "Crédits immobiliers en cours", value: 450, unit: "eur", min: 0, hint: "Mensualités assurance comprise, pour les prêts qui continueront après l'opération." },
        { id: "creditsConso", label: "Crédit auto, consommation, LOA", value: 280, unit: "eur", min: 0 },
        { id: "pension", label: "Pension alimentaire versée", value: 0, unit: "eur", min: 0 },
        { id: "loyerActuel", label: "Loyer actuel payé par le foyer", value: 850, unit: "eur", min: 0, hint: "Il disparaît pour une résidence principale, il reste une charge pour un investissement locatif." },
      ],
    },
    {
      title: "Le foyer et le projet",
      fields: [
        { id: "adultes", label: "Nombre d'adultes", value: 2, unit: "nombre", min: 1, max: 6, step: 1 },
        { id: "enfants", label: "Nombre d'enfants à charge", value: 1, unit: "nombre", min: 0, max: 15, step: 1, hint: "Garde alternée comprise." },
        {
          id: "objet",
          label: "Objet du financement",
          value: OBJET_RP,
          options: [
            { value: OBJET_RP, label: OBJET_RP },
            { value: OBJET_LOCATIF, label: OBJET_LOCATIF },
          ],
        },
        { id: "loyerAttendu", label: "Loyer mensuel attendu du bien financé", value: 0, unit: "eur", min: 0, hint: "Investissement locatif seulement : compté à 70 %." },
        { id: "apport", label: "Apport personnel", value: 30000, unit: "eur", min: 0, hint: "Doit au moins couvrir les frais de notaire, de garantie et de dossier." },
        { id: "taux", label: "Taux du prêt, hors assurance", value: 3.3, unit: "pct", min: 0, max: 20, step: 0.05, hint: "Repère : 3,35 % sur 25 ans." },
        { id: "duree", label: "Durée envisagée", value: 25, unit: "an", min: 1, max: 30, step: 1 },
        { id: "assurance", label: "Taux d'assurance emprunteur, sur capital initial", value: 0.3, unit: "pct", min: 0, max: 5, step: 0.01, hint: "Repères : 0,36 % en contrat groupe, 0,17 % en délégation." },
        { id: "neuf", label: "Bien neuf ou en VEFA", value: "Non", options: [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }], hint: "Dans le neuf, la taxe de publicité foncière remplace les droits de mutation." },
        { id: "differe", label: "Différé d'amortissement justifié", value: "Non", options: [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }], hint: "VEFA, construction, gros travaux : la durée HCSF passe de 25 à 27 ans." },
        { id: "droitMajore", label: "Droit départemental majoré à 5 %", value: "Non", options: [{ value: "Non", label: "Non" }, { value: "Oui", label: "Oui" }], hint: "Appliqué par la grande majorité des départements jusqu'au 31/03/2028." },
      ],
    },
    {
      title: "Bilan patrimonial : actif",
      fields: [
        { id: "rp", label: "Résidence principale, valeur de marché", value: 0, unit: "eur", min: 0, hint: "Valeur de revente réaliste aujourd'hui, pas le prix payé. 0 si vous êtes locataire." },
        { id: "locatifs", label: "Biens locatifs", value: 140000, unit: "eur", min: 0 },
        { id: "autresBiens", label: "Autres biens immobiliers", value: 0, unit: "eur", min: 0 },
        { id: "livrets", label: "Comptes courants et livrets", value: 18000, unit: "eur", min: 0 },
        { id: "assuranceVie", label: "Assurance-vie, valeur de rachat", value: 25000, unit: "eur", min: 0 },
        { id: "pea", label: "PEA et comptes-titres", value: 12000, unit: "eur", min: 0 },
        { id: "retraite", label: "Épargne retraite (PER, PERCO)", value: 8000, unit: "eur", min: 0, hint: "Non comptée dans les liquidités mobilisables." },
        { id: "parts", label: "Parts de sociétés et SCPI", value: 0, unit: "eur", min: 0, hint: "Peu liquides : non comptées dans les liquidités mobilisables." },
        { id: "autresActifs", label: "Autres actifs", value: 0, unit: "eur", min: 0 },
      ],
    },
    {
      title: "Bilan patrimonial : passif",
      fields: [
        { id: "crdRp", label: "Capital restant dû, résidence principale", value: 0, unit: "eur", min: 0 },
        { id: "crdLocatifs", label: "Capital restant dû, biens locatifs", value: 60000, unit: "eur", min: 0 },
        { id: "crdConso", label: "Crédit auto ou consommation, restant dû", value: 6500, unit: "eur", min: 0 },
        { id: "decouverts", label: "Découverts et crédits renouvelables", value: 0, unit: "eur", min: 0 },
        { id: "impots", label: "Impôts et charges à régler", value: 0, unit: "eur", min: 0 },
        { id: "autresDettes", label: "Autres dettes", value: 0, unit: "eur", min: 0 },
      ],
    },
  ],
  params: [
    { id: "effortMax", label: "Taux d'effort maximal HCSF", value: 35, unit: "pct", hint: "Assurance comprise, avec une marge de flexibilité de 20 % de la production." },
    { id: "dureeMax", label: "Durée maximale HCSF", value: 25, unit: "an" },
    { id: "dureeMaxDiffere", label: "Durée maximale HCSF avec différé", value: 27, unit: "an" },
    { id: "dmtoMajore", label: "Droits de mutation, droit majoré à 5 %", value: 6.32, unit: "pct" },
    { id: "dmtoStandard", label: "Droits de mutation, droit à 4,50 %", value: 5.81, unit: "pct" },
    { id: "tpfNeuf", label: "Taxe de publicité foncière, neuf ou VEFA", value: 0.715, unit: "pct" },
    { id: "csi", label: "Contribution de sécurité immobilière", value: 0.1, unit: "pct" },
    { id: "emolumentsTaux", label: "Émoluments du notaire, taux marginal HT", value: 0.799, unit: "pct" },
    { id: "emolumentsFixe", label: "Émoluments du notaire, part fixe HT", value: 397.25, unit: "eur" },
    { id: "tva", label: "TVA sur les émoluments", value: 20, unit: "pct" },
    { id: "usureCourt", label: "Taux d'usure, moins de 10 ans", value: 4.07, unit: "pct" },
    { id: "usureMoyen", label: "Taux d'usure, 10 à moins de 20 ans", value: 4.57, unit: "pct" },
    { id: "usureLong", label: "Taux d'usure, 20 ans et plus", value: 5.29, unit: "pct" },
    { id: "ponderationLoyers", label: "Pondération des revenus locatifs", value: 70, unit: "pct", hint: "Couvre vacance, impayés et charges du bailleur." },
    { id: "ponderationPrimes", label: "Pondération des primes et variables", value: 100, unit: "pct" },
    { id: "ravAdulte", label: "Reste à vivre minimal par adulte", value: 800, unit: "eur" },
    { id: "ravEnfant", label: "Reste à vivre minimal par enfant", value: 300, unit: "eur" },
    { id: "debours", label: "Débours et formalités du notaire", value: 1000, unit: "eur" },
    { id: "garantiePct", label: "Frais de garantie, part du capital", value: 1.2, unit: "pct" },
    { id: "dossierForfait", label: "Frais de dossier de la banque", value: 2000, unit: "eur" },
  ],
  headlines: [
    {
      label: "Prix d'achat maximal, hors frais",
      unit: "eur",
      compute: (v, c) => prixMaximal(v, c),
      caption: (v, c) =>
        `Avec ${fr(capitalEmpruntable(v, c))} € empruntés et ${fr(v.apport ?? 0)} € d'apport, dont ${fr(fraisAFinancer(v, c))} € de frais.`,
    },
    {
      label: "Mensualité tenable, assurance comprise",
      unit: "eur",
      compute: (v, c) => mensualiteTenable(v, c),
      caption: (v, c) => {
        if (mensualiteTenable(v, c) === 0) return "Aucune marge : les charges actuelles saturent déjà le dossier.";
        return mensualiteEffort(v, c) <= mensualiteResteAVivre(v, c)
          ? "C'est le taux d'effort de 35 % qui limite le dossier."
          : "C'est le reste à vivre du foyer qui limite le dossier, avant le taux d'effort.";
      },
    },
  ],
  outputs: [
    { id: "revenusFoyer", label: "Total des revenus du foyer", unit: "eur", compute: (v) => revenusFoyer(v) },
    { id: "revenusRetenus", label: "Revenus retenus par la banque", unit: "eur", compute: (v, c) => revenusRetenus(v, c), hint: "Salaires, primes pondérées, autres revenus et loyers pondérés : le dénominateur de tous les ratios." },
    { id: "chargesRetenues", label: "Charges retenues", unit: "eur", compute: (v, c) => chargesRetenues(v, c) },
    { id: "mensEffort", label: "Mensualité maximale au taux d'effort", unit: "eur", compute: (v, c) => mensualiteEffort(v, c) },
    { id: "ravMin", label: "Reste à vivre minimal attendu", unit: "eur", compute: (v) => resteAVivreMinimal(v) },
    { id: "mensRav", label: "Mensualité maximale au reste à vivre", unit: "eur", compute: (v, c) => mensualiteResteAVivre(v, c) },
    { id: "rav", label: "Reste à vivre après la mensualité", unit: "eur", compute: (v, c) => revenusRetenus(v, c) - chargesRetenues(v, c) - mensualiteTenable(v, c) },
    { id: "effortStrict", label: "Taux d'effort HCSF strict", unit: "pct", compute: (v, c) => ratio(creditsEnCours(v) + mensualiteTenable(v, c), revenusRetenus(v, c)) * 100, hint: "Crédits en cours et mensualité sur revenus retenus : le ratio déclaré au HCSF, sans loyer ni pension." },
    { id: "chargesToutCompris", label: "Taux de charges tout compris", unit: "pct", compute: (v, c) => ratio(chargesRetenues(v, c) + mensualiteTenable(v, c), revenusRetenus(v, c)) * 100 },
    { id: "capital", label: "Capital empruntable", unit: "eur", compute: (v, c) => capitalEmpruntable(v, c), strong: true, hint: "Le montant du prêt, pas le prix du bien." },
    { id: "garantie", label: "Frais de garantie", unit: "eur", compute: (v, c) => fraisGarantie(v, c) },
    { id: "dossier", label: "Frais de dossier", unit: "eur", compute: (v, c) => fraisDossier(v, c) },
    { id: "budget", label: "Budget total disponible", unit: "eur", compute: (v, c) => capitalEmpruntable(v, c) + (v.apport ?? 0) },
    { id: "notaire", label: "Frais de notaire estimés", unit: "eur", compute: (v, c) => fraisNotaire(v, c), hint: "Droits, émoluments TTC, contribution de sécurité immobilière et débours, calculés sur le prix maximal." },
    { id: "notairePct", label: "Frais de notaire rapportés au prix", unit: "pct", compute: (v, c) => ratio(fraisNotaire(v, c), prixMaximal(v, c)) * 100 },
    { id: "frais", label: "Total des frais à financer", unit: "eur", compute: (v, c) => fraisAFinancer(v, c) },
    { id: "apportOk", label: "Apport couvre les frais", unit: "texte", compute: (v, c) => ((v.apport ?? 0) >= Math.round(fraisAFinancer(v, c) * 100) / 100 ? "OK" : "À corriger"), hint: "Les banques ne financent plus les frais par le prêt, sauf exception." },
    {
      id: "dureeOk",
      label: "Durée conforme HCSF",
      unit: "texte",
      compute: (v, c) => ((v.duree ?? 0) <= (oui(c.differe) ? (v.dureeMaxDiffere ?? 27) : (v.dureeMax ?? 25)) ? "OK" : "À corriger"),
    },
    { id: "usureOk", label: "Taux et assurance sous le taux d'usure", unit: "texte", compute: (v) => ((v.taux ?? 0) + (v.assurance ?? 0) <= tauxUsure(v) ? "OK" : "À corriger") },
    {
      id: "normeOk",
      label: "Endettement dans la norme",
      unit: "texte",
      compute: (v, c) => {
        const tenable = mensualiteTenable(v, c);
        const charges = ratio(chargesRetenues(v, c) + tenable, revenusRetenus(v, c)) * 100;
        const rav = revenusRetenus(v, c) - chargesRetenues(v, c) - tenable;
        return tenable > 0 && Math.round(charges * 1e4) / 1e4 <= (v.effortMax ?? 35) && Math.round(rav * 100) / 100 >= resteAVivreMinimal(v) ? "OK" : "À corriger";
      },
    },
    { id: "saut", label: "Saut de charge, mensualité future moins loyer actuel", unit: "eur", compute: (v, c) => (c.objet === OBJET_RP ? mensualiteTenable(v, c) - (v.loyerActuel ?? 0) : Number.NaN), hint: "Résidence principale seulement. La banque vérifie que l'épargne passée couvrait déjà ce saut." },
    { id: "coutCredit", label: "Coût total du crédit, intérêts et assurance", unit: "eur", compute: (v, c) => mensualiteTenable(v, c) * 12 * (v.duree ?? 0) - capitalEmpruntable(v, c) },
    { id: "patrimoineNet", label: "Patrimoine net avant l'opération", unit: "eur", compute: (v) => actif(v) - passif(v), strong: true },
    { id: "ltv", label: "Endettement immobilier, encours sur valeur", unit: "pct", compute: (v) => (immobilier(v) > 0 ? ratio(encoursImmo(v), immobilier(v)) * 100 : Number.NaN) },
    { id: "detteActif", label: "Dettes sur actif brut", unit: "pct", compute: (v) => (actif(v) > 0 ? ratio(passif(v), actif(v)) * 100 : Number.NaN) },
    { id: "detteRevenus", label: "Dette totale en années de revenus retenus", unit: "fois", compute: (v, c) => ratio(passif(v), revenusRetenus(v, c) * 12) },
    { id: "epargneResiduelle", label: "Épargne résiduelle après apport", unit: "eur", compute: (v) => mobilisables(v) - (v.apport ?? 0), hint: "Liquidités mobilisables moins apport : l'épargne de précaution que la banque veut voir subsister." },
    { id: "epargneMois", label: "Épargne résiduelle en mois de mensualité", unit: "mois", compute: (v, c) => (mensualiteTenable(v, c) > 0 ? (mobilisables(v) - (v.apport ?? 0)) / mensualiteTenable(v, c) : Number.NaN) },
    { id: "apportLiquide", label: "Apport couvert par les liquidités", unit: "texte", compute: (v) => ((v.apport ?? 0) <= mobilisables(v) ? "OK" : "À corriger"), hint: "Sinon il faudra un rachat, un déblocage de PER ou une donation." },
    { id: "patrimoineProForma", label: "Patrimoine net après l'opération", unit: "eur", compute: (v, c) => actif(v) - (v.apport ?? 0) + prixMaximal(v, c) - (passif(v) + capitalEmpruntable(v, c)), hint: "Au prix maximal, le jour de la signature." },
    { id: "variation", label: "Variation du patrimoine net", unit: "eur", compute: (v, c) => -fraisAFinancer(v, c), hint: "Égale aux frais de l'opération, en négatif : ils sont perdus. Le bien s'apprécie ensuite, ou non." },
    { id: "ltvProForma", label: "Endettement immobilier après l'opération", unit: "pct", compute: (v, c) => ratio(encoursImmo(v) + capitalEmpruntable(v, c), immobilier(v) + prixMaximal(v, c)) * 100 },
    { id: "detteActifProForma", label: "Dettes sur actif brut après l'opération", unit: "pct", compute: (v, c) => ratio(passif(v) + capitalEmpruntable(v, c), actif(v) - (v.apport ?? 0) + prixMaximal(v, c)) * 100 },
  ],
  caveat:
    "Le prix maximal est un plafond, pas une cible : il suppose d'emprunter jusqu'à la dernière marge et de consacrer tout l'apport aux frais et au prix. Les repères de reste à vivre et de pondération varient d'une banque à l'autre, ajustez-les dans les paramètres.",
};
