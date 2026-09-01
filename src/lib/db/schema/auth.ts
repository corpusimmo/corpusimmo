/**
 * LES QUATRE TABLES D'AUTH.JS — leur forme ne nous appartient pas.
 *
 * `@auth/drizzle-adapter` n'interroge pas ces tables par leur nom SQL : il lit
 * les CLÉS TypeScript de l'objet Drizzle et construit ses requêtes avec. Une
 * clé renommée (`providerAccountId` en `providerAccountIdentifier`, par
 * exemple) ne casse rien à la compilation mais fait échouer la connexion au
 * premier aller-retour OAuth, en production, un dimanche soir.
 *
 * Les clés TypeScript sont donc recopiées à l'identique depuis
 * `@auth/drizzle-adapter/src/lib/pg.ts`, y compris les `snake_case` bizarres
 * que l'adaptateur hérite du protocole OAuth (`refresh_token`, `expires_at`…).
 * Les NOMS DE COLONNE, eux, nous appartiennent : ils sont en `snake_case`
 * comme le reste du schéma. Le test `schema.test.ts` monte l'adaptateur sur ces
 * tables au niveau des types, ce qui fait échouer `pnpm typecheck` si l'une des
 * clés dérive.
 *
 * TROIS ÉCARTS ASSUMÉS PAR RAPPORT AU SCHÉMA DE RÉFÉRENCE
 *
 *  1. `users.id` est un `uuid` et non un `text` : l'adaptateur l'autorise
 *     explicitement (`PgVarchar | PgText | PgUUID`), et un identifiant qui
 *     finira dans une URL de partage ne doit rien laisser deviner du volume de
 *     la table. `defaultRandom()` remplit la colonne côté Postgres, ce que
 *     l'adaptateur détecte via `hasDefault` pour ne pas imposer le sien.
 *
 *  2. Tous les horodatages sont en `timestamptz`. Le schéma de référence
 *     utilise un `timestamp` nu, qui stocke une heure sans dire laquelle : une
 *     session expirant « à 2 h » sur une base en UTC et une application en
 *     Europe/Paris se ferme deux heures trop tôt l'hiver, une de plus l'été.
 *     Le type de colonne reste `PgTimestamp`, donc l'adaptateur ne voit pas la
 *     différence.
 *
 *  3. La table `authenticator` (WebAuthn) n'est PAS créée. Elle est optionnelle
 *     dans `DefaultPostgresSchema`, et le produit n'a ni clé de sécurité ni
 *     projet d'en avoir. Le jour venu, c'est une table et une migration, pas
 *     une refonte. En attendant, appeler une méthode WebAuthn de l'adaptateur
 *     échouerait sur une table absente : c'est le comportement voulu, mieux
 *     vaut une erreur franche qu'une table morte.
 *
 * `users.email` reste NULLABLE, comme dans le schéma de référence. Cela paraît
 * absurde pour un produit dont tout l'intérêt est de tenir une adresse vérifiée,
 * mais `createUser` peut être appelé par un fournisseur qui n'en rend pas :
 * contraindre la colonne transformerait ce cas en erreur 500 au lieu d'un
 * compte incomplet. La vérification métier vit dans le callback `signIn`, pas
 * dans le schéma.
 */

import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    // La clé primaire du protocole : un compte est identifié par le couple
    // (fournisseur, identifiant chez ce fournisseur), jamais par le nôtre.
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    // « Quels comptes cette personne a-t-elle liés ? » est la seule question
    // qu'on pose hors du chemin d'authentification, et la clé primaire ne la
    // sert pas : elle commence par le fournisseur.
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    // Le ménage des sessions périmées balaie par date : sans cet index, il
    // relit la table entière à chaque passage.
    index("sessions_expires_idx").on(table.expires),
  ],
);

/**
 * Les jetons à usage unique du lien magique.
 *
 * `useVerificationToken` SUPPRIME la ligne et rend ce qu'il a supprimé : c'est
 * la suppression qui garantit l'usage unique, pas une colonne « consommé ».
 * Deux requêtes concurrentes avec le même jeton ne peuvent donc pas réussir
 * toutes les deux, quelle que soit la charge.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
    index("verification_tokens_expires_idx").on(table.expires),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
