import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DvfTransaction } from "@/types/dvf";

import type { ComparableEntry } from "./wire";

/**
 * LA REPRISE, et ce qui la rend idempotente.
 *
 * Le point le plus cher de ce chantier n'est pas de lire un panier en base,
 * c'est de ne PAS perdre celui qui a été constitué sans compte. Les cas
 * ci-dessous décrivent les quatre façons dont la reprise pourrait mal tourner :
 * ne rien reprendre, reprendre deux fois, écraser ce que la base porte déjà, ou
 * reprendre pour quelqu'un d'autre.
 *
 * La base est simulée. Ce qu'on éprouve ici est l'ENCHAÎNEMENT des appels, pas
 * le SQL : celui-ci est déjà couvert par `src/lib/db/scopes.test.ts`.
 */

const currentUserId = vi.fn<() => Promise<string | null>>();
const addComparable = vi.fn();
const updateComparable = vi.fn();
const removeComparable = vi.fn();
const clearComparableSet = vi.fn();
const listComparableSets = vi.fn();
const readCurrentSet = vi.fn();
const setComparableSubject = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  currentUserId: () => currentUserId(),
}));

vi.mock("@/lib/db", () => ({
  addComparable: (...args: unknown[]) => addComparable(...args),
  updateComparable: (...args: unknown[]) => updateComparable(...args),
  removeComparable: (...args: unknown[]) => removeComparable(...args),
  clearComparableSet: (...args: unknown[]) => clearComparableSet(...args),
  listComparableSets: (...args: unknown[]) => listComparableSets(...args),
  readCurrentSet: (...args: unknown[]) => readCurrentSet(...args),
  setComparableSubject: (...args: unknown[]) => setComparableSubject(...args),
}));

const {
  addComparableAction,
  clearComparablesAction,
  removeComparableAction,
  setComparableSubjectAction,
  syncComparablesAction,
  updateComparableAction,
} = await import("./actions");

const USER = "3f1c8d2e-0b7a-4a1e-9f6d-2c5b8e7a1d40";
const SET = "9a2b7c6d-4e3f-4c1b-8d7a-6f5e4d3c2b1a";

const TRANSACTION: DvfTransaction = {
  id: "geodvf:2024-1",
  date: "2024-03-12",
  year: 2024,
  nature: "sale",
  price: 320_000,
  propertyType: "apartment",
  city: "Nantes",
  cityCode: "44109",
  departmentCode: "44",
  coordinates: { lat: 47.21, lng: -1.55 },
  isMultiLot: false,
  source: "geodvf",
};

function entry(id: string, overrides: Partial<ComparableEntry> = {}): ComparableEntry {
  return {
    transaction: { ...TRANSACTION, id },
    addedAt: "2024-05-01T10:00:00.000Z",
    excluded: false,
    ...overrides,
  };
}

/** Le comportement nominal : la ligne est neuve, elle entre. */
function inserted() {
  return { stored: true, value: { setId: SET, added: true } };
}

/** Le conflit : la ligne était déjà là, l'insertion n'a rien fait. */
function alreadyThere() {
  return { stored: true, value: { setId: SET, added: false } };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserId.mockResolvedValue(USER);
  addComparable.mockResolvedValue(inserted());
  updateComparable.mockResolvedValue({ stored: true, value: null });
  removeComparable.mockResolvedValue({ stored: true, value: null });
  clearComparableSet.mockResolvedValue({ stored: true, value: null });
  setComparableSubject.mockResolvedValue({ stored: true, value: null });
  listComparableSets.mockResolvedValue([{ id: SET }]);
  readCurrentSet.mockResolvedValue({ id: SET, subject: null, items: [] });
});

describe("syncComparablesAction, sans session", () => {
  it("ne touche à rien et laisse la main au navigateur", async () => {
    currentUserId.mockResolvedValue(null);

    const result = await syncComparablesAction([entry("geodvf:2024-1")]);

    expect(result).toEqual({ backed: false, items: [], subject: null });
    expect(addComparable).not.toHaveBeenCalled();
    expect(readCurrentSet).not.toHaveBeenCalled();
  });
});

