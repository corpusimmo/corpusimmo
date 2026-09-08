"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Contact, KanbanSquare, LayoutDashboard, ListChecks, Plus } from "lucide-react";

import { Button } from "@/components/ui";
import type { TeamMember } from "@/lib/crm/team";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/crm", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/crm/contacts", label: "Contacts", icon: Contact },
  { href: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/crm/taches", label: "Tâches", icon: ListChecks },
];

export function CrmNav({ member }: { member: TeamMember }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Sections du CRM" className="flex flex-wrap gap-1">
        {LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-inverted text-ink-inverted"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-muted">Connecté : {member.firstName}</span>
        <Button asChild size="sm">
          <Link href="/crm/contacts/nouveau">
            <Plus aria-hidden="true" className="size-4" />
            Contact
          </Link>
        </Button>
      </div>
    </div>
  );
}
