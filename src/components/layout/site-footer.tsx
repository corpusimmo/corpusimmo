import Link from "next/link";

import { NewsletterForm } from "@/components/marketing/newsletter-form";
import { ConsentFooterLink } from "@/components/consent/consent-footer-link";
import { mainNav, secondaryNav } from "@/config/navigation";
import { disclaimers, siteConfig } from "@/config/site";

import { BrandMark } from "./brand-mark";

/**
 * Le pied de page porte trois choses, et rien d'autre : le plan du site (c'est
 * lui qui irrigue l'autorité vers tous les hubs, sur toutes les pages), la
 * provenance des données, et la phrase que nous ne dirons jamais autrement —
 * une estimation n'est pas une expertise.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-surface-inverted text-ink-inverted">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-md">
            <span className="inline-flex items-center gap-2.5">
              <BrandMark className="size-8" tone="inverted" />
              <span className="font-display text-lg font-semibold">{siteConfig.name}</span>
            </span>
            <p className="mt-3 font-display text-xl italic text-white/90">
              {siteConfig.signature}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{siteConfig.tagline}</p>

            <div className="mt-7 border-t border-white/15 pt-6">
              <h2 className="eyebrow !text-[color:var(--accent-rule)]">
                Ce qui bouge sur le marché
              </h2>
              <p className="mt-2 mb-4 text-sm leading-relaxed text-white/70">
                Les chiffres qui sortent, les méthodes qui tiennent. Pas de publicité.
              </p>
              <NewsletterForm />
            </div>
          </div>

          <nav aria-label="Plan du site" className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="eyebrow !text-[color:var(--accent-rule)]">Le produit</h2>
              <ul className="mt-3 space-y-2">
                {mainNav.map((entry) => (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      className="text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="eyebrow !text-[color:var(--accent-rule)]">La maison</h2>
              <ul className="mt-3 space-y-2">
                {secondaryNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <ConsentFooterLink className="text-sm text-white/75 transition-colors hover:text-white" />
                </li>
                <li>
                  <a
                    href={`mailto:${siteConfig.contactEmail}`}
                    className="text-sm text-white/75 transition-colors hover:text-white"
                  >
                    Nous écrire
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 border-t border-white/15 pt-8">
          <p className="max-w-3xl text-[0.8125rem] leading-relaxed text-white/60">
            {disclaimers.dvfSource}
          </p>
          <p className="mt-3 max-w-3xl text-[0.8125rem] leading-relaxed text-white/60">
            Fond cartographique : OpenFreeMap et OpenStreetMap. Géocodage : Géoplateforme IGN, base
            adresse nationale. {disclaimers.short}
          </p>
          <p className="mt-6 text-[0.8125rem] text-white/50">
            © {year} {siteConfig.legalName}
          </p>
        </div>
      </div>
    </footer>
  );
}
