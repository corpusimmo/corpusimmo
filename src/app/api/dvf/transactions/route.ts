/**
 * `GET /api/dvf/transactions`
 *
 *   ?bbox=ouest,sud,est,nord         → mutations inside the viewport
 *   ?lat=&lng=&radius=               → mutations within a radius (metres)
 *
 * Filters: `types`, `yearMin`, `yearMax`, `priceMin`, `priceMax`, `areaMin`,
 * `areaMax`, `pricePerSqmMin`, `pricePerSqmMax`, `limit`.
 *
 * Everything is validated and re-clamped server-side. A provider failure is a
 * 502 with a truthful message — never an empty list that would read as "no
 * sales here".
 */

import type { NextRequest } from "next/server";
import { getDvfProvider } from "@/lib/dvf";
import {
  dvfQuerySchema,
  formatIssues,
  toBoundsQuery,
  toRadiusQuery,
} from "@/lib/dvf/query-schema";
import { jsonError, jsonOk, toErrorResponse } from "../_http";

export const runtime = "nodejs";
/** Multi-MB CSV downloads plus commune resolution: the default 15 s is tight. */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = dvfQuerySchema.safeParse(params);

  if (!parsed.success) {
    return jsonError(400, "invalid_request", formatIssues(parsed.error));
  }

  const provider = getDvfProvider();
  const bounds = toBoundsQuery(parsed.data);
  const radius = toRadiusQuery(parsed.data);

  try {
    // bbox wins when both are supplied: it is what the map actually shows.
    const result = bounds
      ? await provider.getTransactionsByBounds(bounds)
      : radius
        ? await provider.getTransactionsNearPoint(radius)
        : null;

    if (!result) {
      return jsonError(400, "invalid_request", "Requête incomplète.");
    }

    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
