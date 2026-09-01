/**
 * LA FICHE D'UN ARTICLE.
 *
 * Trois décisions structurent ce fichier.
 *
 * 1. STATIQUE, sans exception. `generateStaticParams` énumère les articles, et
 *    `dynamicParams = false` ferme la porte à tout le reste&nbsp;: un slug
 *    inconnu rend un 404 déjà construit, il ne déclenche pas un rendu à la
 *    demande. C'est ce qui garantit que le disque n'est jamais lu en réponse à
 *    une requête, et que le blog ne fait pas basculer le site hors du rendu
 *    statique.
 *
 * 2. LES BROUILLONS N'EXISTENT PAS EN PRODUCTION. Ils ne sont pas cachés par
 *    une condition d'affichage&nbsp;: ils ne sont pas énumérés, donc pas
 *    construits, donc pas atteignables. Un texte en cours d'écriture ne peut
 *    pas fuiter par une URL devinée.
 *
 * 3. LES DONNÉES STRUCTURÉES SONT ÉCRITES ICI, pas déduites. `Article` et
 *    `BreadcrumbList` décrivent ce que la page contient réellement&nbsp;: un
 *    titre, deux dates, un auteur, une position dans le site. Rien n'y est
 *    déclaré qui ne soit visible à l'écran.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui";
import { disclaimers, siteConfig } from "@/config/site";
import {
  blogCategoryLabel,
  blogDateTime,
  blogRobots,
  formatBlogDate,
  findVisibleBlogPost,
  parseMarkdown,
  publishedBlogPosts,
  relatedTo,
  visibleBlogPosts,
} from "@/lib/blog";
import { ORGANIZATION_ID, breadcrumbNode, type JsonLdNode } from "@/lib/seo/json-ld";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { canonicalUrl, pageMetadata, polishMetaText } from "@/lib/seo/metadata";
import type { BlogPost } from "@/types/blog";

import { ArticleBody } from "../article-body";
import { PostCard } from "../post-card";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Un slug hors de cette liste rend un 404 statique, jamais un rendu à la demande. */
export const dynamicParams = false;

export function generateStaticParams() {
  return visibleBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = findVisibleBlogPost(slug);
  if (!post) return { title: "Article introuvable" };

  const path = `/blog/${post.slug}`;
  // Un brouillon relu en local n'est indexable dans aucune circonstance, même
  // si le journal venait à être ouvert le même jour.
  const robots = post.status === "draft" ? { index: false, follow: false } : blogRobots(true);

  const base = pageMetadata({
    title: post.title,
    description: post.excerpt,
    path,
    index: robots.index,
    follow: robots.follow,
  });

  return {
    ...base,
    authors: [{ name: post.author.name }],
    // L'Open Graph est réécrit en entier plutôt qu'étendu : un article porte un
    // `type` et des dates que la fabrique générique n'a pas à connaître.
    openGraph: {
      type: "article",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      url: canonicalUrl(path),
      title: polishMetaText(`${post.title} · ${siteConfig.name}`),
      description: polishMetaText(post.excerpt),
      publishedTime: blogDateTime(post.publishedAt),
      modifiedTime: blogDateTime(post.updatedAt),
      authors: [post.author.name],
      tags: post.tags,
      // Déclarer une image ici DÉSACTIVE l'image sociale générée par convention
      // de fichier. C'est le sens de la clé : un article qui a sa propre
      // illustration passe devant l'image de section.
      ...(post.socialImage ? { images: [{ url: post.socialImage }] } : {}),
    },
  };
}

/**
 * Les données structurées de l'article.
 *
 * L'éditeur est seulement RÉFÉRENCÉ par son `@id`, pas redécrit&nbsp;: le
 * gabarit racine pose déjà `organizationNode()` sur toutes les pages
 * (`src/app/layout.tsx`), et la référence résout donc dans le même document.
 *
 * Rien n'est déclaré ici qui ne soit visible à l'écran&nbsp;: titre, chapeau,
 * auteur, rubrique, deux dates. Un balisage qui affirme plus que la page est
 * une manipulation, et se traite comme telle par les moteurs.
 */
function articleNode(post: BlogPost): JsonLdNode {
  const url = canonicalUrl(`/blog/${post.slug}`);

  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    inLanguage: "fr-FR",
    datePublished: blogDateTime(post.publishedAt),
    dateModified: blogDateTime(post.updatedAt),
    author: { "@type": "Organization", name: post.author.name },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: url,
    articleSection: blogCategoryLabel(post.category),
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
    ...(post.socialImage
      ? {
          image: post.socialImage.startsWith("/")
            ? canonicalUrl(post.socialImage)
            : post.socialImage,
        }
      : {}),
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = findVisibleBlogPost(slug);
  if (!post) notFound();

  const blocks = parseMarkdown(post.body);
  // Les articles liés sont pris parmi les PUBLIÉS seulement, y compris en
  // développement : proposer un brouillon en fin de lecture donnerait une liste
  // qui rétrécit le jour de la mise en ligne.
  const related = relatedTo(post, publishedBlogPosts(), 2);
  const updated = post.updatedAt !== post.publishedAt;

  return (
    <div className="bg-canvas py-8 md:py-12">
      {/* Le balisage n'est posé que sur un article réellement publié : décrire
          un brouillon en `Article` serait décrire une page qui n'existe pas. */}
      {post.status === "published" ? (
        <JsonLd
          nodes={[
            articleNode(post),
            breadcrumbNode([
              { name: "Accueil", path: "/" },
              { name: "Journal", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ]}
        />
      ) : null}

      <div className="container-page flex flex-col gap-8">
        <nav aria-label="Fil d'Ariane">
          <Link
            href="/blog"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Le journal
          </Link>
        </nav>

        <article className="flex flex-col gap-8">
          <header className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{blogCategoryLabel(post.category)}</p>
              {post.status === "draft" ? (
                <Badge tone="warning" size="sm">
                  Brouillon
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
              {post.title}
            </h1>

            <p className="mt-4 text-lg leading-relaxed text-ink-muted">{post.excerpt}</p>

            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-subtle">
              <span>{post.author.name}</span>
              {post.author.role ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{post.author.role}</span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <time dateTime={blogDateTime(post.publishedAt)}>
                {formatBlogDate(post.publishedAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span className="tnum">{post.readingMinutes} min de lecture</span>
            </p>

            {updated ? (
              <p className="mt-1 text-xs text-ink-subtle">
                Mis à jour le{" "}
                <time dateTime={blogDateTime(post.updatedAt)}>
                  {formatBlogDate(post.updatedAt)}
                </time>
              </p>
            ) : null}
          </header>

          {post.status === "draft" ? (
            <p className="rounded-md border border-warning/25 bg-warning-soft px-5 py-4 text-sm leading-relaxed text-warning-soft-fg">
              Brouillon visible en développement uniquement. Cet article n&apos;est ni construit,
              ni listé, ni diffusé en production tant que son statut n&apos;est pas passé
              à&nbsp;<code className="font-mono">published</code>.
            </p>
          ) : null}

          <div className="max-w-3xl">
            <ArticleBody blocks={blocks} />
          </div>

          {post.tags.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2" aria-label="Étiquettes">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Badge tone="neutral" size="sm">
                    {tag}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="max-w-3xl border-t border-border-soft pt-5 text-xs leading-relaxed text-ink-subtle">
            {disclaimers.short}
          </p>
        </article>

        {related.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl text-ink">À lire ensuite</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {related.map((entry) => (
                <PostCard key={entry.slug} post={entry} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
