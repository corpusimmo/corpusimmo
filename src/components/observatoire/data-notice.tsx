import { cn } from "@/lib/utils/cn";

/**
 * Le marqueur de provenance.
 *
 * Il n'existe qu'UNE seule version de ce composant, et c'est délibéré : cette
 * version du produit ne contient aucune donnée de démonstration. Tout ce qui
 * s'affiche vient de DVF. Le jour où un écran montrera autre chose, il faudra
 * lui écrire son propre marqueur — et non retirer celui-ci.
 */
export function RealDataNotice({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-ink-subtle", className)}>
      {children ??
        "Source : Demandes de Valeurs Foncières (DGFiP), transactions réellement enregistrées."}
    </p>
  );
}
