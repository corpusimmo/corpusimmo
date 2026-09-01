"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button, LoadingState } from "@/components/ui";

/** Les erreurs d'Auth.js, traduites. Le code brut ne dit rien à personne. */
const ERRORS: Record<string, string> = {
  OAuthSignin: "La connexion à Google n'a pas pu démarrer. Réessayez dans un instant.",
  OAuthCallback: "Google n'a pas répondu comme attendu. Réessayez.",
  OAuthAccountNotLinked: "Cette adresse est déjà associée à une autre méthode de connexion.",
  AccessDenied:
    "Google n'a pas confirmé que cette adresse vous appartient. Vérifiez votre compte Google, puis réessayez.",
  Verification: "Ce lien de connexion a expiré. Relancez la connexion.",
  Configuration: "La connexion n'est pas configurée sur ce site.",
  Default: "La connexion n'a pas abouti. Réessayez.",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/";

  useEffect(() => {
    // On demande à Auth.js ce qu'il propose réellement plutôt que de le
    // supposer : sans identifiants Google configurés, la liste est vide, et un
    // bouton qui mènerait à une erreur vaut moins que la phrase qui l'explique.
    let cancelled = false;
    void getProviders().then((providers) => {
      if (!cancelled) setAvailable(Boolean(providers && Object.keys(providers).length > 0));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading" || available === null) {
    return <LoadingState label="Vérification de la connexion…" />;
  }

  if (session?.user) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-success/25 bg-success-soft p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-success-soft-fg">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Vous êtes connecté
        </p>
        <p className="text-sm leading-relaxed text-success-soft-fg/90">
          {session.user.email} — votre adresse est vérifiée par Google. Les documents de la
          bibliothèque s&apos;ouvrent désormais sans repasser par un formulaire.
        </p>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex gap-3 rounded-lg border border-warning/25 bg-warning-soft p-6">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="text-sm leading-relaxed text-warning-soft-fg">
          <p className="font-semibold">La connexion n&apos;est pas encore ouverte</p>
          <p className="mt-1 text-warning-soft-fg/90">
            L&apos;identification Google n&apos;est pas configurée sur cette installation.
            L&apos;essentiel du site n&apos;en dépend pas&nbsp;: l&apos;estimateur, la carte des
            ventes et l&apos;observatoire fonctionnent sans compte. Seuls les dix calculateurs
            demandent une connexion, et ils restent consultables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p
          role="alert"
          className="flex gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          {ERRORS[error] ?? ERRORS.Default}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        loading={pending}
        onClick={() => {
          setPending(true);
          void signIn("google", { redirectTo: next });
        }}
      >
        Continuer avec Google
      </Button>

      <p className="text-xs leading-relaxed text-ink-subtle">
        Nous ne demandons à Google que votre nom et votre adresse e-mail. Aucun accès à vos
        contacts, à votre agenda ni à vos fichiers n&apos;est demandé, et rien n&apos;est publié en
        votre nom.
      </p>
    </div>
  );
}
