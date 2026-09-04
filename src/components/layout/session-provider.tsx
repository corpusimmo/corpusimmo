"use client";

import { SessionProvider } from "next-auth/react";

/**
 * La session est résolue DANS LE NAVIGATEUR, et c'est un choix d'architecture,
 * pas une facilité.
 *
 * Appeler `auth()` dans le layout racine ferait basculer **toutes** les pages
 * en rendu dynamique — exactement ce que ce dépôt évite depuis le début, et ce
 * qu'un domaine neuf ne peut pas se permettre. Le fournisseur ci-dessous
 * interroge `/api/auth/session` après l'hydratation : les pages restent
 * statiques, et seul l'en-tête change d'aspect une fois la réponse arrivée.
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
