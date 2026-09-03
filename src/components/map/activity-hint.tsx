"use client";

/**
 * La ligne qui précise « local commercial ou industriel ».
 *
 * ── LA RÈGLE D'AFFICHAGE ───────────────────────────────────────────────────
 * Elle n'écrase JAMAIS l'étiquette DVF, elle s'ajoute en dessous. DVF dit ce
 * que le fisc a enregistré ; SIRENE dit qui travaille là. Quand les deux
 * divergent, c'est le désaccord qui informe — pas la moyenne des deux.
 *
 * D'où le vocabulaire : « vraisemblablement », la source nommée, et les
 * raisons sociales affichées pour que le lecteur juge lui-même. Un
 * professionnel doit pouvoir dire en une seconde d'où sort la phrase et
 * décider s'il la croit.
 *
 * ── QUAND ELLE SE TAIT ─────────────────────────────────────────────────────
 * Rien à dire est une réponse valable : pas d'établissement actif, trop peu
 * pour trancher, ou adresse mixte où aucune famille ne domine. Le composant
 * ne rend alors rien du tout, plutôt qu'un « usage inconnu » qui ferait
 * passer une ignorance pour un résultat.
 *
 * La requête ne part qu'au montage de la fiche d'un local — donc sur clic,
 * jamais au survol ni en masse.
 */

import * as React from "react";
import { Building2, Loader2 } from "lucide-react";

import { ACTIVITY_FAMILIES } from "@/lib/enrichment/naf";
import type { ActivityHint as Hint } from "@/lib/enrichment/sirene";

type State =
  | { status: "loading" }
  | { status: "done"; hint: Hint | null }
  | { status: "failed" };

export function ActivityHint({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetch(`/api/activite?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ hint: Hint | null }>;
      })
      .then((payload) => setState({ status: "done", hint: payload.hint }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        void error;
        setState({ status: "failed" });
      });

    return () => controller.abort();
  }, [lat, lng]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        Recherche des activités à cette adresse…
      </p>
    );
  }

  // Un service en panne ne mérite pas un bandeau : cette ligne est un bonus,
  // pas une donnée dont la fiche dépend.
  if (state.status === "failed") return null;

  const hint = state.hint;
  if (!hint || !hint.conclusive) return null;

  const meta = ACTIVITY_FAMILIES[hint.family];
  const others = hint.count - hint.familyCount;

  return (
    <p className="flex items-start gap-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
      <Building2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">
        Vraisemblablement <span className="font-medium text-ink">{meta.label}</span> :{" "}
        {hint.familyCount} établissement{hint.familyCount > 1 ? "s" : ""} de ce type
        {others > 0 ? ` sur ${hint.count}` : ""} à cette adresse
        {hint.examples.length > 0 ? ` (${hint.examples.join(", ")})` : ""}.{" "}
        <span className="text-ink-subtle">
          Source SIRENE, activités déclarées : un indice sur l’usage, pas une
          qualification du bien.
        </span>
      </span>
    </p>
  );
}
