/**
 * `POST /api/leads` — le seul endroit où un contact personnel entre dans le
 * système.
 *
 * RÈGLES DE CONSENTEMENT, appliquées ici et pas seulement documentées :
 *  - `estimationDelivery` est OBLIGATOIRE. Le refuser, c'est refuser le
 *    service : la requête est rejetée avec un message explicite.
 *  - `professionalContact` et `marketing` sont OPTIONNELS et valent FAUX par
 *    défaut. Le serveur ne les déduit jamais, ne les force jamais à vrai, et ne
 *    dérive jamais l'un de l'autre. Un champ absent est un refus.
 *  - Les deux sont horodatés une fois, côté serveur, dans `collectedAt`. Un
 *    horodatage fourni par le client ne prouverait rien.
 *
 * RÈGLE DE JOURNALISATION : l'adresse e-mail n'apparaît jamais en clair dans un
 * journal applicatif. Tout ce qui s'imprime passe par `maskEmail`.
 *
 * CE QUE CETTE VERSION NE FAIT PAS ENCORE
 *   Rien n'est persisté : le lead est scoré, l'e-mail part, et la requête
 *   répond `202 Accepted`. Conséquence assumée sur le score — la bande
 *   « valeur estimée du bien » n'est PAS comptée, parce que la valeur nous
 *   arrive du client et qu'un client peut se déclarer propriétaire d'une villa
 *   à 2 M€ pour gonfler sa propre note. Les quatre autres bandes portent sur ce
 *   que le client déclare légitimement sur lui-même. La bande valeur revient le
 *   jour où une estimation est relue depuis le stockage, pas depuis le corps de
 *   la requête.
 *
 * Accepte du JSON et de l'`application/x-www-form-urlencoded` /
 * `multipart/form-data`, pour qu'un formulaire fonctionne sans JavaScript.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { getMailer, maskEmail, renderEstimationReadyEmail } from "@/lib/email";
import { leadsListId, syncContact } from "@/lib/email/contacts";
import type { EmailProvider } from "@/lib/email";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";
import { leadTemperature, scoreLead } from "@/lib/leads/score";
import type { ProjectIntent, PropertyType } from "@/types/property";
import type { ValuationResult } from "@/types/valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROPERTY_TYPES = [
  "apartment",
  "house",
  "land",
  "building",
  "parking",
  "retail",
  "office",
  "business_premises",
  "other",
] as const satisfies readonly PropertyType[];

const PROJECT_INTENTS = [
  "curiosity",
  "buying",
  "selling_considering",
  "selling_under_3m",
  "selling_under_6m",
  "inheritance",
  "investment",
  "other",
] as const satisfies readonly ProjectIntent[];

/**
 * Un formulaire envoie `"on"` pour une case cochée et RIEN pour une case
 * décochée — l'absence est le refus, ce qui est exactement la sémantique
 * voulue.
 */
const optionalConsent = z
  .union([z.boolean(), z.enum(["true", "false", "on", "off", "1", "0", ""])])
  .optional()
  .transform((value) => value === true || value === "true" || value === "on" || value === "1");

const bodySchema = z.object({
  contact: z.object({
    firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(80),
    lastName: z.string().trim().max(80).optional(),
    email: z
      .string()
      .trim()
      .min(1, "L'adresse e-mail est obligatoire.")
      .email("Adresse e-mail invalide."),
    phone: z.string().trim().max(30).optional(),
  }),
  consents: z.object({
    estimationDelivery: z.literal(true, {
      message:
        "Vous devez accepter de recevoir votre estimation pour que nous puissions vous l'envoyer.",
    }),
    professionalContact: optionalConsent,
    marketing: optionalConsent,
  }),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  intent: z.enum(PROJECT_INTENTS).optional(),
  city: z.string().trim().max(120).optional(),
  cityCode: z.string().trim().max(10).optional(),
  postcode: z.string().trim().max(10).optional(),
  livingArea: z.coerce.number().positive().max(100_000).optional(),
});

/** Clés imbriquées dans un corps de formulaire plat : `contact.email`. */
function expandFormData(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const path = key.split(".");
    let node = out;
    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = path[i] ?? "";
      const next = node[segment];
      if (typeof next !== "object" || next === null) node[segment] = {};
      node = node[segment] as Record<string, unknown>;
    }
    const leaf = path[path.length - 1] ?? key;
    node[leaf] = value;
  }
  return out;
}

