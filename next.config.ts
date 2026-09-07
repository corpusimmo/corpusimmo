import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * LES PHOTOGRAPHIES DE COMMUNE VIENNENT DE WIKIMEDIA.
   *
   * Un seul hôte, et en HTTPS seulement : `remotePatterns` est une liste
   * blanche, et l'élargir revient à laisser n'importe quelle URL passer par
   * notre optimiseur, donc à offrir un service de redimensionnement gratuit à
   * qui le trouverait. Les images sont ensuite mises en cache chez nous, si
   * bien que Wikimedia n'est sollicité qu'une fois par format.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },

  experimental: {
    // Keeps the icon barrel from being pulled in whole on every route.
    optimizePackageImports: ["lucide-react"],
  },

  /**
   * LES FICHIERS QUE LE TRACEUR NE VOIT PAS.
   *
   * `readFileSync(join(process.cwd(), "…"))` est un chemin CALCULÉ : l'analyse
   * statique de Next ne peut pas deviner ce qu'il désigne, et les fichiers ne
   * partent donc pas d'eux-mêmes dans le paquet de la fonction. Ils sont
   * nommés ici pour les routes d'image sociale, les seules à les lire.
   */
  outputFileTracingIncludes: {
    "/opengraph-image": ["./src/lib/seo/og-fond.jpg", "./src/lib/seo/fonts/*"],
    "/**/opengraph-image": [
      "./src/lib/seo/og-fond.jpg",
      "./src/lib/seo/fonts/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
