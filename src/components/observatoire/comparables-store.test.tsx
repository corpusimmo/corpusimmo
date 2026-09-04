import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DvfTransaction } from "@/types/dvf";

/**
 * LES DEUX REGISTRES DU PANIER, vus depuis l'écran.
 *
 * Ce qui est éprouvé ici n'est pas la base, c'est la BASCULE : qui décide du
 * registre, ce qui se passe au moment précis où quelqu'un se connecte, et ce
 * que le navigateur garde une fois que le compte a pris le relais. C'est la
 * séquence où l'on peut perdre le travail de quelqu'un.
 */

const useSession = vi.fn<() => { status: "loading" | "authenticated" | "unauthenticated" }>();

const syncComparablesAction = vi.fn();
const addComparableAction = vi.fn();
const removeComparableAction = vi.fn();
const updateComparableAction = vi.fn();
const clearComparablesAction = vi.fn();
const setComparableSubjectAction = vi.fn();

vi.mock("next-auth/react", () => ({ useSession: () => useSession() }));

vi.mock("@/app/(site)/observatoire/comparables/actions", () => ({
  syncComparablesAction: (...args: unknown[]) => syncComparablesAction(...args),
  addComparableAction: (...args: unknown[]) => addComparableAction(...args),
  removeComparableAction: (...args: unknown[]) => removeComparableAction(...args),
  updateComparableAction: (...args: unknown[]) => updateComparableAction(...args),
  clearComparablesAction: (...args: unknown[]) => clearComparablesAction(...args),
  setComparableSubjectAction: (...args: unknown[]) => setComparableSubjectAction(...args),
}));

const { ComparablesProvider, useComparables } = await import("./comparables-store");

const STORAGE_KEY = "corpusimmo.pro.comparables.v1";
const SOURCE_KEY = "corpusimmo.pro.comparables.source.v1";

function transaction(id: string): DvfTransaction {
  return {
    id,
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
}

function stored(id: string) {
  return { transaction: transaction(id), addedAt: "2024-05-01T10:00:00.000Z", excluded: false };
}

/** Un témoin : il expose l'état du panier et les gestes qu'on veut déclencher. */
function Probe() {
  const cart = useComparables();

  return (
    <div>
      <p data-testid="state">
        {cart.hydrated ? "prêt" : "attente"} · {cart.source} · {cart.count} ·{" "}
        {cart.failed ? "échec" : "ok"}
      </p>
      <p data-testid="ids">{cart.ids.join(",")}</p>
      <button type="button" onClick={() => cart.add(transaction("geodvf:2024-9"))}>
        ajouter
      </button>
      <button type="button" onClick={() => cart.remove("geodvf:2024-1")}>
        retirer
      </button>
      <button type="button" onClick={() => cart.setExcluded("geodvf:2024-1", true)}>
        exclure
      </button>
      <button type="button" onClick={() => cart.clear()}>
        vider
      </button>
    </div>
  );
}

function mount() {
  return render(
    <ComparablesProvider>
      <Probe />
    </ComparablesProvider>,
  );
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useSession.mockReturnValue({ status: "unauthenticated" });
  syncComparablesAction.mockResolvedValue({ backed: true, items: [], subject: null });
  addComparableAction.mockResolvedValue(true);
  removeComparableAction.mockResolvedValue(true);
  updateComparableAction.mockResolvedValue(true);
  clearComparablesAction.mockResolvedValue(true);
  setComparableSubjectAction.mockResolvedValue(true);
});

describe("sans compte, le navigateur fait foi", () => {
  it("relit la sélection rangée dans ce navigateur", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored("geodvf:2024-1")]));

    mount();

    await waitFor(() => expect(state()).toContain("prêt · local · 1"));
    expect(syncComparablesAction).not.toHaveBeenCalled();
  });

  it("écrit dans le navigateur et n'appelle aucune action serveur", async () => {
    mount();
    await waitFor(() => expect(state()).toContain("prêt · local"));

    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toContain("geodvf:2024-9"),
    );
    expect(addComparableAction).not.toHaveBeenCalled();
  });

  it("attend de connaître la session avant de choisir un registre", async () => {
    useSession.mockReturnValue({ status: "loading" });
    window.localStorage.setItem(SOURCE_KEY, "account");

    mount();

    // Ce navigateur SAIT que la sélection vit dans un compte : afficher un
    // panier vide en attendant ferait croire à une perte.
    await waitFor(() => expect(state()).toContain("attente"));
    expect(syncComparablesAction).not.toHaveBeenCalled();
  });
});

