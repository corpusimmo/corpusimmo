import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";

import { SignInForm } from "./sign-in-form";

// Aucune valeur de référencement : un robot n'y voit qu'un bouton. `follow` est
// coupé aussi, faute de quoi un moteur arriverait sur le reste du site par un
// écran d'authentification plutôt que par une page qui dit quelque chose.
export const metadata: Metadata = pageMetadata({
  title: "Connexion",
  description:
    "Se connecter avec Google pour ouvrir les calculateurs et recevoir vos documents sans " +
    "attendre un courriel de confirmation.",
  path: "/connexion",
  index: false,
  follow: false,
});

export default function ConnexionPage() {
  return (
    <div className="bg-canvas py-14 md:py-20">
      <div className="container-page">
        <div className="mx-auto max-w-md">
          <p className="eyebrow">Connexion</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">
            Se connecter avec Google
          </h1>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Un compte ne sert qu&apos;à une chose ici&nbsp;: prouver que votre adresse est bien la
            vôtre, pour vous remettre un document sans vous faire attendre un courriel.
          </p>

          <div className="mt-8">
            <Suspense fallback={<LoadingState label="Chargement…" />}>
              <SignInForm />
            </Suspense>
          </div>

          <p className="mt-8 border-t border-border pt-6 text-sm leading-relaxed text-ink-muted">
            Rien de ce que propose le site n&apos;exige un compte. L&apos;
            <Link href="/estimer" className="font-semibold text-primary underline">
              estimateur
            </Link>
            , la{" "}
            <Link href="/carte" className="font-semibold text-primary underline">
              carte
            </Link>
            , l&apos;
            <Link href="/observatoire" className="font-semibold text-primary underline">
              observatoire
            </Link>{" "}
            et les{" "}
            <Link href="/outils" className="font-semibold text-primary underline">
              dix outils
            </Link>{" "}
            sont ouverts.
          </p>
        </div>
      </div>
    </div>
  );
}
