/**
 * LE JETON DE PARTAGE — ce qui tient lieu de serrure.
 *
 * Une estimation partagée est atteignable par quiconque a l'URL. Le jeton n'est
 * donc pas un détail de forme : c'est LA mesure de sécurité du dispositif, et
 * ses trois propriétés se vérifient sans base.
 */

import { describe, expect, it } from "vitest";

import { isShareToken, newShareToken, SHARE_TOKEN_PATTERN } from "./tokens";

describe("jeton de partage", () => {
  it("est sûr dans une URL, sans échappement nulle part", () => {
    // Base64 classique produirait `+`, `/` et `=`, qu'il faudrait échapper dans
    // un chemin, dans une requête, dans un e-mail, et qu'un intermédiaire
    // finirait par mal recopier.
    for (let i = 0; i < 200; i += 1) {
      expect(newShareToken()).toMatch(SHARE_TOKEN_PATTERN);
    }
  });

  it("fait 24 caractères, soit 144 bits", () => {
    // Assez pour qu'énumérer la table par tirage au sort n'ait aucun sens.
    expect(newShareToken()).toHaveLength(24);
  });

  it("ne se répète pas", () => {
    const tirages = new Set(Array.from({ length: 500 }, () => newShareToken()));
    expect(tirages.size).toBe(500);
  });

  it("refuse ce qui n'a pas la bonne forme, sans requête", () => {
    // Une URL bricolée est écartée avant d'atteindre la base : inutile de faire
    // travailler Postgres pour un jeton qui ne peut pas exister.
    expect(isShareToken("trop-court")).toBe(false);
    expect(isShareToken(`${newShareToken()}x`)).toBe(false);
    expect(isShareToken("aaaaaaaaaaaaaaaaaaaaaaa/")).toBe(false);
    expect(isShareToken("../../etc/passwd")).toBe(false);
  });

  it("accepte ce qu'il vient de produire", () => {
    expect(isShareToken(newShareToken())).toBe(true);
  });
});
