"use client";

/**
 * « Exporter », et en dessous les trois formats.
 *
 * POURQUOI TROIS, ET PAS UN. Ils ne servent pas les mêmes gens. Le CSV part
 * dans un script ou un autre outil. Le tableur part chez quelqu'un qui va
 * retrier, filtrer, ajouter une colonne — d'où des nombres qui restent des
 * nombres, pas du texte. Le document part chez un client ou dans un dossier :
 * il doit se lire, pas se manipuler.
 *
 * LE CAS DU PDF. Il n'est pas fabriqué ici : on ouvre une page mise en pages
 * et on laisse le navigateur imprimer, ce que tous savent faire vers un PDF.
 * Générer le binaire nous-mêmes voudrait dire embarquer une librairie de plus
 * de trois cents kilo-octets, chargée par tous les visiteurs y compris ceux
 * qui n'exportent jamais — pour un résultat typographiquement inférieur à ce
 * que le moteur de rendu produit déjà. Le bouton le dit franchement.
 */

import * as React from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const FORMATS: {
  id: ExportFormat;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "xlsx",
    label: "Tableur Excel",
    hint: "Prix et surfaces en nombres, prêts à retrier",
    icon: <FileSpreadsheet aria-hidden className="size-4" />,
  },
  {
    id: "pdf",
    label: "Document à imprimer",
    hint: "Mise en pages prête ; choisissez « PDF » à l’impression",
    icon: <FileText aria-hidden className="size-4" />,
  },
  {
    id: "csv",
    label: "CSV",
    hint: "Séparateur point-virgule, pour un autre outil",
    icon: <Table2 aria-hidden className="size-4" />,
  },
];

export function ExportMenu({
  onExport,
  disabled,
}: {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  // Un menu qui ne se referme ni au clic dehors ni à Échap reste posé sur la
  // page et masque ce qu'on venait de consulter.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Download className="size-4" aria-hidden />
        Exporter
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(format.id);
              }}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="mt-0.5 text-ink-muted">{format.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {format.label}
                </span>
                <span className="block text-xs leading-snug text-ink-subtle">
                  {format.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
