"use client";

/**
 * One recorded mutation, presented honestly.
 *
 * Rules baked in rather than left to the caller:
 *  - a missing field shows "—", never a plausible-looking guess;
 *  - a multi-lot mutation says so, because its €/m² is not comparable;
 *  - a row coming from the demo dataset is badged as fictional;
 *  - the address is shown exactly as DVF publishes it. Décret n° 2018-1350
 *    forbids indirect re-identification, so it is never enriched with a
 *    third-party lookup, and no owner information exists here to begin with.
 */

import * as React from "react";
import {
  Check,
  ExternalLink,
  Layers,
  Maximize2,
  MapPin,
  Plus,
  Ruler,
  Eye,
  Trees,
  X,
} from "lucide-react";
import type { DvfPropertyType, DvfTransaction } from "@/types/dvf";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  formatArea,
  formatDate,
  formatDistance,
  formatPrice,
  formatPricePerSqm,
} from "@/lib/utils/format";
import { googleMapsUrl, streetViewUrl } from "@/lib/utils/maps";
import { ActivityHint } from "./activity-hint";
import { DpeBadge } from "./dpe-badge";
import { RisquesBadge } from "./risques-badge";

export const PROPERTY_TYPE_LABELS: Record<DvfPropertyType, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  dependency: "Dépendance",
  other: "Autre bien",
};

const NATURE_LABELS: Record<DvfTransaction["nature"], string> = {
  sale: "Vente",
  sale_off_plan: "Vente en l’état futur d’achèvement",
  sale_land_to_build: "Vente de terrain à bâtir",
  exchange: "Échange",
  auction: "Adjudication",
  expropriation: "Expropriation",
  other: "Autre mutation",
};

export interface TransactionCardProps {
  transaction: DvfTransaction;
  /** Distance to the studied property, when there is one. */
  distanceMeters?: number;
  isComparable?: boolean;
  onToggleComparable?: (transaction: DvfTransaction) => void;
  onClose?: () => void;
  /** Densité d'affichage — jamais un univers. Voir `DvfMap`. */
  density?: "standard" | "dense";
  className?: string;
}

