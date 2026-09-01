/**
 * LE PANIER DE COMPARABLES — la sélection de l'observatoire, sortie du
 * navigateur.
 *
 * `src/components/observatoire/comparables-store.tsx` la garde aujourd'hui
 * dans `localStorage`, sous une clé partagée entre `/observatoire` et l'espace
 * `/pro`. Le fichier justifie cette persistance en une phrase qui vaut cahier
 * des charges : « un utilisateur qui choisit quatorze comparables et recharge
 * la page ne doit pas perdre son après-midi ». En base, la même phrase se lit
 * « ne doit pas perdre son après-midi en changeant d'ordinateur ».
 *
 * DEUX TABLES PARCE QU'IL Y A DEUX OBJETS. Le panier a un nom, un bien de
 * référence et une date ; les lignes qu'il contient ont chacune leur poids,
 * leur exclusion et leur commentaire. Tout mettre dans un seul `jsonb`
 * interdirait de modifier une ligne sans réécrire les cinquante autres, et
 * transformerait « je décoche ce comparable » en course entre deux onglets.
 *
 * ON RECOPIE LA TRANSACTION DVF ENTIÈRE, pas seulement son identifiant, et
 * c'est le magasin local qui a raison sur ce point : « une ligne DVF est un
 * fait historique immuable — il n'y a rien à invalider ». S'y ajoute une raison
 * propre à la base : un panier vieux de deux ans doit rester lisible même si le
 * millésime DVF a été republié entre-temps, et même si le fournisseur a changé.
 * Le panier est une PIÈCE, il porte ses pièces jointes.
 *
 * LE BIEN DE RÉFÉRENCE est un `PropertyDraft` en `jsonb` et non une table de
 * biens. Il n'existe pas d'entité « bien » persistée dans le produit : ce que
 * l'assistant collecte est un brouillon, et lui inventer une identité créerait
 * des doublons que personne ne saurait fusionner. Le jour où un vrai
 * répertoire de biens existera, cette colonne deviendra une clé étrangère.
 */

import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { DvfTransaction } from "@/types/dvf";
import type { PropertyDraft } from "@/types/property";

import { users } from "./auth";
import { estimations } from "./estimations";

export const comparableSets = pgTable(
  "comparable_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nul tant que la personne n'a rien nommé : le panier courant n'a pas de nom. */
    name: text("name"),
    /** Le bien de référence, tel que l'assistant l'a collecté. */
    subject: jsonb("subject").$type<PropertyDraft>(),
    /**
     * L'estimation née de ce panier, s'il y en a eu une. `set null` et non
     * `cascade` : oublier une estimation ne doit pas emporter le travail de
     * sélection qui l'a produite, alors que l'inverse serait vrai.
     */
    estimationId: uuid("estimation_id").references(() => estimations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // « Mes paniers, le plus récemment touché en premier » : c'est ainsi qu'on
    // retrouve celui sur lequel on travaillait.
    index("comparable_sets_user_updated_at_idx").on(table.userId, table.updatedAt.desc()),
  ],
);

export const comparableItems = pgTable(
  "comparable_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => comparableSets.id, { onDelete: "cascade" }),
    /** L'identifiant DVF préfixé du fournisseur, par exemple `geodvf:2024-532458`. */
    transactionId: text("transaction_id").notNull(),
    /** La mutation elle-même, recopiée. Voir l'en-tête du fichier. */
    transaction: jsonb("transaction").$type<DvfTransaction>().notNull(),
    addedAt: timestamp("added_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Gardé dans le panier mais hors du calcul. */
    excluded: boolean("excluded").notNull().default(false),
    /**
     * Pondération imposée par le professionnel, dans [0, 3] — le contrat du
     * moteur. Nulle quand la pondération calculée fait foi, ce qui n'est PAS la
     * même chose qu'un poids de zéro : zéro veut dire « compte pour rien »,
     * nul veut dire « je ne me prononce pas ».
     */
    manualWeight: doublePrecision("manual_weight"),
    comment: text("comment"),
  },
  (table) => [
    // Le même bien deux fois dans un panier n'est pas une sélection, c'est un
    // doublon de pondération : il compterait double dans la moyenne.
    uniqueIndex("comparable_items_set_transaction_idx").on(table.setId, table.transactionId),
    // L'ordre d'affichage par défaut du panier est l'ordre d'ajout.
    index("comparable_items_set_added_at_idx").on(table.setId, table.addedAt),
  ],
);

export type ComparableSetRow = typeof comparableSets.$inferSelect;
export type ComparableSetInsert = typeof comparableSets.$inferInsert;
export type ComparableItemRow = typeof comparableItems.$inferSelect;
export type ComparableItemInsert = typeof comparableItems.$inferInsert;
