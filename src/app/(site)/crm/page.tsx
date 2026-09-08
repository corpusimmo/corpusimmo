import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TaskRow } from "@/components/crm/task-row";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui";
import { CONTACT_STAGE_LABELS, CONTACT_STAGE_TONES, contactName, formatAmount, formatDateTime } from "@/lib/crm/labels";
import { memberLabel } from "@/lib/crm/team";
import { dashboardCounts, listContacts, listOpenTasks } from "@/lib/db/queries/crm";

import { deleteTaskAction, toggleTaskAction } from "./actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default async function CrmDashboardPage() {
  const [counts, recent, tasks] = await Promise.all([
    dashboardCounts(),
    listContacts({ limit: 8 }),
    listOpenTasks(),
  ]);
  const today = tasks.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Ce qui est entré, ce qui attend, ce qui est en cours."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contacts" value={counts.contacts} hint={`${counts.newThisWeek} sur 7 jours`} />
        <Stat label="À contacter" value={counts.toContact} hint="Nouveaux et à contacter" />
        <Stat label="Tâches ouvertes" value={counts.openTasks} />
        <Stat
          label="Pipeline"
          value={counts.openDeals}
          hint={counts.openAmountCents ? formatAmount(counts.openAmountCents) : "Aucun montant"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Derniers contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="Aucun contact" description="Le premier arrivera par le site ou par la machine." />
            ) : (
              <ul className="divide-y divide-border-soft">
                {recent.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/crm/contacts/${contact.id}`}
                        className="block truncate text-sm font-medium text-ink hover:underline"
                      >
                        {contactName(contact)}
                      </Link>
                      <p className="truncate text-xs text-ink-muted">
                        {contact.origin ?? "site"} · {formatDateTime(contact.lastActivityAt ?? contact.updatedAt)}
                        {contact.ownerEmail ? ` · ${memberLabel(contact.ownerEmail)}` : ""}
                      </p>
                    </div>
                    <Badge tone={CONTACT_STAGE_TONES[contact.stage]} size="sm">
                      {CONTACT_STAGE_LABELS[contact.stage]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link href="/crm/contacts">
                Tous les contacts
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tâches à faire</CardTitle>
          </CardHeader>
          <CardContent>
            {today.length === 0 ? (
              <EmptyState title="Rien en attente" description="Ajoutez une tâche depuis une fiche contact ou la page Tâches." />
            ) : (
              <ul className="divide-y divide-border-soft">
                {today.map(({ task, contact }) => (
                  <TaskRow
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    dueAt={task.dueAt}
                    doneAt={task.doneAt}
                    assigneeLabel={memberLabel(task.assigneeEmail)}
                    contact={contact ? { id: contact.id, label: contactName(contact) } : null}
                    onToggle={toggleTaskAction}
                    onDelete={deleteTaskAction}
                  />
                ))}
              </ul>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-2">
              <Link href="/crm/taches">
                Toutes les tâches
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
