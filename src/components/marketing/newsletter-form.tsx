"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button, Checkbox, Input } from "@/components/ui";

type Status = "idle" | "sending" | "done" | "error";

interface SubscribeResponse {
  subscribed?: boolean;
  error?: { message?: string };
}

import { track } from "@/lib/analytics/track";

/**
 * L'inscription à la lettre d'information.
 *
 * La case de consentement est **décochée** et **obligatoire**. Ce n'est pas de
 * la prudence excessive : c'est la seule finalité du formulaire, et la
 * pré-cocher reviendrait à décider à la place de quelqu'un ce qu'il accepte de
 * recevoir. Le serveur la refuse d'ailleurs si elle n'est pas vraie.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (status === "done") {
    return (
      <p className="flex items-center gap-2 text-sm text-white/85">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        C&apos;est noté. Vous pouvez vous désinscrire en un clic depuis
        n&apos;importe quel envoi.
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus("sending");
        setMessage(null);

        try {
          const response = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: email.trim(), consent }),
          });

          const payload = (await response
            .json()
            .catch(() => null)) as SubscribeResponse | null;

          if (!response.ok) {
            setMessage(
              payload?.error?.message ??
                "L'inscription n'a pas abouti. Réessayez.",
            );
            setStatus("error");
            return;
          }

          /**
           * La route répond 202 même quand la liste n'est pas configurée : de
           * son point de vue la demande est bien reçue. Mais l'adresse n'est
           * alors enregistrée NULLE PART — et afficher « c'est noté » ici
           * serait un mensonge, exactement celui que ce produit s'interdit sur
           * les prix. On lit donc `subscribed`, pas le code de statut.
           */
          if (payload?.subscribed !== true) {
            setMessage(
              "L'inscription n'est pas encore ouverte. Rien n'a été enregistré, " +
                "revenez dans quelques jours.",
            );
            setStatus("error");
            return;
          }

          track({
            name: "newsletter_subscribed",
            params: { source: "pied-de-page" },
          });
          setStatus("done");
        } catch {
          setMessage("Réseau indisponible. Réessayez dans un instant.");
          setStatus("error");
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="prenom@exemple.fr"
          aria-label="Votre adresse e-mail"
          // `sm:flex-1` et non `flex-1` : sous 640 px la rangée est une
          // COLONNE, et `flex-1` s'y applique donc à la hauteur. Le champ
          // retombait à 19 px, hauteur de son texte, au lieu des 44 px de
          // `h-11` — une cible impossible à viser au doigt. Le partage de la
          // largeur ne sert qu'une fois les deux éléments côte à côte.
          className="bg-white/10 text-white placeholder:text-white/40 sm:flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          loading={status === "sending"}
          className="shrink-0"
        >
          S&apos;inscrire
        </Button>
      </div>

      <Checkbox
        checked={consent}
        onChange={(event) => setConsent(event.target.checked)}
        label={
          <span className="text-xs leading-relaxed text-white/65">
            J&apos;accepte de recevoir la lettre d&apos;information de
            CorpusImmo. Désinscription en un clic dans chaque envoi.
          </span>
        }
      />

      {status === "error" && message ? (
        <p role="alert" className="text-xs font-medium text-white/90">
          {message}
        </p>
      ) : null}
    </form>
  );
}
