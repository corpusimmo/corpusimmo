"use client";

/**
 * L'étiquette énergie, sur une vente que DVF laisse muette là-dessus.
 *
 * ── CE QU'ELLE DIT, ET CE QU'ELLE NE DIT PAS ───────────────────────────────
 * Deux affichages, jamais un seul, parce que la source ne permet pas toujours
 * de conclure :
 *
 *   · APPARIÉ. La surface de la mutation retrouve un diagnostic et un seul :
 *     on nomme l'étiquette, en disant que c'est un rapprochement de surfaces
 *     et non une donnée portée par l'acte.
 *   · PROFIL. Sinon on décrit l'immeuble : combien de diagnostics, et de
 *     quelle étiquette à quelle étiquette. Moins précis, mais vrai.
 *
 * Nommer l'étiquette du premier résultat serait faux une fois sur trois : à
 * une même adresse nantaise, le relevé donne F, C et G.
 *
 * La requête ne part qu'à l'ouverture d'une fiche, donc sur clic, et
 * uniquement pour un logement : un terrain ou un parking n'a pas de DPE.
 */

import * as React from "react";
import { Loader2, Zap } from "lucide-react";

import {
  DPE_COLORS,
  labelRange,
  soleLabel,
  type DpeReading,
} from "@/lib/dpe/ademe";

type State =
  | { status: "loading" }
  | { status: "done"; reading: DpeReading | null }
  | { status: "failed" };

function Letter({ label }: { label: string }) {
  return (
    <span
      className="inline-grid size-5 place-items-center rounded-sm text-[11px] font-bold text-[#14293c]"
      style={{ backgroundColor: DPE_COLORS[label as keyof typeof DPE_COLORS] }}
    >
      {label}
    </span>
  );
}

export function DpeBadge({
  lat,
  lng,
  builtArea,
}: {
  lat: number;
  lng: number;
  builtArea?: number;
}) {
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    const query = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (builtArea) query.set("surface", String(builtArea));

    fetch(`/api/dpe?${query.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ reading: DpeReading | null }>;
      })
      .then((payload) => setState({ status: "done", reading: payload.reading }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        void error;
        setState({ status: "failed" });
      });

    return () => controller.abort();
  }, [lat, lng, builtArea]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        Recherche des diagnostics énergétiques…
      </p>
    );
  }

  // Un service en panne ne mérite pas un bandeau : cette ligne complète la
  // fiche, elle ne la porte pas.
  if (state.status === "failed" || !state.reading) return null;

  const reading = state.reading;
  const matched = reading.matched;
  const range = labelRange(reading);
  const sole = soleLabel(reading);

  return (
    <p className="flex items-start gap-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
      <Zap aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">
        {matched ? (
          <>
            <span className="inline-flex items-center gap-1.5 align-middle">
              <Letter label={matched.label} />
              {matched.ges ? (
                <span className="text-ink-subtle">
                  GES <Letter label={matched.ges} />
                </span>
              ) : null}
            </span>{" "}
            <span className="font-medium text-ink">
              Diagnostic rapproché par la surface
            </span>{" "}
            ({matched.area} m²
            {matched.date ? `, ${matched.date.slice(0, 4)}` : ""}).{" "}
          </>
        ) : (
          <>
            <span className="font-medium text-ink">
              {reading.count} diagnostic{reading.count > 1 ? "s" : ""} à cette
              adresse
            </span>
            {sole ? (
              <>
                , tous en{" "}
                <span className="inline-block align-middle">
                  <Letter label={sole} />
                </span>
                .{" "}
              </>
            ) : range ? (
              <>
                , de{" "}
                <span className="inline-block align-middle">
                  <Letter label={range.best} />
                </span>{" "}
                à{" "}
                <span className="inline-block align-middle">
                  <Letter label={range.worst} />
                </span>
                . La surface ne permet pas d’en désigner un seul.{" "}
              </>
            ) : (
              ". "
            )}
          </>
        )}
        <span className="text-ink-subtle">
          Source ADEME. DVF ne publie pas le DPE : ce rapprochement est
          géographique, il ne figure pas dans l’acte.
        </span>
      </span>
    </p>
  );
}
