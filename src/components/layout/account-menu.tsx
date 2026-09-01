"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, UserRound } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Le coin compte de l'en-tête.
 *
 * Il ne rend RIEN tant que la session n'est pas résolue. Afficher « Connexion »
 * puis le remplacer par un nom une demi-seconde plus tard fait sauter la barre
 * et donne l'impression d'un site mal réveillé — et sur la plupart des visites
 * la réponse est « personne », donc l'attente ne coûte presque jamais rien.
 */
export function AccountMenu({ className }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span aria-hidden="true" className={cn("h-9 w-9", className)} />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/connexion"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-[0.9375rem] text-ink-muted transition-colors hover:text-ink",
          className,
        )}
      >
        <UserRound aria-hidden="true" className="size-4" />
        Connexion
      </Link>
    );
  }

  const label = session.user.name ?? session.user.email ?? "Mon compte";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="hidden max-w-[12rem] truncate text-sm text-ink-muted sm:inline">
        {label}
      </span>
      <button
        type="button"
        onClick={() => void signOut({ redirectTo: "/" })}
        className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="sr-only sm:not-sr-only">Se déconnecter</span>
      </button>
    </div>
  );
}
