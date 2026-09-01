/**
 * LE COMPORTEMENT SANS BASE — le contrat le plus dur à tenir, donc celui qu'on
 * éprouve en premier.
 *
 * `.env.example` le formule ainsi : « L'application démarre, sert de vraies
 * données DVF et se construit avec ce fichier vide. C'est un contrat, pas une
 * commodité : la CI lance `pnpm build` avec un environnement vide pour le
 * vérifier à chaque push. »
 *
 * Un module de base de données est précisément le genre de module qui casse ce
 * contrat sans qu'on s'en aperçoive : il suffit d'une connexion ouverte à
 * l'import, ou d'un `process.env.DATABASE_URL!` avec son point d'exclamation
 * confiant. Ces cas de test sont là pour que la faute se voie ici, pas dans un
 * journal de build Vercel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DatabaseNotConfiguredError,
  databaseUrl,
  isDatabaseConfigured,
  requireDatabaseUrl,
  resetConfigWarnings,
} from "./config";

const URL_VALIDE = "postgresql://user:pass@ep-cool-name.eu-central-1.aws.neon.tech/neondb";

let original: string | undefined;

beforeEach(() => {
  original = process.env.DATABASE_URL;
  resetConfigWarnings();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  vi.restoreAllMocks();
});

describe("sans DATABASE_URL", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("ne se déclare pas configuré", () => {
    expect(isDatabaseConfigured()).toBe(false);
    expect(databaseUrl()).toBeUndefined();
  });

  it("ne lève pas : c'est le cas normal, pas une panne", () => {
    expect(() => isDatabaseConfigured()).not.toThrow();
  });

  it("lève une erreur RECONNAISSABLE quand on exige la connexion", () => {
    expect(() => requireDatabaseUrl()).toThrow(DatabaseNotConfiguredError);
  });

  it("dit quoi faire dans le message, pas seulement ce qui manque", () => {
    try {
      requireDatabaseUrl();
      expect.unreachable("requireDatabaseUrl aurait dû lever");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain(".env.local");
      expect(message).toContain("docs/database.md");
    }
  });

  it("n'avertit qu'UNE fois, quel que soit le nombre d'appels", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    databaseUrl();
    databaseUrl();
    databaseUrl();

    // Un avertissement répété à chaque requête finit filtré, donc n'avertit
    // plus personne.
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("avec une DATABASE_URL", () => {
  it("la rend telle quelle", () => {
    process.env.DATABASE_URL = URL_VALIDE;
    expect(databaseUrl()).toBe(URL_VALIDE);
    expect(isDatabaseConfigured()).toBe(true);
  });

  it("accepte les deux préfixes que Postgres reconnaît", () => {
    process.env.DATABASE_URL = "postgres://u:p@hote/base";
    expect(isDatabaseConfigured()).toBe(true);
  });

  it("ignore les espaces autour, qu'un copier-coller ajoute", () => {
    process.env.DATABASE_URL = `  ${URL_VALIDE}\n`;
    expect(databaseUrl()).toBe(URL_VALIDE);
  });
});

describe("avec une DATABASE_URL inutilisable", () => {
  it("traite une chaîne vide comme une absence", () => {
    // Le cas d'un `DATABASE_URL=` laissé dans un fichier d'environnement : la
    // variable EXISTE et ne vaut rien. La transmettre au pilote produirait une
    // erreur de connexion incompréhensible.
    process.env.DATABASE_URL = "   ";
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("refuse ce qui n'est pas une chaîne de connexion Postgres", () => {
    process.env.DATABASE_URL = "mysql://u:p@hote/base";
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("avertit au lieu d'interrompre, comme `src/config/env.ts`", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.DATABASE_URL = "ceci-n-est-pas-une-url";

    expect(() => databaseUrl()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("postgresql://");
  });
});
