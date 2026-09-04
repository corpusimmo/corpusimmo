/**
 * `POST /api/outils/[slug]/acces` : la porte d'un outil.
 *
 * L'ADRESSE N'EST PLUS DANS LE CORPS DE LA REQUÊTE. Elle est lue dans la
 * session vérifiée par Google, côté serveur. Une adresse postée par le client
 * serait une déclaration que rien ne prouve, et il suffirait d'en changer à
 * chaque appel pour se donner autant d'accès qu'on veut.
 *
 * Un déblocage, dans la limite de deux par semaine glissante. Le consentement à
 * la lettre d'information est STRICTEMENT à part : demander un outil n'a jamais
 * valu accord pour recevoir autre chose.
 *
 * LA CASE DÉCOCHÉE EST UN REFUS, ET LE REFUS S'ENREGISTRE. C'est la différence
 * entre ce registre et une liste de diffusion : la liste ne retient que les
 * oui, le registre retient la DÉCISION. Une ligne `granted: false` datée sert
 * deux fois, pour prouver qu'on n'a pas inscrit quelqu'un qui n'avait rien
 * demandé, et pour ne pas lui reposer la question indéfiniment.
 *
 * Le consentement n'est écrit que si l'on sait DE QUI il émane (adresse
 * vérifiée ou compte) : une ligne sans sujet ne se rattacherait à personne et
 * ne prouverait rien.
 *
 * Sans authentification configurée sur l'installation, la session n'existe pas
 * et la route reste ouverte : le dépôt doit démarrer avec un `.env` vide.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { leadsListId, syncContact } from "@/lib/email/contacts";
import { grantAccess } from "@/lib/access/ledger";
// Plus de session : l'accès se décide sur le seul quota du navigateur.
import { accountId, saveConsents } from "@/lib/leads/persistence";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";
import { getToolCard } from "@/data/tools-catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
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

  /* L'AUTHENTIFICATION EST RETIRÉE. Le débit d'un crédit ne se refuse donc
     plus faute de session : il ne dépend que du quota du navigateur. L'adresse
     saisie dans le formulaire reste la seule source, comme elle l'était déjà
     pour un visiteur anonyme. */
  if (false) {
    return NextResponse.json(
      {
        error: {
          code: "unauthenticated",
          message: "Connectez-vous pour ouvrir cet outil.",
        },
      },
      { status: 401, headers: { "cache-control": "no-store" } },
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
  /* Sans session, cette route n'a AUCUNE adresse à sa disposition : le corps
     de la requête ne porte que le consentement à la lettre d'information.
     `null` est donc la réponse honnête, et la synchronisation de contact plus
     bas se contente de ne rien faire. */
  const email: string | null = null;
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

  /**
   * LA DÉCISION EST ENREGISTRÉE DANS LES DEUX SENS, cochée comme décochée. Ce
   * n'est pas l'inscription à la liste : c'est la trace de ce que la personne a
   * répondu à la question qu'on lui a posée, sur cette page, ce jour-là. Sans
   * identité (installation sans authentification), il n'y a personne à qui
   * rattacher la ligne et on n'écrit rien.
   */
  const userId = await accountId();
  const consentWrite =
    email || userId
      ? await saveConsents([{ purpose: "marketing", granted: input.newsletter }], {
          source: `outil:${slug}`,
          email,
          userId,
        })
      : ({ recorded: false, reason: "empty" } as const);

  // Le contact n'est inscrit à la liste QUE si la case a été cochée, et QUE si
  // une adresse vérifiée existe. `syncContact` refuse d'ailleurs sans
  // `marketing: true`.
  const subscription =
    email && input.newsletter
      ? await syncContact(
          {
            email,
            source: `outil:${slug}`,
            consents: {
              marketing: true,
              professionalContact: false,
              // Posé par le serveur, comme la ligne du registre : la date qui
              // voyage avec le contact ne vient jamais du navigateur.
              collectedAt: (consentWrite.recorded
                ? consentWrite.collectedAt
                : new Date()
              ).toISOString(),
            },
          },
          leadsListId(),
        )
      : { synced: false as const };

  console.info(
    `[api/outils] « ${slug} » ${outcome.alreadyOwned ? "déjà ouvert" : "débloqué"} pour ` +
      `visiteur anonyme, ` +
      `${outcome.quota.remaining} crédit(s) restant(s), ` +
      `lettre d'information ${input.newsletter ? "acceptée" : "refusée"} ` +
      `(${consentWrite.recorded ? "consentement enregistré" : `non enregistré : ${consentWrite.reason}`})`,
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
      newsletter: {
        subscribed: subscription.synced,
        /** Le choix, tel qu'il a été fait. */
        granted: input.newsletter,
        /** Vrai seulement si la ligne existe vraiment dans le registre. */
        consentRecorded: consentWrite.recorded,
      },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
