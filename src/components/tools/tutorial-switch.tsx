"use client";

/**
 * Le tutoriel, en deux versions : l'outil en ligne et le classeur Excel.
 *
 * Les deux supports font le même calcul mais ne s'utilisent pas pareil — on ne
 * dit pas « cliquez sur le curseur » à quelqu'un qui a ouvert un tableur. Plutôt
 * que deux pages qui se désynchroniseraient, une bascule : le visiteur choisit
 * son support, et le mode choisi est mémorisé pour la prochaine visite.
 *
 * Les étapes de la version en ligne sont DÉRIVÉES de la spécification de
 * l'outil : ajouter un champ au calculateur met le tutoriel à jour tout seul.
 */

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, MonitorSmartphone } from "lucide-react";

type Mode = "outil" | "excel";

const CLE_STOCKAGE = "corpusimmo:tutoriel:support";

export interface TutorialStep {
  title: string;
  body: string;
}

export function TutorialSwitch({
  outil,
  excel,
  toolHref,
  downloadHref,
  hasTool,
}: {
  outil: TutorialStep[];
  excel: TutorialStep[];
  toolHref: string;
  downloadHref: string;
  hasTool: boolean;
}) {
  const [mode, setMode] = useState<Mode>(hasTool ? "outil" : "excel");

  useEffect(() => {
    if (!hasTool) return;
    try {
      const memorise = window.localStorage.getItem(CLE_STOCKAGE);
      if (memorise === "outil" || memorise === "excel") setMode(memorise);
    } catch {
      // Navigation privée ou stockage refusé : le mode par défaut suffit,
      // ce n'est pas une raison pour casser la page.
    }
  }, [hasTool]);

  const choisir = (next: Mode) => {
    setMode(next);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, next);
    } catch {
      /* voir ci-dessus */
    }
  };

  const etapes = mode === "outil" ? outil : excel;

  return (
    <div className="flex flex-col gap-6">
      {hasTool ? (
        <div
          role="tablist"
          aria-label="Choisir le support"
          className="inline-flex w-fit rounded-lg border border-border bg-surface-2 p-1"
        >
          {(
            [
              { id: "outil" as const, label: "L'outil en ligne", Icon: MonitorSmartphone },
              { id: "excel" as const, label: "Le fichier Excel", Icon: FileSpreadsheet },
            ]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => choisir(id)}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                mode === id
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <ol className="flex flex-col gap-5">
        {etapes.map((etape, index) => (
          <li key={etape.title} className="flex gap-4">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-fg"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1 pt-0.5">
              <h3 className="text-base font-semibold text-ink">{etape.title}</h3>
              <p className="text-base leading-relaxed text-ink-muted">{etape.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3 border-t border-border-soft pt-6">
        {mode === "outil" && hasTool ? (
          <a
            href={toolHref}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-fg shadow-xs transition-colors hover:bg-primary-hover"
          >
            <MonitorSmartphone className="size-4" aria-hidden />
            Ouvrir l&apos;outil et suivre ces étapes
          </a>
        ) : (
          <a
            href={downloadHref}
            download
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-fg shadow-xs transition-colors hover:bg-primary-hover"
          >
            <Download className="size-4" aria-hidden />
            Télécharger le fichier et suivre ces étapes
          </a>
        )}
      </div>
    </div>
  );
}
