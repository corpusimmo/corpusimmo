"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

/**
 * La frontière d'erreur racine.
 *
 * Elle ne montre JAMAIS le message technique&nbsp;: il peut porter une adresse
 * saisie par quelqu'un, ou le détail d'une requête. Il part dans la console,
 * pas à l'écran.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erreur non rattrapée", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-20 text-center">
      <p className="eyebrow">Incident</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
        Quelque chose s&apos;est mal passé
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-ink-muted">
        L&apos;écran n&apos;a pas pu s&apos;afficher. Réessayer suffit dans la plupart des cas.
        {error.digest ? (
          <>
            {" "}
            Si l&apos;incident persiste, mentionnez la référence{" "}
            <code className="rounded-xs bg-surface-2 px-1 py-0.5 text-[0.9em]">{error.digest}</code>.
          </>
        ) : null}
      </p>

      <Button className="mt-8" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
