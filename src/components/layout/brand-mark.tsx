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

  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-9 shrink-0", className)}
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
        <path d="M18.5 3 26 10.5h-7.5z" fill="var(--primary-fg)" opacity="0.18" />
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
      <path d={SIGNATURE} stroke="var(--accent-rule)" strokeWidth="2" strokeLinecap="round" />
    </svg>
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
      <span className="font-display text-[1.125rem] font-semibold tracking-[-0.012em] text-ink">
        {siteConfig.name}
      </span>
    </span>
  );
}
