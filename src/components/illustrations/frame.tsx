import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * LE CADRE COMMUN DES SCHÉMAS.
 *
 * Trois décisions sont prises ici une fois pour toutes, pour que les six
 * schémas se ressemblent sans que chacun les réécrive.
 *
 * 1. LE DESSIN EST FLUIDE. `viewBox` + `width="100%"` : aucune largeur en
 *    pixels n’est écrite dans un schéma. C’est l’appelant qui borne la largeur
 *    (une colonne de texte, une carte), et le dessin suit.
 *
 * 2. LE NOM ACCESSIBLE EST PORTÉ PAR LE SVG, pas par la page. `role="img"` +
 *    `aria-label` donnent le nom court, `<desc>` la description longue. Un
 *    schéma qui explique la méthode et qu’un lecteur d’écran annonce
 *    « image » n’explique rien à la moitié des lecteurs.
 *
 * 3. LA LÉGENDE EST DU VRAI TEXTE HTML, jamais du texte SVG. Le texte d’un SVG
 *    fluide grandit et rétrécit avec le dessin : à 360 px de large, une légende
 *    dessinée devient illisible. Et c’est là, dans la légende, que se dit ce
 *    que le schéma SIMPLIFIE. Le produit s’interdit les fausses promesses
 *    partout ailleurs ; un dessin ne fait pas exception.
 */

/** Ce que tout schéma accepte. Rien de plus : un schéma n’a pas d’état. */
export interface DiagramProps {
  className?: string;
  /** Passer `false` retire la légende, quand le texte autour la porte déjà. */
  caption?: boolean;
}

export interface DiagramFigureProps {
  /** Le nom accessible du dessin. Court, il tient lieu de titre. */
  title: string;
  /** La description longue : ce qu’un lecteur voyant lit dans le dessin. */
  description: string;
  /** La légende visible sous le dessin. `null` la retire. */
  caption: ReactNode;
  viewBox: string;
  className?: string;
  children: ReactNode;
}

export function DiagramFigure({
  title,
  description,
  caption,
  viewBox,
  className,
  children,
}: DiagramFigureProps) {
  return (
    <figure className={cn("flex w-full flex-col gap-3", className)}>
      <svg
        viewBox={viewBox}
        width="100%"
        role="img"
        aria-label={title}
        focusable="false"
        className="block h-auto w-full text-ink"
      >
        {/* `<title>` fait l’infobulle du navigateur, `aria-label` fait le nom
            accessible : les deux disent la même chose, volontairement. */}
        <title>{title}</title>
        <desc>{description}</desc>
        {children}
      </svg>

      {caption ? (
        <figcaption className="text-xs leading-relaxed text-ink-subtle">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/**
 * Une flèche horizontale, tête comprise.
 *
 * Dessinée en polygone plutôt qu’avec un `<marker>` : un marqueur SVG exige un
 * `id` unique dans le document, et deux schémas posés sur la même page se
 * voleraient leurs flèches. Aucun `id` n’est émis par cette bibliothèque.
 */
export function ArrowRight({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const head = 6;
  return (
    <g className="stroke-border-strong" strokeWidth="1.5">
      <line x1={x1} y1={y} x2={x2 - head} y2={y} />
      <polygon
        points={`${x2},${y} ${x2 - head},${y - 3.6} ${x2 - head},${y + 3.6}`}
        className="fill-border-strong stroke-none"
      />
    </g>
  );
}
