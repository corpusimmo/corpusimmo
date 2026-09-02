"use client";

/**
 * L'unique navigation du site.
 *
 * Cinq entrées triées par INTENTION, un CTA persistant, et pas la moindre
 * bascule « Particuliers / Professionnels » : la doctrine du produit est qu'on
 * trie les gens une fois à l'entrée et le contenu à l'intérieur des outils —
 * jamais le site lui-même (voir `src/config/navigation.ts`).
 *
 * Les deux entrées à sous-menu sont des DIVULGATIONS, pas des survols : un menu
 * qui ne s'ouvre qu'au survol est inatteignable au clavier et hostile au
 * tactile. Le survol ouvre aussi, en confort, mais le clic et la touche Entrée
 * restent le contrat.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

import { Button } from "@/components/ui";
import {
  MODULE_STATUS_LABELS,
  mainNav,
  primaryCta,
  secondaryNav,
} from "@/config/navigation";
import type { NavEntry, NavItem } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

import { AccountMenu } from "./account-menu";
import { BrandLockup } from "./brand-mark";

/** Actif sur la page elle-même ET sur ses sous-pages : `/outils/dcf` allume « Outils ». */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  // Une navigation ferme tout : sans ça, le panneau resterait ouvert par-dessus
  // la page d'arrivée.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openMenu, close]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70">
      {/* Le filet or en tête de page : un trait de deux pixels, c'est toute
          la part institutionnelle que le chrome se permet. */}
      <div
        aria-hidden="true"
        className="h-0.5 w-full bg-[linear-gradient(90deg,var(--accent-rule),var(--accent)_45%,var(--accent-rule))]"
      />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-fg"
      >
        Aller au contenu
      </a>

      <div className="container-page flex h-16 items-center justify-between gap-4">
        {/* `min-h-11` : le lockup dessine 38 px, et c'est la première cible de
            chaque page. Le bandeau fait 64 px, la hauteur est disponible. */}
        <Link
          href="/"
          aria-label={`${siteConfig.name}, accueil`}
          className="inline-flex min-h-11 items-center rounded-sm"
        >
          <BrandLockup markClassName="size-8" />
        </Link>

        <div ref={navRef} className="hidden lg:block">
          <nav aria-label="Navigation principale">
            <ul className="flex items-center gap-1">
              {mainNav.map((entry) => (
                <li key={entry.href} className="relative">
                  {entry.children?.length ? (
                    <DropdownEntry
                      entry={entry}
                      active={isActive(pathname, entry.href)}
                      open={openMenu === entry.href}
                      onToggle={() =>
                        setOpenMenu((current) =>
                          current === entry.href ? null : entry.href,
                        )
                      }
                      onOpen={() => setOpenMenu(entry.href)}
                    />
                  ) : (
                    <Link
                      href={entry.href}
                      className={cn(
                        // h-11 et non h-9 : ces entrées n'ont pas de fond, la
                        // hauteur ne se voit donc pas, mais elle se touche.
                        "inline-flex h-10 items-center rounded-full px-3.5 text-[0.9375rem] transition-colors",
                        isActive(pathname, entry.href)
                          ? "bg-surface-3 font-semibold text-ink"
                          : "text-ink-muted hover:bg-surface-3 hover:text-ink",
                      )}
                    >
                      {entry.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AccountMenu className="hidden lg:inline-flex" />
          {/* `tap-target` : le CTA est dessiné en `sm` (36 px) pour ne pas
              écraser le bandeau, sa zone d'appui monte seule à 44 px. */}
          <Button
            asChild
            size="sm"
            className="tap-target hidden sm:inline-flex"
          >
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="menu-mobile"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="sr-only">
              {mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            </span>
            {mobileOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <MobileMenu pathname={pathname} onClose={() => setMobileOpen(false)} />
      ) : null}
    </header>
  );
}

function DropdownEntry({
  entry,
  active,
  open,
  onToggle,
  onOpen,
}: {
  entry: NavEntry;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const panelId = useId();

  return (
    <div onPointerEnter={onOpen}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          // Même hauteur que les entrées simples, pour la même raison.
          "inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-[0.9375rem] transition-colors",
          active || open
            ? "bg-surface-3 font-semibold text-ink"
            : "text-ink-muted hover:bg-surface-3 hover:text-ink",
        )}
      >
        {entry.label}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="animate-fade-up absolute left-0 top-full z-50 mt-2 w-[26rem] rounded-lg border border-border bg-surface p-2 shadow-lg"
        >
          <ul>
            {entry.children?.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className="block rounded-md px-3 py-2.5 transition-colors hover:bg-surface-3"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {child.label}
                    </span>
                    {child.status && child.status !== "live" ? (
                      <span className="eyebrow shrink-0">
                        {MODULE_STATUS_LABELS[child.status]}
                      </span>
                    ) : null}
                  </span>
                  {child.description ? (
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-muted">
                      {child.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MobileMenu({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  return (
    <div
      id="menu-mobile"
      className="animate-fade-in border-t border-border bg-surface lg:hidden"
    >
      <div className="container-page flex items-center justify-between py-3">
        <span className="eyebrow">Navigation</span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3 hover:text-ink"
        >
          <span className="sr-only">Fermer le menu</span>
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="container-page pb-6">
        <ul className="divide-y divide-border-soft">
          {mainNav.map((entry) => (
            <li key={entry.href} className="py-2">
              <MobileLink item={entry} pathname={pathname} strong />
              {entry.children?.length ? (
                <ul className="mt-1 space-y-0.5 border-l-2 border-accent-rule pl-3">
                  {entry.children.map((child) => (
                    <li key={child.href}>
                      <MobileLink item={child} pathname={pathname} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>

        {/* Ces quatre entrées sont des cibles isolées dans une liste, pas des
            mots dans une phrase : elles prennent les 44 px, et l'écart entre
            les lignes se resserre d'autant. */}
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-0.5">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-3">
          <AccountMenu />
          <Button asChild fullWidth>
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
        </div>
      </nav>
    </div>
  );
}

function MobileLink({
  item,
  pathname,
  strong,
}: {
  item: NavItem;
  pathname: string;
  strong?: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        // `py-3` : le lien passe de 36 à 44 px de haut. Un menu mobile est
        // touché au pouce, jamais pointé.
        "block rounded-sm px-1 py-3",
        strong ? "text-[0.9375rem]" : "text-sm",
        isActive(pathname, item.href)
          ? "font-semibold text-ink"
          : "text-ink-muted",
      )}
    >
      {item.label}
    </Link>
  );
}
