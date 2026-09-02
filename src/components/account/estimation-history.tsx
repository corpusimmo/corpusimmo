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
 *
 * DEUX SOURCES, ET LAQUELLE GAGNE. Pour une personne connectée, la liste vient
 * de la base et suit d'un appareil à l'autre : c'est elle qui fait foi, et les
 * suppressions passent par des actions serveur. Pour une visite anonyme, elle
 * vient du navigateur. Le composant est le même dans les deux cas, et il DIT
 * lequel s'applique plutôt que de laisser croire à une sauvegarde qui n'existe
 * pas.
 */

import { useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Badge, Button, EmptyState, SkeletonText } from "@/components/ui";
import {
  useEstimationHistory,
  type EstimationRecord,
} from "@/lib/history/estimations";
import { formatArea, formatPrice, formatPricePerSqm } from "@/lib/utils/format";
import { PROPERTY_TYPE_LABELS } from "@/types/property";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

/**
 * UNE DATE QUI N'EN EST PAS UNE NE DOIT PAS EMPORTER LA PAGE.
 *
 * `Intl.DateTimeFormat.format()` ne rend pas « Invalid Date » : il LÈVE un
 * `RangeError`. Une seule ligne d'historique dont l'horodatage est illisible —
 * une migration, un import, une colonne nulle — et c'est tout l'espace compte
 * qui tombe sur la page d'incident, pour une date.
 */
function formatDate(value: number): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

export function EstimationHistory({
  stored,
  onForget,
  onClear,
}: {
  /** La liste de la base. `null` pour une visite anonyme. */
  stored?: EstimationRecord[] | null;
  onForget?: (id: string) => Promise<void>;
  onClear?: () => Promise<void>;
} = {}) {
  const local = useEstimationHistory();
  const [pending, startTransition] = useTransition();

  const serverBacked = stored != null;
  const estimations = serverBacked ? stored : local.estimations;
  const hydrated = serverBacked || local.hydrated;

  const forget = (id: string) => {
    if (serverBacked && onForget) startTransition(() => void onForget(id));
    else local.forget(id);
  };

  const clear = () => {
    if (serverBacked && onClear) startTransition(() => void onClear());
    else local.clear();
  };

  if (!hydrated) return <SkeletonText lines={4} />;

  if (estimations.length === 0) {
    return (
      <EmptyState
        title="Aucune estimation pour l'instant"
        description={
          serverBacked
            ? "Chaque estimation terminée s'ajoute ici automatiquement, rattachée à votre compte."
            : "Chaque estimation terminée s'ajoute ici automatiquement. Elle reste dans ce navigateur : rien n'est envoyé ni conservé sur nos serveurs."
        }
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
                  {PROPERTY_TYPE_LABELS[record.propertyType] ?? "Bien"}
                </Badge>
                {record.surface > 0 ? (
                  <span className="tnum text-sm text-ink-muted">
                    {formatArea(record.surface)}
                  </span>
                ) : null}
                {record.value ? null : (
                  <Badge tone="warning" size="sm">
                    Sans conclusion
                  </Badge>
                )}
              </div>

              <p className="mt-1.5 truncate font-medium text-ink">
                {record.address}
              </p>

              <p className="tnum mt-0.5 text-sm text-ink-subtle">
                {formatDate(record.at) ?? "Date inconnue"}
                {record.value ? (
                  <>
                    {" · "}
                    {record.comparables} vente
                    {record.comparables > 1 ? "s" : ""} retenue
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
                    {formatPrice(record.value.low)} à{" "}
                    {formatPrice(record.value.high)}
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
                aria-label={`Effacer l'estimation${
                  formatDate(record.at) ? ` du ${formatDate(record.at)}` : ""
                }`}
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
          {serverBacked
            ? "Ces estimations sont rattachées à votre compte : vous les retrouvez sur tous vos appareils."
            : "Ces estimations vivent dans ce navigateur uniquement. Elles ne suivent pas d'un appareil à l'autre, et un nettoyage de l'historique les efface."}
        </p>
        <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
          Tout effacer
        </Button>
      </div>
    </div>
  );
}
