"use client";

/**
 * « Gérer les cookies » dans le pied de page.
 *
 * Le consentement doit pouvoir être retiré aussi facilement qu'il a été donné.
 * « Aussi facilement » veut dire depuis n'importe quelle page, sans chercher :
 * d'où ce lien, au même rang que les mentions légales, plutôt qu'un paragraphe
 * enfoui dans une politique que personne n'ouvre.
 *
 * C'est un bouton et non un lien, parce qu'il ne mène nulle part : il rouvre le
 * bandeau sur place. La page cookies, elle, reste accessible juste au-dessus
 * pour qui veut le détail avant de décider.
 */

import { useConsent } from "@/lib/consent/consent";

export function ConsentFooterLink({ className }: { className?: string }) {
  const { reopen, hydrated } = useConsent();

  if (!hydrated) return null;

  return (
    <button type="button" onClick={reopen} className={className}>
      Gérer les cookies
    </button>
  );
}
