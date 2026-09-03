import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * L'ESPACE COMPTE, MONTÉ EN ENTIER, POUR UNE PERSONNE CONNECTÉE.
 *
 * La page tombait en production sur l'écran d'incident, uniquement une fois
 * connecté, avec un message que Next masque par principe. La version anonyme
 * s'affichait : impossible de reproduire en ouvrant simplement l'URL.
 *
 * Ce test monte le composant serveur lui-même, avec des dépendances simulées
 * qui rendent exactement ce qu'une base rend. Une exception ici, c'est la page
 * d'incident là-bas — et le message, lui, n'est pas masqué.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/auth/current-user", () => ({
  currentUserId: async () => USER_ID,
}));

vi.mock("./actions", () => ({
  forgetEstimationAction: async () => {},
  clearEstimationsAction: async () => {},
  saveProfileAction: async () => {},
}));

const now = Math.floor(Date.now() / 1000);

vi.mock("@/lib/access/ledger", () => ({
  UNKNOWN_ACCESS: {
    unlocked: [],
    quota: { limit: 2, used: 0, remaining: 2, renewsAt: null },
    enforced: false,
  },
  readAccess: async () => ({
    // Deux déblocages : c'est ce qui fait rendre la section « Vos outils
    // débloqués », absente de la page anonyme.
    unlocked: [
      { slug: "dcf", at: now - 3600 },
      { slug: "wault", at: now - 7200 },
    ],
    quota: {
      limit: 2,
      used: 2,
      remaining: 0,
      renewsAt: new Date(Date.now() + 86_400_000),
    },
    enforced: true,
  }),
}));

vi.mock("@/lib/db", () => ({
  listEstimations: async () => [
    {
      id: "22222222-2222-4222-8222-222222222222",
      engineId: "est_1",
      at: Date.UTC(2026, 7, 30, 9, 12),
      address: "12 rue Crébillon, 44000 Nantes",
      city: "Nantes",
      postcode: "44000",
      propertyType: "apartment",
      surface: 72,
      value: { low: 325_000, central: 348_000, high: 371_000 },
      pricePerSqm: 4_830,
      confidence: 82,
      comparables: 9,
      shareToken: null,
    },
  ],
  readProfile: async () => ({
    userId: USER_ID,
    firstName: "Camille",
    lastName: "Durand",
    phone: null,
    updatedAt: new Date(),
  }),
}));

describe("Mon espace, connecté", () => {
  it("se rend sans lever", async () => {
    const { default: MonEspacePage } = await import("./page");
    const ui = await MonEspacePage();

    expect(() => render(ui)).not.toThrow();
  });

  it("montre les outils débloqués, l'historique et le profil", async () => {
    const { default: MonEspacePage } = await import("./page");
    const { container } = render(await MonEspacePage());

    expect(container.textContent).toContain("Vos outils débloqués");
    expect(container.textContent).toContain("Ouvert le");
  });
});
