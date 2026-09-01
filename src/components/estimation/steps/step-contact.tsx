"use client";

import { Checkbox, Field, Input } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { formatArea } from "@/lib/utils/format";
import { PROPERTY_TYPE_LABELS } from "@/types/property";
import { parseNumber, resolvePropertyType, type StepProps } from "../wizard-state";

export function StepContact({ state, errors, update }: StepProps) {
  const { contact, consents } = state;
  const type = resolvePropertyType(state);
  const livingArea = parseNumber(state.features.livingArea);
  const landArea = parseNumber(state.features.landArea);

  const setContact = (patch: Partial<typeof contact>) =>
    update({ contact: { ...contact, ...patch } });
  const setConsents = (patch: Partial<typeof consents>) =>
    update({ consents: { ...consents, ...patch } });

  return (
    <div className="flex flex-col gap-8">
      {/* A last look at what is about to be estimated — no surprise result. */}
      <div
        className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3.5"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Récapitulatif
        </p>
        <p className="text-sm font-medium text-ink">{state.address?.label ?? "Adresse à préciser"}</p>
        <p className="text-sm text-ink-muted">
          {type ? PROPERTY_TYPE_LABELS[type] : "Type à préciser"}
          {livingArea !== undefined ? ` — ${formatArea(livingArea)}` : ""}
          {landArea !== undefined ? ` — terrain ${formatArea(landArea)}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="contact-firstname" required error={errors.firstName}>
          <Input
            id="contact-firstname"
            name="given-name"
            autoComplete="given-name"
            value={contact.firstName}
            invalid={Boolean(errors.firstName)}
            onChange={(event) => setContact({ firstName: event.target.value })}
          />
        </Field>

        <Field
          label="Adresse e-mail"
          htmlFor="contact-email"
          required
          error={errors.email}
          hint="C’est là que nous envoyons votre estimation."
        >
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contact.email}
            invalid={Boolean(errors.email)}
            onChange={(event) => setContact({ email: event.target.value })}
          />
        </Field>

        <Field
          label="Téléphone"
          htmlFor="contact-phone"
          error={errors.phone}
          hint="Facultatif. Utile seulement si vous souhaitez être rappelé."
          className="sm:col-span-2"
        >
          <Input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="06 12 34 56 78"
            value={contact.phone}
            invalid={Boolean(errors.phone)}
            onChange={(event) => setContact({ phone: event.target.value })}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold text-ink">
          Vos accords
        </legend>

        <div className="rounded-lg border border-border bg-surface p-4">
          <Checkbox
            checked={consents.estimationDelivery}
            onChange={(event) => setConsents({ estimationDelivery: event.target.checked })}
            error={errors.estimationDelivery}
            label={
              <span className="text-sm leading-relaxed text-ink">
                J’accepte de recevoir mon estimation par e-mail.{" "}
                <span className="text-ink-muted">
                  Nécessaire pour vous transmettre le résultat que vous demandez.
                </span>
              </span>
            }
          />
        </div>

        {/* Deliberately a separate box: this is the one that shares your data. */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <Checkbox
            checked={consents.professionalContact}
            onChange={(event) => setConsents({ professionalContact: event.target.checked })}
            label={
              <span className="text-sm leading-relaxed text-ink">
                J’accepte qu’un professionnel de l’immobilier me contacte au sujet de ce bien.{" "}
                <span className="text-ink-muted">
                  Vos coordonnées ne sont transmises à personne si cette case reste décochée. Vous
                  obtenez votre estimation dans tous les cas.
                </span>
              </span>
            }
          />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <Checkbox
            checked={consents.marketing}
            onChange={(event) => setConsents({ marketing: event.target.checked })}
            label={
              <span className="text-sm leading-relaxed text-ink">
                Je souhaite recevoir les actualités de {siteConfig.name}.{" "}
                <span className="text-ink-muted">Quelques e-mails par an, désinscription en un clic.</span>
              </span>
            }
          />
        </div>
      </fieldset>

      <p className="text-xs leading-relaxed text-ink-subtle">
        Vos réponses sont utilisées pour produire votre estimation et vous l’adresser. Vous pouvez
        demander leur suppression à tout moment en écrivant à{" "}
        <a
          href={`mailto:${siteConfig.contactEmail}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {siteConfig.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
