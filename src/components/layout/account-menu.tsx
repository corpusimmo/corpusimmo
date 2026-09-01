"use client";

import Link from "next/link";
import { useState } from "react";
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
          <Link
            href="/mon-espace"
            className="flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-surface-2"
            title={session.user.email ?? undefined}
          >
            <Avatar
              src={session.user.image ?? null}
              name={session.user.name ?? session.user.email ?? "Compte"}
            />
            <span className="hidden max-w-[10rem] truncate text-sm text-ink-muted lg:inline">
              {session.user.name ?? session.user.email}
            </span>
          </Link>
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

/**
 * LA PHOTO DE PROFIL GOOGLE.
 *
 * Elle arrive dans la session (`user.image`) et pointe vers `googleusercontent`.
 * Deux garde-fous :
 *   · `referrerPolicy="no-referrer"` : sans lui, Google renvoie parfois un 403
 *     sur les vignettes chargées depuis un autre domaine ;
 *   · un repli en initiales dès que l'image manque ou échoue. Un carré cassé en
 *     haut à droite est pire que pas de photo du tout.
 *
 * `<img>` et non `next/image` : l'optimiseur d'images demanderait de déclarer
 * `googleusercontent.com` dans les domaines autorisés, pour une vignette de
 * 32 px déjà servie à la bonne taille par Google. Le jeu n'en vaut pas la
 * chandelle, et la règle ESLint est donc désactivée ici en connaissance de cause.
 */
function Avatar({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (!src || broken) {
    return (
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.6875rem] font-semibold text-ink-muted"
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="size-7 shrink-0 rounded-full border border-border object-cover"
    />
  );
}
