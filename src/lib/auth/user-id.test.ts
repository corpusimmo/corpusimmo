/**
 * Ce test verrouille le garde-fou qui a failli coûter une panne en production :
 * un jeton de session émis AVANT l'arrivée de la base porte l'identifiant du
 * compte Google, pas celui d'une ligne `users`. Le passer à une requête
 * reviendrait à comparer une colonne `uuid` à une suite de chiffres, ce que
 * Postgres refuse par une erreur, pas par un résultat vide.
 */

import { describe, expect, it } from "vitest";

import { isDatabaseUserId } from "./user-id";

describe("isDatabaseUserId", () => {
  it("accepte un uuid, en minuscules comme en majuscules", () => {
    expect(isDatabaseUserId("0b6f1a2c-3d4e-4f50-9a1b-2c3d4e5f6071")).toBe(true);
    expect(isDatabaseUserId("0B6F1A2C-3D4E-4F50-9A1B-2C3D4E5F6071")).toBe(true);
  });

  it("refuse l'identifiant numérique d'un compte Google", () => {
    expect(isDatabaseUserId("104857293847562930485")).toBe(false);
  });

  it("refuse ce qui ressemble sans en être", () => {
    expect(isDatabaseUserId("0b6f1a2c3d4e4f509a1b2c3d4e5f6071")).toBe(false);
    expect(isDatabaseUserId("0b6f1a2c-3d4e-4f50-9a1b-2c3d4e5f607")).toBe(false);
    expect(isDatabaseUserId("0b6f1a2c-3d4e-4f50-9a1b-2c3d4e5f6071x")).toBe(false);
    expect(isDatabaseUserId("' OR 1=1 --")).toBe(false);
  });

  it("refuse l'absence", () => {
    expect(isDatabaseUserId(null)).toBe(false);
    expect(isDatabaseUserId(undefined)).toBe(false);
    expect(isDatabaseUserId("")).toBe(false);
  });
});
