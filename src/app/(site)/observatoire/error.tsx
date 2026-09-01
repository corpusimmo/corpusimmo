"use client";

import { useEffect } from "react";

import { PageContainer } from "@/components/observatoire/page-container";
import { ErrorState } from "@/components/ui";

export default function ObservatoireError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[observatoire] erreur", error);
  }, [error]);

  return (
    <PageContainer>
      <ErrorState
        title="L'observatoire n'a pas pu s'afficher"
        description="Les transactions sont temporairement indisponibles. Aucune valeur de substitution n'est affichée : nous préférons ne rien montrer qu'un chiffre que la donnée ne soutient pas."
        onRetry={reset}
      />
    </PageContainer>
  );
}
