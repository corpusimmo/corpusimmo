/**
 * DVF entry point. Everything outside `src/lib/dvf` goes through here.
 *
 * Provider selection order:
 *   1. the demonstration dataset, only when `env.dvf.useMock` is true — which
 *      `config/env.ts` makes impossible in production;
 *   2. `env.dvf.provider` (`geodvf` by default).
 */

import { env } from "@/config/env";
import type { DvfProvider, DvfSourceId } from "@/types/dvf";
import { geoDvfProvider } from "./providers/geodvf";
import { ceremaProvider } from "./providers/cerema";
import { mockDvfProvider } from "./providers/mock";

export function getDvfProvider(): DvfProvider {
  if (env.dvf.useMock) return mockDvfProvider;
  return env.dvf.provider === "cerema" ? ceremaProvider : geoDvfProvider;
}

/** True when the served rows are fabricated and must be badged in the UI. */
export function isDemoData(source: DvfSourceId): boolean {
  return source === "mock";
}

export { computeMarketStats, median, MIN_STATISTICAL_SAMPLE } from "./aggregate";
export type { MarketStats } from "./aggregate";
export { coverageDisclaimer, coverageLabel, isPartialYear } from "./coverage";
export { DVF_DEFAULT_LIMIT, DVF_MAX_LIMIT, clampLimit, matchesFilters } from "./filters";
export { parseGeoDvfCsv, DvfParseError } from "./normalize";
export { geoDvfProvider, ceremaProvider, mockDvfProvider };
