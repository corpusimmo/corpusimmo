/**
 * `GET /api/dvf/transactions/[id]` → one normalised `DvfTransaction`.
 *
 * The response is strictly the `DvfTransaction` contract: no owner, no name,
 * no parcel identifier presented as a person. Décret n° 2018-1350 forbids
 * indirect re-identification as much as direct, so we neither enrich the row
 * with a third-party service nor let a search engine index it — see the
 * `X-Robots-Tag` in `_http.ts`.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDvfProvider } from "@/lib/dvf";
import { jsonError, jsonOk, toErrorResponse } from "../../_http";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Ids are `provider:commune:mutation` or `cerema:<id>@lat,lng`. Kept
 * deliberately narrow — this string is used to build an upstream URL.
 */
const idSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z]+:[A-Za-z0-9._@,:-]+$/u, "Identifiant de mutation invalide.");

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const parsed = idSchema.safeParse(decodeURIComponent(rawId));

  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Identifiant de mutation invalide.");
  }

  try {
    const transaction = await getDvfProvider().getTransactionById(parsed.data);
    if (!transaction) {
      return jsonError(404, "not_found", "Cette mutation n'est pas disponible.");
    }
    return jsonOk(transaction);
  } catch (error) {
    return toErrorResponse(error);
  }
}
