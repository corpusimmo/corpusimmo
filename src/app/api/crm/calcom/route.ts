/**
 * LES RENDEZ-VOUS CAL.COM, TRACÉS SUR LA FICHE.
 *
 * Cal.com poste ici ses événements de réservation (webhook « Booking Created »,
 * « Cancelled », « Rescheduled »). On y lit l'adresse de la personne, l'heure et
 * le type de rendez-vous, on retrouve ou crée la fiche, et on pose une note
 * `rendez_vous` dans son fil. Rien d'autre : l'agenda reste dans Cal.com.
 *
 * SIGNÉ. Cal.com envoie `X-Cal-Signature-256`, un HMAC SHA-256 du corps brut
 * avec le secret saisi dans le webhook. On le compare à `CALCOM_WEBHOOK_SECRET`
 * en temps constant. Sans secret côté serveur, la route répond 503.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isDatabaseConfigured } from "@/lib/db";
import { addNote, upsertFromMachine } from "@/lib/db/queries/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  triggerEvent: z.string(),
  payload: z.object({
    title: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    eventTitle: z.string().optional(),
    type: z.string().optional(),
    attendees: z
      .array(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
          timeZone: z.string().optional(),
        }),
      )
      .optional(),
    responses: z.record(z.string(), z.unknown()).optional(),
    cancellationReason: z.string().optional().nullable(),
  }),
});

const EVENT_LABELS: Record<string, string> = {
  BOOKING_CREATED: "Rendez-vous pris",
  BOOKING_RESCHEDULED: "Rendez-vous déplacé",
  BOOKING_CANCELLED: "Rendez-vous annulé",
  BOOKING_REQUESTED: "Rendez-vous demandé",
  BOOKING_REJECTED: "Rendez-vous refusé",
  BOOKING_NO_SHOW_UPDATED: "Absence au rendez-vous",
};

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function signed(raw: string, header: string | null): boolean {
  const secret = process.env.CALCOM_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function phoneOf(responses: Record<string, unknown> | undefined): string | null {
  const candidate = responses?.phone ?? responses?.attendeePhoneNumber ?? responses?.["telephone"];
  if (typeof candidate === "string") return candidate.trim() || null;
  if (candidate && typeof candidate === "object" && "value" in candidate) {
    const value = (candidate as { value?: unknown }).value;
    return typeof value === "string" ? value.trim() || null : null;
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.CALCOM_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (!signed(raw, request.headers.get("x-cal-signature-256"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const { triggerEvent, payload } = parsed.data;
  const attendee = payload.attendees?.[0];
  if (!attendee) return NextResponse.json({ ignored: "no_attendee" });

  const label = EVENT_LABELS[triggerEvent] ?? triggerEvent;
  const when = payload.startTime ? WHEN.format(new Date(payload.startTime)) : "";
  const lines = [
    `${label}${when ? ` : ${when}` : ""}`,
    payload.eventTitle || payload.title ? `Type : ${payload.eventTitle ?? payload.title}` : "",
    payload.cancellationReason ? `Motif : ${payload.cancellationReason}` : "",
  ].filter(Boolean);

  try {
    const [firstName, ...rest] = (attendee.name ?? "").trim().split(/\s+/);
    const id = await upsertFromMachine({
      email: attendee.email,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      phone: phoneOf(payload.responses),
      tags: ["rendez-vous"],
    });
    await addNote({ contactId: id, body: lines.join("\n"), kind: "rendez_vous" });
    return NextResponse.json({ id });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[crm] webhook Cal.com en échec (${reason})`);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
