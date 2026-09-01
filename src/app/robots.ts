import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Ce qui est fermé aux robots, et pourquoi.
 *
 * `/observatoire/comparables` porte des mutations DVF détaillées, adresse
 * comprise&nbsp;: le décret du 28/12/2018 en interdit l'indexation. Les routes
 * `/api/*` ne rendent rien de lisible et servent, pour certaines, exactement la
 * même donnée — elles sont donc fermées par la même logique, en plus des
 * en-têtes `X-Robots-Tag` qu'elles portent déjà.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/observatoire/comparables"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
