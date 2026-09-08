import { PendingButton } from "@/components/crm/pending-button";
import { Field, Input, PageHeader, Select } from "@/components/ui";
import { currentMember } from "@/lib/crm/access";
import { teamMembers } from "@/lib/crm/team";

import { createContactAction } from "../../actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "Nouveau contact",
  robots: { index: false, follow: false },
};

export default async function NewContactPage() {
  const me = await currentMember();
  return (
    <>
      <PageHeader title="Nouveau contact" description="Une adresse suffit. Le reste se complète plus tard." />
      <form action={createContactAction} className="panel grid max-w-2xl gap-5 p-6 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="email" required className="sm:col-span-2">
          <Input id="email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Prénom" htmlFor="firstName">
          <Input id="firstName" name="firstName" />
        </Field>
        <Field label="Nom" htmlFor="lastName">
          <Input id="lastName" name="lastName" />
        </Field>
        <Field label="Téléphone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" />
        </Field>
        <Field label="Société ou activité" htmlFor="company">
          <Input id="company" name="company" />
        </Field>
        <Field label="Responsable" htmlFor="ownerEmail">
          <Select id="ownerEmail" name="ownerEmail" defaultValue={me?.email ?? ""}>
            {teamMembers().map((member) => (
              <option key={member.email} value={member.email}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <PendingButton type="submit">Créer la fiche</PendingButton>
        </div>
      </form>
    </>
  );
}
