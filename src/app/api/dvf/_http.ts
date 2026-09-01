/**
 * Shared response helpers for the DVF routes.
 *
 * `_http.ts` is not a route: App Router ignores files whose name starts with
 * an underscore.
 */

import { NextResponse } from "next/server";
import { DvfProviderError } from "@/types/dvf";
import { CommuneLookupError } from "@/lib/geo/communes";

export type ApiErrorCode =
  | "invalid_request"
  | "dvf_unavailable"
  | "geocoder_unavailable"
  | "not_found"
  | "internal_error";

/**
 * Décret n° 2018-1350 du 28/12/2018: DVF may not be indexed by search engines,
 * and detailed mutations must not enable indirect re-identification. Every DVF
 * response therefore carries an explicit `noindex`, in addition to the
 * `noindex` on the pages themselves.
 */
export const NOINDEX_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

/** §7 — mutations are immutable, so a long shared cache is safe and cheap. */
export const DVF_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function jsonOk<T>(body: T, extraHeaders?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    headers: { ...DVF_CACHE_HEADERS, ...NOINDEX_HEADERS, ...extraHeaders },
  });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      // Never let a shared cache retain an error page for an hour.
      headers: { "Cache-Control": "no-store", ...NOINDEX_HEADERS },
    },
  );
}

/** Maps a thrown provider/geo failure onto the documented error envelope. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof DvfProviderError) {
    // A 400 from the provider is a client-fixable problem (Cerema's bbox cap),
    // so it must not be dressed up as an outage.
    const status = error.status === 400 ? 400 : 502;
    return jsonError(
      status,
      status === 400 ? "invalid_request" : "dvf_unavailable",
      error.message,
    );
  }
  if (error instanceof CommuneLookupError) {
    return jsonError(502, "dvf_unavailable", error.message);
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return jsonError(408, "invalid_request", "Requête interrompue.");
  }
  return jsonError(
    500,
    "internal_error",
    "Une erreur inattendue est survenue lors de la lecture des données DVF.",
  );
}
