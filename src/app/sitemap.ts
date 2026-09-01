import type { MetadataRoute } from "next";

import { toolCatalogue } from "@/data/tools-catalogue";
import { siteConfig } from "@/config/site";

/**
 * Le plan du site, dressé à la main plutôt que déduit du système de fichiers.
 *
 * Une génération automatique embarquerait tôt ou tard une page `noindex` — la
 * sélection de comparables, par exemple — et enverrait aux moteurs l'inverse de
 * ce que la page leur dit. Ici, une URL n'entre que si quelqu'un l'a décidé.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();

  const pages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] =
    [
      { path: "/", priority: 1, changeFrequency: "weekly" },
      { path: "/estimer", priority: 0.9, changeFrequency: "monthly" },
      { path: "/carte", priority: 0.9, changeFrequency: "weekly" },
      { path: "/observatoire", priority: 0.8, changeFrequency: "weekly" },
      { path: "/observatoire/transactions", priority: 0.7, changeFrequency: "weekly" },
      { path: "/outils", priority: 0.8, changeFrequency: "monthly" },
      { path: "/solutions", priority: 0.7, changeFrequency: "monthly" },
      { path: "/solutions/automatisation", priority: 0.6, changeFrequency: "monthly" },
      { path: "/solutions/formation", priority: 0.6, changeFrequency: "monthly" },
      { path: "/solutions/leads-vendeurs", priority: 0.6, changeFrequency: "monthly" },
      { path: "/a-propos", priority: 0.4, changeFrequency: "monthly" },
      { path: "/mentions-legales", priority: 0.2, changeFrequency: "monthly" },
      { path: "/confidentialite", priority: 0.2, changeFrequency: "monthly" },
    ];

  return [
    ...pages.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...toolCatalogue.map((tool) => ({
      url: `${base}/outils/${tool.id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
