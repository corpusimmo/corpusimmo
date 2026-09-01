/**
 * Le contrat d'un outil en ligne.
 *
 * POURQUOI UNE SPÉCIFICATION PLUTÔT QUE DIX PAGES
 *   Chaque modèle Excel a la même anatomie : des cellules de SAISIE groupées en
 *   sections, des cellules CALCULÉES qui en dépendent, et deux ou trois chiffres
 *   qu'on retient. Écrire dix formulaires React à la main reviendrait à
 *   réimplémenter dix fois cette anatomie, et à laisser dix occasions de diverger
 *   du fichier. Ici, un outil EST une donnée : ses champs, ses formules, ses
 *   résultats. Un seul composant les rend tous.
 *
 * LA RÈGLE QUI COMPTE
 *   Les taux réglementaires ne sont jamais écrits dans une formule : ils vivent
 *   dans `params`, avec leur libellé et leur millésime, exactement comme l'onglet
 *   « Paramètres » du fichier. Quand la loi bouge, on édite une ligne, et la page
 *   web et le classeur disent toujours la même chose.
 */

/** Ce que l'utilisateur saisit. */
export interface ToolField {
  id: string;
  label: string;
  /** Valeur de départ : un cas réaliste, jamais zéro — un formulaire vide n'apprend rien. */
  value: number;
  unit: "eur" | "pct" | "m2" | "an" | "mois" | "nombre" | "eurm2" | "date";
  /** Phrase courte sous le champ. Le « pourquoi », pas le « quoi ». */
  hint?: string;
  /** Bornes de sécurité : elles empêchent une saisie qui rendrait le résultat absurde. */
  min?: number;
  max?: number;
  step?: number;
}

/** Un choix fermé — l'équivalent d'une liste déroulante Excel. */
export interface ToolChoice {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  hint?: string;
}

/**
 * Une colonne d'un tableau à lignes ajoutables.
 *
 * POURQUOI UN TABLEAU, ET PAS DES CHAMPS NUMÉROTÉS
 *   « Locataire 1 — loyer », « Locataire 2 — loyer »… force à décider d'avance
 *   combien il y en aura, et produit une grille où l'œil saute d'un locataire à
 *   l'autre au lieu de lire une ligne. Un rent roll fait quarante lignes dans le
 *   classeur : le limiter à trois en ligne n'est pas une simplification, c'est
 *   une infirmité.
 */
export interface ToolColumn {
  id: string;
  label: string;
  /**
   * `date` s'affiche en sélecteur de date mais se STOCKE en horodatage, comme
   * les autres colonnes. L'état d'un tableau reste ainsi uniformément
   * numérique : la persistance, la remise à zéro et les calculs n'ont pas à
   * connaître les dates.
   */
  unit: ToolField["unit"] | "date";
  /** Valeur d'une ligne fraîchement ajoutée. Un horodatage pour `date`. */
  value: number;
  /** En-tête court pour l'affichage en tableau. */
  short?: string;
}

export interface ToolTable {
  id: string;
  title: string;
  columns: ToolColumn[];
  /** Lignes de départ : un cas réaliste, pas un tableau vide. */
  rows: number[][];
  /** Libellé du bouton d'ajout. */
  addLabel: string;
  /** Nombre de lignes en dessous duquel on ne peut pas descendre. */
  min?: number;
  /**
   * Noms des lignes, quand elles en ont un — les lots d'un chiffrage, les
   * offres d'un comparateur. Les lignes ajoutées au-delà reçoivent
   * `extraLabel`. L'état reste un tableau de nombres : nommer une ligne ne
   * doit pas obliger à mélanger textes et nombres dans les calculs.
   */
  rowLabels?: string[];
  /** Nom donné aux lignes ajoutées au-delà de `rowLabels`. */
  extraLabel?: string;
  hint?: string;
}

export interface ToolSection {
  title: string;
  fields: (ToolField | ToolChoice)[];
}

/** Une ligne calculée. `compute` reçoit les saisies résolues et les paramètres. */
export interface ToolOutput {
  id: string;
  label: string;
  unit: ToolField["unit"] | "texte" | "annees" | "fois";
  compute: (
    v: Record<string, number>,
    c: Record<string, string>,
    t: Record<string, number[][]>,
  ) => number | string;
  hint?: string;
  /** Mis en avant dans la liste des résultats. */
  strong?: boolean;
}

/** Le ou les chiffres qu'on retient — l'équivalent du grand nombre du fichier. */
export interface ToolHeadline {
  label: string;
  unit: ToolOutput["unit"];
  compute: (
    v: Record<string, number>,
    c: Record<string, string>,
    t: Record<string, number[][]>,
  ) => number | string;
  /** Commentaire sous le chiffre, calculé lui aussi : il dit ce que le chiffre veut dire. */
  caption?: (
    v: Record<string, number>,
    c: Record<string, string>,
    t: Record<string, number[][]>,
  ) => string;
}

