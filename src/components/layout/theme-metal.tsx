"use client";

/**
 * LE CHOIX DU THÈME — argent ou mixte.
 *
 * Ce n'est pas un thème clair contre un thème sombre : les trois sont clairs,
 * et ce qui change est la part de couleur. L'argent ne colore rien, et le
 * mixte, qui est le thème par défaut, met le violet sur ce
 * qui se clique et l'argent sur tout le reste. Les valeurs vivent dans
 * `globals.css`, ce composant ne fait que poser un attribut.
 *
 * POURQUOI UN ATTRIBUT SUR `<html>` ET NON UN ÉTAT REACT. Les couleurs sont
 * des variables CSS lues par toute la page, y compris par des morceaux rendus
 * sur le serveur qui ne rerendront jamais. Un état React ne les atteindrait
 * pas ; un attribut sur la racine les atteint tous, d'un coup, sans rerendu.
 *
 * LE CLIGNOTEMENT EST TRAITÉ AILLEURS, dans le script en ligne de
 * `layout.tsx` : c'est lui qui relit la préférence AVANT la première peinture.
 * Ici, on ne fait que réaccorder le bouton à ce que ce script a déjà décidé.
 */

import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type Metal = "mixte" | "argent";

/** La clé est partagée avec le script en ligne du gabarit racine. */
export const CLE_METAL = "corpusimmo.metal";

const METAUX: ReadonlyArray<{ id: Metal; nom: string; titre: string }> = [
  { id: "argent", nom: "Bleu", titre: "Thème bleu et argent" },
  { id: "mixte", nom: "Violet", titre: "Thème violet, argent en second" },
];

/** L'événement par lequel toutes les instances du bouton se tiennent au courant. */
const EVENEMENT = "corpusimmo:metal";

function lireClient(): Metal {
  const t = document.documentElement.dataset.theme;
  return t === "argent" ? t : "mixte";
}

/**
 * Ce que le SERVEUR croit. Toujours le mixte, puisque c'est le thème écrit
 * dans `:root` : le serveur ne sait rien du stockage du navigateur, et
 * prétendre le contraire produirait un balisage qu'aucune restauration ne
 * pourrait tenir.
 */
function lireServeur(): Metal {
  return "mixte";
}

function abonner(reagir: () => void): () => void {
  window.addEventListener(EVENEMENT, reagir);
  return () => window.removeEventListener(EVENEMENT, reagir);
}

export function ThemeMetal({ className }: { className?: string }) {
  /**
   * LA SOURCE DE VÉRITÉ EST L'ATTRIBUT SUR `<html>`, PAS UN ÉTAT REACT.
   *
   * C'est ce que dit `useSyncExternalStore` : le serveur rend le mixte, le
   * navigateur lit l'attribut que le script en ligne a posé, et React fait la
   * jonction sans erreur d'hydratation. Une version antérieure gardait l'état
   * dans `useState` et le corrigeait dans un effet ; le bouton restait sur
   * « Or » alors que la page était bien en argent. Un état local qui recopie
   * une valeur vivant ailleurs finit toujours par diverger d'elle.
   *
   * L'abonnement sert au cas où deux instances coexistent, en-tête et menu
   * mobile par exemple : elles se tiennent au courant par l'événement plutôt
   * que de se relire l'une l'autre.
   */
  const metal = React.useSyncExternalStore(abonner, lireClient, lireServeur);

  const choisir = (suivant: Metal): void => {
    /* LE MIXTE EST L'ABSENCE D'ATTRIBUT, et non une valeur de plus. Il est
       écrit dans `:root` : lui donner son propre `data-theme` obligerait à
       recopier tout le bloc par défaut pour rien, et à le tenir à jour deux
       fois. */
    if (suivant === "mixte") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = suivant;
    window.dispatchEvent(new Event(EVENEMENT));
    try {
      window.localStorage.setItem(CLE_METAL, suivant);
    } catch {
      // Mode privé, quota plein : le choix vaut pour cette visite seulement.
      // C'est un désagrément, pas une panne, et rien d'autre n'en dépend.
    }
  };

  return (
    /* ── ÉPINGLÉ EN BAS À GAUCHE, ET PAS DANS L'EN-TÊTE ────────────────
       L'en-tête est l'endroit des chemins, pas des réglages : le choix du
       métal y prenait la place d'une entrée de navigation et suivait la page
       partout, en haut, là où l'œil cherche autre chose.

       En bas à gauche il reste accessible sans rien disputer : la droite est
       occupée par les retours et les bandeaux, et le bas de page n'est
       atteint qu'après lecture. `z-30` le place sous l'en-tête collant
       (`z-40`) et sous les fenêtres modales, mais au-dessus du contenu.

       Il ne se masque jamais, y compris en format réduit : un réglage qu'on
       ne trouve que sur grand écran n'est pas un réglage, c'est une option
       cachée. */
    <div
      className={cn(
        /* EN FORMAT RÉDUIT, CENTRÉ EN BAS. Collé au bord gauche, il tombait
           sous le pouce au même endroit que les boutons de l'application et
           sortait à moitié de l'écran sur les appareils étroits. Centré, il
           reste à égale distance des deux bords. Au-delà, il retourne au coin
           gauche, où il ne dispute rien à la lecture. */
        "fixed bottom-4 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-full",
        "border border-border bg-surface/95 p-0.5 shadow-lg backdrop-blur-sm",
        "md:bottom-6 md:left-6 md:translate-x-0",
        className,
      )}
      role="group"
      aria-label="Thème du site"
    >
      {METAUX.map((m) => {
        const actif = metal === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => choisir(m.id)}
            aria-pressed={actif}
            title={m.titre}
            className={cn(
              "relative inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors",
              actif
                ? "bg-primary text-primary-fg"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {/* La pastille montre la couleur elle-même, dégradé compris :
                c'est plus rapide à lire qu'un libellé, et le libellé reste là
                pour qui ne distingue pas les teintes. Celle du mixte est
                coupée en deux, violet puis argent, ce qui dit exactement ce
                que fait le thème. */}
            <span
              aria-hidden="true"
              className={cn(
                "size-3 rounded-full",
                m.id === "argent"
                  ? "bg-[linear-gradient(135deg,#1d4ed8_0%,#3b82f6_48%,#dfe5ec_52%,#8d97a5_100%)]"
                  : "bg-[linear-gradient(135deg,#5b2fd6_0%,#6d4fd0_48%,#dfe5ec_52%,#8d97a5_100%)]",
              )}
            />
            {m.nom}
          </button>
        );
      })}

    </div>
  );
}
