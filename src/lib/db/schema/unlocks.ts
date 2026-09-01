/**
 * LES DÉBLOCAGES D'OUTILS — le registre que le cookie signé porte aujourd'hui.
 *
 * `src/lib/access/ledger.ts` garde la même information dans un cookie httpOnly
 * signé en HMAC. Ce cookie fonctionne, mais il tient dans un navigateur : il
 * s'évapore au changement d'appareil, et il se plafonne à quarante entrées
 * (`MAX_GRANTS`) parce qu'un en-tête HTTP a une taille. Cette table lève les
 * deux limites sans changer la règle d'un iota.
 *
 * LA RÈGLE, ET POURQUOI ELLE N'EST PAS DANS CE FICHIER
 *   Deux outils par semaine GLISSANTE. On compte les DÉBLOCAGES, jamais les
 *   usages : rouvrir un outil déjà obtenu ne coûte rien. Cette règle vit dans
 *   `src/lib/access/core.ts` (`computeQuota`, `applyGrant`, `WEEKLY_LIMIT`,
 *   `WINDOW_SECONDS`), elle y est pure et testée, et elle n'est réécrite NULLE
 *   PART ici. Aucune vue SQL, aucune contrainte, aucun `count(*) where
 *   unlocked_at > now() - interval '7 days'` : deux implémentations de la même
 *   règle finiraient par diverger, et c'est la règle à laquelle l'utilisateur
 *   tient le plus.
 *
 * UNE LIGNE PAR OUTIL POSSÉDÉ, pas une par ouverture.
 *   L'index unique `(user_id, tool_slug)` traduit directement « rouvrir ne
 *   consomme rien » : une seconde ouverture ne peut pas créer de ligne, donc ne
 *   peut pas consommer de crédit, même si un appelant s'y prenait mal.
 *   `unlocked_at` reste la date de la PREMIÈRE ouverture, ce qui est exactement
 *   ce que fait `applyGrant` avec le cookie.
 *
 * LA FENÊTRE GLISSANTE N'EST PAS CALENDAIRE. « Lundi minuit » ferait affluer
 * tout le monde au même instant et punirait qui arrive un dimanche soir. La
 * conséquence pour le schéma est qu'aucune colonne ne porte de semaine, de mois
 * ni de période : il n'y a que des dates, et c'est le calcul qui glisse.
 */

import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const toolUnlocks = pgTable(
  "tool_unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** L'identifiant d'outil, tel que `src/lib/tools/definitions.ts` le nomme. */
    toolSlug: text("tool_slug").notNull(),
    unlockedAt: timestamp("unlocked_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // « Rouvrir ne coûte rien », traduit en contrainte plutôt qu'en discipline.
    uniqueIndex("tool_unlocks_user_tool_idx").on(table.userId, table.toolSlug),
    // La seule lecture du chemin critique : tous les déblocages d'une personne,
    // du plus récent au plus ancien. La date est dans l'index parce que c'est
    // elle qui décide de la fenêtre, et l'ordre décroissant parce que c'est
    // celui de l'affichage.
    index("tool_unlocks_user_unlocked_at_idx").on(table.userId, table.unlockedAt.desc()),
  ],
);

export type ToolUnlockRow = typeof toolUnlocks.$inferSelect;
export type ToolUnlockInsert = typeof toolUnlocks.$inferInsert;
