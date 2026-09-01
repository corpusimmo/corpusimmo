import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSpreadsheet } from "lucide-react";

import { FavoriteButton } from "@/components/tools/favorite-button";
import { DeveloperBalance, WaultDiagram } from "@/components/illustrations";
import { PreviewGallery } from "@/components/tools/preview-gallery";
import { Badge, Button } from "@/components/ui";
import { toolAssetTypes, toolUsages } from "@/config/navigation";
import { disclaimers } from "@/config/site";
import { getToolPreviews } from "@/data/tool-previews";
import { toolCatalogue, getToolCard } from "@/data/tools-catalogue";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { breadcrumbNode, webApplicationNode } from "@/lib/seo/json-ld";
import { pageMetadata, polishMetaText } from "@/lib/seo/metadata";
import { relatedTools } from "@/lib/seo/related-tools";
import { toolMetaDescription } from "@/lib/seo/tool-metadata";
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

/**
 * La description méta est COMPOSÉE, pas recopiée (voir
 * `src/lib/seo/tool-metadata.ts`) : le résumé d'un outil est écrit pour tenir
 * sous un titre, il fait rarement les 150 signes qu'attend un extrait de
 * résultat de recherche.
 *
 * ATTENTION en éditant ce fichier : l'inventaire du sitemap repère les pages
 * hors index en cherchant le jeton `index: false` dans le source d'un
 * `page.tsx` (voir `src/lib/seo/routes.ts`). L'écrire ici, même dans une
 * branche d'erreur, sortirait les DIX fiches de l'index. Le test
 * `src/app/sitemap.test.ts` le rattrape, mais autant ne pas l'écrire.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) return { title: "Outil introuvable" };

  return pageMetadata({
    title: tool.title,
    description: toolMetaDescription(tool.summary),
    path: `/outils/${tool.id}`,
    socialTitle: tool.title,
    socialDescription: polishMetaText(tool.summary),
  });
}

export default async function OutilPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolCard(slug);
  if (!tool) notFound();

  const spec = getToolSpec(tool.id);
  const previews = getToolPreviews(tool.id);
  const neighbours = relatedTools(tool.id);

  return (
    <div className="bg-canvas py-8 md:py-12">
      <div className="container-page flex flex-col gap-8">
        {/* La FICHE est une application décrite, et une page de deuxième
            niveau : c'est ce qui justifie l'un et l'autre balisage.
            `isAccessibleForFree` n'est PAS déclaré : la fiche est libre, le
            calculateur demande une connexion. Voir `src/lib/seo/json-ld.ts`. */}
        <JsonLd
          nodes={[
            webApplicationNode({
              name: tool.title,
              description: polishMetaText(tool.summary),
              path: `/outils/${tool.id}`,
              category: "FinanceApplication",
            }),
            breadcrumbNode([
              { name: "Accueil", path: "/" },
              { name: "Outils", path: "/outils" },
              { name: tool.title, path: `/outils/${tool.id}` },
            ]),
          ]}
        />

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

        {/* L'outil d'abord : la personne est venue calculer, pas lire. Il vit
            sur une page à part parce que le verrou se vérifie côté serveur, et
            que cette fiche-ci doit rester statique donc indexable. */}
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-xl text-ink">Ouvrir le calculateur</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Gratuit, dans le navigateur. Le calculateur s&apos;utilise en étant connecté, à
              raison de deux outils par semaine glissante. Ceux que vous avez déjà ouverts le
              restent, sans limite.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`/outils/${tool.id}/calculer`}>
              Ouvrir le calculateur
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
              <h2 className="font-display text-xl text-ink">Pourquoi cet outil</h2>
              {tool.body.map((paragraph, index) => (
                <Fragment key={paragraph}>
                  <p className="text-sm leading-relaxed text-ink-muted">{paragraph}</p>
                  {/* Le schéma sous le PREMIER paragraphe, et seulement là où la
                      fiche annonce déjà ce qu'il montre : « le bilan se lit à
                      l'envers », « le mur d'échéances que la moyenne cache ».
                      Le dessin est la démonstration, pas une décoration. */}
                  {index === 0 && tool.id === "bilan-promoteur" ? (
                    <div className="my-2 rounded-md bg-canvas p-3 md:p-4">
                      <DeveloperBalance />
                    </div>
                  ) : null}
                  {index === 0 && tool.id === "wault" ? (
                    <div className="my-2 rounded-md bg-canvas p-3 md:p-4">
                      <WaultDiagram />
                    </div>
                  ) : null}
                </Fragment>
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

            {previews.length > 0 ? (
              <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
                <div>
                  <h2 className="font-display text-xl text-ink">Le classeur, onglet par onglet</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    L&apos;outil ci-dessus reprend ces calculs dans le navigateur. Le classeur, lui,
                    s&apos;emporte, s&apos;annote et se transmet.
                  </p>
                </div>
                <PreviewGallery shots={previews} title={tool.title} />
              </section>
            ) : null}
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

        {/* LES OUTILS VOISINS.
            Sans ce bloc, les dix fiches sont dix culs-de-sac : on y entre par
            le sommaire et on n'en ressort que par le bouton retour. Les voisins
            sont CALCULÉS sur les axes du catalogue (type d'actif × usage, voir
            `src/lib/seo/related-tools.ts`), pas listés à la main : trois liens,
            pas un pavé, et ils restent justes quand un outil change d'axe. */}
        {neighbours.length > 0 ? (
          <section aria-labelledby="voisins" className="border-t border-border pt-8">
            <h2 id="voisins" className="font-display text-xl text-ink">
              Dans la suite du dossier
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              Les outils qui servent au même moment, ou sur le même type
              d&apos;actif.
            </p>
            <ul className="mt-5 grid gap-4 md:grid-cols-3">
              {neighbours.map((neighbour) => (
                <li key={neighbour.id}>
                  <Link
                    href={`/outils/${neighbour.id}`}
                    className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                  >
                    <h3 className="text-base font-semibold text-ink">{neighbour.title}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-ink-muted">
                      {neighbour.summary}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Voir la fiche
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
        ) : null}
      </div>
    </div>
  );
}
