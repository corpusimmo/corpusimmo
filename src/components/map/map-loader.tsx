"use client";

/**
 * The only sanctioned entry point to the map.
 *
 * `maplibre-gl` is a few hundred kilobytes of WebGL runtime; it must never be
 * part of the initial bundle of a page that merely *mentions* a map
 * (CONTRACTS §7). `ssr: false` is also a correctness requirement, not only a
 * size one — the library touches `window` at module scope.
 *
 * The wrapper owns the box so the skeleton and the real map occupy exactly the
 * same space: `next/dynamic` does not forward props to the loading component,
 * and a bare skeleton would otherwise collapse to zero height.
 */

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/cn";
import type { DvfMapProps } from "./dvf-map";

function MapSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-canvas" role="status" aria-live="polite">
      <div className="skeleton absolute inset-0" />
      <div className="absolute left-3 top-3 h-10 w-32 rounded-md border border-border bg-surface/80 shadow-sm" />
      <div className="absolute right-3 top-3 h-[70px] w-[34px] rounded-md border border-border bg-surface/80 shadow-sm" />
      <span className="sr-only">Chargement de la carte…</span>
    </div>
  );
}

const DvfMapAsync = dynamic<DvfMapProps>(() => import("./dvf-map").then((mod) => mod.DvfMap), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function LazyDvfMap({ className, ...props }: DvfMapProps) {
  return (
    <div className={cn("relative isolate", className)}>
      <DvfMapAsync {...props} className="absolute inset-0" />
    </div>
  );
}

export type { DvfMapProps };
