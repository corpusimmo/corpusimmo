import { describe, expect, it } from "vitest";

import { DENSITY_OPTIONS } from "@/components/observatoire/dvf-filters";

import { clampLimit, DVF_DEFAULT_LIMIT, DVF_MAX_LIMIT } from "./filters";
import { dvfQuerySchema } from "./query-schema";

/**
 * L'invariant que ce fichier protège.
 *
 * Le plafond serveur vit dans `filters.ts`, les densités offertes à l'écran
 * dans un composant. Quand les deux ont divergé — plafond à 800, sélecteur
 * jusqu'à 2500 — l'observatoire est resté vide en production, et le seul indice
 * visible était « limit: Too big ». Une constante et une liste d'options dans
 * deux fichiers ne restent d'accord que si quelque chose les y oblige.
 */
describe("densités offertes et plafond serveur", () => {
  it("n'offre aucune densité que le serveur refuserait", () => {
    for (const option of DENSITY_OPTIONS) {
      expect(option.value).toBeLessThanOrEqual(DVF_MAX_LIMIT);
    }
  });

  it("accepte chaque densité offerte, telle qu'elle part du navigateur", () => {
    for (const option of DENSITY_OPTIONS) {
      const parsed = dvfQuerySchema.safeParse({
        bbox: "-1.60,47.20,-1.54,47.23",
        limit: String(option.value),
      });
      expect(parsed.success, `densité ${option.value} refusée`).toBe(true);
    }
  });

  it("refuse toujours une demande absurde", () => {
    const parsed = dvfQuerySchema.safeParse({
      bbox: "-1.60,47.20,-1.54,47.23",
      limit: "99999",
    });
    expect(parsed.success).toBe(false);
  });

  it("garde une densité par défaut réellement servable", () => {
    expect(DVF_DEFAULT_LIMIT).toBeLessThanOrEqual(DVF_MAX_LIMIT);
    expect(clampLimit(99_999)).toBe(DVF_MAX_LIMIT);
  });
});
