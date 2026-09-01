/**
 * `POST /api/newsletter` — inscription à la lettre d'information.
 *
 * Séparée de `/api/leads`, et ce n'est pas de la duplication : ce sont deux
 * consentements différents, donnés à deux moments, pour deux finalités. Les
 * fondre reviendrait à inscrire à une liste de diffusion quelqu'un qui n'a
 * demandé qu'une estimation.
 *
 * L'accord est OBLIGATOIRE ici, et c'est la seule raison d'être du formulaire :
 * on ne demande pas une adresse « pour rester en contact » puis on décide
 * ensuite de ce qu'on en fait.
 *
 * CE QUI EST CONSERVÉ : une ligne dans le registre, finalité `marketing`,
 * origine `newsletter`, horodatée par Postgres. C'est elle qui se produit en
 * cas de réclamation ; l'audience du fournisseur d'e-mails est une liste de
 * diffusion, pas une preuve (voir `src/lib/email/contacts.ts`).
 *
 * POURQUOI AUCUN REFUS N'EST ÉCRIT ICI, alors que la règle est d'enregistrer
 * les refus. Une case décochée ne passe pas la validation : ce n'est pas une
 * personne qui décline une proposition, c'est un formulaire incomplet, et la
 * personne qui ne veut pas s'inscrire ne l'envoie tout simplement pas. Écrire
 * un refus depuis un corps de requête non validé permettrait surtout à
 * n'importe qui de fabriquer des lignes au nom de l'adresse de son choix. Les
 * vrais refus se recueillent là où la case coexiste avec une autre action :
 * `/api/leads` et `/api/outils/[slug]/acces`.
 *
 * DEUX CHAMPS DISTINCTS DANS LA RÉPONSE, parce que ce sont deux choses :
 * `subscribed` dit l'inscription à la liste de diffusion, `consent.recorded`
 * dit la preuve conservée. L'un peut réussir sans l'autre.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { maskEmail } from "@/lib/email";
import { newsletterListId, syncContact } from "@/lib/email/contacts";
import { saveConsents } from "@/lib/leads/persistence";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L'adresse e-mail est obligatoire.")
    .email("Adresse e-mail invalide."),
  firstName: z.string().trim().max(80).optional(),
  /**
   * `z.literal(true)` et non un booléen : une case décochée n'est pas une
   * valeur à interpréter, c'est un refus, et la requête doit échouer.
   */
  consent: z.literal(true, {
    message: "Vous devez accepter de recevoir la lettre d'information pour vous inscrire.",
  }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const limit = checkRateLimit(`newsletter:${clientKey(request)}`, {
    limit: 5,
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

  // Le registre d'abord : c'est la preuve, et elle doit exister même si le
  // fournisseur de liste est injoignable ensuite.
  const consentWrite = await saveConsents([{ purpose: "marketing", granted: true }], {
    source: "newsletter",
    email,
  });

  // La date de Postgres quand elle existe, celle du serveur sinon. Dans les
  // deux cas, jamais celle du navigateur : un horodatage fourni par le client
  // ne prouverait rien.
  const collectedAt = (consentWrite.recorded ? consentWrite.collectedAt : new Date()).toISOString();

  const outcome = await syncContact(
    {
      email: input.email,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      source: "newsletter",
      consents: {
        marketing: true,
        professionalContact: false,
        collectedAt,
      },
    },
    newsletterListId(),
  );

  console.info(
    `[api/newsletter] inscription pour ${maskEmail(email)}, ` +
      (outcome.synced
        ? `liste ${outcome.created ? "créée" : "mise à jour"}`
        : `non synchronisée (${outcome.reason})`) +
      ", consentement " +
      (consentWrite.recorded ? "enregistré" : `non enregistré (${consentWrite.reason})`),
  );

  // Toujours 202, y compris quand la liste n'est pas configurée : du point de
  // vue de la personne, sa demande est prise. Ce qui manque est de notre côté,
  // et `synced` le dit sans le lui faire porter. `consent.recorded` dit la même
  // chose du registre, sans jamais affirmer une conservation qui n'a pas eu
  // lieu.
  return NextResponse.json(
    {
      subscribed: outcome.synced,
      consent: { purpose: "marketing", granted: true, recorded: consentWrite.recorded },
      collectedAt,
    },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
