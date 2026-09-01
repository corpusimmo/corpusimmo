/**
 * `POST /api/consentement` : le dépôt de la preuve du choix cookies.
 *
 * POURQUOI CETTE ROUTE EXISTE. Le bandeau décide déjà tout seul, côté
 * navigateur, et rien n'est chargé tant que la réponse n'est pas donnée : le
 * respect du choix ne dépend pas de cet appel. Ce qui manquait est la PREUVE.
 * `src/lib/consent/consent.ts` le dit lui-même : le choix vit dans
 * `localStorage`, donc dans un seul navigateur, donc nulle part le jour où il
 * faut le produire. Cette route est le seul endroit où ce choix devient une
 * ligne datée par Postgres.
 *
 * ELLE N'ACCEPTE AUCUNE ADRESSE, et c'est délibéré à double titre. Le bandeau
 * n'en demande pas, et une route publique qui accepterait une adresse
 * permettrait à n'importe qui de fabriquer un « accord » au nom de n'importe
 * qui. L'identité, quand elle existe, est lue dans la session côté serveur, pas
 * dans le corps de la requête.
 *
 * ELLE N'ACCEPTE QUE LA FINALITÉ `analytics`, pour la même raison. Les trois
 * autres finalités se recueillent dans un formulaire où la personne donne aussi
 * son adresse (`/api/leads`, `/api/newsletter`, `/api/outils/[slug]/acces`) :
 * les ouvrir ici reviendrait à offrir un guichet d'écriture libre sur le
 * registre.
 *
 * L'HORODATAGE EST POSÉ PAR POSTGRES. Un `collectedAt` glissé dans le corps est
 * ignoré, il n'est lu nulle part : une date fournie par le navigateur ne
 * prouverait rien, et c'est précisément une preuve qu'on constitue ici.
 *
 * UN REFUS S'ENREGISTRE COMME UN ACCORD. `granted: false` est une ligne, pas un
 * silence. Sans elle, on ne pourrait pas montrer qu'on a demandé et respecté un
 * non.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { accountId, saveConsents } from "@/lib/leads/persistence";
import { checkRateLimit, clientKey } from "@/lib/leads/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

const bodySchema = z.object({
  /**
   * Le choix de mesure d'audience : vrai pour un accord, faux pour un refus.
   * Un booléen strict, jamais une chaîne : ici il n'y a pas de formulaire sans
   * JavaScript à ménager, l'appel vient du bandeau.
   */
  analytics: z.boolean({ message: "Le choix de mesure d'audience est obligatoire." }),
  /**
   * D'où vient le choix. Deux valeurs seulement : ce champ sert à savoir ce
   * qu'on montrait à la personne, il n'a donc de sens que fermé.
   */
  source: z.enum(["bandeau-cookies", "page-cookies"]).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  /**
   * Une limite haute, volontairement. Trop basse, elle ferait perdre la preuve
   * de vrais visiteurs partageant une sortie réseau (entreprise, opérateur
   * mobile), ce qui est plus grave que quelques lignes de trop.
   */
  const limit = checkRateLimit(`consentement:${clientKey(request)}`, {
    limit: 30,
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
      { status: 429, headers: { ...NO_STORE, "retry-after": String(limit.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Requête illisible." } },
      { status: 400, headers: NO_STORE },
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
      { status: 400, headers: NO_STORE },
    );
  }

  const input = parsed.data;

  // Le compte quand il y en a un : il rend le registre lisible depuis l'espace
  // personnel. Sans compte, la ligne reste anonyme, ce que le schéma prévoit
  // (le bandeau ne réclame aucune adresse, surtout pas pour un refus).
  const userId = await accountId();

  const outcome = await saveConsents([{ purpose: "analytics", granted: input.analytics }], {
    source: input.source ?? "bandeau-cookies",
    userId,
  });

  console.info(
    `[api/consentement] mesure d'audience ${input.analytics ? "acceptée" : "refusée"} ` +
      `par ${userId ? "un compte" : "un visiteur anonyme"}, ` +
      (outcome.recorded ? "enregistrée" : `non enregistrée (${outcome.reason})`),
  );

  // 201 seulement quand la ligne existe. Sinon 202 : la décision est reçue et
  // déjà appliquée côté navigateur, mais rien n'a été conservé, et la réponse
  // ne prétend pas le contraire.
  return NextResponse.json(
    {
      consent: {
        purpose: "analytics" as const,
        granted: input.analytics,
        recorded: outcome.recorded,
        /**
         * La date de Postgres, ou `null`. Jamais une date de repli : elle
         * ressemblerait à une preuve, alors que rien n'a été écrit.
         */
        collectedAt: outcome.recorded ? outcome.collectedAt.toISOString() : null,
      },
    },
    { status: outcome.recorded ? 201 : 202, headers: NO_STORE },
  );
}
