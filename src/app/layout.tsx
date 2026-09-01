import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { AuthSessionProvider } from "@/components/layout/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { safeUrl } from "@/config/app-url";
import { siteConfig } from "@/config/site";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { organizationNode, webSiteNode } from "@/lib/seo/json-ld";
import { SITE_DESCRIPTION, SITE_TITLE, canonicalUrl } from "@/lib/seo/metadata";

import "./globals.css";

/**
 * Deux familles, deux rôles, et rien d'autre à charger.
 *
 * Inter porte l'interface et le corps de texte. Source Serif 4 ne titre que les
 * h1/h2/h3 — c'est le sérif qui fait basculer la page du registre application
 * vers le registre document. Aucune police alternative n'est déclarée : la
 * direction artistique est figée, il n'y a rien à prévisualiser.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

/**
 * LES MÉTADONNÉES DE BASE, et le gabarit de titres.
 *
 * Ce qui est ici est un SOCLE, pas un contenu : chaque page réécrit son titre,
 * sa description, sa canonique et son Open Graph par `pageMetadata`
 * (`src/lib/seo/metadata.ts`). Ce que le socle garantit, c'est qu'une page qui
 * oublierait quelque chose retombe sur une valeur juste plutôt que sur rien.
 *
 * `title.template` met la marque APRÈS le titre de page, jamais avant : dans un
 * résultat de recherche, les premiers mots sont les seuls qu'on lit, et ce sont
 * ceux de la page qui répondent à la requête.
 *
 * L'image sociale n'est pas déclarée ici : elle vient de la convention de
 * fichier (`src/app/opengraph-image.tsx`), que Next fusionne tant qu'aucune
 * page ne déclare ses propres images.
 */
export const metadata: Metadata = {
  // `safeUrl` plutôt que `new URL` : une origine mal formée doit dégrader vers
  // des métadonnées relatives, jamais faire tomber le build entier.
  metadataBase: safeUrl(siteConfig.url),
  title: {
    default: SITE_TITLE,
    template: `%s \u00b7 ${siteConfig.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.legalName, url: canonicalUrl("/") }],
  creator: siteConfig.legalName,
  publisher: siteConfig.legalName,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: canonicalUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Sans ces trois-là, Google s'autorise un extrait court, une vignette
      // minuscule et aucun aperçu vidéo. Ce site n'a rien à cacher de son
      // contenu : autant le laisser en montrer le maximum.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#1b3349",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Rien n'est lu ici — ni cookie, ni en-tête, ni session. C'est délibéré : la
 * moindre lecture de `cookies()` dans le layout racine bascule TOUTES les pages
 * en rendu dynamique. Le site reste donc statique par défaut, ce dont un
 * domaine neuf a besoin.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>
        {/* Les données structurées de SITE, posées une fois pour toutes les
            pages : l'éditeur et le site lui-même. Les schémas propres à une
            page (application, fil d'Ariane) sont posés par la page.
            Aucune `SearchAction` : il n'existe pas de recherche à l'échelle du
            site, et en déclarer une qui n'existe pas ne rapporte rien. */}
        <JsonLd nodes={[organizationNode(), webSiteNode()]} />
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
