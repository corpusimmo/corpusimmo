import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { MODULE_STATUS_LABELS } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export interface OfferPageProps {
  eyebrow: string;
  title: string;
  lede: string;
  /** Ce qui est livré, poste par poste. */
  delivers: { title: string; body: string }[];
  /** La frontière honnête : ce qui n'est pas prêt, et pourquoi. */
  notYet: string[];
  /** Ce qu'on peut essayer tout de suite, comme preuve. */
  proof: { href: string; label: string; body: string }[];
}

/**
 * La trame commune aux trois offres.
 *
 * Chacune se termine par un bloc « ce qui n'est pas prêt ». Ce n'est pas de la
 * modestie : une page de vente qui promet trois choses dont deux n'existent pas
 * se paie au premier rendez-vous, et beaucoup plus cher que l'aveu.
 */
export function OfferPage({ eyebrow, title, lede, delivers, notYet, proof }: OfferPageProps) {
  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Link
            href="/solutions"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Toutes les solutions
          </Link>

          <div className="max-w-3xl">
            <span className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">{eyebrow}</p>
              <Badge tone="neutral" size="sm">
                {MODULE_STATUS_LABELS.preview}
              </Badge>
            </span>
            <h1 className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">{lede}</p>
          </div>
        </header>

        <section aria-labelledby="livre" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-4">
            <h2 id="livre" className="font-display text-2xl text-ink">
              Ce qui est livré
            </h2>
            <ul className="flex flex-col gap-3">
              {delivers.map((item) => (
                <li key={item.title} className="rounded-lg border border-border bg-surface p-5">
                  <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <aside className="flex flex-col gap-4 self-start rounded-lg border border-warning/25 bg-warning-soft p-6">
            <h2 className="text-sm font-semibold text-warning-soft-fg">
              Ce qui n&apos;est pas encore prêt
            </h2>
            <ul className="flex flex-col gap-2.5">
              {notYet.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-warning-soft-fg/90">
                  {item}
                </li>
              ))}
            </ul>
            <p className="border-t border-warning/25 pt-4 text-sm leading-relaxed text-warning-soft-fg/90">
              Écrivez à{" "}
              <a href={`mailto:${siteConfig.contactEmail}`} className="font-semibold underline">
                {siteConfig.contactEmail}
              </a>{" "}
              si vous voulez en parler avant que ce soit ouvert.
            </p>
          </aside>
        </section>

        <section aria-labelledby="preuve" className="border-t border-border pt-10">
          <h2 id="preuve" className="font-display text-2xl text-ink">
            En attendant, jugez sur pièces
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {proof.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <h3 className="text-base font-semibold text-ink">{item.label}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    Essayer
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Button asChild variant="secondary" className="mt-8">
            <Link href="/outils">Voir les dix outils</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
