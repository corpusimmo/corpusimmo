import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { safeUrl } from "@/config/app-url";
import { siteConfig } from "@/config/site";

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

export const metadata: Metadata = {
  // `safeUrl` plutôt que `new URL` : une origine mal formée doit dégrader vers
  // des métadonnées relatives, jamais faire tomber le build entier.
  metadataBase: safeUrl(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
