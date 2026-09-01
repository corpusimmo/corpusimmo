import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * Le logotype est dessiné, jamais importé en bitmap : il doit rester net à
 * toutes les tailles, hériter des couleurs du thème et ne coûter aucune requête.
 *
 * LE SIGNE — un corpus est un ENSEMBLE de pièces attestées. La marque montre
 * donc une pile d'actes, dont un seul est mis en évidence, en bronze : c'est
 * exactement ce que fait le produit — retrouver, dans la masse des mutations
 * enregistrées, celle qui ressemble à votre bien. Le trait bronze est
 * volontairement le plus court : la pièce retenue est toujours une exception
 * dans le corpus, jamais la moyenne.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <g strokeLinecap="round" fill="none">
        <path d="M9 11h14" stroke="var(--primary-fg)" strokeWidth="2.4" opacity="0.55" />
        <path d="M9 16h9" stroke="var(--accent-rule)" strokeWidth="2.4" />
        <path d="M9 21h14" stroke="var(--primary-fg)" strokeWidth="2.4" opacity="0.55" />
      </g>
    </svg>
  );
}

export function BrandLockup({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} />
      <span className="font-display text-[1.125rem] font-semibold tracking-[-0.012em] text-ink">
        {siteConfig.name}
      </span>
    </span>
  );
}
