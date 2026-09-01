/**
 * La description méta d'une fiche outil, composée plutôt que rédigée dix fois.
 *
 * POURQUOI COMPOSER
 *   Le résumé d'un outil est écrit pour l'ÉCRAN : une phrase, dense, qui tient
 *   sous un titre. Une méta-description a une autre contrainte, purement
 *   physique : en dessous de 150 signes elle laisse la place vide, au-dessus de
 *   170 elle est coupée, et c'est la fin qui saute. Recopier le résumé produirait
 *   dix descriptions trop courtes ; écrire dix descriptions à la main
 *   garantirait qu'elles divergent du jour où un outil change.
 *
 * COMMENT
 *   Le résumé est complété par une phrase qui dit la même chose de tous les
 *   outils, et qui est VRAIE de tous : les hypothèses sont affichées, elles se
 *   modifient, elles sont datées. Le complément est choisi selon la place qui
 *   reste, ce qui fait tomber les dix descriptions entre 145 et 170 signes.
 *
 * CE QU'ELLE NE DIT PLUS
 *   « Sans compte ». Les calculateurs demandent désormais une connexion : la
 *   fiche reste en consultation libre, le calcul non. Une description qui
 *   promettrait l'inverse serait un mensonge fait à Google d'abord, au visiteur
 *   ensuite.
 */

import { polishMetaText } from "./metadata";

/** Le plus long, pour les résumés les plus courts. */
const AMPLE =
  " Les hypothèses de calcul sont affichées, modifiables et datées, et les limites écrites.";

const MEDIUM = " Les hypothèses de calcul sont affichées, modifiables et datées.";

const BRIEF = " Hypothèses affichées, modifiables et datées.";

export function toolMetaDescription(summary: string): string {
  // La longueur est mesurée APRÈS toilette typographique : le remplacement des
  // tirets cadratins par des virgules déplace le compte de quelques signes.
  const base = polishMetaText(summary);

  if (base.length <= 85) return polishMetaText(base + AMPLE);
  if (base.length <= 95) return polishMetaText(base + MEDIUM);
  return polishMetaText(base + BRIEF);
}
