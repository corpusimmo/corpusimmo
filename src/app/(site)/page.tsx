import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Map as MapIcon,
  Scale,
  Table2,
} from "lucide-react";

import { MethodDiagram, RadiusEscalation } from "@/components/illustrations";
import { CorpusStrip } from "@/components/marketing/corpus-strip";
import { HeroAddressSearch } from "@/components/marketing/hero-address-search";
import { HeroExhibit } from "@/components/marketing/hero-exhibit";
import { HeroSlideshow } from "@/components/marketing/hero-slideshow";
import { TypologyStrip } from "@/components/marketing/typology-strip";
import { Button } from "@/components/ui";
import { disclaimers, siteConfig } from "@/config/site";
import { publishedCities } from "@/lib/cities/dataset";
import { SITE_DESCRIPTION, SITE_TITLE, pageMetadata } from "@/lib/seo/metadata";

/**
 * Le seul titre du site qui ne passe PAS par le gabarit « %s · CorpusImmo ».
 *
 * Il porte déjà la marque en tête, et l'accueil est la page où l'on cherche le
 * nom autant que le service. Le titre social, lui, est celui de la page : hors
 * du site, une promesse marche mieux qu'une raison sociale.
 */
export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
  socialTitle: "Ce qui s'est vraiment vendu, et à quel prix",
  socialDescription:
    "Estimation, carte des ventes et observatoire, sur les mutations enregistrées par la DGFiP.",
});

/**
 * LA COMMUNE DE LA PIÈCE À CONVICTION.
 *
 * Nantes, parce que son marché est profond (plus de vingt mille ventes
 * d'appartements exploitables), lisible (une seule commune, pas d'arrondissement
 * à expliquer), et que sa dispersion illustre bien ce qu'une médiane cache. Le
 * jour où une autre commune conviendra mieux, c'est une constante à changer.
 * Si elle venait à sortir du jeu de données, la pièce disparaît proprement au
 * lieu d'afficher un cadre vide.
 */
const EXHIBIT_CITY = "nantes";

/**
 * L'accueil, en une seule colonne et pour tout le monde.
 *
 * Pas de porte « Particulier / Professionnel » : les deux audiences utilisent
 * les mêmes outils, et faire choisir un profil à l'entrée coûte un clic pour
 * n'apprendre rien. Le tri se fait plus bas, dans le langage des sections, et
 * dans les outils eux-mêmes, où l'usage est la première question posée.
 *
 * LA PAGE MONTRE AVANT DE DIRE. Un site qui se réclame des ventes réelles ne
 * peut pas s'ouvrir sur un titre et un champ vide : la première vue porte un
 * relevé calculé sur des actes, le bandeau qui suit donne la mesure exacte du
 * corpus, et la méthode est dessinée avant d'être décrite. Tout ce qui est
 * chiffré ici est calculé au build depuis le jeu de données versionné.
 */