describe("syncComparablesAction, LA REPRISE", () => {
  it("verse dans le compte ce que le navigateur portait", async () => {
    await syncComparablesAction([entry("geodvf:2024-1"), entry("geodvf:2024-2")]);

    expect(addComparable).toHaveBeenCalledTimes(2);
    expect(addComparable.mock.calls.map((call) => (call[1] as DvfTransaction).id)).toEqual([
      "geodvf:2024-1",
      "geodvf:2024-2",
    ]);
  });

  it("conserve l'horodatage d'origine : l'ordre du panier est celui du travail", async () => {
    await syncComparablesAction([
      entry("geodvf:2024-late", { addedAt: "2024-05-02T10:00:00.000Z" }),
      entry("geodvf:2024-early", { addedAt: "2024-05-01T10:00:00.000Z" }),
    ]);

    // Repris du plus ancien au plus récent, chacun avec SA date.
    expect(addComparable.mock.calls.map((call) => (call[1] as DvfTransaction).id)).toEqual([
      "geodvf:2024-early",
      "geodvf:2024-late",
    ]);
    expect((addComparable.mock.calls[0]?.[2] as Date).toISOString()).toBe(
      "2024-05-01T10:00:00.000Z",
    );
    expect((addComparable.mock.calls[1]?.[2] as Date).toISOString()).toBe(
      "2024-05-02T10:00:00.000Z",
    );
  });

  it("recopie les surcharges du professionnel sur les lignes réellement insérées", async () => {
    await syncComparablesAction([
      entry("geodvf:2024-1", { excluded: true, manualWeight: 2, comment: "Bien atypique" }),
    ]);

    expect(updateComparable).toHaveBeenCalledTimes(1);
    expect(updateComparable.mock.calls[0]?.[0]).toBe(USER);
    expect(updateComparable.mock.calls[0]?.[1]).toBe(SET);
    expect(updateComparable.mock.calls[0]?.[2]).toBe("geodvf:2024-1");
    expect(updateComparable.mock.calls[0]?.[3]).toEqual({
      excluded: true,
      manualWeight: 2,
      comment: "Bien atypique",
    });
  });

  it("n'écrit rien de plus pour une ligne sans surcharge", async () => {
    await syncComparablesAction([entry("geodvf:2024-1")]);
    expect(updateComparable).not.toHaveBeenCalled();
  });

  it("est idempotente : une seconde reprise n'ajoute ni ligne ni écriture", async () => {
    addComparable.mockResolvedValue(alreadyThere());

    await syncComparablesAction([
      entry("geodvf:2024-1", { excluded: true, manualWeight: 2, comment: "Bien atypique" }),
    ]);

    // L'insertion est tentée (elle est en `onConflictDoNothing`), mais RIEN
    // n'est réécrit : la base fait foi pour une ligne qu'elle porte déjà.
    expect(addComparable).toHaveBeenCalledTimes(1);
    expect(updateComparable).not.toHaveBeenCalled();
  });

  it("ne défait pas une exclusion posée depuis un autre appareil", async () => {
    addComparable.mockResolvedValue(alreadyThere());

    await syncComparablesAction([entry("geodvf:2024-1", { excluded: false })]);

    expect(updateComparable).not.toHaveBeenCalled();
  });

  it("ignore une charge corrompue au lieu de la ranger en base", async () => {
    await syncComparablesAction([{ transaction: { id: 3 } }, null, "geodvf:2024-1"]);
    expect(addComparable).not.toHaveBeenCalled();
  });

  it("rend ensuite ce que le compte porte, lui et pas le navigateur", async () => {
    const stored = [entry("geodvf:2024-9")];
    readCurrentSet.mockResolvedValue({ id: SET, subject: null, items: stored });

    const result = await syncComparablesAction([entry("geodvf:2024-1")]);

    expect(result.backed).toBe(true);
    expect(result.items).toBe(stored);
  });

  it("rend un panier vide, et non une absence, quand le compte n'a jamais rien rangé", async () => {
    readCurrentSet.mockResolvedValue(null);

    const result = await syncComparablesAction([]);

    expect(result).toEqual({ backed: true, items: [], subject: null });
  });
});

