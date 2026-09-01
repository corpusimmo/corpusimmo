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
import { MODULE_STATUS_LABELS, mainNav, primaryCta, secondaryNav } from "@/config/navigation";
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
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-fg"
      >
        Aller au contenu
      </a>

      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={`${siteConfig.name}, accueil`} className="rounded-sm">
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
                      onToggle={() => setOpenMenu((current) => (current === entry.href ? null : entry.href))}
                      onOpen={() => setOpenMenu(entry.href)}
                    />
                  ) : (
                    <Link
                      href={entry.href}
                      className={cn(
                        "inline-flex h-9 items-center rounded-sm px-3 text-[0.9375rem] transition-colors",
                        isActive(pathname, entry.href)
                          ? "font-semibold text-ink"
                          : "text-ink-muted hover:text-ink",
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
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="menu-mobile"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="sr-only">{mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}</span>
            {mobileOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? <MobileMenu pathname={pathname} onClose={() => setMobileOpen(false)} /> : null}
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
          "inline-flex h-9 items-center gap-1 rounded-sm px-3 text-[0.9375rem] transition-colors",
          active || open ? "font-semibold text-ink" : "text-ink-muted hover:text-ink",
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
          className="animate-fade-up absolute left-0 top-full z-50 mt-1 w-[26rem] rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          <ul>
            {entry.children?.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className="block rounded-sm px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{child.label}</span>
                    {child.status && child.status !== "live" ? (
                      <span className="eyebrow shrink-0">{MODULE_STATUS_LABELS[child.status]}</span>
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

function MobileMenu({ pathname, onClose }: { pathname: string; onClose: () => void }) {
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
          className="inline-flex size-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
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

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="text-sm text-ink-muted hover:text-ink">
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
        "block rounded-sm px-1 py-2",
        strong ? "text-[0.9375rem]" : "text-sm",
        isActive(pathname, item.href) ? "font-semibold text-ink" : "text-ink-muted",
      )}
    >
      {item.label}
    </Link>
  );
}
