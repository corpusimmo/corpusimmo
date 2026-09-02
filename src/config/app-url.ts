/**
 * Resolution of the application's public origin.
 *
 * Why this exists rather than a one-line `??` fallback:
 *
 * Next.js INLINES `process.env.NEXT_PUBLIC_*` at build time. When the variable
 * is not defined, the reference is replaced by an EMPTY STRING, not by
 * `undefined` — so `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`
 * evaluates to `""` and `new URL("")` throws `ERR_INVALID_URL`. That is exactly
 * how a Vercel build fails at "Collecting page data" while a local build with
 * the variable simply unset succeeds.
 *
 * So: treat blank as missing, and fall back to the platform-provided origin so
 * a fresh deployment gets correct canonical, OpenGraph and sitemap URLs with
 * zero configuration.
 */

/**
 * Le domaine de production, écrit une fois.
 *
 * SANS `www`, ET CE N'EST PAS UN DÉTAIL. `www.corpus.immo` répond bien, mais
 * par une redirection 308 vers `corpus.immo` : c'est l'apex qui sert le site.
 * Une URL canonique, une entrée de plan de site ou un lien de partage qui
 * pointe vers la forme redirigée coûte une requête à chaque visite, dilue les
 * signaux de référencement entre deux adresses, et fait échouer une URI de
 * redirection OAuth déclarée sur l'autre forme.
 *
 * `NEXT_PUBLIC_APP_URL` et les variables de la plateforme restent prioritaires :
 * une préversion doit s'annoncer sous SON adresse, jamais sous celle-ci, sinon
 * elle se déclare canonique et se met en concurrence avec le site.
 */
export const PRODUCTION_URL = "https://corpus.immo";

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function withProtocol(host: string): string {
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

export function resolveAppUrl(): string {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return withProtocol(explicit).replace(/\/+$/, "");

  // Vercel exposes the host without a protocol. The production alias is
  // preferred over the per-deployment URL so preview builds do not advertise
  // themselves as canonical.
  const platformHost =
    clean(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ??
    clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    clean(process.env.NEXT_PUBLIC_VERCEL_URL) ??
    clean(process.env.VERCEL_URL);

  if (platformHost) return withProtocol(platformHost).replace(/\/+$/, "");

  // Hors plateforme et hors variable : le domaine de production en production,
  // localhost ailleurs. Sans cette ligne, un rendu de production fait hors
  // Vercel — une image sociale exportée, un PDF, une preuve d'impression —
  // affichait « localhost:3000 » et le publiait.
  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;

  return "http://localhost:3000";
}

/**
 * Never let a malformed value crash a build: metadata is not worth an outage.
 * Returns `undefined` so the caller can simply omit `metadataBase`.
 */
export function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[config] URL d'application invalide, ignorée : "${value}"`);
    }
    return undefined;
  }
}
