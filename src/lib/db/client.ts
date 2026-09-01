import "server-only";

/**
 * LE CLIENT NEON — en HTTP, et une seule fois par processus.
 *
 * POURQUOI HTTP ET NON UNE CONNEXION TCP. Le déploiement est sur Vercel, en
 * environnement serverless : chaque invocation peut être un processus neuf, et
 * une poignée de main TCP plus une négociation TLS coûtent plus cher que la
 * requête elle-même. `@neondatabase/serverless` en mode HTTP envoie une requête
 * comme on envoie un `fetch`, sans connexion à garder ouverte, sans pool à
 * épuiser. C'est aussi la seule forme qui fonctionne dans le runtime Edge, si
 * une route y bascule un jour.
 *
 * CE QUE HTTP NE FAIT PAS : les transactions multi-instructions. Chaque appel
 * est atomique tout seul, et rien de plus. C'est un vrai renoncement, assumé
 * ici parce qu'aucune écriture du produit n'a besoin de deux tables d'un coup
 * de façon indivisible — et documenté dans `docs/database.md` avec la seule
 * course qui reste (le quota, voir `queries/unlocks.ts`). Le jour où une
 * transaction sera nécessaire, `drizzle-orm/neon-serverless` et le pilote
 * WebSocket sont l'échappatoire, sans changer une ligne de schéma.
 *
 * LE CLIENT EST MÉMOÏSÉ pour la durée du processus. Pas pour économiser une
 * connexion — il n'y en a pas — mais pour ne pas reconstruire à chaque requête
 * la carte des tables que Drizzle dérive du schéma.
 *
 * L'ABSENCE DE `DATABASE_URL` NE LÈVE PAS À L'IMPORT. C'est le contrat du
 * dépôt (voir `config.ts`) : ce module se charge toujours, et `getDb()` lève
 * seulement si quelqu'un demande vraiment une requête. `tryGetDb()` existe pour
 * les appelants qui préfèrent dégrader que rattraper.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { requireDatabaseUrl } from "./config";
import * as schema from "./schema";

export { DatabaseNotConfiguredError, isDatabaseConfigured } from "./config";

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | undefined;
let cachedUrl: string | undefined;

/**
 * La base, ou une erreur explicite.
 *
 * À réserver aux chemins qui ne PEUVENT pas se passer de la base. Partout
 * ailleurs, les fonctions de `queries/` dégradent déjà pour l'appelant.
 */
export function getDb(): Database {
  const url = requireDatabaseUrl();

  // L'URL fait partie de la clé de cache : en test, ou après un changement de
  // branche Neon, réutiliser un client construit sur l'ancienne chaîne
  // enverrait silencieusement les requêtes au mauvais endroit.
  if (!cached || cachedUrl !== url) {
    cached = drizzle(neon(url), { schema });
    cachedUrl = url;
  }

  return cached;
}

/** La base, ou `null` quand elle n'est pas configurée. Ne lève jamais. */
export function tryGetDb(): Database | null {
  try {
    return getDb();
  } catch {
    return null;
  }
}
