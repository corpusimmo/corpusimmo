/**
 * LA FORME D'UN IDENTIFIANT DE BASE, isolée de tout le reste.
 *
 * Ce fichier n'importe NI `server-only`, NI la configuration
 * d'authentification, NI la base. Il ne fait que reconnaître une forme, et
 * c'est ce qui le rend éprouvable sous Vitest, là où `current-user.ts` ne
 * l'est pas. La même séparation existe entre `lib/access/core.ts` et
 * `lib/access/ledger.ts`, et pour la même raison : la règle se teste, la
 * plomberie s'exécute.
 *
 * LE PIÈGE QU'IL FERME, rencontré en branchant la base. La session est un jeton
 * signé. Avant l'adaptateur, `sub` portait l'identifiant du compte GOOGLE, une
 * longue suite de chiffres. Depuis, il porte l'identifiant de la ligne `users`,
 * un UUID. Or les jetons déjà émis continuent de circuler avec l'ancienne
 * valeur jusqu'à expiration.
 *
 * Passer cet ancien `sub` à une requête reviendrait à comparer une colonne
 * `uuid` à « 104857293847562930485 » : Postgres refuse par une ERREUR, pas par
 * un résultat vide. La page tomberait, et seulement pour les personnes déjà
 * connectées avant la mise en ligne, c'est-à-dire les plus fidèles.
 */

/** La forme d'un `uuid` PostgreSQL, et rien d'autre. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDatabaseUserId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
