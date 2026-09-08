import "server-only";

/**
 * QUI A LE DROIT D'OUVRIR LE CRM.
 *
 * La session prouve une adresse ; `CRM_TEAM` dit lesquelles comptent. Les deux
 * conditions sont exigées, et la base aussi : sans elle, il n'y a rien à
 * montrer. `currentMember()` répond `null` dans tous les autres cas, et c'est
 * la mise en page de `/crm` qui décide de rediriger.
 */

import { auth, isAuthConfigured } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

import { findMember, type TeamMember } from "./team";

export async function currentMember(): Promise<TeamMember | null> {
  if (!isAuthConfigured || !isDatabaseConfigured()) return null;
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.email || user.verifiedEmail !== true) return null;
    return findMember(user.email);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[crm] session illisible (${reason})`);
    return null;
  }
}

export class NotAMemberError extends Error {
  constructor() {
    super("Cette action est réservée à l'équipe.");
    this.name = "NotAMemberError";
  }
}

/** Pour les actions serveur : lève si la personne n'est pas de l'équipe. */
export async function requireMember(): Promise<TeamMember> {
  const member = await currentMember();
  if (!member) throw new NotAMemberError();
  return member;
}
