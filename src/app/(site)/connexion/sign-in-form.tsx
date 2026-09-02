"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, MailCheck } from "lucide-react";

import { Button, Field, Input, LoadingState } from "@/components/ui";
import { track } from "@/lib/analytics/track";

import { rememberIdentity } from "./actions";

/** Les erreurs d'Auth.js, traduites. Le code brut ne dit rien à personne. */
const ERRORS: Record<string, string> = {
  OAuthSignin:
    "La connexion à Google n'a pas pu démarrer. Réessayez dans un instant.",
  OAuthCallback: "Google n'a pas répondu comme attendu. Réessayez.",
  OAuthAccountNotLinked:
    "Cette adresse est déjà associée à une autre méthode de connexion.",
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
  /** Vrai quand le lien de connexion par courriel est réellement proposé. */
  const [emailLink, setEmailLink] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  // Le prénom et le nom ne servent PAS à l'authentification : le lien prouve
  // l'adresse à lui seul. Ils servent à ce que le compte créé porte un nom,
  // là où la voie Google en apporte un d'office.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/";

  useEffect(() => {
    // On demande à Auth.js ce qu'il propose réellement plutôt que de le
    // supposer : sans identifiants Google configurés, la liste est vide, et un
    // bouton qui mènerait à une erreur vaut moins que la phrase qui l'explique.
    let cancelled = false;
    void getProviders().then((providers) => {
      if (cancelled) return;
      const ids = providers ? Object.keys(providers) : [];
      setAvailable(ids.length > 0);
      // Le lien de connexion n'est proposé que si le serveur le propose : il
      // dépend d'une base, et un formulaire qui ne pourrait pas aboutir vaut
      // moins que son absence.
      setEmailLink(ids.includes("email"));
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
          {session.user.email}, votre adresse est vérifiée par Google. Les
          documents de la bibliothèque s&apos;ouvrent désormais sans repasser
          par un formulaire.
        </p>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex gap-3 rounded-lg border border-warning/25 bg-warning-soft p-6">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <div className="text-sm leading-relaxed text-warning-soft-fg">
          <p className="font-semibold">
            La connexion n&apos;est pas encore ouverte
          </p>
          <p className="mt-1 text-warning-soft-fg/90">
            L&apos;identification Google n&apos;est pas configurée sur cette
            installation. L&apos;essentiel du site n&apos;en dépend pas&nbsp;:
            l&apos;estimateur, la carte des ventes et l&apos;observatoire
            fonctionnent sans compte. Seuls les dix calculateurs demandent une
            connexion, et ils restent consultables.
          </p>
        </div>
      </div>
    );
  }

  if (linkSent) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-success/25 bg-success-soft p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-success-soft-fg">
          <MailCheck aria-hidden="true" className="size-4" />
          Votre lien est parti
        </p>
        <p className="text-sm leading-relaxed text-success-soft-fg/90">
          Nous venons d&apos;envoyer un lien de connexion à{" "}
          <strong>{email.trim()}</strong>. Il est valable quinze minutes, et une
          seule fois. Pensez à regarder dans les indésirables si vous ne le
          voyez pas arriver.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => {
            setLinkSent(false);
            setLinkError(null);
          }}
        >
          Utiliser une autre adresse
        </Button>
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
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-danger"
          />
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
        Nous ne demandons à Google que votre nom et votre adresse e-mail. Aucun
        accès à vos contacts, à votre agenda ni à vos fichiers n&apos;est
        demandé, et rien n&apos;est publié en votre nom.
      </p>

      {emailLink ? (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
              ou
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const address = email.trim();
              if (!address) {
                setLinkError("Indiquez une adresse e-mail.");
                return;
              }
              if (!firstName.trim() || !lastName.trim()) {
                setLinkError("Indiquez votre prénom et votre nom.");
                return;
              }

              setLinkPending(true);
              setLinkError(null);
              track({ name: "login_started", params: { provider: "email" } });

              // `redirect: false` pour rester sur place : la page de
              // vérification d'Auth.js est en anglais et hors de notre
              // direction artistique.
              // Le nom est rangé AVANT l'envoi, et l'échec n'empêche pas la
              // connexion : un profil non prérempli est un désagrément, une
              // porte fermée serait autre chose.
              await rememberIdentity({
                email: address,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
              }).catch(() => undefined);

              const outcome = await signIn("email", {
                email: address,
                redirect: false,
              });

              if (outcome?.error) {
                setLinkError(
                  "L'envoi n'a pas abouti. Réessayez dans un instant.",
                );
                setLinkPending(false);
                return;
              }

              setLinkSent(true);
              setLinkPending(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="sign-in-first-name">
                <Input
                  id="sign-in-first-name"
                  required
                  autoComplete="given-name"
                  placeholder="Camille"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field label="Nom" htmlFor="sign-in-last-name">
                <Input
                  id="sign-in-last-name"
                  required
                  autoComplete="family-name"
                  placeholder="Durand"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Recevoir un lien de connexion"
              htmlFor="sign-in-email"
              hint="Sans mot de passe : nous envoyons un lien valable quinze minutes. Votre nom sert à ce que votre espace vous appelle par votre nom, rien de plus."
            >
              <Input
                id="sign-in-email"
                type="email"
                required
                autoComplete="email"
                placeholder="prenom@exemple.fr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {linkError ? (
              <p role="alert" className="text-sm text-danger">
                {linkError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="secondary"
              loading={linkPending}
              className="w-fit"
            >
              M&apos;envoyer un lien
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
