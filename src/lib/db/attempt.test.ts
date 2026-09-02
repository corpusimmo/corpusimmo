import { afterEach, describe, expect, it, vi } from "vitest";

import { attempt } from "./attempt";

describe("attempt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rend la valeur quand la lecture aboutit", async () => {
    await expect(attempt("test", async () => 42, 0)).resolves.toEqual({ value: 42, failed: false });
  });

  it("rend le repli et journalise quand la lecture échoue", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await attempt(
      "historique",
      async () => {
        throw new Error('relation "estimations" does not exist');
      },
      null,
    );
    expect(outcome).toEqual({ value: null, failed: true });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("historique");
  });
});
