import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * Le logotype est dessiné, jamais importé en bitmap : il doit rester net à
 * toutes les tailles, hériter des couleurs du thème et ne coûter aucune requête.
 *
 * LE SIGNE — un titre de propriété.
 *
 * C'est la seule forme où les deux moitiés du nom ne sont pas juxtaposées mais
 * CONFONDUES : un titre de propriété est à la fois la pièce et le bien. La page
 * porte un toit, et la ligne bronze en dessous est celle de la signature —
 * l'acte est ce qui transforme un bâtiment en une mutation enregistrée, ce que
 * DVF publie et ce que ce produit lit.
 *
 * Le coin corné n'est pas décoratif : c'est lui qui empêche la forme d'être lue
 * comme une simple carte, et il rappelle qu'un corpus est fait de feuillets.
 */

/**
 * Le fond derrière la marque décide de son traitement.
 *
 * `inverted` n'est pas un thème : c'est le tirage en réserve, pour le bleu nuit
 * du pied de page où une page pleine en bleu nuit disparaîtrait purement et
 * simplement. Le trait remplace l'aplat, le bronze ne bouge pas.
 */
export type BrandMarkTone = "default" | "inverted";

/**
 * La géométrie, écrite une fois : les deux tirages la partagent.
 *
 * La maison porte des MURS, et ce n'est pas un détail de dessin. Le toit seul
 * se lit comme un chevron — une flèche vers le haut, un bouton « replier » —
 * dès qu'on descend sous 32 px. Deux traits verticaux suffisent à lever
 * l'ambiguïté, et ils s'arrêtent juste au-dessus de la ligne bronze : celle-ci
 * devient alors le SOL sur lequel la maison est posée autant que la ligne de
 * signature de l'acte. Un seul trait, deux rôles.
 */
const PAGE =
  "M7.5 3h11L26 10.5v16.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 27.5v-23A1.5 1.5 0 0 1 7.5 3z";
const ROOF = "M11 18.5 16 13.5l5 5";
const WALLS = "M12.6 18.5v4M19.4 18.5v4";
const SIGNATURE = "M10.5 25h11";

