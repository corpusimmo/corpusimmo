import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { ConfirmButton } from "@/components/crm/confirm-button";
import { InlineSelect } from "@/components/crm/inline-select";
import { PendingButton } from "@/components/crm/pending-button";
import { TaskRow } from "@/components/crm/task-row";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  CONTACT_STAGE_LABELS,
  CONTACT_STAGE_TONES,
  DEAL_STAGE_LABELS,
  NOTE_KIND_LABELS,
  contactName,
  formatAmount,
  formatDateTime,
  formatDay,
} from "@/lib/crm/labels";
import { memberLabel, teamMembers } from "@/lib/crm/team";
import {
  listDealsOfContact,
  listLeadsOfContact,
  listNotes,
  listTasksOfContact,
  readContact,
} from "@/lib/db/queries/crm";
import { CONTACT_STAGES, DEAL_STAGES, NOTE_KINDS } from "@/lib/db/schema/crm";

import {
  addDealAction,
  addNoteAction,
  addTaskAction,
  deleteContactAction,
  deleteDealAction,
  deleteNoteAction,
  deleteTaskAction,
  setDealStageAction,
  toggleTaskAction,
  updateContactAction,
} from "../../actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "Contact",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const contact = await readContact(id);
  if (!contact) notFound();

  const [notes, tasks, deals, leads] = await Promise.all([
    listNotes(id),
    listTasksOfContact(id),
    listDealsOfContact(id),
    listLeadsOfContact(id),
  ]);
  const members = teamMembers();
  const dealStageOptions = DEAL_STAGES.map((value) => ({ value, label: DEAL_STAGE_LABELS[value] }));
  const fieldEntries = Object.entries(contact.fields);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/crm/contacts" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Contacts
          </Link>
        }
        title={contactName(contact)}
        description={[contact.email, contact.phone, contact.company].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={CONTACT_STAGE_TONES[contact.stage]}>{CONTACT_STAGE_LABELS[contact.stage]}</Badge>
            <ConfirmButton
                type="button"
                variant="ghost"
                size="sm"
                message="Supprimer cette fiche, ses notes, ses tâches et ses opportunités ? Cette action est définitive."
                action={async () => {
                  "use server";
                  const data = new FormData();
                  data.set("id", contact.id);
                  await deleteContactAction(data);
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Supprimer
              </ConfirmButton>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Fiche</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateContactAction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={contact.id} />
                <Field label="Prénom" htmlFor="firstName">
                  <Input id="firstName" name="firstName" defaultValue={contact.firstName ?? ""} />
                </Field>
                <Field label="Nom" htmlFor="lastName">
                  <Input id="lastName" name="lastName" defaultValue={contact.lastName ?? ""} />
                </Field>
                <Field label="Téléphone" htmlFor="phone">
                  <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
                </Field>
                <Field label="Société ou activité" htmlFor="company">
                  <Input id="company" name="company" defaultValue={contact.company ?? ""} />
                </Field>
                <Field label="Étape" htmlFor="stage">
                  <Select id="stage" name="stage" defaultValue={contact.stage}>
                    {CONTACT_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {CONTACT_STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Responsable" htmlFor="ownerEmail">
                  <Select id="ownerEmail" name="ownerEmail" defaultValue={contact.ownerEmail ?? ""}>
                    <option value="">Personne</option>
                    {members.map((member) => (
                      <option key={member.email} value={member.email}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Étiquettes" htmlFor="tags" hint="Séparées par des virgules." className="sm:col-span-2">
                  <Input id="tags" name="tags" defaultValue={contact.tags.join(", ")} />
                </Field>
                <div className="sm:col-span-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">
                    Origine : {contact.origin ?? "site"} · créé le {formatDay(contact.createdAt)}
                  </p>
                  <PendingButton type="submit" size="sm">
                    Enregistrer
                  </PendingButton>
                </div>
              </form>
            </CardContent>
          </Card>

          {fieldEntries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Réponses de qualification</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm">
                  {fieldEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium text-ink-muted">{key}</dt>
                      <dd className="whitespace-pre-wrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {leads.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Demandes sur le site</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border-soft text-sm">
                  {leads.map((lead) => (
                    <li key={lead.id} className="py-2">
                      <p className="font-medium">
                        {lead.source}
                        {lead.city ? ` · ${lead.city}` : ""}
                        {lead.propertyType ? ` · ${lead.propertyType}` : ""}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(lead.createdAt)} · score {lead.score}
                        {lead.estimatedLow && lead.estimatedHigh
                          ? ` · ${formatAmount(lead.estimatedLow * 100)} à ${formatAmount(lead.estimatedHigh * 100)}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Opportunités</CardTitle>
            </CardHeader>
            <CardContent>
              {deals.length > 0 ? (
                <ul className="mb-4 divide-y divide-border-soft">
                  {deals.map((deal) => (
                    <li key={deal.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{deal.title}</p>
                        <p className="text-xs text-ink-muted">
                          {formatAmount(deal.amountCents) || "Sans montant"}
                          {deal.expectedCloseAt ? ` · ${formatDay(deal.expectedCloseAt)}` : ""}
                          {` · ${memberLabel(deal.ownerEmail)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <InlineSelect
                          label="Colonne"
                          value={deal.stage}
                          options={dealStageOptions}
                          onChange={async (next) => {
                            "use server";
                            await setDealStageAction(deal.id, next, contact.id);
                          }}
                          className="w-36"
                        />
                        <ConfirmButton
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer l'opportunité"
                          message="Supprimer cette opportunité ?"
                          action={deleteDealAction.bind(null, deal.id, contact.id)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </ConfirmButton>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form action={addDealAction} className="grid gap-3 sm:grid-cols-[1fr_8rem_9rem_auto]">
                <input type="hidden" name="contactId" value={contact.id} />
                <Input name="title" placeholder="Titre de l'opportunité" required aria-label="Titre" />
                <Input name="amount" inputMode="decimal" placeholder="Montant €" aria-label="Montant en euros" />
                <Input name="expectedCloseAt" type="date" aria-label="Échéance" />
                <PendingButton type="submit" variant="secondary">
                  Ajouter
                </PendingButton>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tâches</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <ul className="mb-4 divide-y divide-border-soft">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      id={task.id}
                      title={task.title}
                      dueAt={task.dueAt}
                      doneAt={task.doneAt}
                      assigneeLabel={memberLabel(task.assigneeEmail)}
                      contact={{ id: contact.id, label: "" }}
                      onToggle={toggleTaskAction}
                      onDelete={deleteTaskAction}
                    />
                  ))}
                </ul>
              ) : null}
              <form action={addTaskAction} className="grid gap-3 sm:grid-cols-[1fr_9rem_8rem_auto]">
                <input type="hidden" name="contactId" value={contact.id} />
                <Input name="title" placeholder="Rappeler, envoyer la proposition…" required aria-label="Tâche" />
                <Input name="dueAt" type="date" aria-label="Échéance" />
                <Select name="assigneeEmail" aria-label="Pour qui" defaultValue={contact.ownerEmail ?? ""}>
                  {members.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.firstName}
                    </option>
                  ))}
                </Select>
                <PendingButton type="submit" variant="secondary">
                  Ajouter
                </PendingButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fil</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addNoteAction} className="mb-5 flex flex-col gap-3">
                <input type="hidden" name="contactId" value={contact.id} />
                <Textarea name="body" required placeholder="Ce qui s'est dit, ce qui a été décidé." aria-label="Note" rows={3} />
                <div className="flex items-center gap-3">
                  <Select name="kind" aria-label="Type" defaultValue="note" className="w-40">
                    {NOTE_KINDS.filter((kind) => kind !== "system").map((kind) => (
                      <option key={kind} value={kind}>
                        {NOTE_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </Select>
                  <PendingButton type="submit" size="sm">
                    Ajouter au fil
                  </PendingButton>
                </div>
              </form>
              {notes.length === 0 ? (
                <p className="text-sm text-ink-muted">Rien encore sur cette fiche.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {notes.map((note) => (
                    <li key={note.id} className="rounded-md border border-border-soft bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                        <span>
                          <Badge tone={note.kind === "system" ? "neutral" : "primary"} size="sm">
                            {NOTE_KIND_LABELS[note.kind]}
                          </Badge>{" "}
                          {note.authorEmail ? memberLabel(note.authorEmail) : "Machine"} · {formatDateTime(note.createdAt)}
                        </span>
                        <ConfirmButton
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer la note"
                          message="Supprimer cette note ?"
                          action={deleteNoteAction.bind(null, note.id, contact.id)}
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </ConfirmButton>
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap">{note.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
