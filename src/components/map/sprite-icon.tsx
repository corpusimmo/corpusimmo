"use client";

/**
 * Une image du sprite de la carte, affichée en HTML.
 *
 * POURQUOI CE DÉTOUR. La légende doit montrer le dessin EXACT que la carte
 * pose sur un arrêt. Prendre une icône d'une autre famille, même proche de
 * sens, laisse au lecteur une correspondance à faire dans sa tête, donc une
 * correspondance qu'il ne fera pas.
 *
 * Or un sprite MapLibre est un atlas PNG plus un index JSON de coordonnées :
 * il n'est pas consultable comme une image isolée. On lit donc l'index une
 * fois, puis chaque icône devient un cadre de la taille voulue, avec l'atlas
 * en fond décalé sur ses coordonnées. C'est le mécanisme même du sprite, joué
 * en CSS au lieu de WebGL.
 *
 * L'index est chargé UNE fois pour toute l'application, par une promesse de
 * module : une légende de dix entrées ne doit pas déclencher dix requêtes.
 * Le fichier est de toute façon déjà téléchargé par la carte, donc le cache
 * du navigateur répond.
 *
 * Tant que l'index n'est pas là, ou si l'icône n'existe pas, on rend une
 * pastille de la couleur de la famille : la légende reste lisible et garde sa
 * hauteur, au lieu de sauter quand les images arrivent.
 */

import * as React from "react";

import { SPRITE_BASE } from "./transports";

interface SpriteEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

type SpriteIndex = Record<string, SpriteEntry>;

let indexPromise: Promise<SpriteIndex> | null = null;

function loadIndex(): Promise<SpriteIndex> {
  indexPromise ??= fetch(`${SPRITE_BASE}.json`)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<SpriteIndex>;
    })
    .catch(() => ({}));
  return indexPromise;
}

export function SpriteIcon({
  name,
  color,
  size = 14,
}: {
  name: string | null;
  /** Repli, et couleur de la famille : elle porte la correspondance. */
  color: string;
  size?: number;
}) {
  const [entry, setEntry] = React.useState<SpriteEntry | null>(null);

  React.useEffect(() => {
    if (!name) return;
    let alive = true;
    void loadIndex().then((index) => {
      if (alive) setEntry(index[name] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  if (!entry) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full border border-border-strong/40"
        style={{ backgroundColor: color, width: size * 0.8, height: size * 0.8 }}
      />
    );
  }

  /**
   * L'index donne des coordonnées en pixels de l'ATLAS, et l'index ne donne
   * pas les dimensions de l'atlas. On ne peut donc pas calculer un
   * `background-size` en pourcentage : on découpe à la taille exacte du cadre,
   * avec le fond à sa taille naturelle, puis on met le tout à l'échelle par
   * une transformation. C'est la seule méthode qui reste juste quel que soit
   * le `pixelRatio` de l'atlas, y compris s'il change un jour.
   */
  const scale = size / entry.height;

  return (
    <span
      aria-hidden="true"
      className="block shrink-0 overflow-hidden"
      style={{ width: entry.width * scale, height: size }}
    >
      <span
        className="block bg-no-repeat"
        style={{
          width: entry.width,
          height: entry.height,
          backgroundImage: `url(${SPRITE_BASE}.png)`,
          backgroundPosition: `-${entry.x}px -${entry.y}px`,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      />
    </span>
  );
}
