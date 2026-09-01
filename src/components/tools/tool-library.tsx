"use client";

/**
 * La bibliothèque d'outils, filtrée dans le navigateur.
 *
 * Le filtrage est client, et la page reste STATIQUE : dix outils tiennent
 * largement dans le document, et lire la query string côté serveur ferait
 * basculer la page en rendu dynamique pour un service que le navigateur rend
 * instantanément. Le prix d'un rendu dynamique se paie sur chaque visite ; le
 * prix de ce filtre se paie une fois, en octets.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Search, SlidersHorizontal } from "lucide-react";

import { Badge, Button, Input } from "@/components/ui";
import { toolAssetTypes, toolUsages } from "@/config/navigation";
import type { ToolAssetType, ToolUsage } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { AssetTypeIcon, type AssetIconName } from "@/components/illustrations";
import type { ToolCard } from "@/types/tool";

import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites";

function matches(tool: ToolCard, assetType: ToolAssetType | null, usage: ToolUsage | null, query: string) {
  // « Tous actifs » répond à n'importe quel filtre de type d'actif : c'est ce
  // qui évite qu'un comparateur de prêts disparaisse dès qu'on clique
  // « Bureaux ».
  if (assetType && !tool.assetTypes.includes(assetType) && !tool.assetTypes.includes("tous-actifs")) {
    return false;
  }
  if (usage && !tool.usages.includes(usage)) return false;

  if (query) {
    const haystack = `${tool.title} ${tool.summary} ${tool.audience}`.toLowerCase();
    if (!haystack.includes(query.toLowerCase())) return false;
  }
  return true;
}

export function ToolLibrary({ tools }: { tools: ToolCard[] }) {
  const [assetType, setAssetType] = useState<ToolAssetType | null>(null);
  const [usage, setUsage] = useState<ToolUsage | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favorites, hydrated } = useFavorites();

  const visible = useMemo(
    () =>
      tools.filter(
        (tool) =>
          matches(tool, assetType, usage, query) &&
          (!onlyFavorites || favorites.includes(tool.id)),
      ),
    [tools, assetType, usage, query, onlyFavorites, favorites],
  );

  const reset = () => {
    setAssetType(null);
    setUsage(null);
    setQuery("");
    setOnlyFavorites(false);
  };

  const filtered = assetType !== null || usage !== null || query !== "" || onlyFavorites;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un outil : rentabilité, DCF, plus-value…"
            aria-label="Rechercher un outil"
            className="pl-9"
          />
        </div>

        <Facets
          legend="Type d'actif"
          options={toolAssetTypes}
          value={assetType}
          onChange={setAssetType}
        />
        <Facets legend="Usage" options={toolUsages} value={usage} onChange={setUsage} />

        {/* Le filtre n'apparaît qu'une fois qu'il a quelque chose à montrer :
            un « mes favoris (0) » proposé d'emblée n'apprend rien et occupe
            une ligne. */}
        {hydrated && favorites.length > 0 ? (
          <button
            type="button"
            aria-pressed={onlyFavorites}
            onClick={() => setOnlyFavorites((value) => !value)}
            className={cn(
              // Une pastille de 34 px se voit très bien et s'attrape mal : la
              // zone d'appui monte à 44 px sans que le filtre ne grossisse.
              "tap-target relative inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              onlyFavorites
                ? "border-accent bg-accent-soft text-accent-soft-fg"
                : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
            )}
          >
            <Bookmark aria-hidden="true" className="size-4" />
            Ce que j&apos;ai mis de côté
            <span className="tnum text-xs opacity-70">{favorites.length}</span>
          </button>
        ) : null}

        {filtered ? (
          <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-4">
            <p aria-live="polite" className="text-sm text-ink-muted">
              {visible.length === 0
                ? onlyFavorites
                  ? "Aucun de vos favoris ne correspond aux autres filtres."
                  : "Aucun outil ne correspond."
                : `${visible.length} outil${visible.length > 1 ? "s" : ""} sur ${tools.length}`}
            </p>
            {/* `size="sm"` dessine 36 px de haut : la zone d'appui complète
                les 8 px qui manquent, sans alourdir la barre de filtres. */}
            <Button variant="ghost" size="sm" onClick={reset} className="tap-target">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Tout afficher
            </Button>
          </div>
        ) : null}
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {visible.map((tool) => (
          <li key={tool.id}>
            <Link
              href={`/outils/${tool.id}`}
              className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 transition-shadow hover:shadow-md"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="eyebrow">{tool.audience}</span>
                {/* Les familles d'actif en silhouettes, dans la grammaire du
                    logotype : le classement du catalogue devient lisible d'un
                    coup d'œil, sans photo. */}
                <span className="flex shrink-0 gap-1 text-ink-subtle" aria-hidden="true">
                  {assetIconsFor(tool.assetTypes).map((name) => (
                    <AssetTypeIcon key={name} name={name} className="size-5" />
                  ))}
                </span>
              </span>
              <h2 className="font-display text-xl leading-snug text-ink">{tool.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-ink-muted">{tool.summary}</p>
              <span className="flex flex-wrap items-center gap-2 pt-1">
                {tool.usages.map((id) => (
                  <Badge key={id} tone="neutral" size="sm">
                    {toolUsages.find((entry) => entry.id === id)?.label ?? id}
                  </Badge>
                ))}
                <FavoriteButton slug={tool.id} title={tool.title} className="ml-auto" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Facets<Id extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { id: Id; label: string }[];
  value: Id | null;
  onChange: (next: Id | null) => void;
}) {
  return (
    // `gap-y-2.5` : les pastilles font 34 px de haut mais 44 px de zone
    // d'appui. Les 8 px d'origine laissaient donc la zone d'une pastille mordre
    // de 2 px sur celle de la ligne suivante dès que la rangée se replie, et un
    // filtre attrapé à la place d'un autre est pire qu'un filtre difficile à
    // attraper. 34 + 10 = 44 : les zones se touchent sans se recouvrir.
    <fieldset className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
      <legend className="eyebrow mb-2">{legend}</legend>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : option.id)}
            className={cn(
              "tap-target relative rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * La correspondance entre les facettes du catalogue et les icônes.
 *
 * `residentiel` donne DEUX silhouettes, appartement et maison : c'est la seule
 * famille qui en recouvre deux que le public distingue spontanément.
 * `tous-actifs` donne l'immeuble entier, sans lot désigné. Au-delà de trois
 * icônes, on tronque : une rangée de six silhouettes ne classe plus rien.
 */
const ASSET_ICONS: Record<ToolAssetType, AssetIconName[]> = {
  residentiel: ["apartment", "house"],
  bureaux: ["office"],
  commerce: ["retail"],
  industriel: ["warehouse"],
  terrain: ["land"],
  "tous-actifs": ["building"],
};

function assetIconsFor(types: readonly ToolAssetType[]): AssetIconName[] {
  const seen = new Set<AssetIconName>();
  for (const type of types) for (const name of ASSET_ICONS[type]) seen.add(name);
  return [...seen].slice(0, 3);
}
