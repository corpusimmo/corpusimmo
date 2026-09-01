/**
 * La configuration de `drizzle-kit`, l'outil qui LIT le schéma TypeScript et
 * ÉCRIT le SQL de migration.
 *
 * Il ne tourne jamais en production ni au build : c'est un outil de
 * développement, appelé à la main par `pnpm db:generate` quand le schéma change.
 * D'où deux conséquences pour ce fichier :
 *
 *  1. `DATABASE_URL` peut être absent. `drizzle-kit generate` compare le schéma
 *     à l'historique des migrations déjà écrites, PAS à une base : il n'a besoin
 *     d'aucune connexion. Seuls `migrate`, `push` et `studio` en veulent une, et
 *     ils échoueront alors avec leur propre message. Mettre une chaîne vide ici
 *     serait donc inoffensif, mais on préfère `""` explicite à un `!` qui
 *     mentirait sur la présence de la variable.
 *
 *  2. La migration ne s'applique JAMAIS toute seule. Il n'y a pas de
 *     `drizzle-kit push` dans les scripts, et `db:migrate` doit être lancé
 *     sciemment, en sachant sur quelle base il pointe. Une migration appliquée
 *     par un script de build sur la base de production est le genre d'accident
 *     qu'on ne remarque qu'une fois les données parties.
 *
 * `DATABASE_URL_UNPOOLED` est préféré quand il existe : Neon rend une chaîne
 * passant par son pool de connexions et une chaîne directe. Une migration prend
 * des verrous et enchaîne des instructions dans une transaction, ce qui se
 * comporte mieux hors du pool.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  // Demande confirmation avant toute instruction destructrice, et détaille ce
  // qui sera exécuté. Le défaut est plus silencieux, ce qui n'est pas ce qu'on
  // veut d'un outil qui touche au stockage.
  strict: true,
  verbose: true,
});
