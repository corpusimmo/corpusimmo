import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `env` est lu à l'import, donc on le remplace : la suite doit pouvoir jouer
 * le cas « secret absent », qu'aucune variable réelle ne produirait.
 */
const secretRef = { value: "un-secret-de-test-assez-long-pour-passer-32" as string | undefined };

vi.mock("@/config/env", () => ({
  get env() {
    return { downloadSecret: secretRef.value };
  },
}));

const { createDownloadToken, verifyDownloadToken } = await import("./token");

const NOW = new Date("2026-09-01T12:00:00.000Z");

describe("jeton de téléchargement", () => {
  beforeEach(() => {
    secretRef.value = "un-secret-de-test-assez-long-pour-passer-32";
  });

  it("accepte un jeton qu'il vient d'émettre", () => {
    const token = createDownloadToken("matrice-dcf", "Jean@Exemple.FR", 3600, NOW);
    expect(token).not.toBeNull();

    const verdict = verifyDownloadToken(token ?? "", "matrice-dcf", NOW);
    expect(verdict.valid).toBe(true);
    if (verdict.valid) {
      expect(verdict.slug).toBe("matrice-dcf");
      // L'adresse est normalisée à l'émission : le lien reste attribuable
      // quelle que soit la casse saisie.
      expect(verdict.email).toBe("jean@exemple.fr");
    }
  });

  it("refuse un jeton émis pour un AUTRE document", () => {
    const token = createDownloadToken("matrice-dcf", "jean@exemple.fr", 3600, NOW);
    const verdict = verifyDownloadToken(token ?? "", "bilan-promoteur", NOW);
    expect(verdict).toEqual({ valid: false, reason: "wrong_document" });
  });

  it("refuse un jeton expiré", () => {
    const token = createDownloadToken("matrice-dcf", "jean@exemple.fr", 60, NOW);
    const plusTard = new Date(NOW.getTime() + 61_000);
    expect(verifyDownloadToken(token ?? "", "matrice-dcf", plusTard)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("refuse une charge utile modifiée", () => {
    const token = createDownloadToken("matrice-dcf", "jean@exemple.fr", 3600, NOW) ?? "";
    const [, signature] = token.split(".");

    // On réécrit la charge pour viser un autre document, en gardant la
    // signature d'origine : c'est l'attaque que la signature doit arrêter.
    const forged = Buffer.from(
      JSON.stringify({ s: "bilan-promoteur", e: "jean@exemple.fr", x: 9_999_999_999 }),
      "utf8",
    ).toString("base64url");

    expect(verifyDownloadToken(`${forged}.${signature}`, "bilan-promoteur", NOW)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("refuse un jeton signé avec un autre secret", () => {
    const token = createDownloadToken("matrice-dcf", "jean@exemple.fr", 3600, NOW) ?? "";
    secretRef.value = "un-autre-secret-tout-aussi-long-pour-le-test";
    expect(verifyDownloadToken(token, "matrice-dcf", NOW)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("refuse un jeton mal formé", () => {
    expect(verifyDownloadToken("nimportequoi", "matrice-dcf", NOW)).toEqual({
      valid: false,
      reason: "malformed",
    });
    expect(verifyDownloadToken("a.b.c", "matrice-dcf", NOW)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("n'émet rien et n'accepte rien sans secret configuré", () => {
    secretRef.value = undefined;
    expect(createDownloadToken("matrice-dcf", "jean@exemple.fr", 3600, NOW)).toBeNull();
    expect(verifyDownloadToken("quoi.que.ce.soit", "matrice-dcf", NOW)).toEqual({
      valid: false,
      reason: "not_configured",
    });
  });
});