describe("LA REPRISE, au moment de la connexion", () => {
  beforeEach(() => {
    useSession.mockReturnValue({ status: "authenticated" });
  });

  it("verse dans le compte ce que le navigateur portait", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored("geodvf:2024-1")]));
    syncComparablesAction.mockResolvedValue({
      backed: true,
      items: [stored("geodvf:2024-1"), stored("geodvf:2024-2")],
      subject: null,
    });

    mount();

    await waitFor(() => expect(state()).toContain("prêt · account · 2"));

    const payload = syncComparablesAction.mock.calls[0]?.[0] as { transaction: DvfTransaction }[];
    expect(payload.map((item) => item.transaction.id)).toEqual(["geodvf:2024-1"]);
  });

  it("efface la copie locale une fois la reprise confirmée", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored("geodvf:2024-1")]));
    syncComparablesAction.mockResolvedValue({
      backed: true,
      items: [stored("geodvf:2024-1")],
      subject: null,
    });

    mount();
    await waitFor(() => expect(state()).toContain("account"));

    // Sans cet effacement, retirer un comparable de son compte le verrait
    // revenir au rechargement suivant, reversé par une copie que plus personne
    // ne regarde.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(SOURCE_KEY)).toBe("account");
  });

  it("n'écrit plus dans le navigateur une fois le compte aux commandes", async () => {
    mount();
    await waitFor(() => expect(state()).toContain("account"));

    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));

    await waitFor(() => expect(addComparableAction).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("laisse le compte trancher, et non la session côté navigateur", async () => {
    // Session ouverte, mais pas de base ou jeton antérieur à son arrivée :
    // c'est la réponse du serveur qui décide, pas `useSession()`.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored("geodvf:2024-1")]));
    syncComparablesAction.mockResolvedValue({ backed: false, items: [], subject: null });

    mount();

    await waitFor(() => expect(state()).toContain("prêt · local · 1"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("geodvf:2024-1");
    expect(window.localStorage.getItem(SOURCE_KEY)).toBeNull();
  });

  it("n'efface rien et le DIT quand le compte ne répond pas", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([stored("geodvf:2024-1")]));
    syncComparablesAction.mockRejectedValue(new Error("réseau"));

    mount();

    await waitFor(() => expect(state()).toContain("prêt · local · 1 · échec"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("geodvf:2024-1");
  });

  it("emporte ce qui a été coché pendant que la session se résolvait", async () => {
    // Mode privé : le navigateur refuse d'écrire, le panier ne vit qu'en
    // mémoire. C'est le seul cas où le stockage ne rattrape pas la reprise.
    useSession.mockReturnValue({ status: "loading" });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });

    const view = mount();
    await waitFor(() => expect(state()).toContain("prêt · local · 0"));
    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));
    await waitFor(() => expect(state()).toContain("local · 1"));

    setItem.mockRestore();
    useSession.mockReturnValue({ status: "authenticated" });
    view.rerender(
      <ComparablesProvider>
        <Probe />
      </ComparablesProvider>,
    );

    await waitFor(() => expect(syncComparablesAction).toHaveBeenCalledTimes(1));
    const payload = syncComparablesAction.mock.calls[0]?.[0] as { transaction: DvfTransaction }[];
    expect(payload.map((item) => item.transaction.id)).toEqual(["geodvf:2024-9"]);
  });

  it("ne reprend qu'une fois, quel que soit le nombre de rendus", async () => {
    const view = mount();
    await waitFor(() => expect(state()).toContain("account"));

    view.rerender(
      <ComparablesProvider>
        <Probe />
      </ComparablesProvider>,
    );

    await waitFor(() => expect(state()).toContain("account"));
    expect(syncComparablesAction).toHaveBeenCalledTimes(1);
  });
});

describe("les gestes, une fois le compte aux commandes", () => {
  beforeEach(async () => {
    useSession.mockReturnValue({ status: "authenticated" });
    syncComparablesAction.mockResolvedValue({
      backed: true,
      items: [stored("geodvf:2024-1")],
      subject: null,
    });
    mount();
    await waitFor(() => expect(state()).toContain("prêt · account · 1"));
  });

  it("retire du compte et de l'écran", async () => {
    await userEvent.click(screen.getByRole("button", { name: "retirer" }));

    await waitFor(() => expect(state()).toContain("account · 0"));
    expect(removeComparableAction).toHaveBeenCalledWith("geodvf:2024-1");
  });

  it("exclut sans supprimer", async () => {
    await userEvent.click(screen.getByRole("button", { name: "exclure" }));

    await waitFor(() =>
      expect(updateComparableAction).toHaveBeenCalledWith("geodvf:2024-1", { excluded: true }),
    );
    expect(state()).toContain("account · 1");
  });

  it("vide le panier sans le supprimer", async () => {
    await userEvent.click(screen.getByRole("button", { name: "vider" }));

    await waitFor(() => expect(clearComparablesAction).toHaveBeenCalledTimes(1));
    expect(state()).toContain("account · 0");
  });

  it("signale une écriture que le compte n'a pas acceptée", async () => {
    addComparableAction.mockResolvedValue(false);

    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));

    await waitFor(() => expect(state()).toContain("échec"));
  });

  it("n'envoie pas deux fois le même comparable", async () => {
    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));
    await waitFor(() => expect(addComparableAction).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "ajouter" }));
    expect(addComparableAction).toHaveBeenCalledTimes(1);
  });
});
