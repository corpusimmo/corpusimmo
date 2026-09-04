"use client";

/**
 * L'ÉTAT DE SESSION DU PANIER DE COMPARABLES, EN SOMMEIL.
 *
 * La connexion Google et l'espace membre sont retirés du produit le temps
 * d'être refaits : personne n'est authentifié, donc cette fonction rend
 * toujours « unauthenticated ». Elle existe quand même, et dans son propre
 * module, pour deux raisons.
 *
 * 1. La bascule du navigateur vers le compte reste ÉCRITE et TESTÉE dans
 *    `comparables-store.tsx`. C'est la séquence où l'on peut perdre le panier
 *    de quelqu'un ; la supprimer puis la réécrire de mémoire dans quelques
 *    semaines coûterait plus cher que de la laisser dormir ici.
 * 2. Le jour où les comptes reviennent, ce fichier est le SEUL à changer :
 *    `useSession()` remplace la constante, et le reste de la chaîne fonctionne
 *    déjà, puisque ses tests n'ont jamais cessé de tourner.
 *
 * C'est une fonction et non une constante exportée parce que TypeScript
 * réduirait la constante à son unique littéral et déclarerait mortes les deux
 * branches qui nous intéressent.
 */
export function useSessionStatus(): "loading" | "authenticated" | "unauthenticated" {
  return "unauthenticated";
}
