/**
 * LES ESTIMATIONS — le résumé d'un côté, le résultat complet de l'autre.
 *
 * Aujourd'hui l'historique vit dans `localStorage`
 * (`src/lib/history/estimations.ts`) et n'y garde qu'un RÉSUMÉ : où, quoi,
 * combien, avec quelle confiance. Le fichier explique pourquoi, et la raison
 * tenait au navigateur : « un résumé tient dans `localStorage` quand un
 * résultat complet, avec ses cent mutations, ne tient pas ».
 *
 * EN BASE, LA CONTRAINTE DISPARAÎT MAIS LA SÉPARATION RESTE, pour une autre
 * raison. La page « mes estimations » liste trente lignes ; si le résultat
 * complet était une colonne de la même table, chaque affichage de liste
 * traînerait trente charges JSON de plusieurs centaines de kilo-octets. Postgres
 * range les gros `jsonb` hors ligne (TOAST) et ne les lit que si on les
 * demande, mais un `select *` les demande — et un `select *` finit toujours par
 * arriver. Deux tables rendent l'erreur impossible plutôt qu'improbable.
 *
 * DEUX TABLES, DEUX RYTHMES DE LECTURE :
 *   - `estimations` : lue à chaque affichage de liste, quelques centaines
 *     d'octets par ligne, indexée par personne et par date ;
 *   - `estimation_results` : lue quand on rouvre UNE estimation, et pour rien
 *     d'autre.
 *
 * POURQUOI GARDER LE RÉSULTAT COMPLET, qu'on ne gardait pas.
 *   Trois choses en dépendent, et aucune n'est possible sans lui :
 *     1. le LIEN PARTAGEABLE. Le refus actuel est honnête (« rien n'est stocké
 *        côté serveur, donc une URL permanente serait une promesse que le
 *        rechargement casserait ») mais c'est un refus faute de stockage, pas
 *        par principe ;
 *     2. le PDF régénéré des mois plus tard, sans redemander l'adresse ;
 *     3. la BANDE « valeur estimée » du score de lead, que
 *        `src/app/api/leads/route.ts` refuse aujourd'hui de compter parce que
 *        la valeur lui arrive du CLIENT, et qu'un client peut se déclarer
 *        propriétaire d'une villa à deux millions. Relue depuis cette table,
 *        elle redevient une donnée que nous avons produite.
 *
 * `jsonb` ET NON UN SCHÉMA ÉCLATÉ. `ValuationResult` porte les comparables, les
 * sous-scores de pondération, les motifs de rejet, le diagnostic. Le
 * normaliser demanderait cinq tables de plus, dont aucune ne serait jamais
 * interrogée autrement que « rends-moi tout ce résultat ». `payload_version`
 * est là pour le jour où la forme changera : on ne migre pas des millions de
 * documents, on lit l'ancienne version telle qu'elle a été écrite.
 */

import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { PropertyType } from "@/types/property";
import type { ValuationMethodId, ValuationResult, ValuationStatus } from "@/types/valuation";

import { users } from "./auth";

export const estimations = pgTable(
  "estimations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * NULLABLE, et c'est le cas normal au lancement : l'estimateur est ouvert
     * et le restera. Une estimation anonyme s'enregistre quand même, ce qui
     * rend possible de la rattacher à un compte créé après coup.
     *
     * `cascade` sur une colonne nullable ne touche que les lignes rattachées :
     * effacer un compte efface ses estimations, jamais celles de personne.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /**
     * L'identifiant rendu par le moteur (`ValuationResult.id`). Distinct de
     * `id` : celui-ci est notre clé, celui-là est la référence que le client a
     * déjà en main quand il demande l'enregistrement.
     */
    engineId: text("engine_id").notNull(),
    method: text("method").$type<ValuationMethodId>().notNull(),
    status: text("status").$type<ValuationStatus>().notNull(),
    /** Quand le MOTEUR a conclu. C'est la date que la liste affiche. */
    computedAt: timestamp("computed_at", { mode: "date", withTimezone: true }).notNull(),
    /** Quand la LIGNE a été écrite. Les deux diffèrent si l'on enregistre après coup. */
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),

    addressLabel: text("address_label").notNull(),
    city: text("city").notNull(),
    postcode: text("postcode"),
    cityCode: text("city_code"),
    departmentCode: text("department_code"),
    propertyType: text("property_type").$type<PropertyType>().notNull(),
    /**
     * Surface retenue, en m². `doublePrecision` et non `numeric` : la surface
     * n'est pas de l'argent, une décimale de flottant ne coûte rien ici, et
     * `numeric` reviendrait en chaîne côté TypeScript pour une précision dont
     * personne n'a l'usage. Zéro quand le type de bien n'a pas de surface.
     */
    surface: doublePrecision("surface").notNull().default(0),

    /**
     * La fourchette, en euros ENTIERS. Nulle quand le moteur n'a pas conclu :
     * l'échec se garde aussi, sans quoi on ne saurait jamais combien de
     * demandes n'aboutissent pas.
     */
    valueLow: integer("value_low"),
    valueCentral: integer("value_central"),
    valueHigh: integer("value_high"),
    pricePerSqm: integer("price_per_sqm"),
    /** 0 à 100. */
    confidence: integer("confidence").notNull(),
    /** Nombre de ventes retenues : ce qui dit le poids réel du chiffre. */
    comparablesCount: integer("comparables_count").notNull(),

    /**
     * Le jeton du lien partageable, tiré au hasard et posé À LA DEMANDE.
     *
     * Nul par défaut, et c'est tout le sujet : une estimation n'est pas
     * partageable parce qu'elle existe, elle l'est parce que quelqu'un l'a
     * décidé. Un identifiant de ligne devinable transformerait toute la table
     * en URL publique.
     */
    shareToken: text("share_token").unique(),
  },
  (table) => [
    // La liste « mes estimations » : une personne, du plus récent au plus
    // ancien. C'est la seule requête chaude de cette table.
    index("estimations_user_computed_at_idx").on(table.userId, table.computedAt.desc()),
    /**
     * Deux fois le même résultat de moteur pour la même personne, c'est un
     * doublon — exactement ce que `normalise()` écarte aujourd'hui côté
     * navigateur. L'unicité le rend impossible à l'écriture.
     *
     * Postgres traite deux NULL comme distincts : les estimations anonymes
     * échappent donc à cette contrainte, ce qui est le comportement voulu (on
     * ne peut pas dédupliquer des visiteurs qu'on ne distingue pas).
     */
    uniqueIndex("estimations_user_engine_id_idx").on(table.userId, table.engineId),
  ],
);

export const estimationResults = pgTable("estimation_results", {
  /**
   * Clé primaire ET clé étrangère : un résultat par estimation. Le `cascade`
   * fait que l'oubli d'une estimation emporte son résultat, sans que personne
   * n'ait à y penser.
   */
  estimationId: uuid("estimation_id")
    .primaryKey()
    .references(() => estimations.id, { onDelete: "cascade" }),
  payload: jsonb("payload").$type<ValuationResult>().notNull(),
  /** Version de forme du document, pour lire l'ancien sans le migrer. */
  payloadVersion: integer("payload_version").notNull().default(1),
  storedAt: timestamp("stored_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EstimationRow = typeof estimations.$inferSelect;
export type EstimationInsert = typeof estimations.$inferInsert;
export type EstimationResultRow = typeof estimationResults.$inferSelect;
export type EstimationResultInsert = typeof estimationResults.$inferInsert;
