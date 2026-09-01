import { MapPin } from "lucide-react";
import { formatArea } from "@/lib/utils/format";
import {
  PROPERTY_CONDITION_LABELS,
  PROPERTY_TYPE_LABELS,
  type PropertyDraft,
} from "@/types/property";

const OUTDOOR_LABELS: Record<string, string> = {
  balcony: "Balcon",
  terrace: "Terrasse",
  garden: "Jardin",
  none: "Sans extérieur",
};

/** Only answered characteristics are shown — a missing field stays invisible. */
function buildChips(subject: PropertyDraft): string[] {
  const { features } = subject;
  const chips: string[] = [PROPERTY_TYPE_LABELS[subject.type]];

  if (features.livingArea !== undefined) chips.push(formatArea(features.livingArea));
  if (features.landArea !== undefined) chips.push(`Terrain ${formatArea(features.landArea)}`);
  if (features.rooms !== undefined) chips.push(`${features.rooms} pièce${features.rooms > 1 ? "s" : ""}`);
  if (features.bedrooms !== undefined)
    chips.push(`${features.bedrooms} chambre${features.bedrooms > 1 ? "s" : ""}`);
  if (features.floor !== undefined)
    chips.push(features.floor === 0 ? "Rez-de-chaussée" : `${features.floor}ᵉ étage`);
  if (features.hasElevator) chips.push("Ascenseur");
  if (features.hasGarage) chips.push("Garage");
  if (features.hasParking) chips.push("Stationnement");
  if (features.outdoor) chips.push(OUTDOOR_LABELS[features.outdoor] ?? features.outdoor);
  if (features.condition) chips.push(PROPERTY_CONDITION_LABELS[features.condition]);
  if (features.isBuildable === true) chips.push("Constructible");
  if (features.isBuildable === false) chips.push("Non constructible");

  return chips;
}

export function SubjectSummary({ subject }: { subject: PropertyDraft }) {
  const chips = buildChips(subject);

  return (
    <section
      aria-labelledby="bien-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-xs"
    >
      <h2
        id="bien-title"
        className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-subtle"
      >
        Le bien estimé
      </h2>

      <div className="flex items-start gap-2.5">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-ink">{subject.address.label}</p>
          <p className="text-xs text-ink-muted">
            {subject.address.city} — {subject.address.postcode ?? subject.address.cityCode}
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted"
          >
            {chip}
          </li>
        ))}
      </ul>
    </section>
  );
}