describe("les écritures, une par une", () => {
  it("refusent toutes d'agir sans session", async () => {
    currentUserId.mockResolvedValue(null);

    expect(await addComparableAction(entry("geodvf:2024-1"))).toBe(false);
    expect(await removeComparableAction("geodvf:2024-1")).toBe(false);
    expect(await updateComparableAction("geodvf:2024-1", { excluded: true })).toBe(false);
    expect(await clearComparablesAction()).toBe(false);
    expect(await setComparableSubjectAction(null)).toBe(false);

    expect(addComparable).not.toHaveBeenCalled();
    expect(removeComparable).not.toHaveBeenCalled();
    expect(updateComparable).not.toHaveBeenCalled();
    expect(clearComparableSet).not.toHaveBeenCalled();
    expect(setComparableSubject).not.toHaveBeenCalled();
  });

  it("retrouvent le panier par la SESSION, jamais par un identifiant reçu", async () => {
    await removeComparableAction("geodvf:2024-1");

    expect(listComparableSets).toHaveBeenCalledWith(USER);
    expect(removeComparable).toHaveBeenCalledWith(USER, SET, "geodvf:2024-1");
  });

  it("refusent un identifiant de mutation qui n'en est pas un", async () => {
    expect(await removeComparableAction({ id: "geodvf:2024-1" })).toBe(false);
    expect(await removeComparableAction("x".repeat(500))).toBe(false);
    expect(removeComparable).not.toHaveBeenCalled();
  });

  it("distinguent « remets le poids calculé » de « poids nul »", async () => {
    await updateComparableAction("geodvf:2024-1", { manualWeight: null });
    expect(updateComparable.mock.calls[0]?.[3]).toEqual({ manualWeight: null });

    await updateComparableAction("geodvf:2024-1", { manualWeight: 0 });
    expect(updateComparable.mock.calls[1]?.[3]).toEqual({ manualWeight: 0 });
  });

  it("ramènent une pondération hors bornes dans le contrat du moteur", async () => {
    await updateComparableAction("geodvf:2024-1", { manualWeight: 9 });
    expect(updateComparable.mock.calls[0]?.[3]).toEqual({ manualWeight: 3 });
  });

  it("ne touchent pas à un champ absent du correctif", async () => {
    await updateComparableAction("geodvf:2024-1", { excluded: true });
    expect(updateComparable.mock.calls[0]?.[3]).toEqual({ excluded: true });
  });

  it("considèrent un retrait sans panier comme déjà fait", async () => {
    listComparableSets.mockResolvedValue([]);
    expect(await removeComparableAction("geodvf:2024-1")).toBe(true);
    expect(removeComparable).not.toHaveBeenCalled();
  });

  it("refusent un bien de référence qui ne passe pas le schéma du moteur", async () => {
    expect(await setComparableSubjectAction({ type: "chateau" })).toBe(false);
    expect(setComparableSubject).not.toHaveBeenCalled();
  });

  it("rangent un bien de référence valide dans le panier courant", async () => {
    const subject = {
      type: "apartment",
      address: {
        id: "44109_1234_00008",
        label: "8 Rue de la Paix 44000 Nantes",
        kind: "housenumber",
        city: "Nantes",
        cityCode: "44109",
        departmentCode: "44",
        coordinates: { lat: 47.21, lng: -1.55 },
        score: 0.9,
      },
      features: { livingArea: 64 },
    };

    expect(await setComparableSubjectAction(subject)).toBe(true);
    expect(setComparableSubject.mock.calls[0]?.[0]).toBe(USER);
    expect(setComparableSubject.mock.calls[0]?.[1]).toBe(SET);
  });

  it("n'inventent pas de panier pour y accrocher un bien de référence", async () => {
    listComparableSets.mockResolvedValue([]);
    expect(await setComparableSubjectAction(null)).toBe(false);
    expect(setComparableSubject).not.toHaveBeenCalled();
  });

  it("disent quand l'écriture n'a pas abouti, pour que l'écran puisse le dire aussi", async () => {
    addComparable.mockResolvedValue({ stored: false, reason: "failed" });
    expect(await addComparableAction(entry("geodvf:2024-1"))).toBe(false);
  });
});
