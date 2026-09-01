import { describe, expect, it } from "vitest";

import {
  apresInstallation,
  apresRefus,
  assezVu,
  AUCUNE_PRESENCE,
  compterVue,
  estMuette,
  PAGES_AVANT_INVITE,
  parsePresence,
  parseSouvenir,
  REFUS_JOURS,
  silenceApresRefus,
  VIERGE,
  type Souvenir,
} from "./memory";

const JOUR = 86_400_000;
const T0 = Date.UTC(2026, 0, 15, 12, 0, 0);

describe("parseSouvenir", () => {
  it("rend un souvenir vierge sur tout ce qui n'est pas un objet exploitable", () => {
    for (const brut of [null, undefined, 42, "refuse", [], {}, { statut: "refuse" }]) {
      expect(parseSouvenir(brut)).toEqual(VIERGE);
    }
  });

  it("relit un refus et un rang de refus", () => {
    expect(parseSouvenir({ statut: "refuse", depuis: T0, nieme: 3 })).toEqual({
      statut: "refuse",
      depuis: T0,
      nieme: 3,
    });
  });

  it("ramène un rang absent ou aberrant au premier refus", () => {
    expect(parseSouvenir({ statut: "refuse", depuis: T0 })).toEqual({
      statut: "refuse",
      depuis: T0,
      nieme: 1,
    });
    expect(parseSouvenir({ statut: "refuse", depuis: T0, nieme: -8 })).toEqual({
      statut: "refuse",
      depuis: T0,
      nieme: 1,
    });
  });

  it("relit une installation", () => {
    expect(parseSouvenir({ statut: "installe", depuis: T0 })).toEqual({
      statut: "installe",
      depuis: T0,
    });
  });

  it("refuse un statut inconnu écrit par une autre version", () => {
    expect(parseSouvenir({ statut: "peut-etre", depuis: T0 })).toEqual(VIERGE);
  });
});

describe("estMuette", () => {
  it("laisse parler quand rien n'a jamais été répondu", () => {
    expect(estMuette(VIERGE, T0)).toBe(false);
  });

  it("se tait pendant toute la durée du refus", () => {
    const refus = apresRefus(VIERGE, T0);

    expect(estMuette(refus, T0)).toBe(true);
    expect(estMuette(refus, T0 + JOUR)).toBe(true);
    expect(estMuette(refus, T0 + 30 * JOUR)).toBe(true);
    // La consigne : au moins soixante jours.
    expect(estMuette(refus, T0 + (REFUS_JOURS - 1) * JOUR)).toBe(true);
  });

  it("laisse une seconde chance passé le délai", () => {
    const refus = apresRefus(VIERGE, T0);
    expect(estMuette(refus, T0 + REFUS_JOURS * JOUR)).toBe(false);
  });

  it("double l'attente à chaque refus supplémentaire", () => {
    const premier = apresRefus(VIERGE, T0);
    const second = apresRefus(premier, T0);

    expect(second.statut).toBe("refuse");
    expect(estMuette(second, T0 + REFUS_JOURS * JOUR)).toBe(true);
    expect(estMuette(second, T0 + 2 * REFUS_JOURS * JOUR)).toBe(false);
  });

  it("plafonne le doublement pour ne pas produire de date absurde", () => {
    expect(silenceApresRefus(4)).toBe(silenceApresRefus(40));
    expect(Number.isFinite(silenceApresRefus(999))).toBe(true);
  });

  it("ne redemande jamais rien après une installation", () => {
    const installee = apresInstallation(T0);
    expect(estMuette(installee, T0 + 10 * 365 * JOUR)).toBe(true);
  });

  it("se tait aussi si l'horloge a reculé depuis le refus", () => {
    // Une date de refus dans le futur ne doit pas se lire comme « il y a
    // très longtemps » et rouvrir la porte.
    const refus: Souvenir = { statut: "refuse", depuis: T0 + 10 * JOUR, nieme: 1 };
    expect(estMuette(refus, T0)).toBe(true);
  });
});

describe("parsePresence", () => {
  it("repart de zéro sur une valeur illisible", () => {
    for (const brut of [null, "3", { vues: "beaucoup" }, { vues: -4 }]) {
      expect(parsePresence(brut)).toEqual(AUCUNE_PRESENCE);
    }
  });

  it("relit un comptage et son horodatage", () => {
    expect(parsePresence({ vues: 3, derniere: T0 })).toEqual({ vues: 3, derniere: T0 });
  });

  it("plafonne un compteur gonflé à la main", () => {
    expect(parsePresence({ vues: 1e9, derniere: T0 }).vues).toBe(99);
  });
});

describe("compterVue", () => {
  it("compte une page vue", () => {
    expect(compterVue(AUCUNE_PRESENCE, T0)).toEqual({ vues: 1, derniere: T0 });
  });

  it("ignore un second comptage immédiat : React double les effets en mode strict", () => {
    const apres = compterVue(AUCUNE_PRESENCE, T0);
    expect(compterVue(apres, T0 + 5)).toEqual(apres);
    expect(compterVue(apres, T0 + 300)).toEqual(apres);
  });

  it("compte de nouveau une seconde plus tard", () => {
    const apres = compterVue(AUCUNE_PRESENCE, T0);
    expect(compterVue(apres, T0 + 1_500).vues).toBe(2);
  });
});

describe("assezVu", () => {
  it("ne juge pas la première page suffisante", () => {
    expect(assezVu({ vues: 1, derniere: T0 })).toBe(false);
  });

  it("s'ouvre à la deuxième", () => {
    expect(PAGES_AVANT_INVITE).toBe(2);
    expect(assezVu({ vues: 2, derniere: T0 })).toBe(true);
  });
});