export function TransactionCard({
  transaction,
  distanceMeters,
  isComparable = false,
  onToggleComparable,
  onClose,
  density = "standard",
  className,
}: TransactionCardProps) {
  const t = transaction;
  const cible = {
    coordinates: t.coordinates,
    addressLabel: t.addressLabel,
    postcode: t.postcode,
    city: t.city,
  };
  const mapsHref = googleMapsUrl(cible);
  const panoHref = streetViewUrl(cible);
  const isDense = density === "dense";

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-3 bg-surface p-4",
        isDense ? "text-[13px]" : "text-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={t.propertyType === "apartment" ? "primary" : "accent"}
              size="sm"
            >
              {PROPERTY_TYPE_LABELS[t.propertyType]}
            </Badge>
            {t.source === "mock" ? (
              <Badge tone="warning" size="sm">
                Donnée fictive
              </Badge>
            ) : null}
            {t.isMultiLot ? (
              <Badge tone="neutral" size="sm">
                <Layers aria-hidden="true" className="size-3" />
                {t.lotCount ? `${t.lotCount} lots` : "Multi-lots"}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-ink-muted">
            {NATURE_LABELS[t.nature]} · {formatDate(t.date)}
          </p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">Fermer la fiche</span>
          </button>
        ) : null}
      </header>

      <div className="flex items-end justify-between gap-3">
        <p className="tnum text-2xl font-semibold leading-none tracking-tight text-ink">
          {formatPrice(t.price)}
        </p>
        {t.pricePerSqm !== undefined ? (
          <p className="tnum shrink-0 text-sm font-medium text-ink-muted">
            {formatPricePerSqm(t.pricePerSqm)}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-soft pt-3">
        <Metric
          icon={<Maximize2 className="size-3.5" />}
          label="Surface bâtie"
          value={formatArea(t.builtArea)}
        />
        <Metric
          icon={<Ruler className="size-3.5" />}
          label="Pièces"
          value={t.rooms !== undefined ? String(t.rooms) : "–"}
        />
        {t.landArea !== undefined ? (
          <Metric
            icon={<Trees className="size-3.5" />}
            label="Terrain"
            value={formatArea(t.landArea)}
          />
        ) : null}
        {distanceMeters !== undefined ? (
          <Metric
            icon={<MapPin className="size-3.5" />}
            label="Distance"
            value={formatDistance(distanceMeters)}
          />
        ) : null}
      </dl>

      <p className="flex items-start gap-1.5 border-t border-border-soft pt-3 text-xs leading-relaxed text-ink-muted">
        <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          {t.addressLabel ? (
            <span className="block font-medium text-ink">{t.addressLabel}</span>
          ) : (
            <span className="block italic">
              Adresse non publiée pour cette mutation
            </span>
          )}
          <span className="block">
            {[t.postcode, t.city].filter(Boolean).join(" ") || t.cityCode}
          </span>
        </span>
      </p>

      {/* DEUX ENRICHISSEMENTS GÉOGRAPHIQUES, ET LA MÊME PRÉCAUTION.
          Le type déclare `coordinates` comme toujours présent, mais certaines
          mutations n'en portent pas : DVF publie des ventes sans géocodage.
          Sans ce test, la fiche PLANTE au lieu de se contenter de l'adresse
          écrite. C'est un test existant qui l'a montré, pas une relecture.

          L'étiquette énergie, que DVF ne publie pas. Réservée au logement :
          un terrain, un parking ou une dépendance n'a pas de diagnostic, et
          l'aller chercher ne ramènerait que le voisinage. */}
      {t.coordinates &&
      (t.propertyType === "apartment" || t.propertyType === "house") ? (
        <DpeBadge
          lat={t.coordinates.lat}
          lng={t.coordinates.lng}
          builtArea={t.builtArea}
        />
      ) : null}

      {/* DVF range bureaux, boutiques, entrepôts et ateliers dans un seul
          « local industriel, commercial ou assimilé ». Là, et seulement là, on
          va chercher qui travaille à l'adresse pour préciser — juste sous
          l'adresse, et sans jamais remplacer ce que DVF a écrit plus haut. */}
      {t.coordinates && t.propertyType === "commercial" ? (
        <ActivityHint lat={t.coordinates.lat} lng={t.coordinates.lng} />
      ) : null}

      {/* Les risques valent pour TOUS les types, y compris un terrain : une
          zone d'aléa argile ou une ancienne activité industrielle pèsent
          autant sur un terrain nu que sur un logement. */}
      {t.coordinates ? (
        <RisquesBadge lat={t.coordinates.lat} lng={t.coordinates.lng} />
      ) : null}

      {t.isMultiLot ? (
        <p className="rounded-sm bg-warning-soft px-2.5 py-2 text-xs leading-relaxed text-warning-soft-fg">
          Cette vente regroupe plusieurs lots. Le prix au m² est calculé sur la
          surface totale et n’est pas directement comparable à une vente simple.
        </p>
      ) : null}

      {/* ALLER VOIR LE BIEN.
          DVF dit ce qui s'est vendu ; il ne dit rien de la rue ni de la
          façade. Deux liens comblent l'écart sans que nous hébergions une
          image ni ne chargions un script : ce sont des `href`, donc rien ne
          part vers Google avant un clic. Ils s'ouvrent dans un onglet à part,
          pour ne pas faire perdre la sélection de comparables en cours. */}
      {mapsHref ? (
        <div className="flex flex-wrap gap-2 border-t border-border-soft pt-3">
          <Button asChild variant="secondary" size="sm" className="flex-1">
            <a href={mapsHref} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" className="size-4" />
              Voir sur Google Maps
            </a>
          </Button>
          {panoHref ? (
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <a href={panoHref} target="_blank" rel="noreferrer noopener">
                <Eye aria-hidden="true" className="size-4" />
                Street View
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {onToggleComparable ? (
        <Button
          variant={isComparable ? "secondary" : "primary"}
          size="sm"
          fullWidth
          onClick={() => onToggleComparable(t)}
        >
          {isComparable ? (
            <>
              <Check aria-hidden="true" className="size-4" />
              Dans les comparables
            </>
          ) : (
            <>
              <Plus aria-hidden="true" className="size-4" />
              Ajouter aux comparables
            </>
          )}
        </Button>
      ) : null}
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-subtle">
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="tnum truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
