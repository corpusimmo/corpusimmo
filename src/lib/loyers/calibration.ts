/**
 * LE LOYER D'ANNONCE, RAMENÉ AU LOYER RÉELLEMENT SIGNÉ.
 *
 * La carte des loyers couvre toute la France avec des loyers d'ANNONCE,
 * charges comprises. Les observatoires locaux relèvent des loyers de BAUX
 * SIGNÉS, hors charges, mais sur une cinquantaine d'agglomérations. Là où les
 * deux se recouvrent, l'annonce dépasse le bail d'environ 15 %, et l'écart se
 * creuse avec le niveau de loyer.
 *
 * `scripts/calibrer-loyers.mjs` mesure cet écart zone par zone et écrit ses
 * ancrages dans `src/data/loyers-calibration.json`. Ce module ne fait que les
 * lire : il ne contient AUCUNE constante de correction, pour qu'un nouveau
 * millésime d'observatoires change le chiffre sans qu'on touche au code.
 *
 * ── LE CHIFFRE CORRIGÉ RESTE UNE ESTIMATION ────────────────────────────────
 * Le facteur corrige un biais MOYEN. Il ne rend pas locale une estimation de
 * voisinage, et la moitié des zones s'en écarte de plus de cinq points. Ce
 * qu'il apporte est un ordre de grandeur juste plutôt qu'un plafond présenté
 * comme un loyer.
 */

import calibration from "@/data/loyers-calibration.json";

export interface AncrageLoyer {
  /** Niveau de loyer d'annonce, €/m²/mois, où ce facteur a été mesuré. */
  niveau: number;
  facteur: number;
  zones: number;
}

export interface CalibrationLoyers {
  generatedAt: string;
  ancrages: AncrageLoyer[];
  global: number;
  dispersion: { q10: number; q25: number; q75: number; q90: number };
  appariement: { zones: number; communes: number };
  controle: {
    agglomerations: number;
    ecartMedian: number;
    ecartAbsMedian: number;
  } | null;
  precautions: string[];
}

export const CALIBRATION_LOYERS = calibration as CalibrationLoyers;

/**
 * Le facteur applicable à un loyer d'annonce donné.
 *
 * Interpolation linéaire entre ancrages, CONSTANTE au-delà des extrêmes. On
 * n'extrapole pas : la pente mesurée entre 10 et 22 €/m² n'a aucune raison de
 * se prolonger jusqu'à 40, et une droite prolongée assez loin finit par
 * produire un facteur absurde.
 */
export function facteurLoyer(
  annonce: number,
  source: CalibrationLoyers = CALIBRATION_LOYERS,
): number {
  const points = source.ancrages;
  if (points.length === 0) return 1;

  const premier = points[0];
  const dernier = points[points.length - 1];
  if (!premier || !dernier) return 1;
  if (annonce <= premier.niveau) return premier.facteur;
  if (annonce >= dernier.niveau) return dernier.facteur;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b || annonce > b.niveau) continue;
    const largeur = b.niveau - a.niveau;
    if (largeur <= 0) return b.facteur;
    const t = (annonce - a.niveau) / largeur;
    return a.facteur + t * (b.facteur - a.facteur);
  }
  return dernier.facteur;
}

/**
 * Un loyer d'annonce charges comprises, ramené hors charges.
 *
 * `null` en entrée comme en sortie : une commune sans indicateur n'a pas un
 * loyer corrigé de zéro, elle n'a pas de loyer.
 */
export function loyerHorsCharges(
  annonce: number | null | undefined,
  source: CalibrationLoyers = CALIBRATION_LOYERS,
): number | null {
  if (typeof annonce !== "number" || !Number.isFinite(annonce) || annonce <= 0) {
    return null;
  }
  return annonce * facteurLoyer(annonce, source);
}
