"use client";

/**
 * LE RETRAIT DU CONSENTEMENT, aussi simple que son recueil.
 *
 * C'est une obligation, pas une politesse : un accord qu'on ne peut pas retirer
 * n'est pas un accord. Ce composant vit dans le pied de page et sur la page
 * cookies, donc à un clic depuis n'importe où.
 *
 * Il affiche l'état RÉEL, y compris quand le navigateur a tranché à la place de
 * la personne : dire « vous avez accepté » alors qu'un signal de
 * confidentialité bloque tout serait faux, et faux dans le sens qui nous
 * arrange.
 */

import { useConsent } from "@/lib/consent/consent";
import { privacySignalRefuses } from "@/lib/analytics/track";
import { Button } from "@/components/ui";

export function ConsentSettings({ compact = false }: { compact?: boolean }) {
  const { status, choices, hydrated, reopen, refuseAll } = useConsent();

  if (!hydrated) return null;

  if (privacySignalRefuses()) {
    return (
      <p className={compact ? "text-sm text-ink-muted" : "text-sm leading-relaxed text-ink-muted"}>
        Votre navigateur émet un signal de refus de suivi. Nous le respectons&nbsp;: aucune mesure
        d&apos;audience n&apos;est chargée, quel que soit le choix fait ici.
      </p>
    );
  }

  const label =
    status !== "answered"
      ? "Vous n'avez pas encore répondu. Aucune mesure d'audience n'est chargée."
      : choices.analytics
        ? "Vous avez accepté la mesure d'audience."
        : "Vous avez refusé la mesure d'audience.";

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      <p className="text-sm leading-relaxed text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={reopen}>
          Modifier mon choix
        </Button>
        {status === "answered" && choices.analytics ? (
          <Button type="button" variant="ghost" size="sm" onClick={refuseAll}>
            Retirer mon consentement
          </Button>
        ) : null}
      </div>
    </div>
  );
}
