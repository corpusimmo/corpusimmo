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
 * CE QUI EST DÉSORMAIS CONSERVÉ
 *   Trois lignes de consentement (livraison, contact professionnel, lettre
 *   d'information), la fiche de contact dédupliquée par adresse, et la demande
 *   elle-même. Les refus s'écrivent comme les accords : `granted` vaut faux, la
 *   ligne existe, et c'est ce qui permet de prouver qu'on a demandé et essuyé
 *   un non.
 *
 * LE CODE DE STATUT DIT LA VÉRITÉ, ET RIEN QUE CE QU'ON PEUT TENIR
 *   201 quand la demande a VRAIMENT été créée en base, 202 sinon (pas de base
 *   configurée, ou base en panne). Dans les deux cas le champ `persistence` dit
 *   ce qui a été gardé. Répondre 201 sans ligne écrite coûterait le jour où un
 *   client s'y fiera pour ne pas rejouer sa requête, et surtout ce serait un
 *   mensonge sur une preuve, ce qui est le seul mensonge que ce produit ne
 *   puisse pas se permettre.
 *
 * UNE BASE EN PANNE NE COÛTE RIEN À LA PERSONNE : l'estimation part quand même,
 * le score est rendu quand même, et seul `persistence` change. Un formulaire
 * qui échoue parce que la base tousse serait une régression, pas une sécurité.
 *
 * LA BANDE « VALEUR » DU SCORE est comptée uniquement quand l'estimation a pu
 * être RELUE en base. Voir `scoreLead` et le commentaire à l'endroit du calcul.
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
import {
  accountId,
  saveConsents,
  saveLead,
  verifiedEstimation,
  type ConsentDecision,
} from "@/lib/leads/persistence";
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
  const email = input.contact.email.toLowerCase();

  /**
   * Le compte, s'il y en a un. Il rattache la fiche de contact et le registre à
   * une personne identifiée, et c'est lui qui autorise la relecture d'une
   * estimation : on ne relit que les siennes.
   */
  const userId = await accountId();

  /**
   * L'ESTIMATION RELUE DEPUIS LA BASE, seule source admise pour la valeur.
   *
   * Le corps de la requête porte bien une valeur (`valuation.value`), et elle
   * n'est PAS utilisée : elle est déclarative, donc gonflable à volonté. Relue
   * ici, la fourchette est celle que notre moteur a produite à partir des
   * ventes DVF. Cela ne rend pas le chiffre infalsifiable (les caractéristiques
   * du bien restent déclarées par la personne), mais il devient un nombre que
   * nous avons CALCULÉ, cohérent avec la surface et la commune annoncées, au
   * lieu d'un nombre écrit à la main dans un `fetch`.
   *
   * `null` quand la personne n'est pas connectée, quand la base est absente, ou
   * quand l'estimation n'a pas été enregistrée : la bande vaut alors zéro.
   */
  const estimation = userId && valuation?.id ? await verifiedEstimation(valuation.id, userId) : null;

  /**
   * Trois décisions, trois lignes. La livraison est nécessairement accordée
   * (zod l'exige), les deux autres portent la réponse telle quelle : une case
   * décochée s'écrit `granted: false`, elle ne disparaît pas.
   */
  const decisions: ConsentDecision[] = [
    { purpose: "estimation_delivery", granted: true },
    { purpose: "professional_contact", granted: input.consents.professionalContact },
    { purpose: "marketing", granted: input.consents.marketing },
  ];
  const consentWrite = await saveConsents(decisions, { source: "estimation", email, userId });

  /**
   * L'HORODATAGE VIENT DU SERVEUR, dans les deux branches : de Postgres quand
   * le registre a écrit (c'est la date qui fait preuve), du processus qui
   * traite la requête sinon. Jamais du corps de la requête, où il ne prouverait
   * rien.
   */
  const collectedAt = (consentWrite.recorded ? consentWrite.collectedAt : new Date()).toISOString();

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
    // La bande « valeur » ne compte que si l'estimation vient de NOTRE base.
    // Absente ici, c'est zéro point, jamais un point de confiance.
    verifiedValue: estimation?.value?.central,
    createdAt: collectedAt,
  });

  /**
   * La demande elle-même. La fourchette recopiée dans la fiche suit la même
   * règle que le score : elle vient de la base ou elle reste vide, sans quoi la
   * place de marché afficherait un prix que personne n'a calculé.
   */
  const leadWrite = await saveLead({
    contact: {
      email,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
      phone: input.contact.phone,
      userId,
    },
    source: "estimation",
    // NOTRE identifiant de ligne, jamais celui du moteur : la colonne est une
    // clé étrangère.
    estimationId: estimation?.estimationId ?? null,
    propertyType: input.propertyType,
    city: valuation?.subject.address.city ?? input.city,
    cityCode: valuation?.subject.address.cityCode ?? input.cityCode,
    postcode: valuation?.subject.address.postcode ?? input.postcode,
    livingArea: input.livingArea ?? valuation?.subject.features.livingArea,
    intent,
    estimatedLow: estimation?.value?.low,
    estimatedHigh: estimation?.value?.high,
    score,
    scoreBreakdown: breakdown,
  });

  const delivery = await deliverEstimationEmail(input.contact.firstName, email, valuation);

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

  /**
   * `stored` : la demande ET le registre sont en base.
   * `partial` : l'un des deux seulement, ce qui arrive si la base tombe entre
   *             les deux écritures (le pilote HTTP de Neon ne fait pas de
   *             transaction, voir `src/lib/db/client.ts`).
   * `none` : rien n'a été gardé, exactement comme avant la base.
   */
  const persistence: "stored" | "partial" | "none" =
    leadWrite.stored && consentWrite.recorded
      ? "stored"
      : leadWrite.stored || consentWrite.recorded
        ? "partial"
        : "none";

  console.info(
    `[api/leads] lead reçu (score ${score}, ${leadTemperature(score)}) ` +
      `pour ${maskEmail(email)}, ` +
      `demande ${leadWrite.stored ? "enregistrée" : `non enregistrée (${leadWrite.reason})`}, ` +
      `consentements ${
        consentWrite.recorded
          ? `enregistrés (${consentWrite.count})`
          : `non enregistrés (${consentWrite.reason})`
      }, e-mail ${delivery.delivered ? "envoyé" : "non envoyé"}`,
  );

  // 201 seulement si la demande existe vraiment quelque part. Sinon 202, comme
  // avant : la requête est reçue et traitée, rien n'est conservé.
  return NextResponse.json(
    {
      lead: {
        ...(leadWrite.stored ? { id: leadWrite.leadId } : {}),
        score,
        temperature: leadTemperature(score),
        breakdown,
        collectedAt,
      },
      email: { delivered: delivery.delivered, provider: delivery.provider },
      newsletter: { subscribed: subscription.synced },
      consents: {
        recorded: consentWrite.recorded,
        ...(consentWrite.recorded ? { count: consentWrite.count } : {}),
      },
      persistence,
    },
    { status: leadWrite.stored ? 201 : 202, headers: { "cache-control": "no-store" } },
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
