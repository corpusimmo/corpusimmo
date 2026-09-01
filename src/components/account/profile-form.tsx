"use client";

/**
 * LE PROFIL, demandé une fois et jamais réclamé.
 *
 * Google donne un nom complet, le lien de connexion ne donne rien du tout.
 * Aucune des deux voies ne fournit un prénom séparé ni un téléphone, alors que
 * les deux servent dès qu'un professionnel doit rappeler quelqu'un.
 *
 * LE TÉLÉPHONE EST FACULTATIF, et le formulaire le DIT au lieu de le laisser
 * deviner par l'absence d'astérisque. Il n'est jamais requis pour utiliser quoi
 * que ce soit : le demander sans l'exiger est la seule façon de le recueillir
 * sans le voler.
 *
 * UN CHAMP LAISSÉ VIDE N'EFFACE PAS. La requête distingue « je ne touche pas »
 * de « efface », et le formulaire renvoie donc les trois champs tels qu'ils
 * sont affichés : ce qui est vide à l'écran devient vide en base, ce qui est
 * rempli le reste. C'est le comportement qu'attend quelqu'un qui regarde un
 * formulaire pré-rempli.
 */

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";

export interface ProfileValues {
  firstName: string;
  lastName: string;
  phone: string;
}

export function ProfileForm({
  initial,
  onSave,
}: {
  initial: ProfileValues;
  onSave: (values: ProfileValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof ProfileValues) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setSaved(false);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await onSave(values);
          setSaved(true);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="profil-prenom">
          <Input
            id="profil-prenom"
            value={values.firstName}
            onChange={set("firstName")}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nom" htmlFor="profil-nom">
          <Input
            id="profil-nom"
            value={values.lastName}
            onChange={set("lastName")}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field
        label="Téléphone"
        htmlFor="profil-telephone"
        hint="Facultatif. Il ne sert qu'à vous rappeler si vous le demandez, jamais à autre chose."
      >
        <Input
          id="profil-telephone"
          type="tel"
          value={values.phone}
          onChange={set("phone")}
          autoComplete="tel"
          placeholder="06 12 34 56 78"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Enregistrer
        </Button>
        {saved && !pending ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <Check aria-hidden="true" className="size-4" />
            Enregistré
          </p>
        ) : null}
      </div>
    </form>
  );
}
