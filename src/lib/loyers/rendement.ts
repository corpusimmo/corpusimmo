/**
 * LE RENDEMENT LOCATIF BRUT, ET RIEN D'AUTRE.
 *
 * Croiser un loyer d'annonce (ANIL) avec une médiane de prix au m² (DVF) donne
 * un ratio simple : ce qu'un logement rapporterait en un an, rapporté à ce
 * qu'il coûterait. C'est utile, et c'est faux dès qu'on le présente comme un
 * revenu. Ce module ne calcule donc QUE le brut, et son nom le dit.
 *
 * ── CE QUE « BRUT » VEUT DIRE ICI ──────────────────────────────────────────
 * Sont exclus du calcul, parce qu'aucune source publique ne les porte à
 * l'échelle de la commune :
 *
 *   · les charges non récupérables et l'entretien courant ;
 *   · la taxe foncière, qui varie du simple au triple d'une commune à l'autre ;
 *   · la vacance locative et les impayés ;
 *   · les frais de gestion et l'assurance ;
 *   · les frais d'acquisition (« frais de notaire »), qui gonflent le
 *     dénominateur réel de 7 à 8 % dans l'ancien ;
 *   · la fiscalité des revenus fonciers, qui dépend de l'emprunteur, pas du bien.
 *
 * Un rendement NET tourne couramment autour de 60 à 75 % du brut. On ne le
 * calcule pas pour autant : appliquer un abattement forfaitaire à toute la
 * France produirait un chiffre qui a l'air net sans l'être, ce qui est pire
 * qu'un brut annoncé comme brut.
 *
 * ── ET LE LOYER LUI-MÊME SURESTIME ─────────────────────────────────────────
 * Le numérateur vient d'ANNONCES, charges comprises, sur des biens loués vides
 * (voir `scripts/agreger-loyers.mjs`). Le loyer hors charges réellement
 * encaissé est plus bas. Le biais joue donc dans le même sens que les charges
 * omises : le brut calculé ici est un PLAFOND, jamais une prévision.
 *
 * ── LA RÈGLE QUI GOUVERNE TOUTES CES FONCTIONS ─────────────────────────────
 * `null` veut dire « on ne sait pas », jamais zéro et jamais une valeur de
 * remplacement. Une commune sans médiane DVF exploitable n'a pas de rendement ;
 * elle n'a pas un rendement nul, et elle n'hérite pas de celui du département.
 */

import type { IndicateurLoyer } from "./types";

/** Douze mois. Nommé parce qu'un `* 12` nu dans une formule ne se relit pas. */
const MOIS_PAR_AN = 12;

/**
 * Bornes de plausibilité d'un rendement brut annuel, en pourcent.
 *
 * Elles ne filtrent RIEN : `rendementBrut` renvoie la valeur qu'il a calculée,
 * même hors bornes. Elles servent à `rendementHorsNorme`, que l'affichage peut
 * interroger pour accompagner un chiffre d'une réserve. Un brut sous 1 % ou
 * au-dessus de 20 % ne dit presque jamais quelque chose du marché locatif : il
 * dit qu'une des deux médianes repose sur trop peu d'observations, ou que la
 * commune mêle un parc de résidences secondaires à un marché de la location.
 */
export const RENDEMENT_MIN_PLAUSIBLE = 1;
export const RENDEMENT_MAX_PLAUSIBLE = 20;

/**
 * Seuils de prudence repris tels quels des précautions d'emploi de l'ANIL.
 *
 * Ce sont ceux de la source, pas les nôtres : les changer serait publier un
 * jugement que l'ANIL n'a pas porté.
 */
export const OBS_MIN_FIABLE = 30;
export const R2_MIN_FIABLE = 0.5;

/** Un nombre utilisable comme prix ou comme loyer : fini et strictement positif. */
function estMesure(valeur: number | null | undefined): valeur is number {
  return typeof valeur === "number" && Number.isFinite(valeur) && valeur > 0;
}

/**
 * Rendement locatif BRUT annuel, en pourcent.
 *
 * @param loyerMensuelM2 loyer d'annonce en €/m²/mois (charges comprises)
 * @param prixM2 prix de vente médian en €/m²
 * @returns le taux en pourcent, arrondi au centième, ou `null`
 *
 * Renvoie `null` dès qu'une des deux valeurs manque, vaut zéro, est négative ou
 * n'est pas un nombre fini. C'est le cœur de l'honnêteté de ce module : sans
 * les DEUX termes, il n'y a pas de ratio, et il n'y a rien à afficher. On
 * n'emprunte jamais la valeur du département, de l'EPCI ou de l'année d'avant
 * pour combler le trou — un rendement extrapolé est indiscernable d'un
 * rendement mesuré une fois affiché.
 *
 * Deux décimales, pas plus : l'intervalle de prédiction du loyer se compte
 * souvent en euros par m², écrire « 4,7411 % » donnerait à lire une précision
 * que la source n'a pas.
 */
