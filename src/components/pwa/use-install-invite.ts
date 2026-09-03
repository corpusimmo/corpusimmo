"use client";

/**
 * LA DÉCISION D'AFFICHER, séparée de l'affichage.
 *
 * Tout ce qui décide vit ici ; `install-invite.tsx` ne fait que dessiner. La
 * règle tient en une phrase : on ne propose l'installation qu'à quelqu'un qui
 * a montré qu'il lisait, sur une page où il n'est pas en train de travailler,
 * et à qui on ne l'a pas déjà proposé récemment.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { invitationNative } from "./deferred-prompt";
import {
  apresInstallation,
  apresRefus,
  assezVu,
  ecrireSouvenir,
  enregistrerVue,
  estMuette,
  lireSouvenir,
  PRESENCE_AVANT_INVITE_MS,
} from "./memory";
import { isStandalone, readIosSafari } from "./platform";

/**
 * Les écrans où l'on ne s'invite pas.
 *
 * Ce n'est pas de l'évitement de collision, c'est la consigne « non
 * envahissant » prise au sérieux : ces pages sont celles où quelqu'un FAIT
 * quelque chose (une estimation en six étapes, une sélection de comparables,
 * une carte plein écran, un calculateur). Interrompre un travail en cours pour
 * vendre un raccourci sur l'écran d'accueil, c'est le contraire de discret.
 *
 * Accessoirement, `/observatoire` porte déjà un panier fixé en bas d'écran et
 * `/estimer` une barre d'actions collante : deux barres empilées feraient un
 * bandeau, ce que personne n'a demandé.
 */
const PAS_ICI = [
  "/estimer",
  "/observatoire",
  "/mon-espace",
  "/connexion",
  "/hors-ligne",
];

/** Le canal disponible, qui décide du texte autant que du bouton. */
export type Canal =
  /** Chrome, Edge, Android : un vrai bouton qui installe. */
  | "natif"
  /** Safari iOS : pas d'API, seulement une marche à suivre. */
  | "ios";

export interface InstallInvite {
  visible: boolean;
  canal: Canal;
  /** Déclenche l'invite native. Sans objet sur iOS. */
  installer: () => void;
  /** Un refus, mémorisé pour longtemps. */
  refuser: () => void;
}

function surUnEcranDeTravail(pathname: string): boolean {
  return PAS_ICI.some((prefixe) => pathname === prefixe || pathname.startsWith(`${prefixe}/`));
}

export function useInstallInvite(): InstallInvite {
  const pathname = usePathname() ?? "/";

  const [canal, setCanal] = useState<Canal>("natif");
  const [possible, setPossible] = useState(false);
  const [interesse, setInteresse] = useState(false);
  const [ecarte, setEcarte] = useState(false);

  // 1. Le terrain : est-on seulement en situation de proposer quelque chose ?
  //    Lu dans un effet, donc après l'hydratation : `isStandalone()` interroge
  //    `matchMedia`, qui n'existe pas au rendu serveur, et un rendu qui
  //    diviserait serveur et client sur ce point ferait clignoter la page.
  useEffect(() => {
    if (isStandalone()) return;
    if (estMuette(lireSouvenir(), Date.now())) return;

    if (readIosSafari()) {
      setCanal("ios");
      setPossible(true);
      return;
    }

    setCanal("natif");
    // Chrome a peut-être déjà tiré l'événement avant même que ce composant ne
    // se monte : `deferred-prompt` l'a gardé de côté, on le relit ici.
    const relire = () => {
      if (invitationNative.dejaInstallee()) {
        ecrireSouvenir(apresInstallation(Date.now()));
        setPossible(false);
        setEcarte(true);
        return;
      }
      setPossible(invitationNative.disponible());
    };
    relire();
    return invitationNative.subscribe(relire);
  }, []);

  // 2. Le signe d'intérêt, première forme : une deuxième page vue.
  useEffect(() => {
    // Le comptage lui-même ne doit pas provoquer de rendu : seul le
    // FRANCHISSEMENT du seuil en provoque un.
    if (assezVu(enregistrerVue())) setInteresse(true);
  }, [pathname]);

  // 3. Le signe d'intérêt, seconde forme : trente secondes de présence.
  useEffect(() => {
    if (interesse) return;
    const minuteur = window.setTimeout(() => setInteresse(true), PRESENCE_AVANT_INVITE_MS);
    return () => window.clearTimeout(minuteur);
  }, [interesse]);

  const refuser = useCallback(() => {
    setEcarte(true);
    ecrireSouvenir(apresRefus(lireSouvenir(), Date.now()));
  }, []);

  const installer = useCallback(() => {
    const evenement = invitationNative.consommer();
    if (!evenement) {
      setEcarte(true);
      return;
    }

    // On retire l'invite dès le clic : la boîte de dialogue du navigateur
    // passe devant, et la garder derrière ne servirait qu'à la retrouver au
    // retour.
    setEcarte(true);

    void (async () => {
      try {
        await evenement.prompt();
        const { outcome } = await evenement.userChoice;
        ecrireSouvenir(
          outcome === "accepted"
            ? apresInstallation(Date.now())
            : // Un refus dans la boîte native est un refus tout court, et il
              // vaut la même peine que le refus dans notre barre.
              apresRefus(lireSouvenir(), Date.now()),
        );
      } catch {
        // L'événement a expiré, ou le navigateur a refusé de l'ouvrir. Rien à
        // dire à l'utilisateur : il n'a rien demandé de plus qu'un clic.
      }
    })();
  }, []);

  return {
    visible: possible && interesse && !ecarte && !surUnEcranDeTravail(pathname),
    canal,
    installer,
    refuser,
  };
}
