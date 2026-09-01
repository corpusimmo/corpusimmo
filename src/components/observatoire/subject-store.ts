"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { GeoAddress } from "@/types/geo";
import type { PropertyDraft, PropertyFeatures, PropertyType } from "@/types/property";

/**
 * The property under study, shared between `/pro/valorisation` (where it is
 * captured) and `/pro/valorisation/comparaison` (where it is valued).
 *
 * A module-level store rather than a Context: only two screens read it, they
 * are never mounted together, and going through the layout would force yet
 * another client boundary around the whole workspace.
 */

export interface SubjectDraft {
  type: PropertyType;
  address: GeoAddress | null;
  features: PropertyFeatures;
}

const STORAGE_KEY = "corpusimmo.pro.subject.v1";

const DEFAULT_SUBJECT: SubjectDraft = {
  type: "apartment",
  address: null,
  features: {},
};

let snapshot: SubjectDraft = DEFAULT_SUBJECT;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SubjectDraft {
  return snapshot;
}

/** SSR and the first client render must agree, so both start from the default. */
function getServerSnapshot(): SubjectDraft {
  return DEFAULT_SUBJECT;
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / quota: in-memory is good enough for a draft.
  }
}

/** Runs once, after mount — never during render, to keep hydration clean. */
function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return;
    const record = parsed as Record<string, unknown>;
    const address =
      typeof record.address === "object" && record.address !== null
        ? (record.address as GeoAddress)
        : null;
    snapshot = {
      type: typeof record.type === "string" ? (record.type as PropertyType) : DEFAULT_SUBJECT.type,
      address,
      features:
        typeof record.features === "object" && record.features !== null
          ? (record.features as PropertyFeatures)
          : {},
    };
    emit();
  } catch {
    // Corrupted payload: keep the default.
  }
}

export function setSubjectDraft(patch: Partial<SubjectDraft>): void {
  snapshot = { ...snapshot, ...patch };
  persist();
  emit();
}

export function setSubjectFeatures(patch: Partial<PropertyFeatures>): void {
  snapshot = { ...snapshot, features: { ...snapshot.features, ...patch } };
  persist();
  emit();
}

export function resetSubjectDraft(): void {
  snapshot = DEFAULT_SUBJECT;
  persist();
  emit();
}

export function useSubjectDraft(): {
  subject: SubjectDraft;
  setSubject: (patch: Partial<SubjectDraft>) => void;
  setFeatures: (patch: Partial<PropertyFeatures>) => void;
  reset: () => void;
  /** `PropertyDraft` is only well-formed once an address has been resolved. */
  toPropertyDraft: () => PropertyDraft | null;
} {
  const subject = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hydrateOnce();
  }, []);

  const toPropertyDraft = useCallback((): PropertyDraft | null => {
    if (!subject.address) return null;
    return { type: subject.type, address: subject.address, features: subject.features };
  }, [subject]);

  return {
    subject,
    setSubject: setSubjectDraft,
    setFeatures: setSubjectFeatures,
    reset: resetSubjectDraft,
    toPropertyDraft,
  };
}
