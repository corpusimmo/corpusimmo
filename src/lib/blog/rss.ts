/**
 * LE FLUX RSS, écrit comme une fonction pure.
 *
 * Le gestionnaire de route ne fait plus qu'appeler cette fonction et poser deux
 * en-têtes. C'est la même séparation que partout ailleurs dans ce dossier&nbsp;:
 * ce qui produit du contenu se teste sans framework, ce qui répond à une requête
 * ne contient aucune décision.
 *
 * Un flux est le seul artefact du site que nous ne contrôlons plus une fois
 * publié&nbsp;: il est copié, mis en cache, rediffusé. La règle du brouillon y
 * est donc appliquée une seconde fois, ici, en plus de l'appelant.
 */

import type { BlogPost } from "@/types/blog";

import { blogRssDate } from "./format";
import { blogCategoryLabel } from "./taxonomy";
import { publishedOnly, sortPosts } from "./select";

export const BLOG_RSS_TITLE_SUFFIX = "Le journal";

/**
 * Les cinq caractères que XML réserve.
 *
 * Une apostrophe typographique ou un caractère accentué ne posent aucun
 * problème dans un document UTF-8&nbsp;; une esperluette non échappée, si. Elle
 * rend le flux invalide, et un agrégateur ne prévient pas&nbsp;: il cesse
 * simplement de lire.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface BlogRssInput {
  posts: readonly BlogPost[];
  baseUrl: string;
  title: string;
  description: string;
}

export function blogRssFeed({ posts, baseUrl, title, description }: BlogRssInput): string {
  const base = baseUrl.replace(/\/+$/, "");
  const published = sortPosts(publishedOnly(posts));

  const items = published.map((post) => {
    const url = `${base}/blog/${post.slug}`;
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${blogRssDate(post.publishedAt)}</pubDate>`,
      `      <description>${escapeXml(post.excerpt)}</description>`,
      `      <category>${escapeXml(blogCategoryLabel(post.category))}</category>`,
      "    </item>",
    ].join("\n");
  });

  // La date du flux est celle du dernier article, jamais `new Date()` : un flux
  // qui change à chaque build sans qu'aucun article n'ait bougé apprend aux
  // agrégateurs à ne plus faire confiance à ses dates.
  const first = published[0];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(`${base}/blog`)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>fr-FR</language>",
    `    <atom:link href="${escapeXml(`${base}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    ...(first ? [`    <lastBuildDate>${blogRssDate(first.updatedAt)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
