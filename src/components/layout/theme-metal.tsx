"use client";

/**
 * LE CHOIX DU MÉTAL — or ou argent.
 *
 * Ce n'est pas un thème clair contre un thème sombre : les deux sont clairs,
 * et ce qui change est la température de l'écran. L'or réchauffe le fond de
 * page, l'argent le refroidit ; le marine ne bouge pas, parce que c'est lui
 * qui porte l'identité. Les valeurs vivent dans `globals.css`, ce composant
 * ne fait que poser un attribut.
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

export type Metal = "or" | "argent";

/** La clé est partagée avec le script en ligne du gabarit racine. */
export const CLE_METAL = "corpusimmo.metal";

const METAUX: ReadonlyArray<{ id: Metal; nom: string; titre: string }> = [
  { id: "or", nom: "Or", titre: "Thème marine et or" },
  { id: "argent", nom: "Argent", titre: "Thème marine et argent" },
];

/** L'événement par lequel toutes les instances du bouton se tiennent au courant. */
const EVENEMENT = "corpusimmo:metal";

function lireClient(): Metal {
  return document.documentElement.dataset.theme === "argent" ? "argent" : "or";
}

/**
 * Ce que le SERVEUR croit. Toujours l'or, puisque c'est le thème écrit dans
 * `:root` : le serveur ne sait rien du stockage du navigateur, et prétendre le
 * contraire produirait un balisage qu'aucune restauration ne pourrait tenir.
 */
function lireServeur(): Metal {
  return "or";
}

function abonner(reagir: () => void): () => void {
  window.addEventListener(EVENEMENT, reagir);
  return () => window.removeEventListener(EVENEMENT, reagir);
}

export function ThemeMetal({ className }: { className?: string }) {
  /**
   * LA SOURCE DE VÉRITÉ EST L'ATTRIBUT SUR `<html>`, PAS UN ÉTAT REACT.
   *
   * C'est ce que dit `useSyncExternalStore` : le serveur rend l'or, le
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
    document.documentElement.dataset.theme = suivant;
    window.dispatchEvent(new Event(EVENEMENT));
    try {
      window.localStorage.setItem(CLE_METAL, suivant);
    } catch {
      // Mode privé, quota plein : le choix vaut pour cette visite seulement.
      // C'est un désagrément, pas une panne, et rien d'autre n'en dépend.
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5",
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
            {/* La pastille montre le métal lui-même, dégradé compris : c'est
                plus rapide à lire qu'un libellé, et le libellé reste là pour
                qui ne distingue pas les deux teintes. */}
            <span
              aria-hidden="true"
              className={cn(
                "size-3 rounded-full",
                m.id === "or"
                  ? "bg-[linear-gradient(135deg,#8a6a2f,#e2c877_45%,#fbf3d8_55%,#a37f34)]"
                  : "bg-[linear-gradient(135deg,#78818f,#dfe5ec_45%,#ffffff_55%,#8d97a5)]",
              )}
            />
            {m.nom}
          </button>
        );
      })}
    </div>
  );
}
