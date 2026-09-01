import { describe, expect, it } from "vitest";
import { parseValuationRequest } from "./request-schema";

const VALID = {
  subject: {
    type: "apartment",
    address: {
      id: "44109_1234_00008",
      label: "8 Rue de Test 44000 Nantes",
      kind: "housenumber",
      city: "Nantes",
      cityCode: "44109",
      departmentCode: "44",
      coordinates: { lat: 47.2184, lng: -1.5536 },
      score: 0.95,
    },
    features: { livingArea: 70, rooms: 3, condition: "good" },
  },
  intent: "selling_under_6m",
};

describe("parseValuationRequest", () => {
  it("accepts a well-formed request", () => {
    const outcome = parseValuationRequest(VALID);
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.data.subject.features.livingArea).toBe(70);
      expect(outcome.data.intent).toBe("selling_under_6m");
    }
  });

  it("defaults missing features to an empty object rather than failing", () => {
    const { subject, ...rest } = VALID;
    const { features: _features, ...subjectRest } = subject;
    const outcome = parseValuationRequest({ ...rest, subject: subjectRest });
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.data.subject.features).toEqual({});
  });

  it("rejects a missing subject and reports the path", () => {
    const outcome = parseValuationRequest({ intent: "curiosity" });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.issues.some((i) => i.path.startsWith("subject"))).toBe(true);
    }
  });

  it("rejects an unknown property type", () => {
    const outcome = parseValuationRequest({
      ...VALID,
      subject: { ...VALID.subject, type: "castle" },
    });
    expect(outcome.success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    const outcome = parseValuationRequest({
      ...VALID,
      subject: {
        ...VALID.subject,
        address: { ...VALID.subject.address, coordinates: { lat: 999, lng: -1.55 } },
      },
    });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.issues.some((i) => i.path.includes("coordinates"))).toBe(true);
    }
  });

  it("rejects absurd or negative surfaces from the browser", () => {
    for (const livingArea of [-10, 0, 5_000_000]) {
      const outcome = parseValuationRequest({
        ...VALID,
        subject: { ...VALID.subject, features: { livingArea } },
      });
      expect(outcome.success).toBe(false);
    }
  });

  it("rejects a manual weight outside 0 → 3", () => {
    const outcome = parseValuationRequest({
      ...VALID,
      manualWeights: { "geodvf:1": 99 },
    });
    expect(outcome.success).toBe(false);
  });

  it("caps the size of a pro basket so one payload cannot fan out", () => {
    const outcome = parseValuationRequest({
      ...VALID,
      comparableIds: Array.from({ length: 200 }, (_, i) => `geodvf:${i}`),
    });
    expect(outcome.success).toBe(false);
  });

  it("accepts a legitimate pro basket", () => {
    const outcome = parseValuationRequest({
      ...VALID,
      comparableIds: ["geodvf:1", "geodvf:2"],
      manualWeights: { "geodvf:1": 2 },
      excludedIds: ["geodvf:2"],
    });
    expect(outcome.success).toBe(true);
  });

  it("rejects a non-object payload without throwing", () => {
    for (const payload of [null, "hello", 42, []]) {
      expect(parseValuationRequest(payload).success).toBe(false);
    }
  });
});
