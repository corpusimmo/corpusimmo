import "server-only";

/**
 * L'AUTHENTIFICATION EST RETIRÉE, ET TOUT LE MONDE EST ANONYME.
 *
 * Ce module ne parle plus à aucun fournisseur : il rend `null`, toujours.
 * Ce n'est pas un bouchon posé à la hâte, c'est le contrat que le reste du
 * site respectait déjà.
 *
 * POURQUOI CE FICHIER SURVIT À LA SUPPRESSION. Une dizaine d'écrans et de
 * routes demandent « qui est connecté ? » avant de décider s'ils lisent la
 * base ou le navigateur : l'estimateur, les comparables, le quota des
 * calculateurs, les ressources, les leads. Tous savent déjà répondre à `null`,
 * puisque le site a toujours dû fonctionner sans compte. Garder la fonction et
 * lui faire dire « personne » retire l'authentification en UN endroit, là où
 * supprimer l'appel dans chaque fichier aurait été dix occasions de casser un
 * chemin anonyme qui marchait.
 *
 * C'est aussi le point de rebranchement : le jour où la connexion revient, ce
 * fichier redevient le seul à toucher, et tout le reste suit sans être
 * modifié.
 */

export { isDatabaseUserId } from "./user-id";

/**
 * Personne n'est connecté, par construction.
 *
 * `Promise` conservée : les appelants l'attendent, et changer la signature
 * obligerait à toucher chaque site d'appel pour un gain nul.
 */
export function currentUserId(): Promise<string | null> {
  return Promise.resolve(null);
}

/**
 * Faux, tant qu'aucune voie de connexion n'existe.
 *
 * L'en-tête et les écrans qui proposaient de se connecter le lisent : un
 * bouton qui mène à une page supprimée est pire que pas de bouton.
 */
export const isAuthConfigured = false;
