/**
 * CE QUE LE NAVIGATEUR PERMET VRAIMENT.
 *
 * Tout est écrit en fonctions PURES qui reçoivent la chaîne d'agent en
 * paramètre, plutôt qu'en lectures directes de `navigator`. Deux raisons : la
 * détection de plateforme est exactement le genre de code qui se casse en
 * silence, et elle ne se vérifie qu'avec une vraie liste de chaînes d'agent
 * sous la main. Les lecteurs qui touchent au `window` sont réduits à deux
 * lignes chacun, en bas de fichier.
 */

/**
 * L'événement que Chrome, Edge et les navigateurs Android émettent quand ils
 * jugent le site installable. Il n'est pas dans `lib.dom` : le brouillon n'a
 * jamais été normalisé, et Safari ne l'implémentera pas.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

const APPAREIL_IOS = /iPad|iPhone|iPod/;

/** iPadOS 13+ se fait passer pour un Mac de bureau. */
const MAC = /Macintosh/;

/**
 * Les autres navigateurs d'iOS. Ils empruntent tous WebKit, mais aucun n'a le
 * menu Partager de Safari : leur montrer « touchez Partager » serait leur
 * décrire un bouton qui n'existe pas à cet endroit.
 */
const AUTRES_NAVIGATEURS_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//;

/**
 * Les navigateurs intégrés aux applications. « Sur l'écran d'accueil » n'y
 * figure tout simplement pas : il n'y a rien à expliquer, seulement à se taire.
 */
const NAVIGATEURS_INTEGRES = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|Snapchat/;

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (APPAREIL_IOS.test(userAgent)) return true;
  // Le seul indice qui reste pour un iPad : aucun Mac ne déclare plus d'un
  // point de contact.
  return MAC.test(userAgent) && maxTouchPoints > 1;
}

/**
 * iOS + Safari, et rien d'autre. C'est la seule combinaison où l'instruction
 * « Partager, puis Sur l'écran d'accueil » est exacte.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  if (!isIos(userAgent, maxTouchPoints)) return false;
  if (AUTRES_NAVIGATEURS_IOS.test(userAgent)) return false;
  return !NAVIGATEURS_INTEGRES.test(userAgent);
}

/* --------------------------------------------------------------------------
   Les deux lectures du navigateur
   -------------------------------------------------------------------------- */

const MODES_INSTALLES = ["standalone", "minimal-ui", "fullscreen"] as const;

/**
 * L'application tourne-t-elle DÉJÀ installée&nbsp;? Proposer d'installer ce qui
 * est installé est le défaut le plus visible de ce genre de composant.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;

  if (typeof window.matchMedia === "function") {
    for (const mode of MODES_INSTALLES) {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true;
    }
  }

  // Safari iOS n'implémente pas `display-mode` et expose à la place ce drapeau
  // non standard, absent de `lib.dom`. C'est la SEULE façon de savoir qu'on
  // tourne depuis l'écran d'accueil sur iPhone.
  const legacy = window.navigator as Navigator & { standalone?: boolean };
  return legacy.standalone === true;
}

export function readIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  return isIosSafari(window.navigator.userAgent, window.navigator.maxTouchPoints ?? 0);
}
