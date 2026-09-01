"use client";

/**
 * LA GALERIE D'APERÇUS : une capture par onglet du classeur.
 *
 * Montrer vaut mieux qu'affirmer. Une description promet un modèle sérieux ;
 * quatre captures des onglets réels, formules calculées, le prouvent en une
 * seconde.
 *
 * Défilement horizontal natif avec accroche plutôt qu'un carrousel scripté :
 * ça marche au doigt sur mobile, à la molette sur ordinateur, au clavier
 * partout, et ça ne casse pas quand le JavaScript tarde à arriver.
 *
 * Les captures très hautes (un échéancier de trois cents lignes) sont
 * présentées rognées par le haut : sans ce garde-fou, un seul onglet pousserait
 * tout le reste de la page hors de l'écran. Le lien « taille réelle » rend la
 * capture entière à qui la veut, et n'apparaît que là où il y a du hors-champ.
 */

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

import { MAX_PREVIEW_TALLNESS, type ToolPreviewShot } from "@/data/tool-previews";

export function PreviewGallery({ shots, title }: { shots: ToolPreviewShot[]; title: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((index: number) => {
    const track = rail.current;
    const target = track?.children[index] as HTMLElement | undefined;
    if (!track || !target) return;
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: "smooth" });
    setActive(index);
  }, []);

  // La position lue au défilement, pour que les onglets suivent aussi un
  // glissement au doigt et pas seulement les flèches.
  const onScroll = useCallback(() => {
    const track = rail.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / (track.clientWidth || 1)));
  }, []);

  if (shots.length === 0) return null;
  const single = shots.length === 1;

  return (
    <figure className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={rail}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={`Aperçus du classeur ${title}`}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
        >
          {shots.map((shot, index) => {
            const cropped = shot.height / shot.width > MAX_PREVIEW_TALLNESS;
            const ratio = cropped ? 1 / MAX_PREVIEW_TALLNESS : shot.width / shot.height;
            return (
              <div
                key={shot.src}
                className="w-full shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                <div className="relative w-full" style={{ aspectRatio: ratio }}>
                  <Image
                    src={shot.src}
                    alt={`${title}, onglet ${shot.label}`}
                    fill
                    sizes="(min-width: 1024px) 42rem, 100vw"
                    className="object-cover object-top"
                    priority={index === 0}
                  />
                </div>
                {cropped ? (
                  <a
                    href={shot.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    <Maximize2 aria-hidden="true" className="size-3.5" />
                    Onglet plus long que l&apos;écran : voir en taille réelle
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>

        {!single ? (
          <>
            <RailButton side="left" disabled={active === 0} onClick={() => goTo(Math.max(0, active - 1))} />
            <RailButton
              side="right"
              disabled={active >= shots.length - 1}
              onClick={() => goTo(Math.min(shots.length - 1, active + 1))}
            />
          </>
        ) : null}
      </div>

      {!single ? (
        /* `gap-y-4` et non `gap-2` : chaque onglet porte une zone d'appui de
           44 px, plus haute que la pastille de 28 px. Quand la rangée passe à
           la ligne, il faut donc 16 px entre les lignes pour que la zone d'un
           onglet ne recouvre pas celle de la ligne suivante — deux cibles qui
           se chevauchent transforment un bon geste en mauvais clic. */
        <div className="flex flex-wrap items-center gap-x-2 gap-y-4">
          {shots.map((shot, index) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => goTo(index)}
              aria-current={index === active}
              className={`tap-target relative rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                index === active
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {shot.label}
            </button>
          ))}
        </div>
      ) : null}

      <figcaption className="text-xs leading-relaxed text-ink-subtle">
        Captures du classeur réel, avec ses valeurs d&apos;exemple calculées : les cellules bleues
        sont les vôtres, les blanches se calculent seules. Elles datent de la version précédente du
        fichier ; la matrice en cours de révision reprend la même structure, à quelques postes près.
      </figcaption>
    </figure>
  );
}

function RailButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Aperçu précédent" : "Aperçu suivant"}
      // Le rond de 36 px reste dessiné tel quel : il flotte sur la capture et
      // s'y ferait remarquer plus gros. Seule sa zone d'appui monte à 44 px, et
      // les deux flèches sont aux extrémités opposées : aucun recouvrement.
      className={`tap-target absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-surface/95 p-2 shadow-sm backdrop-blur transition-opacity hover:bg-surface sm:block ${
        side === "left" ? "left-2" : "right-2"
      } ${disabled ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Icon aria-hidden="true" className="size-5 text-ink" />
    </button>
  );
}
