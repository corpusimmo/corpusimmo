"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Modal, StatusBadge } from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * No dead button: the professional network is not live yet, so the CTA opens a
 * modal that says exactly that instead of pretending to submit something.
 */
export function LeadCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="flex flex-col gap-4 rounded-xl bg-surface-inverted p-6 shadow-md">
        <h2 className="text-lg font-semibold text-ink-inverted">
          Vous envisagez de vendre&nbsp;?
        </h2>
        <p className="text-sm leading-relaxed text-ink-inverted/75">
          Une estimation statistique donne l’ordre de grandeur. Pour un prix de mise en vente, un
          professionnel qui visite le bien tient compte de ce que DVF ne publie pas.
        </p>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-surface text-ink hover:bg-surface-2"
        >
          Être mis en relation
        </Button>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mise en relation avec un professionnel"
        description="Ce que nous pouvons faire pour vous, et ce que nous ne pouvons pas encore."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
            <Button asChild>
              <Link href="/observatoire">Explorer les ventes du quartier</Link>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <StatusBadge status="preview" />
          <p className="text-sm leading-relaxed text-ink-muted">
            Le réseau de professionnels partenaires n’est pas encore ouvert. Nous préférons vous le
            dire plutôt que d’enregistrer une demande qui n’aboutirait pas.
          </p>
          <p className="text-sm leading-relaxed text-ink-muted">
            Si vous avez coché l’accord correspondant lors de votre estimation, vous serez
            contacté dès l’ouverture. Sinon, écrivez-nous à{" "}
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {siteConfig.contactEmail}
            </a>
            .
          </p>
        </div>
      </Modal>
    </>
  );
}
