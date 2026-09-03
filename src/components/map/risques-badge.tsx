"use client";

/**
 * LES RISQUES DE LA PARCELLE, SUR UNE VENTE QUE DVF LAISSE MUETTE.
 *
 * ── CE QU'IL DIT, ET CE QU'IL NE DIT PAS ───────────────────────────────────
 * Trois affichages, jamais un seul, parce que la source ne conclut pas
 * toujours :
 *
 *   · ÉTABLI. Géorisques qualifie le risque au point demandé : on le nomme,
 *     avec son niveau quand il en a un.
 *   · NON QUALIFIÉ. Le risque existe sur la commune mais la donnée s'arrête
 *     avant l'adresse : on le dit comme tel. Ce n'est PAS une absence de
 *     risque, et l'écrire autrement serait un mensonge utile à personne.
 *   · RIEN. Aucun risque établi, aucun risque laissé sans réponse : le
 *     composant ne rend rien du tout.
 *
 * Ce dernier point est la règle qui compte. Un service en panne, un point hors
 * périmètre, une réponse vide : dans les trois cas on se tait. Écrire « aucun
 * risque » sur la foi d'une requête ratée engagerait un acheteur sur une
 * information qu'on n'a jamais eue.
 *
 * La requête ne part qu'à l'ouverture d'une fiche, donc sur clic.
 */

import * as React from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import {
  severityRank,
  type RiskItem,
  type RiskReading,
} from "@/lib/georisques/api";

type State =
  | { status: "loading" }
  | { status: "done"; reading: RiskReading | null }
  | { status: "failed" };

/**
 * Trois teintes, pas sept : un niveau d'aléa n'est pas une note sur 20, et
 * une palette fine ferait croire à une précision que le zonage n'a pas.
 */
function chipClass(item: RiskItem): string {
  if (item.level === "important") return "bg-danger-soft text-danger-soft-fg";
  if (severityRank(item) >= 2) return "bg-warning-soft text-warning-soft-fg";
  return "bg-surface-3 text-ink-muted";
}

function Chip({ item }: { item: RiskItem }) {
  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${chipClass(item)}`}
    >
      {item.label}
      {item.level ? (
        <span className="font-normal"> ({item.level})</span>
      ) : null}
    </span>
  );
}

export function RisquesBadge({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    const query = new URLSearchParams({ lat: String(lat), lng: String(lng) });

    fetch(`/api/risques?${query.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ reading: RiskReading | null }>;
      })
      .then((payload) => setState({ status: "done", reading: payload.reading }))
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
        Recherche des risques recensés…
      </p>
    );
  }

  // Un service en panne ne mérite pas un bandeau, et surtout pas un bandeau
  // rassurant : cette ligne complète la fiche, elle ne la porte pas.
  if (state.status === "failed" || !state.reading) return null;

  const reading = state.reading;
  const sites = reading.formerIndustrialSites;

  return (
    <div className="flex items-start gap-1.5 rounded-sm bg-surface-2 px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 space-y-1.5">
        {reading.atAddress.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1">
            <span className="font-medium text-ink">
              Risques recensés à ce point :
            </span>
            {reading.atAddress.map((item) => (
              <Chip key={item.key} item={item} />
            ))}
          </p>
        ) : null}

        {sites ? (
          <p>
            <span className="font-medium text-ink">
              {sites.count} ancien{sites.count > 1 ? "s" : ""} site
              {sites.count > 1 ? "s" : ""} industriel
              {sites.count > 1 ? "s" : ""}
            </span>{" "}
            recensé{sites.count > 1 ? "s" : ""} dans un rayon de{" "}
            {sites.radiusM} m (inventaire CASIAS). Un site inventorié n’est pas
            un sol pollué : c’est une activité passée à vérifier.
          </p>
        ) : null}

        {reading.unqualified.length > 0 ? (
          <p>
            {reading.unqualified.length} risque
            {reading.unqualified.length > 1 ? "s" : ""} de la commune
            {reading.unqualified.length > 1 ? " ne sont" : " n’est"} pas
            qualifié{reading.unqualified.length > 1 ? "s" : ""} à cette adresse
            ({reading.unqualified.map((item) => item.label).join(", ")}).
            Absence de donnée ne vaut pas absence de risque.
          </p>
        ) : null}

        <p className="text-ink-subtle">
          Source Géorisques (BRGM). Zonages relevés au point de la mutation :
          ils ne remplacent pas l’état des risques annexé à l’acte.
          {reading.reportUrl ? (
            <>
              {" "}
              <a
                className="underline underline-offset-2 hover:text-ink"
                href={reading.reportUrl}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                Rapport complet
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
