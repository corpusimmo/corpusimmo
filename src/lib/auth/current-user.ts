import "server-only";

/**
 * QUI EST CONNECTÉ, ET PEUT-ON S'EN SERVIR COMME CLÉ ÉTRANGÈRE ?
 *
 * Ces deux questions n'ont pas la même réponse, et les confondre casse la
 * production.
 *
 * LE PIÈGE, RENCONTRÉ EN BRANCHANT LA BASE. La session est un jeton signé.
 * Avant que l'adaptateur n'existe, `sub` portait l'identifiant du compte
 * GOOGLE, une longue suite de chiffres. Depuis, il porte l'identifiant de la
 * ligne `users`, un UUID. Or les jetons déjà émis, eux, n'ont pas changé : ils
 * continuent de circuler avec l'ancienne valeur jusqu'à expiration.
 *
 * Passer cet ancien `sub` à une requête reviendrait à comparer une colonne
 * `uuid` à « 104857293847562930485 » : Postgres refuse, la page tombe en 500,
 * et elle ne tombe QUE pour les personnes déjà connectées avant la mise en
 * ligne. C'est-à-dire, précisément, les plus fidèles.
 *
 * D'où le garde-fou : un identifiant qui n'a pas la forme d'un UUID n'est pas
 * un identifiant de base, et la personne est traitée comme anonyme le temps que
 * son jeton se renouvelle. Elle retrouve tout à sa prochaine connexion, et rien
 * ne casse entre-temps.
 */

import { isDatabaseConfigured } from "@/lib/db";

import { auth, isAuthConfigured } from "./index";
import { isDatabaseUserId } from "./user-id";

export { isDatabaseUserId } from "./user-id";

/**
 * L'identifiant de la ligne `users` de la personne connectée, ou `null`.
 *
 * `null` couvre quatre situations qui appellent la même conduite, à savoir se
 * rabattre sur le navigateur : pas d'authentification configurée, pas de base,
 * personne connectée, ou un jeton antérieur à l'arrivée de la base.
 */
export async function currentUserId(): Promise<string | null> {
  if (!isAuthConfigured || !isDatabaseConfigured()) return null;
  const session = await auth();
  const id = session?.user?.id;
  return isDatabaseUserId(id) ? id : null;
}
