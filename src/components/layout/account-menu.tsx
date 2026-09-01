"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LayoutGrid, LogOut, UserRound } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const LINK =
  "inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-[0.9375rem] text-ink-muted transition-colors hover:text-ink";

/**
 * Le coin compte de l'en-tête.
 *
 * « Mon espace » est rendu TOUT DE SUITE, sans attendre la session : l'espace
 * ne demande pas de compte, il relit un cookie signé et le stockage du
 * navigateur. Le faire dépendre de l'authentification laisserait croire à une
 * porte fermée là où il n'y en a pas.
 *
 * Le reste, en revanche, ne rend RIEN tant que la session n'est pas résolue.
 * Afficher « Connexion » puis le remplacer par un nom une demi-seconde plus
 * tard fait sauter la barre et donne l'impression d'un site mal réveillé ; sur
 * la plupart des visites la réponse est « personne », donc l'attente ne coûte
 * presque jamais rien.
 */
export function AccountMenu({ className }: { className?: string }) {
  const { data: session, status } = useSession();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Link href="/mon-espace" className={LINK}>
        <LayoutGrid aria-hidden="true" className="size-4" />
        Mon espace
      </Link>

      {status === "loading" ? (
        <span aria-hidden="true" className="h-9 w-9" />
      ) : session?.user ? (
        <>
          <span className="hidden max-w-[10rem] truncate text-sm text-ink-muted lg:inline">
            {session.user.name ?? session.user.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut({ redirectTo: "/" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">Se déconnecter</span>
          </button>
        </>
      ) : (
        <Link href="/connexion" className={LINK}>
          <UserRound aria-hidden="true" className="size-4" />
          Connexion
        </Link>
      )}
    </div>
  );
}
