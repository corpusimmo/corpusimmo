import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CrmNav } from "@/components/crm/crm-nav";
import { currentMember } from "@/lib/crm/access";
import { teamMembers } from "@/lib/crm/team";
import { isAuthConfigured } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

/**
 * LA PORTE DU CRM.
 *
 * Trois cas, trois sorties : pas d'équipe ou pas de base, la section n'existe
 * pas (404, comme n'importe quelle page absente) ; personne de connecté, on
 * envoie à la connexion avec retour ici ; connecté mais pas de l'équipe, 404
 * aussi. On ne dit pas « réservé » à quelqu'un qui n'a rien à y faire.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured || !isDatabaseConfigured() || teamMembers().length === 0) {
    redirect("/");
  }
  const member = await currentMember();
  if (!member) {
    redirect("/connexion?callbackUrl=%2Fcrm");
  }
  return (
    <div className="container-page flex flex-col gap-8 py-8">
      <CrmNav member={member} />
      {children}
    </div>
  );
}