export interface ToolSpec {
  id: string;
  title: string;
  /** Une phrase : ce que l'outil répond. */
  intro: string;
  sections: ToolSection[];
  /** Tableaux à lignes ajoutables, rendus après les sections. */
  tables?: ToolTable[];
  headlines: ToolHeadline[];
  outputs: ToolOutput[];
  /** Les taux réglementaires, affichés et modifiables — jamais cachés dans une formule. */
  params: { id: string; label: string; value: number; unit: ToolField["unit"]; hint?: string }[];
  /** La limite assumée, affichée sous le résultat. */
  caveat: string;
}

export function isChoice(field: ToolField | ToolChoice): field is ToolChoice {
  return "options" in field;
}

/* ------------------------------------------------------------------ maths -- */

/**
 * Mensualité d'un prêt amortissable à échéances constantes.
 * Équivalent de PMT. Le cas taux nul est traité à part : la formule générale
 * divise par le taux et produirait une division par zéro.
 */
export function pmt(tauxAnnuelPct: number, annees: number, capital: number): number {
  const n = Math.round(annees * 12);
  if (n <= 0 || capital <= 0) return 0;
  const i = tauxAnnuelPct / 100 / 12;
  if (i === 0) return capital / n;
  return (capital * i) / (1 - Math.pow(1 + i, -n));
}

/** Intérêts cumulés sur les `mois` premières échéances. Équivalent de CUMIPMT. */
export function interetsCumules(
  tauxAnnuelPct: number,
  annees: number,
  capital: number,
  mois: number,
): number {
  const n = Math.round(annees * 12);
  if (n <= 0 || capital <= 0) return 0;
  const i = tauxAnnuelPct / 100 / 12;
  const m = pmt(tauxAnnuelPct, annees, capital);
  let restant = capital;
  let interets = 0;
  for (let k = 0; k < Math.min(mois, n); k += 1) {
    const part = restant * i;
    interets += part;
    restant -= m - part;
  }
  return interets;
}

/** Capital finançable par une mensualité donnée. Équivalent de PV. */
export function capitalFinancable(
  tauxAnnuelPct: number,
  annees: number,
  mensualite: number,
): number {
  const n = Math.round(annees * 12);
  if (n <= 0 || mensualite <= 0) return 0;
  const i = tauxAnnuelPct / 100 / 12;
  if (i === 0) return mensualite * n;
  return (mensualite * (1 - Math.pow(1 + i, -n))) / i;
}

/**
 * Taux de rendement interne, par bissection.
 *
 * Newton converge mal quand les flux changent plusieurs fois de signe ; la
 * bissection est plus lente mais ne diverge jamais, ce qui vaut mieux pour un
 * chiffre affiché à l'écran. Renvoie NaN si aucun taux ne l'annule dans la
 * plage — un TRI n'existe pas toujours, et le prétendre serait pire.
 */
export function tri(flux: number[]): number {
  const van = (taux: number) =>
    flux.reduce((somme, f, k) => somme + f / Math.pow(1 + taux, k), 0);

  let bas = -0.9;
  let haut = 5;
  if (van(bas) * van(haut) > 0) return Number.NaN;

  for (let k = 0; k < 200; k += 1) {
    const milieu = (bas + haut) / 2;
    if (van(bas) * van(milieu) <= 0) haut = milieu;
    else bas = milieu;
  }
  return ((bas + haut) / 2) * 100;
}

/** Valeur actuelle nette de flux annuels, le premier étant l'année 1. */
export function van(tauxPct: number, flux: number[]): number {
  const t = tauxPct / 100;
  return flux.reduce((somme, f, k) => somme + f / Math.pow(1 + t, k + 1), 0);
}

/** Division protégée : l'équivalent du SIERREUR systématique des fichiers. */
export function ratio(numerateur: number, denominateur: number): number {
  return denominateur === 0 || !Number.isFinite(denominateur) ? 0 : numerateur / denominateur;
}


/* ------------------------------------------------------------------ dates -- */

/**
 * Les dates circulent en horodatage (millisecondes) dans l'état des outils.
 *
 * Deux raisons. D'abord l'uniformité : un tableau reste un tableau de nombres,
 * donc la persistance, la remise à zéro et les fonctions de calcul n'ont aucun
 * cas particulier à traiter. Ensuite la robustesse : une date stockée en texte
 * dépend du format régional, et « 03/04/2026 » ne veut pas dire la même chose
 * des deux côtés de la Manche.
 *
 * On travaille en UTC à midi : à minuit, un décalage horaire d'une heure suffit
 * à faire basculer la date d'un jour.
 */
export function toISODate(horodatage: number): string {
  // Zéro vaut « pas de date » et non le 1er janvier 1970 : c'est ce qui permet
  // à une remise à blanc de laisser un sélecteur vide au lieu d'afficher une
  // date absurde que l'utilisateur devrait effacer lui-même.
  if (!Number.isFinite(horodatage) || horodatage === 0) return "";
  return new Date(horodatage).toISOString().slice(0, 10);
}

export function fromISODate(iso: string): number {
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(t) ? t : 0;
}

/** Années entre deux horodatages, plancher à zéro : un bail échu compte pour zéro. */
export function anneesEntre(debut: number, fin: number): number {
  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return 0;
  return Math.max(0, (fin - debut) / (365.2425 * 24 * 3600 * 1000));
}