export function rendementBrut(
  loyerMensuelM2: number | null | undefined,
  prixM2: number | null | undefined,
): number | null {
  if (!estMesure(loyerMensuelM2) || !estMesure(prixM2)) return null;
  const taux = (loyerMensuelM2 * MOIS_PAR_AN * 100) / prixM2;
  // Un `Infinity` ne peut plus sortir d'ici (prixM2 > 0), mais un produit
  // gigantesque le pourrait : on refuse plutôt que de rendre `Infinity`.
  if (!Number.isFinite(taux)) return null;
  return Math.round(taux * 100) / 100;
}

/**
 * Le rendement sort-il des bornes où il veut encore dire quelque chose ?
 *
 * `false` pour `null` : une absence n'est pas une anomalie, et confondre les
 * deux ferait afficher un avertissement là où il n'y a rien à avertir.
 */
export function rendementHorsNorme(taux: number | null): boolean {
  if (taux === null) return false;
  return taux < RENDEMENT_MIN_PLAUSIBLE || taux > RENDEMENT_MAX_PLAUSIBLE;
}

export interface FourchetteRendement {
  bas: number;
  haut: number;
}

/**
 * La fourchette de rendement que l'intervalle de prédiction du loyer implique.
 *
 * Le prix au m² est pris comme une constante : il porte lui aussi une
 * dispersion (quartiles, déciles), mais la composer avec celle du loyer
 * produirait un intervalle dont plus personne ne saurait dire ce qu'il couvre.
 * Cette fourchette répond donc à une question précise, et à elle seule :
 * « à prix connu, que devient le rendement si le loyer est en bas ou en haut de
 * ce que le modèle prédit ? ».
 *
 * `null` si une seule borne manque : une demi-fourchette se lirait comme une
 * fourchette complète.
 */
export function fourchetteRendement(
  indicateur: IndicateurLoyer | null | undefined,
  prixM2: number | null | undefined,
): FourchetteRendement | null {
  if (!indicateur) return null;
  const bas = rendementBrut(indicateur.bas, prixM2);
  const haut = rendementBrut(indicateur.haut, prixM2);
  if (bas === null || haut === null) return null;
  // Les bornes de la source sont ordonnées, mais on ne le suppose pas.
  return bas <= haut ? { bas, haut } : { bas: haut, haut: bas };
}

/**
 * L'indicateur mérite-t-il les réserves que l'ANIL demande de porter ?
 *
 * Trois motifs, dans l'ordre des précautions d'emploi : estimé ailleurs que sur
 * la commune, trop peu d'annonces observées sur place, modèle qui explique mal.
 * Un `r2` ou une `echelle` absents comptent comme fragiles : l'inconnu ne se
 * présume pas favorable.
 */
export function indicateurFragile(
  indicateur: IndicateurLoyer | null | undefined,
): boolean {
  if (!indicateur) return true;
  if (indicateur.echelle !== "commune") return true;
  if (indicateur.obs < OBS_MIN_FIABLE) return true;
  if (indicateur.r2 === null || indicateur.r2 < R2_MIN_FIABLE) return true;
  return false;
}

export interface LectureRendement {
  /** Rendement brut annuel en pourcent, ou `null` si un terme manque. */
  taux: number | null;
  /** Fourchette induite par l'intervalle de prédiction du loyer. */
  fourchette: FourchetteRendement | null;
  /** Vrai quand la source demande d'accompagner le chiffre d'une réserve. */
  fragile: boolean;
  /** Vrai quand le taux sort des bornes où il veut encore dire quelque chose. */
  horsNorme: boolean;
}

/**
 * Tout ce qu'on peut dire d'un rendement, en une lecture.
 *
 * Volontairement une STRUCTURE et non un simple nombre : partout où ce taux
 * s'affiche, `fragile` et `horsNorme` doivent pouvoir s'afficher avec lui. Les
 * séparer en trois appels rendrait trop facile d'oublier les deux derniers.
 */
export function lireRendement(
  indicateur: IndicateurLoyer | null | undefined,
  prixM2: number | null | undefined,
): LectureRendement {
  const taux = rendementBrut(indicateur?.m2, prixM2);
  return {
    taux,
    fourchette: fourchetteRendement(indicateur, prixM2),
    fragile: indicateurFragile(indicateur),
    horsNorme: rendementHorsNorme(taux),
  };
}
