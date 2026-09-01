"use client";

/**
 * LA PORTE D'UN OUTIL, une fois la personne connectée.
 *
 * Le site est ouvert : l'estimateur, la carte et l'observatoire ne demandent
 * rien. Les dix calculateurs, eux, se voient sans compte mais ne s'utilisent
 * qu'après connexion. Ce n'est pas un péage déguisé : c'est ce qui permet de
 * savoir à qui ces outils servent, et de tenir un quota qui ne repose pas sur
 * la bonne volonté du navigateur.
 *
 * L'adresse n'est plus saisie ici. Elle vient de la session vérifiée par
 * Google, et le serveur la relit lui-même : un champ e-mail rempli à la main
 * serait, à ce stade, une déclaration que rien ne prouve.
 *
 * Le compteur est annoncé AVANT le clic, pas au moment du refus. Quelqu'un qui
 * découvre la limite en se la prenant a le sentiment d'un piège ; quelqu'un qui
 * la connaît d'avance choisit où dépenser.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Unlock } from "lucide-react";

import { Button, Checkbox } from "@/components/ui";
import { track } from "@/lib/analytics/track";

export function UnlockForm({
  slug,
  title,
  email,
  remaining,
  limit,
}: {
  slug: string;
  title: string;
  /** L'adresse vérifiée de la session. Affichée, jamais modifiable ici. */
  email: string;
  remaining: number;
  limit: number;
}) {
  const router = useRouter();
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
        track({ name: "tool_unlock_attempt", params: { tool_id: slug } });

        try {
          const response = await fetch(`/api/outils/${slug}/acces`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ newsletter }),
          });

          if (!response.ok) {
            const payload: unknown = await response.json().catch(() => null);
            const detail =
              typeof payload === "object" && payload !== null && "error" in payload
                ? (payload as { error: { message?: string; code?: string } }).error
                : undefined;
            setError(detail?.message ?? "Le déblocage n'a pas abouti. Réessayez.");
            track({
              name: "tool_unlock_refused",
              params: { tool_id: slug, reason: detail?.code ?? "erreur" },
            });
            setPending(false);
            return;
          }

          track({ name: "tool_unlocked", params: { tool_id: slug, newsletter } });
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
          <Unlock aria-hidden="true" className="size-3.5" />
          Ouvrir le calculateur
        </span>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          Vous êtes connecté avec <strong className="text-ink">{email}</strong>. Ouvrir cet outil
          consommera un de vos {limit} accès de la semaine. Il vous restera ensuite{" "}
          <strong className="tnum text-ink">{Math.max(0, remaining - 1)}</strong> accès, et cet
          outil-ci restera ouvert pour de bon.
        </p>
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
          Il vous reste <strong className="text-ink">{remaining}</strong> accès sur {limit} cette
          semaine.
        </p>
      </div>
    </form>
  );
}
