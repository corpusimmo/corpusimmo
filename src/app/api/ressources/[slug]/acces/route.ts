/**
 * `POST /api/ressources/[slug]/acces` — la porte d'un aimant.
 *
 * Le visiteur laisse une adresse, reçoit un lien signé par e-mail. Le fichier
 * ne transite jamais par ce chemin, et l'adresse n'est inscrite à la liste que
 * si la case correspondante a été cochée : demander un document n'a jamais valu
 * accord pour recevoir une lettre d'information.
 *
 * Le lien part par e-mail plutôt que d'être rendu à l'écran, et c'est le point :
 * c'est ce qui vérifie que l'adresse existe et appartient à la personne. Rendre
 * le lien directement transformerait le formulaire en distributeur anonyme.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { auth } from "@/lib/auth";
import { getMailer, maskEmail } from "@/lib/email";
import { leadsListId, syncContact } from "@/lib/email/contacts";
import { renderMagnetReadyEmail } from "@/lib/email/templates/magnet-ready";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";
import { getMagnet } from "@/lib/magnets/catalogue";
import { DEFAULT_TTL_SECONDS, createDownloadToken } from "@/lib/magnets/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'adresse e-mail est obligatoire.")
    .email("Adresse e-mail invalide."),
  firstName: z.string().trim().max(80).optional(),
  /** Strictement facultatif, décoché par défaut, jamais groupé avec l'envoi. */
  newsletter: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const magnet = getMagnet(slug);
  if (!magnet) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Ce document n'existe pas." } },
      { status: 404 },
    );
  }

  const limit = checkRateLimit(`magnet:${clientKey(request)}`, {
    limit: 8,
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
          message: "Certains champs sont invalides.",
          fields: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();
  const token = createDownloadToken(slug, email);

  if (!token) {
    // Le secret de signature manque. On le dit plutôt que d'envoyer un lien
    // qui ne fonctionnerait pas — un e-mail avec un bouton mort coûte la
    // confiance qu'on venait d'obtenir.
    console.error("[api/ressources] DOWNLOAD_SIGNING_SECRET absent : aucun lien émis.");
    return NextResponse.json(
      {
        error: {
          code: "not_configured",
          message: "Le téléchargement est momentanément indisponible. Réessayez plus tard.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const collectedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000);
  const downloadUrl =
    `${env.appUrl.replace(/\/$/, "")}/api/ressources/${slug}/telechargement` +
    `?t=${encodeURIComponent(token)}`;

  /**
   * Le raccourci de la personne déjà connectée.
   *
   * L'aller-retour par e-mail n'a qu'un seul rôle : prouver que l'adresse
   * appartient bien à celui qui la saisit. Quand Google l'a déjà prouvé, le
   * refaire n'ajoute aucune sécurité et ne coûte que de l'attente. On rend donc
   * le lien directement — mais uniquement pour l'adresse de la session, jamais
   * pour celle tapée dans le champ.
   */
  const session = await auth().catch(() => null);
  const sessionEmail = session?.user?.verifiedEmail ? session.user.email?.toLowerCase() : undefined;

  if (sessionEmail && sessionEmail === email) {
    const shortcut = await syncContact(
      {
        email,
        ...(input.firstName ? { firstName: input.firstName } : {}),
        source: `aimant:${slug}`,
        consents: { marketing: input.newsletter, professionalContact: false, collectedAt },
      },
      leadsListId(),
    );

    console.info(
      `[api/ressources] lien « ${slug} » rendu directement à ${maskEmail(email)} ` +
        "(adresse vérifiée par Google)",
    );

    return NextResponse.json(
      {
        downloadUrl,
        sent: false,
        expiresAt: expiresAt.toISOString(),
        newsletter: { subscribed: shortcut.synced },
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const template = renderMagnetReadyEmail({
    ...(input.firstName ? { firstName: input.firstName } : {}),
    title: magnet.title,
    summary: magnet.summary,
    downloadUrl,
    expiresAt,
  });

  const delivery = await getMailer().send({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  const subscription = await syncContact(
    {
      email,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      source: `aimant:${slug}`,
      consents: {
        marketing: input.newsletter,
        professionalContact: false,
        collectedAt,
      },
    },
    leadsListId(),
  );

  console.info(
    `[api/ressources] lien « ${slug} » émis pour ${maskEmail(email)}, ` +
      `e-mail ${delivery.delivered ? "envoyé" : "non envoyé"}, ` +
      `liste ${subscription.synced ? "alimentée" : `non alimentée (${subscription.reason})`}`,
  );

  return NextResponse.json(
    {
      sent: delivery.delivered,
      expiresAt: expiresAt.toISOString(),
      newsletter: { subscribed: subscription.synced },
    },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
