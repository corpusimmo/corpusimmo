import Link from "next/link";
import { Search } from "lucide-react";

import { InlineSelect } from "@/components/crm/inline-select";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";
import { CONTACT_STAGE_LABELS, CONTACT_STAGE_TONES, contactName, formatDateTime } from "@/lib/crm/labels";
import { memberLabel, teamMembers } from "@/lib/crm/team";
import { listContacts } from "@/lib/db/queries/crm";
import { CONTACT_STAGES, type ContactStage } from "@/lib/db/schema/crm";

import { setContactOwnerAction, setContactStageAction } from "../actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "Contacts",
  robots: { index: false, follow: false },
};

type Search = { q?: string; stage?: string; owner?: string; tag?: string };

export default async function CrmContactsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const stage = CONTACT_STAGES.includes(params.stage as ContactStage) ? (params.stage as ContactStage) : undefined;
  const rows = await listContacts({ q: params.q, stage, owner: params.owner, tag: params.tag });
  const members = teamMembers();
  const ownerOptions = [
    { value: "", label: "Personne" },
    ...members.map((member) => ({ value: member.email, label: member.firstName })),
  ];
  const stageOptions = CONTACT_STAGES.map((value) => ({ value, label: CONTACT_STAGE_LABELS[value] }));

  return (
    <>
      <PageHeader title="Contacts" description={`${rows.length} fiche${rows.length > 1 ? "s" : ""} affichée${rows.length > 1 ? "s" : ""}.`} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-ink-muted">
          Recherche
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Nom, e-mail, société, téléphone" />
        </label>
        <label className="flex w-44 flex-col gap-1 text-xs font-medium text-ink-muted">
          Étape
          <Select name="stage" defaultValue={stage ?? ""}>
            <option value="">Toutes</option>
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex w-44 flex-col gap-1 text-xs font-medium text-ink-muted">
          Responsable
          <Select name="owner" defaultValue={params.owner ?? ""}>
            <option value="">Tous</option>
            {members.map((member) => (
              <option key={member.email} value={member.email}>
                {member.firstName}
              </option>
            ))}
          </Select>
        </label>
        {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          Filtrer
        </Button>
        {params.tag ? (
          <Badge tone="accent">
            Étiquette : {params.tag} <Link href="/crm/contacts" className="ml-1 underline">retirer</Link>
          </Badge>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun contact"
          description="Élargissez le filtre, ou créez une fiche."
          action={
            <Button asChild>
              <Link href="/crm/contacts/nouveau">Nouveau contact</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table caption="Contacts">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Contact</TableHeaderCell>
                <TableHeaderCell>Origine</TableHeaderCell>
                <TableHeaderCell>Étape</TableHeaderCell>
                <TableHeaderCell>Responsable</TableHeaderCell>
                <TableHeaderCell>Dernière activité</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link href={`/crm/contacts/${contact.id}`} className="font-medium text-ink hover:underline">
                      {contactName(contact)}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {contact.email}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                      {contact.company ? ` · ${contact.company}` : ""}
                    </p>
                    {contact.tags.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {contact.tags.slice(0, 6).map((tag) => (
                          <Link key={tag} href={`/crm/contacts?tag=${encodeURIComponent(tag)}`}>
                            <Badge tone="neutral" size="sm">
                              {tag}
                            </Badge>
                          </Link>
                        ))}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-ink-muted">{contact.origin ?? "site"}</span>
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      label="Étape"
                      value={contact.stage}
                      options={stageOptions}
                      onChange={setContactStageAction.bind(null, contact.id)}
                      className="w-40"
                    />
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      label="Responsable"
                      value={contact.ownerEmail ?? ""}
                      options={ownerOptions}
                      onChange={setContactOwnerAction.bind(null, contact.id)}
                      className="w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-ink-muted">
                      {formatDateTime(contact.lastActivityAt ?? contact.updatedAt)}
                    </span>
                    <span className="sr-only">
                      {memberLabel(contact.ownerEmail)} {CONTACT_STAGE_TONES[contact.stage]}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
