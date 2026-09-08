"use server";

/**
 * LES ACTIONS DU CRM. Chacune vérifie l'appartenance à l'équipe avant de
 * toucher la base : la mise en page protège l'affichage, pas les écritures.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMember } from "@/lib/crm/access";
import { findMember } from "@/lib/crm/team";
import {
  addDeal,
  addNote,
  addTask,
  createContact,
  deleteContact,
  deleteDeal,
  deleteNote,
  deleteTask,
  setDealStage,
  setTaskDone,
  updateContact,
} from "@/lib/db/queries/crm";
import { CONTACT_STAGES, DEAL_STAGES, NOTE_KINDS } from "@/lib/db/schema/crm";
import type { ContactStage, DealStage, NoteKind } from "@/lib/db/schema/crm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(data: FormData, key: string, max = 200): string | null {
  const value = data.get(key);
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean === "" ? null : clean;
}

function uuid(value: FormDataEntryValue | string | null): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function memberEmail(value: string | null): string | null {
  return findMember(value)?.email ?? null;
}

function dateOrNull(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateAll(contactId?: string | null) {
  revalidatePath("/crm");
  revalidatePath("/crm/contacts");
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/taches");
  if (contactId) revalidatePath(`/crm/contacts/${contactId}`);
}

// --- Contacts --------------------------------------------------------------

export async function createContactAction(data: FormData): Promise<void> {
  const member = await requireMember();
  const email = text(data, "email", 254);
  if (!email || !email.includes("@")) return;
  const id = await createContact({
    email,
    firstName: text(data, "firstName", 120),
    lastName: text(data, "lastName", 120),
    phone: text(data, "phone", 40),
    company: text(data, "company", 160),
    ownerEmail: memberEmail(text(data, "ownerEmail")) ?? member.email,
  });
  revalidateAll(id);
  redirect(`/crm/contacts/${id}`);
}

export async function updateContactAction(data: FormData): Promise<void> {
  await requireMember();
  const id = uuid(data.get("id"));
  if (!id) return;
  const stage = text(data, "stage");
  const tags = (text(data, "tags", 1000) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  await updateContact(id, {
    firstName: text(data, "firstName", 120),
    lastName: text(data, "lastName", 120),
    phone: text(data, "phone", 40),
    company: text(data, "company", 160),
    ownerEmail: memberEmail(text(data, "ownerEmail")),
    stage: CONTACT_STAGES.includes(stage as ContactStage) ? (stage as ContactStage) : undefined,
    tags,
  });
  revalidateAll(id);
}

export async function setContactStageAction(id: string, stage: string): Promise<void> {
  await requireMember();
  if (!uuid(id) || !CONTACT_STAGES.includes(stage as ContactStage)) return;
  await updateContact(id, { stage: stage as ContactStage });
  revalidateAll(id);
}

export async function setContactOwnerAction(id: string, owner: string): Promise<void> {
  await requireMember();
  if (!uuid(id)) return;
  await updateContact(id, { ownerEmail: memberEmail(owner) });
  revalidateAll(id);
}

export async function deleteContactAction(data: FormData): Promise<void> {
  await requireMember();
  const id = uuid(data.get("id"));
  if (!id) return;
  await deleteContact(id);
  revalidateAll();
  redirect("/crm/contacts");
}

// --- Notes -----------------------------------------------------------------

export async function addNoteAction(data: FormData): Promise<void> {
  const member = await requireMember();
  const contactId = uuid(data.get("contactId"));
  const body = text(data, "body", 20000);
  if (!contactId || !body) return;
  const kind = text(data, "kind");
  await addNote({
    contactId,
    body,
    kind: NOTE_KINDS.includes(kind as NoteKind) && kind !== "system" ? (kind as NoteKind) : "note",
    authorEmail: member.email,
  });
  revalidateAll(contactId);
}

export async function deleteNoteAction(id: string, contactId: string): Promise<void> {
  await requireMember();
  if (!uuid(id)) return;
  await deleteNote(id);
  revalidateAll(uuid(contactId));
}

// --- Tâches ----------------------------------------------------------------

export async function addTaskAction(data: FormData): Promise<void> {
  const member = await requireMember();
  const title = text(data, "title", 300);
  if (!title) return;
  const contactId = uuid(data.get("contactId"));
  await addTask({
    title,
    contactId,
    assigneeEmail: memberEmail(text(data, "assigneeEmail")) ?? member.email,
    createdByEmail: member.email,
    dueAt: dateOrNull(text(data, "dueAt")),
  });
  revalidateAll(contactId);
}

export async function toggleTaskAction(id: string, done: boolean, contactId?: string | null): Promise<void> {
  await requireMember();
  if (!uuid(id)) return;
  await setTaskDone(id, done);
  revalidateAll(contactId ? uuid(contactId) : null);
}

export async function deleteTaskAction(id: string, contactId?: string | null): Promise<void> {
  await requireMember();
  if (!uuid(id)) return;
  await deleteTask(id);
  revalidateAll(contactId ? uuid(contactId) : null);
}

// --- Opportunités ----------------------------------------------------------

export async function addDealAction(data: FormData): Promise<void> {
  const member = await requireMember();
  const contactId = uuid(data.get("contactId"));
  const title = text(data, "title", 300);
  if (!contactId || !title) return;
  const amount = text(data, "amount", 20);
  const parsed = amount ? Number(amount.replace(/\s/g, "").replace(",", ".")) : NaN;
  const stage = text(data, "stage");
  await addDeal({
    contactId,
    title,
    amountCents: Number.isFinite(parsed) ? Math.round(parsed * 100) : null,
    stage: DEAL_STAGES.includes(stage as DealStage) ? (stage as DealStage) : "decouverte",
    ownerEmail: memberEmail(text(data, "ownerEmail")) ?? member.email,
    expectedCloseAt: dateOrNull(text(data, "expectedCloseAt")),
  });
  revalidateAll(contactId);
}

export async function setDealStageAction(id: string, stage: string, contactId?: string | null): Promise<void> {
  await requireMember();
  if (!uuid(id) || !DEAL_STAGES.includes(stage as DealStage)) return;
  await setDealStage(id, stage as DealStage);
  revalidateAll(contactId ? uuid(contactId) : null);
}

export async function deleteDealAction(id: string, contactId?: string | null): Promise<void> {
  await requireMember();
  if (!uuid(id)) return;
  await deleteDeal(id);
  revalidateAll(contactId ? uuid(contactId) : null);
}
