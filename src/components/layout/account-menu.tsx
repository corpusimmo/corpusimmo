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
 * Une fois la personne connectée, sa photo prend la place du pictogramme dans
 * ce même lien : un seul chemin vers l'espace, et non deux liens côte à côte
 * qui mènent au même endroit. La déconnexion reste à côté, réduite à son
 * pictogramme sur le bandeau (le libellé est lu par les lecteurs d'écran et
 * s'affiche en toutes lettres dans le menu mobile, où la place ne manque pas).
 *
 * Le reste ne rend RIEN tant que la session n'est pas résolue. Afficher
 * « Connexion » puis le remplacer par une photo une demi-seconde plus tard
 * fait sauter la barre et donne l'impression d'un site mal réveillé ; sur la
 * plupart des visites la réponse est « personne », donc l'attente ne coûte
 * presque jamais rien.
 */
export function AccountMenu({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const user = session?.user;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Link href="/mon-espace" className={LINK} title={user?.email ?? undefined}>
        {user ? (
          <Avatar src={user.image ?? null} name={user.name ?? user.email ?? "Compte"} />
        ) : (
          <LayoutGrid aria-hidden="true" className="size-4" />
        )}
        Mon espace
      </Link>

      {status === "loading" ? (
        <span aria-hidden="true" className="h-9 w-9" />
      ) : user ? (
        <button
          type="button"
          onClick={() => void signOut({ redirectTo: "/" })}
          title="Se déconnecter"
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className="lg:sr-only">Se déconnecter</span>
        </button>
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
 * 24 px déjà servie à la bonne taille par Google. Le jeu n'en vaut pas la
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
        className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[0.625rem] font-semibold text-primary-fg"
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
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="size-6 shrink-0 rounded-full border border-border object-cover"
    />
  );
}
