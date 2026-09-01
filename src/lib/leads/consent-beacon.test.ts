import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_VERSION } from "@/lib/consent/consent";

import { reportConsentChoice } from "./consent-beacon";

const fetchMock = vi.fn();

function bodyOf(call: number): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("reportConsentChoice", () => {
  it("dépose le choix sans aucune date : celle du navigateur ne prouverait rien", async () => {
    await reportConsentChoice(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/consentement");
    expect(bodyOf(0)).toEqual({ analytics: true });
  });

  it("dépose un refus comme un accord", async () => {
    await reportConsentChoice(false);
    expect(bodyOf(0)).toEqual({ analytics: false });
  });

  it("ne redépose pas un choix inchangé, sinon chaque page vue écrirait une ligne", async () => {
    await reportConsentChoice(true);
    await reportConsentChoice(true);
    await reportConsentChoice(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redépose dès que la personne change d'avis, dans les deux sens", async () => {
    await reportConsentChoice(true);
    await reportConsentChoice(false);
    await reportConsentChoice(true);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bodyOf(2)).toEqual({ analytics: true });
  });

  it("rejoue au chargement suivant quand le dépôt a échoué", async () => {
    fetchMock.mockRejectedValueOnce(new Error("hors ligne"));

    await reportConsentChoice(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await reportConsentChoice(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne retient rien non plus quand le serveur refuse la requête", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    await reportConsentChoice(false);
    await reportConsentChoice(false);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mémorise le choix déposé sous la version de périmètre en cours", async () => {
    await reportConsentChoice(true);

    expect(window.localStorage.getItem("corpusimmo.consentement.preuve.v1")).toBe(
      `${CONSENT_VERSION}:oui`,
    );
  });
});
