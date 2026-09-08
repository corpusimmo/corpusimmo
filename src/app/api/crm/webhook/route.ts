/**
 * LE POINT D'ENTRÉE DE LA MACHINE À LEAD MAGNETS.
 *
 * La machine (mode `webhook`) poste ici trois formes de message, distinguées
 * par `type` :
 *   contact  : la fiche entière, à chaque étape du parcours. Un upsert.
 *   note     : un texte à accrocher au contact, désigné par son adresse.
 *   lookup   : « connaissez-vous cette adresse ? », pour ne pas redemander
 *              ce qu'elle a déjà donné. Répond la fiche ou un corps vide.
 *
 * L'adresse est la clé de tout : elle voyage dans chaque message.
 *
 * PROTÉGÉ PAR UN SECRET PARTAGÉ, dans `Authorization`. Sans `CRM_WEBHOOK_SECRET`
 * côté serveur, la route répond 503 plutôt que d'accepter n'importe quoi : un
 * webhook ouvert est une porte pour injecter des contacts.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isDatabaseConfigured } from "@/lib/db";
import { addNote, lookupForMachine, upsertFromMachine } from "@/lib/db/queries/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  type: z.literal("contact"),
  email: z.string().email(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
});

const noteSchema = z.object({
  type: z.literal("note"),
  email: z.string().email(),
  note: z.string().min(1).max(20000),
});

const lookupSchema = z.object({
  type: z.literal("lookup"),
  email: z.string().email(),
});

const messageSchema = z.discriminatedUnion("type", [contactSchema, noteSchema, lookupSchema]);

function authorised(request: Request): boolean {
  const expected = process.env.CRM_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.CRM_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const message = parsed.data;

  try {
    if (message.type === "lookup") {
      const found = await lookupForMachine(message.email);
      if (!found) return new NextResponse(null, { status: 204 });
      return NextResponse.json({
        id: found.id,
        firstName: found.firstName ?? "",
        tags: found.tags,
        fields: found.fields,
      });
    }

    if (message.type === "contact") {
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(message.fields ?? {})) {
        if (value === null || value === undefined) continue;
        fields[key] = typeof value === "string" ? value : JSON.stringify(value);
      }
      const id = await upsertFromMachine({ ...message, fields });
      return NextResponse.json({ id });
    }

    const id = await upsertFromMachine({ email: message.email });
    await addNote({ contactId: id, body: message.note, kind: "system" });
    return NextResponse.json({ id });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[crm] webhook en échec (${reason})`);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
