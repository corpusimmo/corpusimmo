import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import type { EstimationRecord } from "@/lib/history/estimations";

import { EstimationHistory } from "./estimation-history";
import { ProfileForm } from "./profile-form";
import { SavedTools } from "./saved-tools";

/**
 * L'ÉCRAN CONNECTÉ, RENDU HORS LIGNE.
 *
 * L'espace compte tombait en production sur la page d'incident, uniquement
 * pour une personne connectée, avec un message que Next masque. La page
 * anonyme, elle, s'affichait — et c'est ce qui a mis longtemps à s'expliquer :
 * `EstimationHistory` ne rend sa liste QUE lorsque les données viennent du
 * serveur. Sans compte, il rend un squelette et aucune ligne n'est jamais
 * construite, donc aucune ne peut lever.
 *
 * Ces tests montent exactement ce que le serveur monte pour une personne
 * connectée. Une exception ici, c'est la page d'incident là-bas.
 */

const RECORD: EstimationRecord = {
  id: "11111111-1111-4111-8111-111111111111",
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
};

describe("l'espace d'une personne connectée", () => {
  it("rend l'historique servi par la base", () => {
    const { container } = render(<EstimationHistory stored={[RECORD]} />);
    expect(container.textContent).toContain("12 rue Crébillon");
  });

  it("survit à une estimation sans conclusion", () => {
    const sans: EstimationRecord = {
      ...RECORD,
      value: null,
      pricePerSqm: null,
      confidence: 0,
    };
    expect(() => render(<EstimationHistory stored={[sans]} />)).not.toThrow();
  });

  /*
   * LES TROIS DONNÉES QUI ONT DÉJÀ CASSÉ, ou qui le pouvaient.
   *
   * Une date illisible fait LEVER `Intl.DateTimeFormat.format()` — il ne rend
   * pas « Invalid Date ». Un type d'actif inconnu (une valeur retirée du
   * catalogue, une ligne plus ancienne que le code) rendait `undefined`. Les
   * deux traversent la base, donc les deux arrivent un jour.
   */
  it("survit à un horodatage illisible", () => {
    const cassé: EstimationRecord = { ...RECORD, at: Number.NaN };
    const { container } = render(<EstimationHistory stored={[cassé]} />);
    expect(container.textContent).toContain("Date inconnue");
  });

  it("survit à un type de bien inconnu", () => {
    const inconnu = {
      ...RECORD,
      propertyType: "chateau",
    } as unknown as EstimationRecord;
    expect(() =>
      render(<EstimationHistory stored={[inconnu]} />),
    ).not.toThrow();
  });

  it("rend le formulaire de profil, vide comme rempli", () => {
    expect(() =>
      render(
        <ProfileForm
          initial={{ firstName: "", lastName: "", phone: "" }}
          onSave={async () => {}}
        />,
      ),
    ).not.toThrow();
  });

  it("rend les outils mis de côté avec des déblocages", () => {
    expect(() =>
      render(<SavedTools unlocked={["dcf", "wault"]} />),
    ).not.toThrow();
  });
});
