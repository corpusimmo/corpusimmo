import { PendingButton } from "@/components/crm/pending-button";
import { TaskRow } from "@/components/crm/task-row";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { currentMember } from "@/lib/crm/access";
import { contactName } from "@/lib/crm/labels";
import { memberLabel, teamMembers } from "@/lib/crm/team";
import { listOpenTasks } from "@/lib/db/queries/crm";

import { addTaskAction, deleteTaskAction, toggleTaskAction } from "../actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "Tâches",
  robots: { index: false, follow: false },
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ pour?: string }> }) {
  const { pour } = await searchParams;
  const me = await currentMember();
  const members = teamMembers();
  const assignee = members.find((member) => member.email === pour)?.email;
  const rows = await listOpenTasks(assignee);

  return (
    <>
      <PageHeader
        title="Tâches"
        description="Ce qui reste à faire, la plus urgente d'abord."
        actions={
          <form method="get" className="flex items-center gap-2">
            <Select name="pour" defaultValue={assignee ?? ""} aria-label="Pour qui" className="w-40">
              <option value="">Toute l'équipe</option>
              {members.map((member) => (
                <option key={member.email} value={member.email}>
                  {member.firstName}
                </option>
              ))}
            </Select>
            <PendingButton type="submit" variant="secondary" size="sm">
              Voir
            </PendingButton>
          </form>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle tâche</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addTaskAction} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
            <Input name="title" required placeholder="Quoi faire" aria-label="Tâche" />
            <Input name="dueAt" type="date" aria-label="Échéance" />
            <Select name="assigneeEmail" aria-label="Pour qui" defaultValue={me?.email ?? ""}>
              {members.map((member) => (
                <option key={member.email} value={member.email}>
                  {member.firstName}
                </option>
              ))}
            </Select>
            <PendingButton type="submit">Ajouter</PendingButton>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Rien en attente" description="Tout est fait, ou rien n'a été noté." />
      ) : (
        <ul className="panel divide-y divide-border-soft px-4">
          {rows.map(({ task, contact }) => (
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
    </>
  );
}
