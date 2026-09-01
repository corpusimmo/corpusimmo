/**
 * LES CONTACTS ET LES PROSPECTS — ce que `POST /api/leads` traite sans rien
 * garder.
 *
 * La route le dit en toutes lettres dans son en-tête : « Rien n'est persisté :
 * le lead est scoré, l'e-mail part, et la requête répond `202 Accepted` ». Elle
 * répond 202 et non 201 parce que « mentir sur le code de statut coûterait le
 * jour où un client s'y fiera pour rejouer une requête ». Ces deux tables sont
 * ce qui permettra à cette route de répondre 201 sans mentir.
 *
 * DEUX TABLES PARCE QU'UNE PERSONNE N'EST PAS UNE DEMANDE.
 *   Quelqu'un estime son appartement en mars, la maison de sa mère en
 *   septembre. C'est UNE personne et DEUX projets. Tout aplatir dans une table
 *   `leads` donnerait deux adresses e-mail identiques, deux téléphones à tenir
 *   à jour, et la certitude qu'un jour l'un des deux sera faux. Un désabonnement
 *   ou une demande d'effacement porte sur la PERSONNE, jamais sur une de ses
 *   demandes : sans `contacts`, il faudrait les retrouver par égalité de chaîne.
 *
 * LE SCORE EST FIGÉ, PAS RECALCULÉ. `score` et `score_breakdown` conservent la
 * note telle qu'elle a été produite au moment de la demande, avec le barème du
 * moment. Recalculer plus tard donnerait un chiffre différent d'un lead vendu à
 * un professionnel sur la foi de l'ancien, ce qui est un litige, pas une
 * amélioration.
 *
 * LE BLOC BIEN EST DÉNORMALISÉ à dessein — ville, type, surface, intention sont
 * recopiés dans `leads` alors que l'estimation les porte déjà. `src/types/lead.ts`
 * l'avait prévu : « instantané dénormalisé pour que la place de marché n'ait
 * jamais besoin d'une jointure ». S'y ajoute que `estimation_id` est nullable
 * (un formulaire de rappel n'a pas d'estimation) et que l'oubli d'une
 * estimation ne doit pas vider la fiche du prospect.
 *
 * CE QUE CES TABLES NE PORTENT PAS : le consentement. Il vit dans `consents`,
 * en ajout seul, avec sa date, son origine et sa version. Un booléen
 * `marketing` sur le contact serait l'état courant sans l'histoire, et c'est
 * l'histoire qui se produit en cas de réclamation.
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

import type { LeadStatus } from "@/types/lead";
import type { ProjectIntent, PropertyType } from "@/types/property";

import { users } from "./auth";
import { estimations } from "./estimations";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Le compte, quand la personne en a un. Nul le plus souvent : on donne son
     * adresse pour recevoir une estimation, pas pour ouvrir un compte.
     *
     * `cascade` : effacer un compte efface la fiche de contact qui lui est
     * rattachée. Un contact jamais rattaché survit, et s'efface par son adresse.
     */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** En minuscules, toujours. C'est la clé naturelle de la personne. */
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Une personne, une fiche. C'est cette contrainte qui rend l'insertion
    // idempotente : la deuxième demande met la fiche à jour au lieu d'en créer
    // une seconde.
    uniqueIndex("contacts_email_idx").on(table.email),
    index("contacts_user_id_idx").on(table.userId),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    /**
     * L'estimation à l'origine de la demande, quand il y en a une. `set null` :
     * si la personne oublie son estimation, la demande reste, amputée de son
     * détail. La supprimer effacerait une transaction commerciale au motif
     * qu'un document a été rangé.
     */
    estimationId: uuid("estimation_id").references(() => estimations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").$type<LeadStatus>().notNull().default("new"),
    /** D'où vient la demande : `estimation`, `rappel`, `aimant:<slug>`… */
    source: text("source").notNull(),

    // --- Instantané du bien, dénormalisé. Voir l'en-tête. ---
    propertyType: text("property_type").$type<PropertyType>(),
    city: text("city"),
    cityCode: text("city_code"),
    postcode: text("postcode"),
    livingArea: doublePrecision("living_area"),
    intent: text("intent").$type<ProjectIntent>(),
    estimatedLow: integer("estimated_low"),
    estimatedHigh: integer("estimated_high"),

    /** 0 à 100, tel que `scoreLead()` l'a produit ce jour-là. */
    score: integer("score").notNull(),
    /** Le détail des bandes, pour pouvoir expliquer la note deux ans après. */
    scoreBreakdown: jsonb("score_breakdown").$type<{ label: string; points: number }[]>(),
  },
  (table) => [
    // La file de traitement : les demandes non traitées, les plus récentes
    // d'abord.
    index("leads_status_created_at_idx").on(table.status, table.createdAt.desc()),
    // L'historique d'une personne.
    index("leads_contact_id_idx").on(table.contactId),
    index("leads_estimation_id_idx").on(table.estimationId),
  ],
);

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
export type LeadRow = typeof leads.$inferSelect;
export type LeadInsert = typeof leads.$inferInsert;
