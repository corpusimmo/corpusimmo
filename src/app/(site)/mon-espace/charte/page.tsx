import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CharteForm } from "@/components/brand/charte-form";
import { currentUserId } from "@/lib/auth/current-user";
import { readBrandRow } from "@/lib/db";
import { pageMetadata } from "@/lib/seo/metadata";
import { saveCharteAction } from "../actions";

/**
 * L'ÉCRAN DE LA CHARTE, réservé aux comptes.
 *
 * `force-dynamic` parce que la page lit la session ET la base : mise en cache,
 * elle servirait la charte d'un compte à un autre. C'est la même raison qui
 * gouverne le reste de l'espace compte.
 *
 * Aucune indexation : cette page n'a de sens que connecté, et un moteur qui la
 * visiterait n'y verrait qu'une redirection.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Charte graphique",
    description:
      "Le nom, le logo et les couleurs qui habillent les documents générés depuis votre compte.",
    path: "/mon-espace/charte",
  }),
  robots: { index: false, follow: false },
};

export default async function ChartePage() {
  const userId = await currentUserId();
  if (!userId) redirect("/connexion?suivant=/mon-espace/charte");

  const row = await readBrandRow(userId);

  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow-text text-accent">Mon espace</p>
          <h1 className="mt-3 font-display text-3xl text-ink">
            Charte graphique
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
            Renseignée une fois, elle habille tous vos documents : export des
            comparables, trames de dossier, études. Sans elle, ils sortent aux
            couleurs de CorpusImmo.
          </p>

          <div className="panel mt-8 p-6">
            <CharteForm
              initial={{
                companyName: row?.companyName ?? "",
                website: row?.website ?? "",
                logoUrl: row?.logoUrl ?? "",
                primaryColor: row?.primaryColor ?? "",
                secondaryColor: row?.secondaryColor ?? "",
              }}
              onSave={async (values) => {
                "use server";
                return saveCharteAction({
                  companyName: values.companyName,
                  website: values.website,
                  logoUrl: values.logoUrl,
                  primaryColor: values.primaryColor,
                  secondaryColor: values.secondaryColor,
                });
              }}
            />
          </div>

          <p className="mt-6 text-sm text-ink-muted">
            <Link href="/mon-espace" className="font-semibold text-primary underline">
              Retour à mon espace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
