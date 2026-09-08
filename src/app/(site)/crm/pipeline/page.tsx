import Link from "next/link";

import { InlineSelect } from "@/components/crm/inline-select";
import { EmptyState, PageHeader } from "@/components/ui";
import { DEAL_STAGE_LABELS, contactName, formatAmount, formatDay } from "@/lib/crm/labels";
import { memberLabel } from "@/lib/crm/team";
import { listDeals } from "@/lib/db/queries/crm";
import { DEAL_STAGES } from "@/lib/db/schema/crm";

import { setDealStageAction } from "../actions";

import type { Metadata } from "next";

/** Écran de service : hors index, comme `/mon-espace`. */
export const metadata: Metadata = {
  title: "Pipeline",
  robots: { index: false, follow: false },
};

export default async function PipelinePage() {
  const rows = await listDeals();
  const options = DEAL_STAGES.map((value) => ({ value, label: DEAL_STAGE_LABELS[value] }));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Une colonne par étape. Le montant en tête de colonne additionne ce qui s'y trouve."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucune opportunité"
          description="Ajoutez-en une depuis une fiche contact."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {DEAL_STAGES.map((stage) => {
            const column = rows.filter((row) => row.deal.stage === stage);
            const total = column.reduce((sum, row) => sum + (row.deal.amountCents ?? 0), 0);
            return (
              <section key={stage} className="panel flex flex-col gap-3 p-3">
                <header className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold">{DEAL_STAGE_LABELS[stage]}</h2>
                  <span className="text-xs text-ink-muted">
                    {column.length}
                    {total ? ` · ${formatAmount(total)}` : ""}
                  </span>
                </header>
                {column.map(({ deal, contact }) => (
                  <article key={deal.id} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-xs">
                    <p className="text-sm font-medium">{deal.title}</p>
                    <Link href={`/crm/contacts/${contact.id}`} className="text-xs text-ink-muted hover:text-ink hover:underline">
                      {contactName(contact)}
                      {contact.company ? ` · ${contact.company}` : ""}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {formatAmount(deal.amountCents) || "Sans montant"}
                      {deal.expectedCloseAt ? ` · ${formatDay(deal.expectedCloseAt)}` : ""}
                      {` · ${memberLabel(deal.ownerEmail)}`}
                    </p>
                    <InlineSelect
                      label="Déplacer"
                      value={deal.stage}
                      options={options}
                      onChange={async (next) => {
                        "use server";
                        await setDealStageAction(deal.id, next, contact.id);
                      }}
                    />
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
