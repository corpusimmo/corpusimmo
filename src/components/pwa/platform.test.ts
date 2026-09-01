import { describe, expect, it } from "vitest";

import { isIos, isIosSafari } from "./platform";

/**
 * Des chaînes d'agent réelles, pas inventées. La détection de plateforme ne se
 * vérifie que sur des cas observés : c'est du code que l'on ne peut ni relire
 * ni raisonner, seulement confronter.
 */
const AGENTS = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iphoneFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.42.107]",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
} as const;

describe("isIos", () => {
  it("reconnaît un iPhone", () => {
    expect(isIos(AGENTS.iphoneSafari, 5)).toBe(true);
  });

  it("reconnaît un iPad, qui se présente pourtant comme un Mac", () => {
    // Le seul écart entre les deux chaînes suivantes est le tactile.
    expect(AGENTS.ipadOS).toBe(AGENTS.macSafari);
    expect(isIos(AGENTS.ipadOS, 5)).toBe(true);
  });

  it("ne prend pas un Mac de bureau pour un iPad", () => {
    expect(isIos(AGENTS.macSafari, 0)).toBe(false);
  });

  it("ignore Android et Windows", () => {
    expect(isIos(AGENTS.androidChrome, 5)).toBe(false);
    expect(isIos(AGENTS.windowsEdge, 0)).toBe(false);
  });
});

describe("isIosSafari", () => {
  it("accepte Safari sur iPhone et sur iPad", () => {
    expect(isIosSafari(AGENTS.iphoneSafari, 5)).toBe(true);
    expect(isIosSafari(AGENTS.ipadOS, 5)).toBe(true);
  });

  it("écarte les autres navigateurs iOS : leur menu Partager n'est pas celui de Safari", () => {
    expect(isIosSafari(AGENTS.iphoneChrome, 5)).toBe(false);
    expect(isIosSafari(AGENTS.iphoneFirefox, 5)).toBe(false);
  });

  it("écarte les navigateurs intégrés, où « Sur l'écran d'accueil » n'existe pas", () => {
    expect(isIosSafari(AGENTS.iphoneFacebook, 5)).toBe(false);
  });

  it("écarte tout ce qui n'est pas iOS", () => {
    expect(isIosSafari(AGENTS.androidChrome, 5)).toBe(false);
    expect(isIosSafari(AGENTS.macSafari, 0)).toBe(false);
  });
});
