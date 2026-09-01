/**
 * `POST /api/outils/[slug]/acces` — la porte d'un outil.
 *
 * Une adresse contre un déblocage, dans la limite de deux par semaine
 * glissante. Le consentement à la lettre d'information est STRICTEMENT à part :
 * demander un outil n'a jamais valu accord pour recevoir autre chose.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { maskEmail } from "@/lib/email";
import { leadsListId, syncContact } from "@/lib/email/contacts";
import { grantAccess } from "@/lib/access/ledger";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";
import { getToolCard } from "@/data/tools-catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'adresse e-mail est obligatoire.")
    .email("Adresse e-mail invalide."),
  firstName: z.string().trim().max(80).optional(),
  /** Décoché par défaut, jamais groupé avec le déblocage. */
  newsletter: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  if (!getToolCard(slug)) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Cet outil n'existe pas." } },
      { status: 404 },
    );
  }

  const limit = checkRateLimit(`acces:${clientKey(request)}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "Trop de demandes depuis cette connexion. Réessayez dans quelques minutes.",
        },
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Requête illisible." } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: parsed.error.issues[0]?.message ?? "Certains champs sont invalides.",
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const outcome = await grantAccess(slug);

  if (!outcome.granted) {
    return NextResponse.json(
      {
        error: {
          code: "quota_exhausted",
          message: "Vous avez déjà ouvert deux outils cette semaine.",
        },
        quota: {
          used: outcome.quota.used,
          limit: outcome.quota.limit,
          renewsAt: outcome.quota.renewsAt?.toISOString() ?? null,
        },
      },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  // Le contact n'est enregistré QUE si la case a été cochée. `syncContact`
  // refuse d'ailleurs sans `marketing: true`.
  const subscription = await syncContact(
    {
      email: input.email,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      source: `outil:${slug}`,
      consents: {
        marketing: input.newsletter,
        professionalContact: false,
        collectedAt: new Date().toISOString(),
      },
    },
    leadsListId(),
  );

  console.info(
    `[api/outils] « ${slug} » ${outcome.alreadyOwned ? "déjà ouvert" : "débloqué"} pour ` +
      `${maskEmail(input.email.toLowerCase())} — ` +
      `${outcome.quota.remaining} crédit(s) restant(s)`,
  );

  return NextResponse.json(
    {
      granted: true,
      alreadyOwned: outcome.alreadyOwned,
      quota: {
        used: outcome.quota.used,
        limit: outcome.quota.limit,
        remaining: outcome.quota.remaining,
      },
      newsletter: { subscribed: subscription.synced },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
