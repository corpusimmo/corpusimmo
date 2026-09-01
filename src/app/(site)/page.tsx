import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, Map as MapIcon, Scale, Table2 } from "lucide-react";

import { HeroAddressSearch } from "@/components/marketing/hero-address-search";
import { Button } from "@/components/ui";
import { disclaimers, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

/**
 * L'accueil, en une seule colonne et pour tout le monde.
 *
 * Pas de porte « Particulier / Professionnel » : les deux audiences utilisent
 * les mêmes outils, et faire choisir un profil à l'entrée coûte un clic pour
 * n'apprendre rien. Le tri se fait plus bas, dans le langage des sections — et
 * dans les outils eux-mêmes, où l'usage est la première question posée.
 */
export default function HomePage() {
  return (
    <>
      {/* ───────────────────────────────────────────────────────────── hero */}
      <section className="border-b border-border bg-surface">
        <div className="container-page py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">{siteConfig.signature}</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-ink md:text-[3.25rem]">
              Ce qui s&apos;est vraiment vendu, et à quel prix
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
              Les autres estimateurs partent d&apos;annonces — c&apos;est-à-dire de prix demandés.
              Nous partons d&apos;actes : les mutations enregistrées par la DGFiP, publiées en open
              data. Un logement, un commerce, un plateau de bureaux : la même méthode, et elle est
              écrite.
            </p>

            <div className="mt-8 max-w-2xl">
              <HeroAddressSearch />
              <p className="mt-3 text-sm text-ink-subtle">
                Gratuit, sans compte. Vous choisirez ensuite s&apos;il s&apos;agit d&apos;un bien
                résidentiel ou professionnel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────── les outils */}
      <section aria-labelledby="outils" className="container-page py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 id="outils" className="font-display text-3xl leading-tight text-ink">
            Quatre façons d&apos;entrer dans la donnée
          </h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Tout est ouvert. Rien n&apos;est verrouillé derrière un compte, parce qu&apos;un outil
            qu&apos;on ne peut pas essayer ne prouve rien.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {ENTRIES.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 transition-shadow hover:shadow-md"
              >
                <entry.icon aria-hidden="true" className="size-5 text-accent" />
                <h3 className="font-display text-xl leading-snug text-ink">{entry.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-ink-muted">{entry.body}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  {entry.cta}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ──────────────────────────────────────────────────────── la méthode */}
      <section aria-labelledby="methode" className="border-y border-border bg-surface">
        <div className="container-page py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">La méthode</p>
            <h2 id="methode" className="mt-2 font-display text-3xl leading-tight text-ink">
              Une estimation qu&apos;un professionnel peut contester ligne à ligne
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              Le moteur ne cherche pas la précision maximale : il cherche à être défendable. À
              chaque étape, il préfère la méthode dont on peut expliquer le comportement.
            </p>
          </div>

          <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {METHOD.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="tnum font-display text-3xl text-accent-rule">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────────────────────────────────────── honnêteté données */}
      <section aria-labelledby="donnees" className="container-page py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">Les données</p>
            <h2 id="donnees" className="mt-2 font-display text-3xl leading-tight text-ink">
              Ce que nous savons, et ce que nous ne saurons jamais
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">{disclaimers.dvfSource}</p>
            <p className="mt-3 leading-relaxed text-ink-muted">{disclaimers.dvfLimits}</p>
          </div>

          <ul className="flex flex-col gap-4">
            {HONESTY.map((rule) => (
              <li key={rule.title} className="rounded-lg border border-border bg-surface p-5">
                <h3 className="text-sm font-semibold text-ink">{rule.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{rule.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── pour les pros */}
      <section aria-labelledby="pros" className="border-t border-border bg-surface-3">
        <div className="container-page py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">Pour les professionnels</p>
            <h2 id="pros" className="mt-2 font-display text-3xl leading-tight text-ink">
              Les outils sont la démonstration, pas le produit
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Ce que vous voyez ici — un estimateur, une carte, un observatoire, dix calculateurs —
              a été construit par des gens qui automatisent des tâches immobilières pour des
              agences. Si ces outils vous semblent sérieux, c&apos;est le meilleur argument que nous
              ayons.
            </p>
            <Button asChild className="mt-7">
              <Link href="/solutions">
                Voir ce que nous faisons pour les agences
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

const ENTRIES = [
  {
    href: "/estimer",
    icon: Scale,
    title: "Estimer un bien",
    body: "Six questions, puis une fourchette calculée sur les ventes comparables du secteur — avec le détail de ce qui a été retenu et de ce qui a été écarté.",
    cta: "Lancer une estimation",
  },
  {
    href: "/carte",
    icon: MapIcon,
    title: "La carte des ventes",
    body: "Toutes les mutations enregistrées, à l'échelle de la rue. Prix, surface, date, type de bien. Plein écran, sans compte, sans limite de consultation.",
    cta: "Ouvrir la carte",
  },
  {
    href: "/observatoire",
    icon: Table2,
    title: "L'observatoire",
    body: "La même donnée, augmentée : prix médian au m², volumes, dispersion, recherche tabulaire et sélection de comparables qui vous suit d'un écran à l'autre.",
    cta: "Explorer le marché",
  },
  {
    href: "/outils",
    icon: Layers,
    title: "Dix outils de calcul",
    body: "Rentabilité locative, coût réel d'un prêt, arbitrage fiscal, DCF sur dix ans, charge foncière, WAULT… avec les barèmes affichés et modifiables.",
    cta: "Voir les outils",
  },
] as const;

const METHOD = [
  {
    title: "On cherche autour",
    body: "Rayon de 500 m, élargi seulement si nécessaire jusqu'à 5 km. Dans un secteur dense, on ne s'élargit jamais.",
  },
  {
    title: "On écarte, et on le dit",
    body: "Mutations multi-lots, ventes qui ne sont pas des ventes, surfaces hors tolérance, prix au m² aberrants. Chaque motif est compté et affiché.",
  },
  {
    title: "On pondère",
    body: "Distance, récence, surface, typologie — combinées par moyenne géométrique, pour qu'un excellent critère ne rachète jamais un critère catastrophique.",
  },
  {
    title: "On donne une fourchette",
    body: "Jamais un prix ferme. Sa largeur dépend de la qualité du jeu de comparables, et un score de confiance dit ce qu'elle vaut.",
  },
] as const;

const HONESTY = [
  {
    title: "Jamais de repli silencieux",
    body: "Si la source est indisponible, l'interface le dit et propose de réessayer. Elle ne substitue jamais une valeur inventée à une valeur manquante.",
  },
  {
    title: "Plancher statistique de cinq mutations",
    body: "En dessous, aucune valeur ni médiane n'est publiée. Une moyenne sur trois ventes n'est pas une moyenne, c'est une anecdote.",
  },
  {
    title: "Aucun comparable ne pèse plus de 40 %",
    body: "Sans ce plafond, une « valeur de marché » pourrait n'être, en pratique, que le prix d'une seule vente — et sa confidentialité en dépend.",
  },
  {
    title: "Le mot est estimation, jamais expertise",
    body: "Seul un professionnel ayant visité le bien peut établir une valeur vénale ferme. Nous ne prétendrons jamais le contraire.",
  },
] as const;
