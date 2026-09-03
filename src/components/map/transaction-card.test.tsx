import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { DvfTransaction } from "@/types/dvf";

import { TransactionCard } from "./transaction-card";

/**
 * LA FICHE D'UNE MUTATION, telle qu'on la lit sur la carte.
 *
 * Deux promesses sont vérifiées ici parce qu'elles se cassent en silence : le
 * lien vers Google Maps doit être un vrai lien (rien ne part avant un clic) et
 * ouvrir un onglet à part (on ne perd pas sa sélection de comparables), et le
 * bouton d'ajout doit être présent dès qu'un gestionnaire est fourni.
 */

const VENTE: DvfTransaction = {
  id: "t1",
  date: "2025-10-17",
  nature: "sale",
  price: 649_000,
  pricePerSqm: 5_643,
  propertyType: "house",
  builtArea: 115,
  landArea: 293,
  rooms: 4,
  addressLabel: "12 Av Chanzy",
  postcode: "44000",
  city: "Nantes",
  cityCode: "44109",
  coordinates: { lat: 47.2184, lng: -1.5536 },
  isMultiLot: false,
};

describe("TransactionCard", () => {
  it("propose d'aller voir le bien, sans rien envoyer avant le clic", () => {
    render(<TransactionCard transaction={VENTE} />);

    const maps = screen.getByRole("link", { name: /Google Maps/i });
    expect(maps).toHaveAttribute("target", "_blank");
    // Les coordonnées priment sur l'adresse écrite : une adresse DVF est
    // parfois trop approximative pour que Google la place correctement.
    expect(maps.getAttribute("href")).toContain("47.2184");
    expect(maps.getAttribute("rel")).toContain("noopener");

    expect(screen.getByRole("link", { name: /Street View/i })).toBeTruthy();
  });

  it("laisse ajouter aux comparables depuis la fiche", () => {
    const onToggleComparable = vi.fn();
    render(
      <TransactionCard
        transaction={VENTE}
        onToggleComparable={onToggleComparable}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Ajouter aux comparables/i }),
    ).toBeTruthy();
  });

  it("sans coordonnées, retombe sur l'adresse écrite et retire Street View", () => {
    const sansPoint = {
      ...VENTE,
      coordinates: undefined,
    } as unknown as DvfTransaction;
    render(<TransactionCard transaction={sansPoint} />);

    expect(
      screen.getByRole("link", { name: /Google Maps/i }).getAttribute("href"),
    ).toContain("Chanzy");
    expect(screen.queryByRole("link", { name: /Street View/i })).toBeNull();
  });
});
