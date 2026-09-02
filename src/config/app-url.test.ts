import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAppUrl } from "./app-url";

/**
 * L'origine publique décide des URL canoniques, du plan de site, des
 * métadonnées sociales et du domaine imprimé sur l'image de partage. Une
 * erreur ici ne casse rien visiblement : elle publie simplement la mauvaise
 * adresse, partout, jusqu'à ce que quelqu'un la remarque dans un aperçu de
 * lien. D'où ces quatre cas.
 */

const ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllEnvs();
});

describe("resolveAppUrl", () => {
  it("préfère la variable explicite, protocole ajouté et barre finale retirée", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "www.corpus.immo/");
    expect(resolveAppUrl()).toBe("https://www.corpus.immo");
  });

  it("retient l'alias de production de la plateforme avant l'URL du déploiement", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "www.corpus.immo");
    vi.stubEnv("VERCEL_URL", "corpusimmo-git-preview.vercel.app");
    expect(resolveAppUrl()).toBe("https://www.corpus.immo");
  });

  it("retombe sur le domaine de production quand rien n'est déclaré, en production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAppUrl()).toBe("https://www.corpus.immo");
  });

  it("garde localhost en développement : une préversion ne se déclare pas canonique", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveAppUrl()).toBe("http://localhost:3000");
  });
});