async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    return expandFormData(await request.formData());
  }
  return request.json();
}

/**
 * L'estimation telle que le client vient de la recevoir de `/api/estimation`.
 *
 * Elle sert UNIQUEMENT à composer l'e-mail, jamais à noter le lead : on lit
 * donc la forme sans la valider champ par champ, et un objet mal formé fait
 * simplement partir la requête sans e-mail plutôt que de la faire échouer.
 */
function readValuation(raw: unknown): ValuationResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Partial<ValuationResult>;
  if (typeof candidate.id !== "string") return null;
  if (typeof candidate.subject !== "object" || candidate.subject === null) return null;
  if (typeof candidate.diagnostics !== "object" || candidate.diagnostics === null) return null;
  if (typeof candidate.confidence !== "object" || candidate.confidence === null) return null;
  return candidate as ValuationResult;
}

export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`leads:${clientKey(request)}`, {
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
    raw = await readBody(request);
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
  const valuation = readValuation((raw as { valuation?: unknown })?.valuation);

  const collectedAt = new Date().toISOString();
  const consents = {
    estimationDelivery: true as const,
    professionalContact: input.consents.professionalContact,
    marketing: input.consents.marketing,
    collectedAt,
  };

  const intent: ProjectIntent = valuation?.intent ?? input.intent ?? "curiosity";

  const { score, breakdown } = scoreLead({
    intent,
    consents,
    contact: { phone: input.contact.phone, lastName: input.contact.lastName },
    features: valuation?.subject.features,
    // Volontairement absent : voir la note en tête de fichier.
    estimatedValue: undefined,
    createdAt: collectedAt,
  });

  const delivery = await deliverEstimationEmail(
    input.contact.firstName,
    input.contact.email.toLowerCase(),
    valuation,
  );

  // La liste marketing n'est alimentée QUE si la case correspondante a été
  // cochée. Recevoir son estimation n'a jamais valu accord pour recevoir autre
  // chose, et `syncContact` refuse d'ailleurs sans `marketing: true`.
  const subscription = await syncContact(
    {
      email: input.contact.email,
      firstName: input.contact.firstName,
      ...(input.contact.lastName ? { lastName: input.contact.lastName } : {}),
      source: "estimation",
      consents: {
        marketing: consents.marketing,
        professionalContact: consents.professionalContact,
        collectedAt,
      },
      ...(valuation?.subject.address.city ? { city: valuation.subject.address.city } : {}),
      ...(input.propertyType ? { propertyType: input.propertyType } : {}),
    },
    leadsListId(),
  );

  console.info(
    `[api/leads] lead reçu (score ${score}, ${leadTemperature(score)}, sans persistance) ` +
      `pour ${maskEmail(input.contact.email.toLowerCase())} — ` +
      `e-mail ${delivery.delivered ? "envoyé" : "non envoyé"}`,
  );

  // 202 et non 201 : rien n'a été créé côté serveur. Mentir sur le code de
  // statut coûterait le jour où un client s'y fiera pour rejouer une requête.
  return NextResponse.json(
    {
      lead: {
        score,
        temperature: leadTemperature(score),
        breakdown,
        collectedAt,
      },
      email: { delivered: delivery.delivered, provider: delivery.provider },
      newsletter: { subscribed: subscription.synced },
      persistence: "none" as const,
    },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Envoie l'e-mail « estimation prête ». Ne lève JAMAIS et ne change jamais le
 * code de réponse : un incident de relais ne doit pas coûter un contact.
 */
async function deliverEstimationEmail(
  firstName: string,
  to: string,
  valuation: ValuationResult | null,
): Promise<{ delivered: boolean; provider: EmailProvider }> {
  const mailer = getMailer();
  if (!valuation) return { delivered: false, provider: mailer.provider };

  try {
    const template = renderEstimationReadyEmail({
      valuation,
      firstName,
      estimationUrl: `${env.appUrl.replace(/\/$/, "")}/estimer`,
    });
    const result = await mailer.send({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
    return { delivered: result.delivered, provider: mailer.provider };
  } catch (error) {
    console.error("[api/leads] envoi de l'e-mail impossible", error);
    return { delivered: false, provider: mailer.provider };
  }
}
