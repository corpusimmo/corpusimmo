import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap, Target, Workflow } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { MODULE_STATUS_LABELS } from "@/config/navigation";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * NON PUBLIÉE, donc hors index.
 *
 * L'offre professionnelle est écrite mais elle n'est pas ouverte : elle a été
 * retirée du menu (`unpublishedNav` dans `src/config/navigation.ts`). Indexer
 * une page qui vend un rendez-vous qu'on ne peut pas encore honorer serait la
 * même faute que promettre un prix qu'on ne sait pas tenir.
 *
 * `follow` reste vrai : les liens vers l'estimateur, la carte et les outils
 * doivent continuer d'irriguer le reste du site. Le sitemap l'exclut tout seul,
 * en lisant ce `index: false` (voir `src/lib/seo/routes.ts`).
 */
export const metadata: Metadata = pageMetadata({
  title: "Solutions IA pour les professionnels de l'immobilier",
  description:
    "Automatisation des tâches répétitives, formation à l'IA appliquée au métier et leads "
    + "vendeurs consentis. Trois offres décrites sans fard, aucune encore ouverte.",
  path: "/solutions",
  socialTitle: "Ce que nous préparons pour les agences",
  index: false,
});

const OFFERS = [
  {
    href: "/solutions/automatisation",
    icon: Workflow,
    label: "Automatisation sur mesure",
    promise:
      "Les tâches qui reviennent chaque semaine (qualifier, relancer, mettre à jour, reporter) exécutées sans vous.",
    bullets: [
      "Qualification des demandes entrantes",
      "Relances programmées et sorties automatiques",
      "Estimation augmentée dans vos propres outils",
      "Reporting mensuel assemblé et diffusé",
    ],
  },
  {
    href: "/solutions/formation",
    icon: GraduationCap,
    label: "Formation IA immobilier",
    promise:
      "Apprendre à faire faire : quelles tâches confier à une IA, comment vérifier ce qu'elle produit, où sont les pièges.",
    bullets: [
      "Animée par des analystes qui ont exercé le métier",
      "Les outils de la bibliothèque en support",
      "Cas réels, pas de démonstration de salon",
      "Sessions courtes, en intra ou à distance",
    ],
  },
  {
    href: "/solutions/leads-vendeurs",
    icon: Target,
    label: "Leads vendeurs",
    promise:
      "Des propriétaires de votre secteur qui ont estimé leur bien et accepté d'être contactés.",
    bullets: [
      "Consentement explicite, horodaté, tracé",
      "Bien localisé, typologie et surface connues",
      "Score d'intention transmis avec le contact",
      "Volume limité par secteur, pour ne pas diluer",
    ],
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-page py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Pour les professionnels</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.1] text-ink md:text-5xl">
              La preuve d&apos;abord, la proposition ensuite
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-muted">
              Avant de vous vendre quoi que ce soit, nous avons construit un estimateur dont la
              méthode est publiée, une carte de toutes les mutations enregistrées, et dix
              calculateurs métier, le tout ouvert et gratuit. Vous pouvez les essayer maintenant,
              et juger sur pièces.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/outils">
                  Essayer les outils
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/observatoire">Voir l&apos;observatoire</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="offres" className="container-page py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 id="offres" className="font-display text-3xl leading-tight text-ink">
            Trois façons de travailler ensemble
          </h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Aucune n&apos;est encore ouverte à la commande. Les pages ci-dessous décrivent
            exactement ce qui est prêt et ce qui ne l&apos;est pas&nbsp;: nous préférons le dire que le
            laisser découvrir.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {OFFERS.map((offer) => (
            <li key={offer.href}>
              <Link
                href={offer.href}
                className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex items-center justify-between gap-3">
                  <offer.icon aria-hidden="true" className="size-5 text-accent" />
                  <Badge tone="neutral" size="sm">
                    {MODULE_STATUS_LABELS.preview}
                  </Badge>
                </span>
                <h3 className="font-display text-xl leading-snug text-ink">{offer.label}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{offer.promise}</p>
                <ul className="flex flex-1 flex-col gap-1.5 border-t border-border-soft pt-4">
                  {offer.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm text-ink-muted">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1 shrink-0 rounded-full bg-accent-rule"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  En savoir plus
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
    </>
  );
}
