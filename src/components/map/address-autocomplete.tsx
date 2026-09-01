"use client";

/**
 * The first interaction of the product — and the one that decides whether the
 * estimate is about the right building. It is a full ARIA 1.2 combobox, not an
 * input with a div under it: arrow keys, Enter, Escape, `aria-activedescendant`,
 * and a polite live region announcing how many suggestions are available.
 *
 * Network discipline (CONTRACTS §3): 250 ms debounce, one `AbortController` per
 * keystroke, and no request under three characters.
 */

import * as React from "react";
import { Building2, Loader2, MapPin, Search, X } from "lucide-react";
import type { GeoAddress } from "@/types/geo";
import { cn } from "@/lib/utils/cn";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 7;

export interface AddressAutocompleteProps {
  value?: GeoAddress | null;
  onSelect: (address: GeoAddress | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
  id?: string;
  className?: string;
}

type Status = "idle" | "loading" | "ready" | "error";

export function AddressAutocomplete({
  value,
  onSelect,
  placeholder = "Saisissez une adresse",
  autoFocus,
  size = "md",
  id,
  className,
}: AddressAutocompleteProps) {
  const reactId = React.useId();
  const inputId = id ?? `address-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  const [query, setQuery] = React.useState(value?.label ?? "");
  const [results, setResults] = React.useState<GeoAddress[]>([]);
  const [status, setStatus] = React.useState<Status>("idle");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when a value is picked, so the resulting input change never refetches. */
  const skipNextFetchRef = React.useRef(false);

  // Keep the field in sync when the parent resets or replaces the address.
  React.useEffect(() => {
    if (value && value.label !== query) {
      skipNextFetchRef.current = true;
      setQuery(value.label);
      setOpen(false);
    }
    if (value === null && document.activeElement !== inputRef.current) {
      setQuery("");
    }
    // Only the parent-provided value may drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const cancelPending = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Unmount: no dangling timer, no in-flight request writing into dead state.
  React.useEffect(() => cancelPending, [cancelPending]);

  React.useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const trimmed = query.trim();
    cancelPending();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/geocode?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body: unknown = await response.json();
          const list = extractResults(body);
          if (controller.signal.aborted) return;
          setResults(list);
          setStatus("ready");
          setActiveIndex(list.length > 0 ? 0 : -1);
          setOpen(true);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setStatus("error");
          setOpen(true);
        }
      })();
    }, DEBOUNCE_MS);

    return cancelPending;
  }, [query, cancelPending]);

  // Click outside closes without losing the typed text.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Keep the highlighted option visible when navigating with the keyboard.
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.children[activeIndex];
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = (address: GeoAddress): void => {
    cancelPending();
    skipNextFetchRef.current = true;
    setQuery(address.label);
    setOpen(false);
    setActiveIndex(-1);
    setStatus("ready");
    onSelect(address);
  };

  const clear = (): void => {
    cancelPending();
    setQuery("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setActiveIndex(-1);
    onSelect(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const count = results.length;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open && count > 0) {
          setOpen(true);
          setActiveIndex(0);
          return;
        }
        if (count > 0) setActiveIndex((i) => (i + 1) % count);
        return;
      case "ArrowUp":
        event.preventDefault();
        if (count > 0) setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        return;
      case "Home":
        if (open && count > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        return;
      case "End":
        if (open && count > 0) {
          event.preventDefault();
          setActiveIndex(count - 1);
        }
        return;
      case "Enter": {
        if (!open || activeIndex < 0) return;
        const picked = results[activeIndex];
        if (!picked) return;
        event.preventDefault();
        commit(picked);
        return;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
    }
  };

  const showList = open && (status !== "idle" || results.length > 0);
  const activeId = activeIndex >= 0 && results[activeIndex] ? optionId(inputId, activeIndex) : undefined;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle",
            size === "lg" ? "size-5" : "size-4",
          )}
        />

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={`${inputId}-status`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            // Typing invalidates the previous pick: the parent must not keep
            // acting on an address the user is visibly replacing.
            if (value) onSelect(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className={cn(
            "w-full rounded-md border border-border bg-surface text-ink shadow-xs",
            "placeholder:text-ink-subtle",
            "transition-[border-color,box-shadow] duration-150 ease-out",
            "hover:border-border-strong",
            size === "lg" ? "h-14 pl-11 pr-11 text-base" : "h-11 pl-10 pr-10 text-sm",
            showList && results.length > 0 && "rounded-b-none border-b-transparent",
          )}
        />

        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2",
            size === "lg" ? "right-4" : "right-3",
          )}
        >
          {status === "loading" ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-ink-subtle" />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              // 44 px hit area without a 44 px visual: the icon stays discreet.
              className="-m-3 grid size-11 place-items-center rounded-full text-ink-subtle transition-colors hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Effacer l’adresse</span>
            </button>
          ) : null}
        </span>
      </div>

      {/* Announced to screen readers; visually carried by the list itself. */}
      <p id={`${inputId}-status`} role="status" aria-live="polite" className="sr-only">
        {statusMessage(status, results.length, query)}
      </p>

      {showList ? (
        <div
          className={cn(
            "animate-fade-in absolute left-0 right-0 top-full z-50",
            "overflow-hidden rounded-b-md border border-border bg-surface shadow-lg",
          )}
        >
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Suggestions d’adresses"
            className="max-h-80 overflow-y-auto overscroll-contain"
          >
            {results.map((address, index) => (
              <li
                key={address.id}
                id={optionId(inputId, index)}
                role="option"
                aria-selected={index === activeIndex}
                // `onMouseDown` fires before the input's blur, so the click is
                // never swallowed by the outside-click handler.
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(address);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3.5 py-2.5 transition-colors",
                  "border-b border-border-soft last:border-b-0",
                  index === activeIndex ? "bg-primary-soft" : "bg-surface",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                    index === activeIndex
                      ? "bg-primary text-primary-fg"
                      : "bg-surface-2 text-ink-subtle",
                  )}
                >
                  {address.kind === "municipality" ? (
                    <Building2 className="size-3.5" />
                  ) : (
                    <MapPin className="size-3.5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {primaryLabel(address)}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {secondaryLabel(address)}
                  </span>
                </span>
              </li>
            ))}

            {status === "loading" && results.length === 0 ? (
              <li className="flex items-center gap-2 px-3.5 py-4 text-sm text-ink-muted">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Recherche en cours…
              </li>
            ) : null}

            {status === "ready" && results.length === 0 ? (
              <li className="px-3.5 py-4 text-sm text-ink-muted">
                Aucune adresse ne correspond à «&nbsp;{query.trim()}&nbsp;». Essayez avec le code
                postal ou la commune.
              </li>
            ) : null}

            {status === "error" ? (
              <li className="flex flex-col gap-2 px-3.5 py-4">
                <span className="text-sm font-medium text-danger">
                  Le service d’adresses est momentanément indisponible.
                </span>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    // Re-runs the effect by re-setting the same query value.
                    setQuery((q) => `${q} `);
                    setQuery((q) => q.trimEnd());
                  }}
                  className="self-start text-sm font-medium text-primary underline underline-offset-2"
                >
                  Réessayer
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function optionId(inputId: string, index: number): string {
  return `${inputId}-option-${index}`;
}

function primaryLabel(address: GeoAddress): string {
  if (address.kind === "municipality") return address.city;
  const street = [address.houseNumber, address.street].filter(Boolean).join(" ");
  return street.length > 0 ? street : address.label;
}

function secondaryLabel(address: GeoAddress): string {
  if (address.kind === "municipality") {
    return address.context ?? `Commune ${address.cityCode}`;
  }
  return [address.postcode, address.city].filter(Boolean).join(" ");
}

function statusMessage(status: Status, count: number, query: string): string {
  if (status === "error") return "Le service d’adresses est indisponible.";
  if (status === "loading") return "Recherche d’adresses en cours.";
  if (status === "idle") {
    return query.trim().length > 0 ? "Continuez à saisir pour lancer la recherche." : "";
  }
  if (count === 0) return "Aucune adresse trouvée.";
  return `${count} adresse${count > 1 ? "s" : ""} proposée${count > 1 ? "s" : ""}. Utilisez les flèches pour naviguer.`;
}

/** Defensive: the route is ours, but a proxy could still return something else. */
function extractResults(body: unknown): GeoAddress[] {
  if (typeof body !== "object" || body === null) return [];
  const results = (body as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.filter((item): item is GeoAddress => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Partial<GeoAddress>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.label === "string" &&
      typeof candidate.cityCode === "string" &&
      typeof candidate.coordinates === "object" &&
      candidate.coordinates !== null
    );
  });
}
