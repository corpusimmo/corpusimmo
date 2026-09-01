import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui";
import { siteConfig } from "@/config/site";

import { EstimerClient } from "./estimer-client";

const TITLE = "Estimer un bien immobilier gratuitement";
const DESCRIPTION =
  "Logement ou local professionnel : obtenez une fourchette de valeur calculée à partir des " +
  "ventes réellement enregistrées autour du bien. Gratuit, sans compte, méthode publiée.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/estimer" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/estimer`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function EstimerPage() {
  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Estimation par comparaison</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            Combien vaut ce bien, d&apos;après les ventes réelles&nbsp;?
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
            Six questions. Nous cherchons ensuite les mutations enregistrées autour de l&apos;adresse,
            écartons celles qui ne se comparent pas, et publions la méthode qui a produit le chiffre.
          </p>

          <div className="mt-8">
            {/* `useSearchParams` impose une frontière Suspense : sans elle, la page
                entière basculerait en rendu dynamique. */}
            <Suspense fallback={<LoadingState label="Préparation du parcours…" />}>
              <EstimerClient />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
