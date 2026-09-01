import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

import { QuotaExhausted } from "@/components/tools/quota-exhausted";
import { SignInGate } from "@/components/tools/sign-in-gate";
import { ToolRunner } from "@/components/tools/tool-runner";
import { UnlockForm } from "@/components/tools/unlock-form";
import { disclaimers } from "@/config/site";
import { getToolCard } from "@/data/tools-catalogue";
import { pageMetadata } from "@/lib/seo/metadata";
import { readAccess } from "@/lib/access/ledger";
import { auth, isAuthConfigured } from "@/lib/auth";
import { getToolSpec } from "@/lib/tools/definitions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * LE CALCULATEUR, derrière la porte.
 *
 * La fiche publique décrit l'outil et reste statique, donc indexable et
 * instantanée. Le calculateur vit ici, sur une page à part qui relit le registre
 * d'accès à CHAQUE rendu : deviner l'URL ne sert à rien, et le verrou ne dépend
 * pas de ce que le navigateur veut bien exécuter.
 *
 * Cette page n'est pas indexable, et c'est volontaire : elle n'a pas de contenu
 * propre à référencer, et une page de résultats vide dans l'index dessert la
 * fiche qui, elle, a quelque chose à dire.
 *
 * DEUX PORTES, DANS CET ORDRE
 *   1. la CONNEXION. Les dix calculateurs se consultent sans compte mais ne
 *      s'utilisent qu'une fois connecté : c'est la seule chose du site qui le
 *      demande, l'estimateur, la carte et l'observatoire restant ouverts ;
 *   2. le QUOTA, deux outils par semaine glissante, une fois la personne
 *      identifiée.
 *
 * Quand l'authentification n'est pas configurée sur l'installation (le dépôt
 * doit démarrer avec un `.env` vide), la première porte n'existe pas : exiger
 * une connexion impossible fermerait le site au lieu de le protéger.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) return { title: "Outil introuvable" };

  // La canonique pointe sur CETTE page, pas sur la fiche : combiner un
  // `noindex` et une canonique vers une autre URL envoie deux ordres
  // contradictoires, et Google documente qu'il n'en suit alors aucun.
  return pageMetadata({
    title: `${tool.title}, le calculateur`,
    description:
      `${tool.summary} Le calculateur s'ouvre une fois connecté ; la fiche, elle, ` +
      "reste en consultation libre.",
    path: `/outils/${tool.id}/calculer`,
    index: false,
  });
}

export default async function CalculerPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) notFound();

  const spec = getToolSpec(tool.id);
  const session = isAuthConfigured ? await auth() : null;
  const access = await readAccess();
  // Sans secret de signature configuré, il n'y a pas de verrou : tout est
  // ouvert. Voir l'en-tête de `src/lib/access/ledger.ts`.
  const grant = access.unlocked.find((entry) => entry.slug === tool.id);
  const owned = !access.enforced || grant !== undefined;

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href={`/outils/${tool.id}`}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Revenir à la fiche
          </Link>

          <div>
            <p className="eyebrow">{tool.audience}</p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
              {tool.title}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-ink-muted">{tool.summary}</p>
          </div>
        </header>

        {isAuthConfigured && !session?.user ? (
          <SignInGate slug={tool.id} title={tool.title} limit={access.quota.limit} />
        ) : owned ? (
          <>
            {access.enforced && grant ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <Check aria-hidden="true" className="size-4 text-success" />
                Outil débloqué le{" "}
                <strong className="tnum font-medium text-ink">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                    new Date(grant.at * 1000),
                  )}
                </strong>
                . Le rouvrir ne consomme aucun crédit.
              </p>
            ) : null}
            <ToolRunner toolId={tool.id} />
          </>
        ) : access.quota.remaining <= 0 ? (
          <QuotaExhausted renewsAt={access.quota.renewsAt} limit={access.quota.limit} />
        ) : (
          <UnlockForm
            slug={tool.id}
            title={tool.title}
            email={session?.user?.email ?? ""}
            remaining={access.quota.remaining}
            limit={access.quota.limit}
          />
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft p-6">
          <h2 className="text-sm font-semibold text-warning-soft-fg">Ce qu&apos;il ne fait pas</h2>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">{tool.limits}</p>
          <p className="text-sm leading-relaxed text-warning-soft-fg/90">{spec.caveat}</p>
        </section>

        <p className="text-xs leading-relaxed text-ink-subtle">{disclaimers.toolResult}</p>
      </div>
    </div>
  );
}