export default function HomePage() {
  const exhibit = publishedCities().find((city) => city.slug === EXHIBIT_CITY);

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── hero */}
      <section className="relative isolate overflow-hidden bg-surface-inverted text-ink-inverted">
        <HeroSlideshow />

        <div className="container-page relative grid gap-12 pt-14 pb-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:pt-20 lg:pb-32 [&>*]:min-w-0">
          <div>
            {/* Sur le voile marine, la pastille passe en réserve : fond blanc
                translucide, texte or clair. */}
            <p className="eyebrow !bg-white/10 !text-[color:var(--accent-rule)] backdrop-blur-sm">
              {siteConfig.signature}
            </p>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[1.02] font-extrabold text-ink-inverted md:text-[3.75rem] lg:text-[4.25rem]">
              Ce qui s&apos;est vraiment vendu, et à quel prix
            </h1>
            {/* Deux lignes, pas six. L'écart annonce / acte est l'argument entier
                du produit ; le détail (les typologies, la méthode) est repris
                plus bas, où il a la place d'être démontré. */}
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/80">
              Des actes, pas des annonces&nbsp;: les mutations enregistrées par
              la DGFiP, publiées en open data.
            </p>

            <div className="mt-9 max-w-xl">
              <HeroAddressSearch />
              <p className="mt-3 text-sm text-white/65">
                Gratuit, sans compte. Résidentiel ou professionnel.
              </p>
            </div>
          </div>

          {exhibit ? (
            <div className="min-w-0 lg:pl-4">
              <HeroExhibit city={exhibit} />
            </div>
          ) : null}
        </div>
      </section>

      <CorpusStrip />

      <TypologyStrip />

      {/* ──────────────────────────────────────────────────────── les outils */}
      <section
        aria-labelledby="outils"
        className="container-page py-16 md:py-24"
      >
        <div className="max-w-2xl">
          <p className="eyebrow">Quatre entrées</p>
          <h2
            id="outils"
            className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
          >
            Quatre façons d&apos;entrer dans la donnée
          </h2>
          <p className="mt-4 leading-relaxed text-ink-muted">
            L&apos;estimateur, la carte et l&apos;observatoire sont ouverts sans
            compte, parce qu&apos;un outil qu&apos;on ne peut pas essayer ne
            prouve rien. Les dix calculateurs se consultent librement et
            s&apos;utilisent une fois connecté.
          </p>
        </div>

        {/* Quatre colonnes égales : une carte plus large que les autres
            laissait un trou dans la grille à partir de 1024 px. L'entrée
            principale se distingue par sa teinte et son filet, pas par sa
            taille. */}
        <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {ENTRIES.map((entry, index) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className={
                  "group relative flex h-full flex-col gap-4 overflow-hidden rounded-lg border border-border p-7 shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md " +
                  (index === 0 ? "bg-surface-3" : "bg-surface")
                }
              >
                {/* Le filet bronze : permanent sur l'entrée principale, allumé
                    au survol sur les autres. La sélection, dans le vocabulaire
                    de la marque. */}
                <span
                  aria-hidden="true"
                  className={
                    "absolute inset-x-0 top-0 h-0.5 origin-left bg-accent-rule transition-transform duration-300 ease-out group-hover:scale-x-100 " +
                    (index === 0 ? "scale-x-100" : "scale-x-0")
                  }
                />
                <span className="grid size-11 place-items-center rounded-md bg-primary-soft text-primary">
                  <entry.icon aria-hidden="true" className="size-5" />
                </span>
                <div className="flex flex-1 flex-col gap-2">
                  <h3 className="font-display text-xl leading-snug text-ink">
                    {entry.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {entry.body}
                  </p>
                </div>
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
      <section aria-labelledby="methode" className="container-page">
        <div className="panel px-6 py-12 md:px-12 md:py-16 lg:px-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="eyebrow">La méthode</p>
              <h2
                id="methode"
                className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
              >
                Une estimation qu&apos;un professionnel peut contester ligne à
                ligne
              </h2>
              <p className="mt-4 leading-relaxed text-ink-muted">
                Le moteur ne cherche pas la précision maximale&nbsp;: il cherche
                à être défendable. À chaque étape, il préfère la méthode dont on
                peut expliquer le comportement, et il l&apos;affiche.
              </p>

              <ol className="mt-8 flex flex-col divide-y divide-border-soft">
                {METHOD.map((step, index) => (
                  <li
                    key={step.title}
                    className="flex gap-5 py-4 first:pt-0 last:pb-0"
                  >
                    <span className="tnum w-8 shrink-0 font-display text-2xl leading-none text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* `self-start` : la colonne de gauche est collante et la grille
                étire ses cellules par défaut. Sans lui, le cadre du schéma
                s'allonge jusqu'au bas de la section, vide sur les deux tiers. */}
            <div className="rounded-xl bg-canvas p-4 md:p-6 lg:self-start">
              <MethodDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────── la signature */}
      <section
        aria-label="Notre engagement"
        className="container-page pt-6 md:pt-8"
      >
        <div className="relative isolate overflow-hidden rounded-2xl bg-primary text-ink-inverted shadow-lg">
          {/* Les toits d'une ville en fin de journée, sous un voile de marine :
            l'image installe le registre de l'observatoire sans jamais
            concurrencer le texte. `priority` non : elle est sous le pli. */}
          <Image
            src="/illustrations/ville-toits.webp"
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover object-center opacity-60"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_srgb,var(--primary)_90%,transparent)_45%,color-mix(in_srgb,var(--primary)_55%,transparent)_100%)]"
          />
          <div className="grid gap-10 px-6 py-14 md:px-12 md:py-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:px-16">
            {/* La citation est le seul texte du site en sérif : c'est là que
              vit la part institutionnelle du registre. */}
            <p className="font-serif text-3xl leading-[1.15] italic md:text-[2.5rem]">
              «&nbsp;Un corpus est un ensemble clos de pièces authentiques. Rien
              n&apos;y entre qui n&apos;ait été constaté.&nbsp;»
            </p>
            <ul className="grid gap-6 sm:grid-cols-3">
              {PLEDGES.map((pledge) => (
                <li
                  key={pledge.title}
                  className="border-t border-accent-rule pt-4"
                >
                  <p className="font-display text-lg leading-snug">
                    {pledge.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-inverted/75">
                    {pledge.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────── honnêteté données */}
      <section
        aria-labelledby="donnees"
        className="container-page py-16 md:py-24"
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">Les données</p>
            <h2
              id="donnees"
              className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
            >
              Ce que nous savons, et ce que nous ne saurons jamais
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              {disclaimers.dvfSource}
            </p>
            <p className="mt-3 leading-relaxed text-ink-muted">
              {disclaimers.dvfLimits}
            </p>

            <div className="mt-8 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
              <RadiusEscalation />
            </div>
          </div>

          <ul className="flex flex-col gap-4 lg:pt-16">
            {HONESTY.map((rule) => (
              <li
                key={rule.title}
                className="rounded-md border-l-2 border-accent-rule bg-surface py-4 pr-5 pl-5 shadow-sm"
              >
                <h3 className="font-display text-lg leading-snug text-ink">
                  {rule.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {rule.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────── pour les pros */}
      <section aria-labelledby="pros" className="container-page">
        <div className="grid gap-10 rounded-2xl bg-surface-3 px-6 py-12 md:px-12 md:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:px-16">
          <div className="max-w-2xl">
            <p className="eyebrow">Pour les professionnels</p>
            <h2
              id="pros"
              className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl"
            >
              Les outils sont la démonstration, pas le produit
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Ce que vous voyez ici, un estimateur, une carte, un observatoire
              et dix calculateurs, a été construit par des gens qui automatisent
              des tâches immobilières pour des agences. Si ces outils vous
              semblent sérieux, c&apos;est le meilleur argument que nous ayons.
            </p>
            {/* Pas de lien vers `/solutions` : l'offre n'est pas ouverte, la page
                est `noindex` et interdite aux robots. Renvoyer vers elle depuis
                l'accueil promettrait un rendez-vous qu'on ne peut pas honorer, et
                enverrait les robots sur une porte fermée. */}
            <Button asChild className="mt-7">
              <a href={`mailto:${siteConfig.contactEmail}`}>
                Nous écrire
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </Button>
          </div>

          <figure className="hidden lg:block">
            <div className="relative aspect-[3/2] overflow-hidden rounded-xl shadow-md">
              <Image
                src="/illustrations/bien-bureaux.webp"
                alt="Illustration : immeuble de bureaux des années 2000, mur-rideau et plateaux allumés en fin de journée."
                fill
                sizes="(min-width: 1024px) 420px, 0px"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2 text-xs text-ink-subtle">
              Illustration. Les biens du corpus ne sont jamais photographiés.
            </figcaption>
          </figure>
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
    body: "Six questions, puis une fourchette calculée sur les ventes comparables du secteur, avec le détail de ce qui a été retenu et de ce qui a été écarté.",
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
    body: "Distance, récence, surface et typologie, combinées par moyenne géométrique, pour qu'un excellent critère ne rachète jamais un critère catastrophique.",
  },
  {
    title: "On donne une fourchette",
    body: "Jamais un prix ferme. Sa largeur dépend de la qualité du jeu de comparables, et un score de confiance dit ce qu'elle vaut.",
  },
] as const;

const PLEDGES = [
  {
    title: "Des actes, pas des annonces",
    body: "Un prix demandé n'est pas un prix. Nous ne lisons que ce qui a été signé devant notaire.",
  },
  {
    title: "Une méthode écrite",
    body: "Chaque étape du calcul est publiée, et chaque vente écartée est comptée.",
  },
  {
    title: "Sans compte pour l'essentiel",
    body: "Estimateur, carte et observatoire restent ouverts. Ils sont la preuve, pas l'appât.",
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
    body: "Sans ce plafond, une « valeur de marché » pourrait n'être, en pratique, que le prix d'une seule vente, et sa confidentialité en dépend.",
  },
  {
    title: "Le mot est estimation, jamais expertise",
    body: "Seul un professionnel ayant visité le bien peut établir une valeur vénale ferme. Nous ne prétendrons jamais le contraire.",
  },
] as const;
