import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

import { FavoriteButton } from "@/components/tools/favorite-button";
import { ToolRunner } from "@/components/tools/tool-runner";
import { Badge } from "@/components/ui";
import { toolAssetTypes, toolUsages } from "@/config/navigation";
import { disclaimers, siteConfig } from "@/config/site";
import { toolCatalogue, getToolCard } from "@/data/tools-catalogue";
import { getToolSpec } from "@/lib/tools/definitions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Les dix fiches sont générées au build : elles sont indexables, elles ne
 * dépendent de rien qui change, et c'est ce qui les rend instantanées.
 */
export function generateStaticParams() {
  return toolCatalogue.map((tool) => ({ slug: tool.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) return { title: "Outil introuvable" };

  return {
    title: tool.title,
    description: tool.summary,
    alternates: { canonical: `/outils/${tool.id}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      url: `${siteConfig.url}/outils/${tool.id}`,
      title: tool.title,
      description: tool.summary,
    },
  };
}

export default async function OutilPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) notFound();

  const spec = getToolSpec(tool.id);

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href="/outils"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Tous les outils
          </Link>

          <div className="max-w-3xl">
            <p className="eyebrow">{tool.audience}</p>
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
              {tool.title}
            </h1>
            <p className="mt-3 text-lg leading-relaxed text-ink-muted">{tool.summary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FavoriteButton
              slug={tool.id}
              title={tool.title}
              withLabel
              className="order-last ml-auto border border-border"
            />
            {tool.assetTypes.map((id) => (
              <Badge key={id} tone="neutral" size="sm">
                {toolAssetTypes.find((entry) => entry.id === id)?.label ?? id}
              </Badge>
            ))}
            {tool.usages.map((id) => (
              <Badge key={id} tone="accent" size="sm">
                {toolUsages.find((entry) => entry.id === id)?.label ?? id}
              </Badge>
            ))}
          </div>
        </header>

        {/* L'outil d'abord : la personne est venue calculer, pas lire. */}
        <ToolRunner toolId={tool.id} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
              <h2 className="font-display text-xl text-ink">Pourquoi cet outil</h2>
              {tool.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-ink-muted">
                  {paragraph}
                </p>
              ))}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
              <h2 className="font-display text-xl text-ink">Ce qu&apos;il calcule</h2>
              <ul className="flex flex-col gap-2">
                {tool.contents.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-ink">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-rule" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft p-6">
              <h2 className="text-sm font-semibold text-warning-soft-fg">Ce qu&apos;il ne fait pas</h2>
              <p className="text-sm leading-relaxed text-warning-soft-fg/90">{tool.limits}</p>
              <p className="text-sm leading-relaxed text-warning-soft-fg/90">{spec.caveat}</p>
            </section>

            {tool.matrix === "coming" ? (
              <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FileSpreadsheet aria-hidden="true" className="size-4 text-ink-subtle" />
                  Le classeur Excel
                </h2>
                <p className="text-sm leading-relaxed text-ink-muted">
                  La matrice qui double cet outil est en cours de révision. Elle n&apos;est pas
                  encore téléchargeable : nous préférons l&apos;annoncer plutôt que de proposer un
                  bouton qui ne donnerait rien.
                </p>
              </section>
            ) : null}

            <p className="text-xs leading-relaxed text-ink-subtle">{disclaimers.toolResult}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
