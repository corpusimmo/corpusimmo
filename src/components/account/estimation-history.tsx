"use client";

/**
 * L'HISTORIQUE DES ESTIMATIONS, tel qu'on le relit.
 *
 * On affiche ce qui permet de reconnaître une estimation d'un coup d'œil :
 * l'adresse, la date, la fourchette, et le nombre de ventes qui la portent. Ce
 * dernier chiffre n'est pas décoratif : une fourchette adossée à six ventes ne
 * se lit pas comme une fourchette adossée à cinquante.
 *
 * Les estimations que le moteur n'a PAS conclues sont gardées elles aussi, et
 * affichées comme telles. Les effacer donnerait l'illusion d'un outil qui
 * réussit toujours.
 */

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Badge, Button, EmptyState, SkeletonText } from "@/components/ui";
import { useEstimationHistory } from "@/lib/history/estimations";
import { formatArea, formatPrice, formatPricePerSqm } from "@/lib/utils/format";
import { PROPERTY_TYPE_LABELS } from "@/types/property";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export function EstimationHistory() {
  const { estimations, forget, clear, hydrated } = useEstimationHistory();

  if (!hydrated) return <SkeletonText lines={4} />;

  if (estimations.length === 0) {
    return (
      <EmptyState
        title="Aucune estimation pour l'instant"
        description="Chaque estimation terminée s'ajoute ici automatiquement. Elle reste dans ce navigateur : rien n'est envoyé ni conservé sur nos serveurs."
        action={
          <Button asChild variant="secondary">
            <Link href="/estimer">Estimer un bien</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {estimations.map((record) => (
          <li
            key={record.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral" size="sm">
                  {PROPERTY_TYPE_LABELS[record.propertyType]}
                </Badge>
                {record.surface > 0 ? (
                  <span className="tnum text-sm text-ink-muted">{formatArea(record.surface)}</span>
                ) : null}
                {record.value ? null : (
                  <Badge tone="warning" size="sm">
                    Sans conclusion
                  </Badge>
                )}
              </div>

              <p className="mt-1.5 truncate font-medium text-ink">{record.address}</p>

              <p className="tnum mt-0.5 text-sm text-ink-subtle">
                {dateFormat.format(new Date(record.at))}
                {record.value ? (
                  <>
                    {" · "}
                    {record.comparables} vente{record.comparables > 1 ? "s" : ""} retenue
                    {record.comparables > 1 ? "s" : ""}
                    {" · "}confiance {record.confidence}/100
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              {record.value ? (
                <>
                  <p className="tnum font-display text-lg text-ink">
                    {formatPrice(record.value.low)} à {formatPrice(record.value.high)}
                  </p>
                  {record.pricePerSqm ? (
                    <p className="tnum text-sm text-ink-subtle">
                      {formatPricePerSqm(record.pricePerSqm)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="max-w-xs text-sm text-ink-muted">
                  Pas assez de ventes comparables à cette adresse.
                </p>
              )}

              <button
                type="button"
                onClick={() => forget(record.id)}
                aria-label={`Effacer l'estimation du ${dateFormat.format(new Date(record.at))}`}
                className="inline-flex size-9 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-surface-2 hover:text-danger sm:mt-1"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-subtle">
          Ces estimations vivent dans ce navigateur uniquement. Elles ne suivent pas d&apos;un
          appareil à l&apos;autre, et un nettoyage de l&apos;historique les efface.
        </p>
        <Button variant="ghost" size="sm" onClick={clear}>
          Tout effacer
        </Button>
      </div>
    </div>
  );
}
