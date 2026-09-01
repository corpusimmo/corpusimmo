"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Lock } from "lucide-react";

import { Button, Checkbox, Field, Input } from "@/components/ui";

/**
 * La porte d'un outil.
 *
 * Une adresse, et l'outil s'ouvre — dans la limite de deux par semaine. Le
 * compteur est annoncé AVANT le clic, pas au moment du refus : quelqu'un qui
 * découvre la limite en se la prenant a le sentiment d'un piège, quelqu'un qui
 * la connaît d'avance choisit où dépenser.
 */
export function UnlockForm({
  slug,
  title,
  remaining,
  limit,
}: {
  slug: string;
  title: string;
  remaining: number;
  limit: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        try {
          const response = await fetch(`/api/outils/${slug}/acces`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
              newsletter,
            }),
          });

          if (!response.ok) {
            const payload: unknown = await response.json().catch(() => null);
            const detail =
              typeof payload === "object" && payload !== null && "error" in payload
                ? (payload as { error: { message?: string } }).error.message
                : undefined;
            setError(detail ?? "Le déblocage n'a pas abouti. Réessayez.");
            setPending(false);
            return;
          }

          // Le serveur vient de poser le cookie d'accès : on redemande la page,
          // qui rendra le calculateur au lieu de ce formulaire.
          router.refresh();
        } catch {
          setError("Réseau indisponible. Réessayez dans un instant.");
          setPending(false);
        }
      }}
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-1.5">
          <Lock aria-hidden="true" className="size-3.5" />
          Ouvrir le calculateur
        </span>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          L&apos;outil est gratuit. Nous demandons une adresse pour savoir à qui il sert, et parce
          que c&apos;est ce qui finance le reste&nbsp;: la carte, l&apos;observatoire et
          l&apos;estimateur, eux, restent ouverts sans rien demander.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="unlock-first-name" hint="Facultatif.">
          <Input
            id="unlock-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Adresse e-mail" htmlFor="unlock-email" required>
          <Input
            id="unlock-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="prenom@exemple.fr"
          />
        </Field>
      </div>

      <Checkbox
        checked={newsletter}
        onChange={(event) => setNewsletter(event.target.checked)}
        label={
          <span className="text-sm leading-relaxed text-ink-muted">
            Je veux aussi recevoir la lettre d&apos;information. Facultatif, et sans effet sur
            l&apos;accès à cet outil.
          </span>
        }
      />

      {error ? (
        <p
          role="alert"
          className="flex gap-2.5 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Ouvrir l&apos;outil
        </Button>
        <p className="tnum text-sm text-ink-muted">
          Il vous reste <strong className="text-ink">{remaining}</strong> outil
          {remaining > 1 ? "s" : ""} sur {limit} cette semaine.
        </p>
      </div>
    </form>
  );
}
