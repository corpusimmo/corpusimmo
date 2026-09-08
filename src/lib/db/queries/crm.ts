import "server-only";

/**
 * LES REQUÊTES DU CRM. Toutes supposent la base configurée : les pages de
 * `/crm` ne s'affichent pas sans elle, et le webhook répond 503 avant d'y
 * arriver. Les lectures renvoient donc des lignes, pas des `WriteOutcome`.
 */

import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../client";
import {
  contacts,
  crmDeals,
  crmNotes,
  crmTasks,
  leads,
  type ContactFields,
  type ContactStage,
  type DealStage,
  type NoteKind,
} from "../schema";
import { normaliseEmail } from "../scopes";

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactFilter {
  q?: string;
  stage?: ContactStage;
  owner?: string;
  tag?: string;
  limit?: number;
}

export async function listContacts(filter: ContactFilter = {}) {
  const conditions = [];
  if (filter.q) {
    const needle = `%${filter.q.trim()}%`;
    conditions.push(
      or(
        ilike(contacts.email, needle),
        ilike(contacts.firstName, needle),
        ilike(contacts.lastName, needle),
        ilike(contacts.company, needle),
        ilike(contacts.phone, needle),
      ),
    );
  }
  if (filter.stage) conditions.push(eq(contacts.stage, filter.stage));
  if (filter.owner) conditions.push(eq(contacts.ownerEmail, filter.owner));
  if (filter.tag) conditions.push(sql`${contacts.tags} @> ${JSON.stringify([filter.tag])}::jsonb`);

  return getDb()
    .select()
    .from(contacts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sql`coalesce(${contacts.lastActivityAt}, ${contacts.updatedAt})`))
    .limit(filter.limit ?? 200);
}

export async function readContact(id: string) {
  const [row] = await getDb().select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return row ?? null;
}

export interface ContactPatch {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  stage?: ContactStage;
  ownerEmail?: string | null;
  origin?: string | null;
  tags?: string[];
}

export async function updateContact(id: string, patch: ContactPatch, now = new Date()) {
  await getDb()
    .update(contacts)
    .set({ ...patch, updatedAt: now, lastActivityAt: now })
    .where(eq(contacts.id, id));
}

export async function createContact(
  input: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; company?: string | null; ownerEmail?: string | null },
  now = new Date(),
): Promise<string> {
  const email = normaliseEmail(input.email);
  const [row] = await getDb()
    .insert(contacts)
    .values({
      email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      ownerEmail: input.ownerEmail ?? null,
      origin: "manuel",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        firstName: sql`coalesce(excluded.first_name, ${contacts.firstName})`,
        lastName: sql`coalesce(excluded.last_name, ${contacts.lastName})`,
        phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
        company: sql`coalesce(excluded.company, ${contacts.company})`,
        ownerEmail: sql`coalesce(${contacts.ownerEmail}, excluded.owner_email)`,
        updatedAt: now,
      },
    })
    .returning({ id: contacts.id });
  if (!row) throw new Error("aucune ligne rendue");
  return row.id;
}

export async function deleteContact(id: string) {
  await getDb().delete(contacts).where(eq(contacts.id, id));
}

export async function listLeadsOfContact(contactId: string) {
  return getDb().select().from(leads).where(eq(leads.contactId, contactId)).orderBy(desc(leads.createdAt));
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(
  input: { contactId: string; body: string; kind?: NoteKind; authorEmail?: string | null },
  now = new Date(),
) {
  const db = getDb();
  await db.insert(crmNotes).values({
    contactId: input.contactId,
    body: input.body,
    kind: input.kind ?? "note",
    authorEmail: input.authorEmail ?? null,
    createdAt: now,
  });
  await db
    .update(contacts)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(contacts.id, input.contactId));
}

export async function listNotes(contactId: string) {
  return getDb()
    .select()
    .from(crmNotes)
    .where(eq(crmNotes.contactId, contactId))
    .orderBy(desc(crmNotes.createdAt));
}