export function BrandMark({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: BrandMarkTone;
}) {
  const inverted = tone === "inverted";

  /**
   * LE SIGNE FOURNI, SUR FOND CLAIR. Deux fichiers, un par métal, et le
   * BASCULEMENT SE FAIT EN CSS plutôt qu'en JavaScript : les deux sont dans
   * le balisage et le thème en montre un. Choisir en JavaScript obligerait ce
   * composant à devenir client, et le signe apparaîtrait après l'hydratation,
   * c'est à dire en retard sur le reste de l'en-tête.
   *
   * SUR FOND SOMBRE, ON GARDE LE DESSIN. La tour de gauche du fichier est
   * marine : posée sur le marine du pied de page, elle disparaît. Tant qu'il
   * n'existe pas de version en réserve, le tracé fait le travail, lui qui
   * s'adapte à son fond.
   */
  if (!inverted) {
    return (
      <span
        className={cn(
          "relative inline-flex h-9 shrink-0 items-center",
          "[&>img]:h-full [&>img]:w-auto [&>svg]:h-full [&>svg]:w-auto",
          className,
          /* LA LARGEUR RESTE LIBRE, ET C'EST OBLIGATOIRE. Les appelants
             passent `size-8` ou `size-9`, qui fixent la largeur AUTANT que la
             hauteur : le signe en tours, plus haut que large, s'y écrasait
             d'un tiers. On force donc la largeur à suivre la hauteur, après
             `className` pour passer devant lui. */
          "!w-auto",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-or.webp"
          alt=""
          aria-hidden="true"
          className="signe-tours marque-or block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-argent.webp"
          alt=""
          aria-hidden="true"
          className="signe-tours marque-argent hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-violet.webp"
          alt=""
          aria-hidden="true"
          className="signe-tours marque-violet hidden"
        />
        {/* LA FAMILLE EN PILE, DANS LES TROIS MÉTAUX. Trois fichiers de
            plus dans le balisage, et c'est le CSS qui n'en montre qu'un : le
            composant reste rendu sur le serveur, donc le signe est peint avec
            la première image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-stack-or.webp"
          alt=""
          aria-hidden="true"
          className="signe-stack marque-or hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-stack-argent.webp"
          alt=""
          aria-hidden="true"
          className="signe-stack marque-argent hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marque-stack-violet.webp"
          alt=""
          aria-hidden="true"
          className="signe-stack marque-violet hidden"
        />
      </span>
    );
  }

  /**
   * SUR FOND SOMBRE, LE PIED DE PAGE SUIT LA MÊME FAMILLE QUE L'EN-TÊTE.
   *
   * Les plaques du signe en pile sont séparées par des liserés blancs et
   * gravées de pistes dorées : ce sont eux qui portent la forme, et ils
   * tiennent sur le marine du pied de page sans retouche. Le fichier y va
   * donc tel quel, plutôt que de laisser un second signe que personne n'a
   * choisi.
   *
   * Les tours, elles, restent le TRACÉ et non le fichier : leur plaque de
   * gauche est marine pleine, et sur le marine du pied de page elle
   * disparaîtrait. Le tracé prend les couleurs qu'on lui donne, donc il se
   * tire en réserve.
   */
  return (
    <span
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center",
        "[&>img]:h-full [&>img]:w-auto [&>svg]:h-full [&>svg]:w-auto",
        className,
        "!w-auto",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marque-stack-or.webp"
        alt=""
        aria-hidden="true"
        className="signe-stack marque-or hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marque-stack-argent.webp"
        alt=""
        aria-hidden="true"
        className="signe-stack marque-argent hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marque-stack-violet.webp"
        alt=""
        aria-hidden="true"
        className="signe-stack marque-violet hidden"
      />
      <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="signe-tours size-9 shrink-0"
    >
      <path
        d={PAGE}
        fill={inverted ? "none" : "var(--primary)"}
        stroke={inverted ? "var(--ink-inverted)" : "none"}
        strokeWidth={inverted ? 1.6 : undefined}
        strokeLinejoin="round"
      />

      {/* Le coin corné. Absent du tirage en réserve : à cette épaisseur de
          trait, il encombrerait la forme au lieu de la préciser. */}
      {inverted ? null : (
        <path
          d="M18.5 3 26 10.5h-7.5z"
          fill="var(--primary-fg)"
          opacity="0.18"
        />
      )}

      <g
        fill="none"
        stroke={inverted ? "var(--ink-inverted)" : "var(--primary-fg)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ROOF} />
        <path d={WALLS} />
      </g>

      {/* La ligne de signature. Le seul trait bronze de la marque. */}
      <path
        d={SIGNATURE}
        stroke="var(--accent-rule)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      </svg>
    </span>
  );
}

export function BrandLockup({
  className,
  markClassName,
  tone,
}: {
  className?: string;
  markClassName?: string;
  tone?: BrandMarkTone;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} tone={tone} />
      {/* « Corpus » en encre, « Immo » EN MÉTAL GRAVÉ, pas en feuille.

          LA FEUILLE A ÉTÉ ESSAYÉE ET RETIRÉE. Son dégradé place la lumière au
          MILIEU du mot : sur quatre lettres de dix-huit pixels, les deux du
          centre tombaient dans la bande claire et disparaissaient presque.
          Ce qui fait le relief d'une dorure sur un titre de cinquante pixels
          se retourne contre un mot-symbole, où chaque lettre compte et où
          aucune ne peut être sacrifiée à un reflet.

          Le gravé donne le même métal autrement : la couleur reste PLEINE,
          donc lisible partout, et le relief vient d'une lumière posée au-dessus
          de la lettre. Aucun dégradé, donc rien à perdre en petit. Sur fond
          sombre, la feuille reste légitime : la rampe y repart du clair et
          aucune lettre ne passe sous le seuil. */}
      <span
        className={cn(
          "font-display text-[1.125rem] font-semibold tracking-[-0.02em]",
          tone === "inverted" ? "text-ink-inverted" : "text-ink",
        )}
      >
        {siteConfig.nameParts[0]}
        <span
          className={
            tone === "inverted" ? "feuille-metal-inversee" : "grave-metal"
          }
        >
          {siteConfig.nameParts[1]}
        </span>
      </span>
    </span>
  );
}
