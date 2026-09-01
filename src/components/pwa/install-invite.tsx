"use client";

/**
 * L'INVITE D'INSTALLATION — petite, en bas, et facile à faire taire.
 *
 * Ce qu'elle n'est pas, et ne doit jamais devenir : une modale, une
 * superposition qui assombrit la page, une chose qui vole le focus ou qui
 * arrive dans la première seconde. Proposer d'installer un site est une faveur
 * qu'on demande, pas un passage obligé.
 *
 * LA FORME. Une barre en bas d'écran sur mobile, une carte en bas à GAUCHE sur
 * ordinateur. À gauche parce que le coin bas-droit est déjà pris : les toasts
 * y vivent (`ui/toast.tsx`, z-60) et le panier de comparables aussi
 * (`observatoire/comparables-cart.tsx`, z-40). On se range en dessous des deux,
 * en z-30 : si quelque chose doit passer devant, ce n'est jamais nous.
 *
 * PAS DE DÉCALAGE DE MISE EN PAGE. L'élément est `fixed`, donc hors du flux, et
 * il n'existe pas avant le signe d'intérêt : au chargement, il n'y a rien à
 * décaler.
 *
 * L'ANIMATION. `animate-fade-up`, six pixels de translation. `globals.css`
 * neutralise déjà toutes les animations sous `prefers-reduced-motion` de façon
 * globale et sans exception : il n'y a rien à ajouter ici.
 */

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Share, SquarePlus, X } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui";
import { siteConfig } from "@/config/site";

import { useInstallInvite } from "./use-install-invite";

export function InstallInvite() {
  const { visible, canal, installer, refuser } = useInstallInvite();

  const panneau = useRef<HTMLDivElement | null>(null);
  /**
   * D'où le focus est venu, s'il est venu. On ne le mémorise qu'à la PREMIÈRE
   * entrée au clavier dans la barre : l'invite ne prend jamais le focus d'elle
   * même, donc il n'y a rien à rendre tant que personne n'est entré.
   */
  const retour = useRef<HTMLElement | null>(null);

  const titreId = useId();
  const texteId = useId();

  const fermer = useCallback(() => {
    const cible = retour.current;
    refuser();
    // Le panneau va disparaître : si le focus était dedans, il tomberait sur
    // `<body>` et un lecteur d'écran perdrait sa place. On le rend à l'endroit
    // d'où l'on est entré.
    if (cible && cible.isConnected) cible.focus();
    retour.current = null;
  }, [refuser]);

  // Échap ferme, même quand le focus est resté dans la page : c'est une barre
  // non modale, personne n'a de raison d'aller la chercher au clavier pour
  // s'en débarrasser.
  useEffect(() => {
    if (!visible) return;

    const surTouche = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Une vraie modale est ouverte par-dessus (Modal, Drawer) : Échap lui
      // appartient. On ne lui vole pas sa touche.
      if (document.querySelector('[aria-modal="true"]')) return;
      fermer();
    };

    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [visible, fermer]);

  if (!visible || typeof document === "undefined") return null;

  const ios = canal === "ios";

  return createPortal(
    <div
      ref={panneau}
      // Non modale : ni `aria-modal`, ni piège à focus. Le rôle `dialog` est
      // celui qui décrit le mieux une proposition qu'on peut accepter ou
      // écarter, et il porte son propre nom accessible.
      role="dialog"
      aria-labelledby={titreId}
      aria-describedby={texteId}
      onFocus={(event) => {
        if (retour.current) return;
        const origine = event.relatedTarget;
        if (origine instanceof HTMLElement && !panneau.current?.contains(origine)) {
          retour.current = origine;
        }
      }}
      className={
        "animate-fade-up fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface " +
        "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg " +
        "sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[21rem] sm:rounded-lg sm:border sm:p-4"
      }
    >
      <div className="flex items-start gap-3">
        <BrandMark className="mt-0.5 size-8" />

        <div className="min-w-0 flex-1">
          <p id={titreId} className="text-sm font-semibold text-ink">
            {ios ? "Ajouter à l'écran d'accueil" : `Installer ${siteConfig.name}`}
          </p>

          {ios ? (
            <p id={texteId} className="mt-1 text-xs leading-relaxed text-ink-muted">
              Dans Safari&nbsp;: touchez
              <Share aria-hidden="true" className="mx-1 inline size-3.5 -translate-y-px" />
              <span className="font-medium text-ink">Partager</span>, puis
              <SquarePlus aria-hidden="true" className="mx-1 inline size-3.5 -translate-y-px" />
              <span className="font-medium text-ink">Sur l&apos;écran d&apos;accueil</span>.
            </p>
          ) : (
            <p id={texteId} className="mt-1 text-xs leading-relaxed text-ink-muted">
              Un accès direct depuis l&apos;écran d&apos;accueil, et les pages déjà consultées restent
              lisibles hors connexion.
            </p>
          )}

          {ios ? null : (
            <Button size="sm" onClick={installer} className="mt-3">
              Installer
            </Button>
          )}
        </div>

        <button
          type="button"
          onClick={fermer}
          // Pas « Fermer » tout court : hors contexte, dans la liste des
          // éléments d'un lecteur d'écran, « Fermer » ne dit pas ce qu'on ferme.
          aria-label="Ne plus proposer l'installation"
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
