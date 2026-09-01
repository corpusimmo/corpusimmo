import { describe, expect, it } from "vitest";
import { COMMUNE_ZOOM, readUrlTarget } from "./url-target";

describe("readUrlTarget", () => {
  it("centre sur une commune publiée à partir de son code INSEE", () => {
    const target = readUrlTarget("?commune=44109");
    expect(target).not.toBeNull();
    expect(target?.zoom).toBe(COMMUNE_ZOOM);
    expect(target?.address?.city).toBe("Nantes");
    expect(target?.address?.cityCode).toBe("44109");
    expect(target?.center.lat).toBeCloseTo(47.2, 0);
  });

  it("ignore un code INSEE inconnu et retombe sur lat/lng s'ils sont là", () => {
    expect(readUrlTarget("?commune=00000")).toBeNull();
    const target = readUrlTarget("?commune=00000&lat=45.75&lng=4.85");
    expect(target?.center).toEqual({ lat: 45.75, lng: 4.85 });
    expect(target?.address).toBeUndefined();
  });

  it("lit un point avec un zoom borné", () => {
    expect(readUrlTarget("?lat=48.85&lng=2.35")?.zoom).toBe(15);
    expect(readUrlTarget("?lat=48.85&lng=2.35&zoom=40")?.zoom).toBe(19.5);
    expect(readUrlTarget("?lat=48.85&lng=2.35&zoom=1")?.zoom).toBe(4);
  });

  it("refuse une coordonnée absente, non numérique ou hors du globe", () => {
    expect(readUrlTarget("")).toBeNull();
    expect(readUrlTarget("?lat=48.85")).toBeNull();
    expect(readUrlTarget("?lat=abc&lng=2.35")).toBeNull();
    expect(readUrlTarget("?lat=95&lng=2.35")).toBeNull();
  });
});
