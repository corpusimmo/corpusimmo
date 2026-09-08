/**
 * LE CRM DE L'ÉQUIPE : ce que Mathieu et Gaël voient et font sur un contact.
 *
 * `contacts` reste la table de la PERSONNE, alimentée par les formulaires du
 * site et par la machine à lead magnets. Ce module lui ajoute ce qui relève du
 * travail commercial : une étape de cycle de vie, un responsable, des
 * étiquettes, des champs libres. Puis trois tables autour :
 *
 *   - `crm_notes`  : le fil d'un contact. Une note écrite, un appel, un rendez
 *                    vous, ou une trace posée par la machine (kind `system`).
 *   - `crm_tasks`  : ce qu'il reste à faire, pour qui, pour quand.
 *   - `crm_deals`  : une opportunité chiffrée, avec sa colonne dans le pipeline.
 *
 * L'ÉQUIPE N'EST PAS EN BASE. Deux personnes, désignées par leur adresse dans
 * `CRM_TEAM`. Une table de membres pour deux lignes serait une source de
 * vérité de plus à tenir. Les colonnes `owner_email`, `assignee_email` et
 * `author_email` portent donc l'adresse, et l'affichage la traduit en prénom.
 *
 * TOUT S'EFFACE AVEC LE CONTACT (`cascade`). Une demande d'effacement porte
 * sur la personne ; ses notes et ses tâches n'ont pas de sens sans elle.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { contacts } from "./leads";

/** Le cycle de vie d'une personne, du premier contact au client. */
export const CONTACT_STAGES = [
  "nouveau",
  "a_contacter",
  "en_discussion",
  "qualifie",
  "client",
  "perdu",
] as const;
export type ContactStage = (typeof CONTACT_STAGES)[number];

/** Les colonnes du pipeline des opportunités. */
export const DEAL_STAGES = [
  "decouverte",
  "proposition",
  "negociation",
  "gagne",
  "perdu",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const NOTE_KINDS = ["note", "appel", "email", "rendez_vous", "system"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const crmNotes = pgTable(
  "crm_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    kind: text("kind").$type<NoteKind>().notNull().default("note"),
    /** Nul quand la note vient de la machine, pas d'une personne. */
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("crm_notes_contact_created_idx").on(table.contactId, table.createdAt.desc())],
);

export const crmTasks = pgTable(
  "crm_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nulle pour une tâche sans contact, par exemple « relancer le partenariat ». */
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    assigneeEmail: text("assignee_email"),
    createdByEmail: text("created_by_email"),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    doneAt: timestamp("done_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // La liste du jour : ce qui n'est pas fait, par échéance.
    index("crm_tasks_open_due_idx").on(table.doneAt, table.dueAt),
    index("crm_tasks_contact_idx").on(table.contactId),
  ],
);

export const crmDeals = pgTable(
  "crm_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** En centimes d'euro, jamais en flottant. */
    amountCents: integer("amount_cents"),
    stage: text("stage").$type<DealStage>().notNull().default("decouverte"),
    ownerEmail: text("owner_email"),
    expectedCloseAt: timestamp("expected_close_at", { mode: "date", withTimezone: true }),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("crm_deals_stage_idx").on(table.stage, table.updatedAt.desc()),
    index("crm_deals_contact_idx").on(table.contactId),
  ],
);

export type CrmNoteRow = typeof crmNotes.$inferSelect;
export type CrmNoteInsert = typeof crmNotes.$inferInsert;
export type CrmTaskRow = typeof crmTasks.$inferSelect;
export type CrmTaskInsert = typeof crmTasks.$inferInsert;
export type CrmDealRow = typeof crmDeals.$inferSelect;
export type CrmDealInsert = typeof crmDeals.$inferInsert;

/** Le type des colonnes ajoutées à `contacts` par ce chantier. */
export type ContactFields = Record<string, string>;
