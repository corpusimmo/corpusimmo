"use client";

/**
 * Viewport → DVF rows, with the network discipline CONTRACTS §7 asks for:
 * 400 ms debounce on `moveend`, one `AbortController` per load, and an
 * identical-request guard so a pan that ends where it started costs nothing.
 *
 * On failure the hook exposes the error and KEEPS THE PREVIOUS ROWS OUT of the
 * way: it never invents a fallback dataset. An empty map with an explicit error
 * is honest; a map full of plausible fake prices is not.
 */

import * as React from "react";
import type { DvfQueryFilters, DvfResult } from "@/types/dvf";
import type { BBox } from "@/types/geo";

export const MAP_DEBOUNCE_MS = 400;

export type DvfDataStatus = "idle" | "loading" | "ready" | "error";

export interface UseDvfDataResult {
  result: DvfResult | null;
  status: DvfDataStatus;
  error: string | null;
  /** Schedules a debounced load for the given viewport. */
  request: (bbox: BBox) => void;
  /** Re-runs the last requested viewport immediately. */
  retry: () => void;
  cancel: () => void;
}

export function useDvfData(filters: DvfQueryFilters | undefined, enabled: boolean): UseDvfDataResult {
  const [result, setResult] = React.useState<DvfResult | null>(null);
  const [status, setStatus] = React.useState<DvfDataStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlRef = React.useRef<string | null>(null);
  const lastBboxRef = React.useRef<BBox | null>(null);
  const mountedRef = React.useRef(true);

  // Serialised filters: a stable dependency that survives object identity churn.
  const filterKey = React.useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  const cancel = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, [cancel]);

  const run = React.useCallback(
    (bbox: BBox, force: boolean) => {
      const url = buildUrl(bbox, filters);
      if (!force && url === lastUrlRef.current) return;

      cancel();
      lastUrlRef.current = url;
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      setError(null);

      void (async () => {
        try {
          const response = await fetch(url, { signal: controller.signal });
          const body: unknown = await response.json().catch(() => null);

          if (controller.signal.aborted || !mountedRef.current) return;

          if (!response.ok) {
            // Forget the url so "Réessayer" is not swallowed by the dedup guard.
            lastUrlRef.current = null;
            setStatus("error");
            setError(readErrorMessage(body, response.status));
            setResult(null);
            return;
          }

          setResult(isDvfResult(body) ? body : emptyResult());
          setStatus("ready");
        } catch (err) {
          if (controller.signal.aborted || !mountedRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          lastUrlRef.current = null;
          setStatus("error");
          setError("Impossible de contacter le service des ventes. Vérifiez votre connexion.");
          setResult(null);
        }
      })();
    },
    [cancel, filters],
  );

  const request = React.useCallback(
    (bbox: BBox) => {
      lastBboxRef.current = bbox;
      if (!enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => run(bbox, false), MAP_DEBOUNCE_MS);
    },
    [enabled, run],
  );

  const retry = React.useCallback(() => {
    const bbox = lastBboxRef.current;
    if (bbox) run(bbox, true);
  }, [run]);

  // A filter change invalidates the current answer immediately.
  React.useEffect(() => {
    lastUrlRef.current = null;
    const bbox = lastBboxRef.current;
    if (enabled && bbox) run(bbox, true);
    // `run` is recreated with `filters`; keying on the serialised filters keeps
    // this to one reload per actual change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, enabled]);

  return { result, status, error, request, retry, cancel };
}

export function buildUrl(bbox: BBox, filters: DvfQueryFilters | undefined): string {
  const params = new URLSearchParams();
  // 5 decimals ≈ 1 m: enough precision, and it keeps the dedup key stable
  // through the sub-pixel jitter of an inertial pan.
  params.set("bbox", bbox.map((n) => n.toFixed(5)).join(","));

  if (filters?.propertyTypes?.length) params.set("types", filters.propertyTypes.join(","));
  setIfDefined(params, "yearMin", filters?.yearMin);
  setIfDefined(params, "yearMax", filters?.yearMax);
  setIfDefined(params, "priceMin", filters?.priceMin);
  setIfDefined(params, "priceMax", filters?.priceMax);
  setIfDefined(params, "areaMin", filters?.areaMin);
  setIfDefined(params, "areaMax", filters?.areaMax);
  setIfDefined(params, "pricePerSqmMin", filters?.pricePerSqmMin);
  setIfDefined(params, "pricePerSqmMax", filters?.pricePerSqmMax);
  setIfDefined(params, "limit", filters?.limit);

  return `/api/dvf/transactions?${params.toString()}`;
}

function setIfDefined(params: URLSearchParams, key: string, value: number | undefined): void {
  if (value !== undefined && Number.isFinite(value)) params.set(key, String(value));
}

function readErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (error && typeof error.message === "string") return error.message;
  }
  if (status === 400) return "Emprise trop large : zoomez pour afficher les ventes.";
  return "Les données DVF sont momentanément indisponibles.";
}

function emptyResult(): DvfResult {
  return { transactions: [], count: 0, truncated: false, source: "geodvf", communes: [] };
}

function isDvfResult(body: unknown): body is DvfResult {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { transactions?: unknown }).transactions)
  );
}
