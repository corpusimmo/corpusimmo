/**
 * Test fixtures for the valuation engine.
 *
 * Not a mock dataset for the product — nothing here is ever rendered. It exists
 * so unit tests can build DVF rows and a fake provider without touching the
 * network, which is a hard requirement: an engine test that depends on Etalab
 * being up is not a test.
 */

import type {
  DvfBoundsQuery,
  DvfProvider,
  DvfRadiusQuery,
  DvfResult,
  DvfTransaction,
} from "@/types/dvf";
import type { PropertyDraft } from "@/types/property";
import { haversineMeters } from "@/lib/geo/distance";

/** Reference clock for every test, so ages never drift with the wall clock. */
export const TEST_NOW = new Date("2025-06-15T12:00:00.000Z");

/** Arbitrary point in Nantes; only the relative geometry matters. */
export const SUBJECT_POINT = { lat: 47.2184, lng: -1.5536 };

let sequence = 0;

/**
 * Builds a DVF row. Everything defaults to a plausible, *acceptable* comparable
 * so each test only has to state the one thing it is exercising.
 */
export function makeTransaction(overrides: Partial<DvfTransaction> = {}): DvfTransaction {
  sequence += 1;
  const base: DvfTransaction = {
    id: `mock:${sequence}`,
    date: "2024-09-10",
    year: 2024,
    nature: "sale",
    price: 300_000,
    propertyType: "apartment",
    builtArea: 70,
    rooms: 3,
    city: "Nantes",
    cityCode: "44109",
    departmentCode: "44",
    postcode: "44000",
    coordinates: { lat: SUBJECT_POINT.lat, lng: SUBJECT_POINT.lng },
    isMultiLot: false,
    source: "mock",
  };
  const merged = { ...base, ...overrides };
  // Keep the derived field coherent with whatever the test set.
  if (merged.pricePerSqm === undefined && merged.builtArea) {
    merged.pricePerSqm = Math.round(merged.price / merged.builtArea);
  }
  return merged;
}

/**
 * Offsets a point by roughly `meters` due east. Good enough for distance
 * ordering tests without hard-coding coordinates.
 */
export function pointAtMeters(meters: number): { lat: number; lng: number } {
  const metersPerDegreeLng = 111_320 * Math.cos((SUBJECT_POINT.lat * Math.PI) / 180);
  return { lat: SUBJECT_POINT.lat, lng: SUBJECT_POINT.lng + meters / metersPerDegreeLng };
}

export function makeSubject(overrides: Partial<PropertyDraft> = {}): PropertyDraft {
  return {
    type: "apartment",
    address: {
      id: "44109_1234_00008",
      label: "8 Rue de Test 44000 Nantes",
      kind: "housenumber",
      city: "Nantes",
      cityCode: "44109",
      departmentCode: "44",
      postcode: "44000",
      coordinates: SUBJECT_POINT,
      score: 0.95,
    },
    features: { livingArea: 70, rooms: 3 },
    ...overrides,
  };
}

export interface FakeProviderOptions {
  /** Rows returned per radius. A missing radius returns an empty result. */
  byRadius?: Record<number, DvfTransaction[]>;
  /** Rows returned whatever the radius, filtered by actual distance. */
  all?: DvfTransaction[];
  byId?: Record<string, DvfTransaction | null>;
  /** Throw instead of answering, to exercise the failure path. */
  fail?: Error;
}

export interface FakeProvider extends DvfProvider {
  /** Radii the engine actually asked for, in order. */
  readonly radiiQueried: number[];
}

/** Minimal in-memory `DvfProvider`. No network, no timers, fully deterministic. */
export function makeFakeProvider(options: FakeProviderOptions = {}): FakeProvider {
  const radiiQueried: number[] = [];

  const result = (transactions: DvfTransaction[]): DvfResult => ({
    transactions,
    count: transactions.length,
    truncated: false,
    source: "mock",
    communes: ["44109"],
    latestYear: transactions.reduce((acc, t) => Math.max(acc, t.year), 0) || undefined,
  });

  return {
    id: "mock",
    label: "Fake provider",
    radiiQueried,
    async getTransactionsNearPoint(query: DvfRadiusQuery): Promise<DvfResult> {
      if (options.fail) throw options.fail;
      radiiQueried.push(query.radius);
      if (options.byRadius) {
        return result(options.byRadius[query.radius] ?? []);
      }
      const rows = (options.all ?? []).filter(
        (t) => haversineMeters(query.center, t.coordinates) <= query.radius,
      );
      return result(rows);
    },
    async getTransactionsByBounds(_query: DvfBoundsQuery): Promise<DvfResult> {
      if (options.fail) throw options.fail;
      return result(options.all ?? []);
    },
    async getTransactionById(id: string): Promise<DvfTransaction | null> {
      if (options.fail) throw options.fail;
      if (options.byId) return options.byId[id] ?? null;
      return (options.all ?? []).find((t) => t.id === id) ?? null;
    },
  };
}
