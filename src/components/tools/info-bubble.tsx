"use client";

/**
 * La petite bulle d'aide accolée à un libellé.
 *
 * POURQUOI UN BOUTON, ET PAS UN `title`
 *   L'attribut `title` du navigateur ne s'ouvre qu'au survol prolongé, n'existe
 *   pas au tactile, et n'est pas lu de façon fiable par les lecteurs d'écran.
 *   Ici, l'aide s'ouvre au survol, au focus clavier ET au clic — donc partout.
 *
 * POURQUOI UNE BULLE PLUTÔT QU'UN TEXTE PERMANENT
 *   Une phrase d'aide sous chaque champ triple la hauteur du formulaire et finit
 *   par n'être plus lue du tout. La bulle garde l'information à portée sans
 *   encombrer : elle est là pour le champ qu'on ne comprend pas, pas pour les
 *   quatorze autres.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export function InfoBubble({ children, label }: { children: string; label?: string }) {
  const [ouverte, setOuverte] = useState(false);
  const id = useId();
  const conteneur = useRef<HTMLSpanElement>(null);

  // Échappement et clic à l'extérieur : une bulle ouverte au clic doit pouvoir
  // se fermer autrement qu'en recliquant exactement sur le même point.
  useEffect(() => {
    if (!ouverte) return;

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuverte(false);
    };
    const surClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuverte(false);
    };

    document.addEventListener("keydown", surTouche);
    document.addEventListener("mousedown", surClic);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("mousedown", surClic);
    };
  }, [ouverte]);

  return (
    <span ref={conteneur} className="relative inline-flex">
      <button
        type="button"
        aria-label={label ? `Aide : ${label}` : "Afficher l'aide"}
        aria-expanded={ouverte}
        aria-describedby={ouverte ? id : undefined}
        onClick={() => setOuverte((o) => !o)}
        onMouseEnter={() => setOuverte(true)}
        onMouseLeave={() => setOuverte(false)}
        onFocus={() => setOuverte(true)}
        onBlur={() => setOuverte(false)}
        className="inline-grid size-4 place-items-center rounded-full text-ink-subtle transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Info className="size-3.5" aria-hidden />
      </button>

      {ouverte ? (
        <span
          id={id}
          role="tooltip"
          /* `left-0` et non centré : une bulle centrée sur une icône proche du
             bord droit déborde de l'écran en mobile. Ancrée à gauche, elle
             reste dans le cadre quelle que soit la position du champ. */
          className="absolute bottom-full left-0 z-20 mb-2 w-64 max-w-[min(16rem,calc(100vw-2.5rem))] rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-ink-muted shadow-md"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
