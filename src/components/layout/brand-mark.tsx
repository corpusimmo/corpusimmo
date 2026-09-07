import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * LA MARQUE, EN DEUX FAMILLES DE SIGNE ET TROIS MÉTAUX.
 *
 * Les quatre fichiers sont TOUS dans le balisage, et c'est le CSS qui n'en montre
 * qu'un, selon `data-signe` et `data-theme` posés sur la racine. Choisir en
 * JavaScript obligerait ce composant à passer client, et le signe
 * n'apparaîtrait qu'après l'hydratation, donc en retard sur le reste de
 * l'en-tête. Quatre requêtes d'image contre un signe qui clignote : le choix
 * est vite fait, d'autant que les fichiers pèsent sept kilo-octets chacun.
 */

export type BrandMarkTone = "default" | "inverted";

export function BrandMark({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: BrandMarkTone;
}) {
  const inverted = tone === "inverted";

  /* Les deux tirages montrent les MÊMES fichiers : seule la plaque claire du
     tirage en réserve les sépare. */
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
        <Signes />
      </span>
    );
  }

  /**
   * SUR FOND SOMBRE, LE MÊME SIGNE, POSÉ SUR UNE PLAQUE CLAIRE.
   *
   * Les quatre fichiers sont des aplats sombres. Sur le fond du pied de page,
   * la moitié des plaques disparaît et il ne reste qu'un liseré doré ou
   * violet : la marque n'est plus reconnaissable. La plaque claire lui rend
   * le fond pour lequel elle a été dessinée, et le pied de page montre alors
   * exactement le signe choisi dans le sélecteur, famille et couleur comprises.
   *
   * Le tracé qui tenait ce rôle a été retiré : il montrait un signe que
   * personne n'avait choisi, et l'en-tête et le pied de page ne parlaient
   * plus de la même marque.
   */
  return (
    <span
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center rounded-lg bg-surface p-1",
        "[&>img]:h-full [&>img]:w-auto",
        className,
        "!w-auto",
      )}
    >
      <Signes />
    </span>
  );
}

/**
 * LES QUATRE FICHIERS, ÉCRITS UNE FOIS.
 *
 * Les deux tirages montrent le même jeu : les répéter dans chaque branche
 * garantissait qu'un ajout de métal n'atterrisse que dans l'une des deux.
 */
function Signes() {
  return (
    <>
      {SIGNES.map((signe) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={signe.fichier}
          src={signe.fichier}
          alt=""
          aria-hidden="true"
          className={cn(
            signe.famille,
            signe.metal,
            /* L'argent en tours est le seul montré par défaut : c'est le
               signe du thème écrit dans `:root`, celui que le serveur rend. */
            signe.defaut ? "block" : "hidden",
          )}
        />
      ))}
    </>
  );
}

const SIGNES = [
  { fichier: "/marque-argent.webp", famille: "signe-tours", metal: "marque-argent", defaut: true },
  { fichier: "/marque-violet.webp", famille: "signe-tours", metal: "marque-violet", defaut: false },
  { fichier: "/marque-stack-argent.webp", famille: "signe-stack", metal: "marque-argent", defaut: false },
  { fichier: "/marque-stack-violet.webp", famille: "signe-stack", metal: "marque-violet", defaut: false },
] as const;

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
