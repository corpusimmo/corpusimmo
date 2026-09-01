import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * La coque commune à TOUTES les pages publiques.
 *
 * Un seul en-tête, un seul menu, un seul pied de page — y compris sur les
 * écrans d'analyse. C'est ce qui fait que l'observatoire pousse les pages
 * outils et inversement : le maillage interne est le seul actif de
 * référencement d'un domaine neuf, et il vit dans ce fichier.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