export async function deleteNote(id: string) {
  await getDb().delete(crmNotes).where(eq(crmNotes.id, id));
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export async function addTask(
  input: { title: string; contactId?: string | null; assigneeEmail?: string | null; createdByEmail?: string | null; dueAt?: Date | null },
  now = new Date(),
) {
  await getDb().insert(crmTasks).values({
    title: input.title,
    contactId: input.contactId ?? null,
    assigneeEmail: input.assigneeEmail ?? null,
    createdByEmail: input.createdByEmail ?? null,
    dueAt: input.dueAt ?? null,
    createdAt: now,
  });
}

export async function setTaskDone(id: string, done: boolean, now = new Date()) {
  await getDb()
    .update(crmTasks)
    .set({ doneAt: done ? now : null })
    .where(eq(crmTasks.id, id));
}

export async function deleteTask(id: string) {
  await getDb().delete(crmTasks).where(eq(crmTasks.id, id));
}

/** Les tâches ouvertes, la plus urgente d'abord, avec le nom du contact. */
export async function listOpenTasks(assignee?: string) {
  const conditions = [isNull(crmTasks.doneAt)];
  if (assignee) conditions.push(eq(crmTasks.assigneeEmail, assignee));
  return getDb()
    .select({
      task: crmTasks,
      contact: {
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      },
    })
    .from(crmTasks)
    .leftJoin(contacts, eq(crmTasks.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(sql`${crmTasks.dueAt} asc nulls last`, asc(crmTasks.createdAt));
}

export async function listTasksOfContact(contactId: string) {
  return getDb()
    .select()
    .from(crmTasks)
    .where(eq(crmTasks.contactId, contactId))
    .orderBy(sql`${crmTasks.doneAt} asc nulls first`, sql`${crmTasks.dueAt} asc nulls last`);
}

// ---------------------------------------------------------------------------
// Opportunités
// ---------------------------------------------------------------------------

export async function addDeal(
  input: { contactId: string; title: string; amountCents?: number | null; stage?: DealStage; ownerEmail?: string | null; expectedCloseAt?: Date | null },
  now = new Date(),
) {
  await getDb().insert(crmDeals).values({
    contactId: input.contactId,
    title: input.title,
    amountCents: input.amountCents ?? null,
    stage: input.stage ?? "decouverte",
    ownerEmail: input.ownerEmail ?? null,
    expectedCloseAt: input.expectedCloseAt ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await getDb().update(contacts).set({ lastActivityAt: now }).where(eq(contacts.id, input.contactId));
}

export async function setDealStage(id: string, stage: DealStage, now = new Date()) {
  const closed = stage === "gagne" || stage === "perdu";
  await getDb()
    .update(crmDeals)
    .set({ stage, updatedAt: now, closedAt: closed ? now : null })
    .where(eq(crmDeals.id, id));
}

export async function deleteDeal(id: string) {
  await getDb().delete(crmDeals).where(eq(crmDeals.id, id));
}

export async function listDeals() {
  return getDb()
    .select({
      deal: crmDeals,
      contact: {
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        company: contacts.company,
      },
    })
    .from(crmDeals)
    .innerJoin(contacts, eq(crmDeals.contactId, contacts.id))
    .orderBy(desc(crmDeals.updatedAt));
}

export async function listDealsOfContact(contactId: string) {
  return getDb()
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.contactId, contactId))
    .orderBy(desc(crmDeals.updatedAt));
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

export async function dashboardCounts() {
  const db = getDb();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [total] = await db.select({ n: count() }).from(contacts);
  const [recent] = await db
    .select({ n: count() })
    .from(contacts)
    .where(sql`${contacts.createdAt} >= ${since}`);
  const [toContact] = await db
    .select({ n: count() })
    .from(contacts)
    .where(or(eq(contacts.stage, "nouveau"), eq(contacts.stage, "a_contacter")));
  const [openTasks] = await db.select({ n: count() }).from(crmTasks).where(isNull(crmTasks.doneAt));
  const [pipeline] = await db
    .select({ n: count(), amount: sql<number>`coalesce(sum(${crmDeals.amountCents}), 0)` })
    .from(crmDeals)
    .where(and(sql`${crmDeals.stage} not in ('gagne', 'perdu')`));
  return {
    contacts: total?.n ?? 0,
    newThisWeek: recent?.n ?? 0,
    toContact: toContact?.n ?? 0,
    openTasks: openTasks?.n ?? 0,
    openDeals: pipeline?.n ?? 0,
    openAmountCents: Number(pipeline?.amount ?? 0),
  };
}

// ---------------------------------------------------------------------------
// La machine à lead magnets
// ---------------------------------------------------------------------------

export interface MachineContact {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  website?: string | null;
  tags?: string[];
  fields?: ContactFields;
}

/**
 * La machine renvoie la fiche entière à chaque étape : les étiquettes et les
 * champs qu'elle envoie sont fusionnés à ceux déjà là, jamais substitués. Un
 * contact qui existait par le site garde son prénom si la machine n'en donne
 * pas ; l'inverse est vrai aussi.
 */
export async function upsertFromMachine(input: MachineContact, now = new Date()): Promise<string> {
  const email = normaliseEmail(input.email);
  const tags = (input.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean);
  const fields: ContactFields = {};
  for (const [key, value] of Object.entries(input.fields ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    fields[String(key).slice(0, 80)] = String(value).slice(0, 2000);
  }
  const origin = tags.find((tag) => tag.startsWith("magnet:") || tag.startsWith("aimant:")) ?? "machine";

  const [row] = await getDb()
    .insert(contacts)
    .values({
      email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      phone: input.phone || null,
      company: input.website || null,
      origin,
      tags,
      fields,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        firstName: sql`coalesce(excluded.first_name, ${contacts.firstName})`,
        lastName: sql`coalesce(excluded.last_name, ${contacts.lastName})`,
        phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
        company: sql`coalesce(${contacts.company}, excluded.company)`,
        origin: sql`coalesce(${contacts.origin}, excluded.origin)`,
        // Union des étiquettes, sans doublon, ordre d'arrivée conservé.
        tags: sql`(
          select coalesce(jsonb_agg(t order by ord), '[]'::jsonb)
          from (
            select t, min(ord) as ord
            from jsonb_array_elements_text(${contacts.tags} || excluded.tags) with ordinality as x(t, ord)
            group by t
          ) u
        )`,
        fields: sql`${contacts.fields} || excluded.fields`,
        updatedAt: now,
        lastActivityAt: now,
      },
    })
    .returning({ id: contacts.id });
  if (!row) throw new Error("aucune ligne rendue");
  return row.id;
}

/** Ce que la machine a le droit de relire : prénom, étiquettes, champs. */
export async function lookupForMachine(email: string) {
  const [row] = await getDb()
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      tags: contacts.tags,
      fields: contacts.fields,
    })
    .from(contacts)
    .where(eq(contacts.email, normaliseEmail(email)))
    .limit(1);
  return row ?? null;
}
