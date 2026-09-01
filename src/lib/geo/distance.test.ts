import { describe, expect, it } from "vitest";
import {
  bboxArea,
  bboxAround,
  bboxCenter,
  bboxContains,
  bboxExpand,
  bboxIntersects,
  bboxMaxSpanMeters,
  destinationPoint,
  geodesicCircleRing,
  haversineMeters,
} from "./distance";
import type { LatLng } from "@/types/geo";

const NANTES: LatLng = { lat: 47.2184, lng: -1.5536 };
const PARIS: LatLng = { lat: 48.8566, lng: 2.3522 };
const BORDEAUX: LatLng = { lat: 44.8378, lng: -0.5792 };

describe("haversineMeters", () => {
  it("is zero for a point against itself", () => {
    expect(haversineMeters(NANTES, NANTES)).toBe(0);
  });

  it("matches known intercity distances within 0,5 %", () => {
    // Reference great-circle distances (source: geodesic computation on WGS84).
    expect(haversineMeters(NANTES, PARIS)).toBeCloseTo(342_600, -3);
    expect(haversineMeters(NANTES, BORDEAUX)).toBeCloseTo(275_200, -3);
  });

  it("gives one degree of latitude ≈ 111,2 km anywhere", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
    const north = haversineMeters({ lat: 60, lng: 12 }, { lat: 61, lng: 12 });
    expect(north).toBeCloseTo(d, -2);
  });

  it("shrinks longitude with latitude", () => {
    const equator = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const nantesLat = haversineMeters({ lat: 47.2184, lng: 0 }, { lat: 47.2184, lng: 1 });
    // cos(47.2184°) ≈ 0.679
    expect(nantesLat / equator).toBeCloseTo(Math.cos((47.2184 * Math.PI) / 180), 3);
  });

  it("is symmetric", () => {
    expect(haversineMeters(PARIS, BORDEAUX)).toBeCloseTo(haversineMeters(BORDEAUX, PARIS), 6);
  });
});

describe("bboxAround", () => {
  it("returns [west, south, east, north] centred on the point", () => {
    const bbox = bboxAround(NANTES, 1000);
    expect(bbox[0]).toBeLessThan(NANTES.lng);
    expect(bbox[2]).toBeGreaterThan(NANTES.lng);
    expect(bbox[1]).toBeLessThan(NANTES.lat);
    expect(bbox[3]).toBeGreaterThan(NANTES.lat);
    expect(bboxCenter(bbox).lat).toBeCloseTo(NANTES.lat, 9);
    expect(bboxCenter(bbox).lng).toBeCloseTo(NANTES.lng, 9);
  });

  it("stays tight: never more than 1 % larger than the radius it covers", () => {
    const radius = 800;
    const bbox = bboxAround(NANTES, radius);
    const north = haversineMeters(NANTES, { lat: bbox[3], lng: NANTES.lng });
    const east = haversineMeters(NANTES, { lat: NANTES.lat, lng: bbox[2] });
    expect(north).toBeGreaterThanOrEqual(radius);
    expect(east).toBeGreaterThanOrEqual(radius);
    expect(north).toBeLessThan(radius * 1.01);
    expect(east).toBeLessThan(radius * 1.01);
  });

  it("contains the whole disc it approximates", () => {
    const radius = 1500;
    const bbox = bboxAround(NANTES, radius);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      expect(bboxContains(bbox, destinationPoint(NANTES, radius, bearing))).toBe(true);
    }
  });

  it("degenerates to the point itself for a zero radius", () => {
    expect(bboxAround(NANTES, 0)).toEqual([NANTES.lng, NANTES.lat, NANTES.lng, NANTES.lat]);
  });

  it("never produces an out-of-range box near the pole", () => {
    const bbox = bboxAround({ lat: 89.999, lng: 0 }, 50_000);
    expect(bbox[1]).toBeGreaterThanOrEqual(-90);
    expect(bbox[3]).toBeLessThanOrEqual(90);
    expect(bbox[0]).toBeGreaterThanOrEqual(-180);
    expect(bbox[2]).toBeLessThanOrEqual(180);
  });
});

describe("bboxContains", () => {
  const bbox = bboxAround(NANTES, 1000);

  it("accepts the centre and rejects a far point", () => {
    expect(bboxContains(bbox, NANTES)).toBe(true);
    expect(bboxContains(bbox, PARIS)).toBe(false);
  });

  it("is inclusive on the edges", () => {
    expect(bboxContains(bbox, { lat: bbox[1], lng: bbox[0] })).toBe(true);
    expect(bboxContains(bbox, { lat: bbox[3], lng: bbox[2] })).toBe(true);
  });
});

describe("bboxArea", () => {
  it("returns km² and is ~4 r² for a box built around a radius", () => {
    // The box circumscribing a 1 km disc is 2 km × 2 km ≈ 4 km².
    expect(bboxArea(bboxAround(NANTES, 1000))).toBeCloseTo(4, 1);
  });

  it("is zero for a degenerate box", () => {
    expect(bboxArea([2, 48, 2, 48])).toBe(0);
  });
});

describe("bboxExpand / bboxIntersects / bboxMaxSpanMeters", () => {
  it("grows a box by a metric margin", () => {
    const base = bboxAround(NANTES, 500);
    const grown = bboxExpand(base, 500);
    expect(bboxMaxSpanMeters(grown)).toBeCloseTo(2000, -1);
  });

  it("detects overlapping and disjoint boxes", () => {
    const a = bboxAround(NANTES, 1000);
    const b = bboxAround(NANTES, 2000);
    expect(bboxIntersects(a, b)).toBe(true);
    expect(bboxIntersects(a, bboxAround(PARIS, 1000))).toBe(false);
  });
});

describe("destinationPoint / geodesicCircleRing", () => {
  it("lands exactly at the requested distance and bearing", () => {
    const p = destinationPoint(NANTES, 2500, 90);
    expect(haversineMeters(NANTES, p)).toBeCloseTo(2500, 0);
    expect(p.lng).toBeGreaterThan(NANTES.lng);
    expect(p.lat).toBeCloseTo(NANTES.lat, 4);
  });

  it("produces a closed ring whose vertices all sit on the radius", () => {
    const ring = geodesicCircleRing(NANTES, 800, 48);
    expect(ring).toHaveLength(49);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lng, lat] of ring) {
      expect(haversineMeters(NANTES, { lat, lng })).toBeCloseTo(800, 0);
    }
  });

  it("keeps a minimum vertex count so the circle never looks like a triangle", () => {
    expect(geodesicCircleRing(NANTES, 300, 3).length).toBeGreaterThanOrEqual(13);
  });
});
