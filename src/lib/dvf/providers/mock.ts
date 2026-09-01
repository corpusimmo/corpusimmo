/**
 * Demonstration dataset — FICTIONAL, development only.
 *
 * Reachable only through `env.dvf.useMock`, which `src/config/env.ts` forces to
 * `false` in production: even `USE_MOCK_DVF=true` on the hosting platform
 * cannot make the product serve invented prices to a user.
 *
 * It exists so the map, the filters and the wizard can be worked on offline or
 * when files.data.gouv.fr is down. Every row carries `source: "mock"` so the UI
 * can badge it — a fabricated price must never look like a recorded sale.
 *
 * The generator is seeded: the same 120 mutations come out on every process,
 * which keeps screenshots, tests and design reviews comparable.
 */

import type {
  DvfBoundsQuery,
  DvfMutationNature,
  DvfPropertyType,
  DvfProvider,
  DvfRadiusQuery,
  DvfResult,
  DvfTransaction,
} from "@/types/dvf";
import { destinationPoint } from "@/lib/geo/distance";
import { inBBox, selectRows, withinRadius } from "../filters";

/** Place Royale, Nantes — the demo anchor. */
const CENTER = { lat: 47.2131, lng: -1.5586 };
const MUTATION_COUNT = 120;

const STREETS = [
  "Rue Crébillon",
  "Rue de Strasbourg",
  "Boulevard Guist'hau",
  "Rue du Calvaire",
  "Quai de la Fosse",
  "Rue Paul Bellamy",
  "Rue de la Bastille",
  "Avenue Camus",
  "Rue des Hauts Pavés",
  "Boulevard des Poilus",
  "Rue Sainte-Catherine",
  "Rue du Maréchal Joffre",
] as const;

interface Blueprint {
  type: DvfPropertyType;
  /** Share of the dataset. */
  weight: number;
  areaRange: [number, number];
  /** €/m² band used to derive the price — fictional, plausible for Nantes. */
  unitRange: [number, number];
  roomsPerSqm: number;
}

const BLUEPRINTS: Blueprint[] = [
  { type: "apartment", weight: 0.62, areaRange: [22, 118], unitRange: [2850, 4600], roomsPerSqm: 1 / 26 },
  { type: "house", weight: 0.24, areaRange: [65, 190], unitRange: [3200, 5200], roomsPerSqm: 1 / 28 },
  { type: "commercial", weight: 0.07, areaRange: [40, 320], unitRange: [1500, 3400], roomsPerSqm: 0 },
  { type: "land", weight: 0.04, areaRange: [0, 0], unitRange: [0, 0], roomsPerSqm: 0 },
  { type: "dependency", weight: 0.03, areaRange: [0, 0], unitRange: [0, 0], roomsPerSqm: 0 },
];

/** Deterministic PRNG (mulberry32) — no dependency, stable across runtimes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached: DvfTransaction[] | undefined;

export function getMockTransactions(): DvfTransaction[] {
  if (!cached) cached = buildDataset();
  return cached;
}

function buildDataset(): DvfTransaction[] {
  const random = mulberry32(0x5a10_2024);
  const rows: DvfTransaction[] = [];
  const latestYear = new Date().getUTCFullYear() - 1;

  for (let i = 0; i < MUTATION_COUNT; i += 1) {
    const blueprint = pickBlueprint(random());
    const bearing = random() * 360;
    // sqrt keeps the points uniform over the disc instead of clumping at the centre.
    const distance = Math.sqrt(random()) * 1400;
    const point = destinationPoint(CENTER, distance, bearing);

    const year = latestYear - Math.floor(random() * 4);
    const month = 1 + Math.floor(random() * 12);
    const day = 1 + Math.floor(random() * 28);
    const date = `${year}-${pad(month)}-${pad(day)}`;

    const isMultiLot = random() < 0.08;
    const street = STREETS[Math.floor(random() * STREETS.length)] ?? STREETS[0];
    const number = 1 + Math.floor(random() * 120);

    const built =
      blueprint.areaRange[1] > 0
        ? Math.round(lerp(blueprint.areaRange[0], blueprint.areaRange[1], random()))
        : undefined;
    const unit =
      blueprint.unitRange[1] > 0
        ? lerp(blueprint.unitRange[0], blueprint.unitRange[1], random())
        : undefined;

    let price: number;
    if (built !== undefined && unit !== undefined) {
      price = roundTo(built * unit, 1000);
    } else if (blueprint.type === "land") {
      price = roundTo(lerp(45_000, 220_000, random()), 1000);
    } else {
      price = roundTo(lerp(9_000, 42_000, random()), 500);
    }

    const landArea =
      blueprint.type === "house"
        ? Math.round(lerp(120, 900, random()))
        : blueprint.type === "land"
          ? Math.round(lerp(240, 1600, random()))
          : undefined;

    rows.push({
      id: `mock:44109:${year}-${String(100000 + i)}`,
      date,
      year,
      nature: pickNature(random()),
      price,
      propertyType: blueprint.type,
      propertyTypeLabel: LABELS[blueprint.type],
      builtArea: built,
      landArea,
      rooms:
        built !== undefined && blueprint.roomsPerSqm > 0
          ? Math.max(1, Math.round(built * blueprint.roomsPerSqm))
          : undefined,
      addressLabel: `${number} ${street}`,
      postcode: "44000",
      city: "Nantes",
      cityCode: "44109",
      departmentCode: "44",
      coordinates: point,
      pricePerSqm: built && built > 0 ? Math.round(price / built) : undefined,
      isMultiLot,
      lotCount: isMultiLot ? 2 + Math.floor(random() * 2) : 1,
      source: "mock",
    });
  }

  return rows;
}

const LABELS: Record<DvfPropertyType, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  dependency: "Dépendance",
  other: "Autre",
};

export const mockDvfProvider: DvfProvider = {
  id: "mock",
  label: "Jeu de démonstration (données fictives)",

  async getTransactionsByBounds(query: DvfBoundsQuery): Promise<DvfResult> {
    return toResult(selectRows(getMockTransactions(), query, inBBox(query.bbox)));
  },

  async getTransactionsNearPoint(query: DvfRadiusQuery): Promise<DvfResult> {
    return toResult(
      selectRows(getMockTransactions(), query, withinRadius(query.center, query.radius)),
    );
  },

  async getTransactionById(id: string): Promise<DvfTransaction | null> {
    return getMockTransactions().find((row) => row.id === id) ?? null;
  },
};

function toResult(selection: { rows: DvfTransaction[]; truncated: boolean }): DvfResult {
  let latestYear: number | undefined;
  for (const row of getMockTransactions()) {
    if (latestYear === undefined || row.year > latestYear) latestYear = row.year;
  }
  return {
    transactions: selection.rows,
    count: selection.rows.length,
    truncated: selection.truncated,
    source: "mock",
    communes: ["Nantes"],
    latestYear,
  };
}

function pickBlueprint(r: number): Blueprint {
  let acc = 0;
  for (const blueprint of BLUEPRINTS) {
    acc += blueprint.weight;
    if (r <= acc) return blueprint;
  }
  return BLUEPRINTS[0] as Blueprint;
}

function pickNature(r: number): DvfMutationNature {
  if (r < 0.88) return "sale";
  if (r < 0.96) return "sale_off_plan";
  if (r < 0.99) return "sale_land_to_build";
  return "auction";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
