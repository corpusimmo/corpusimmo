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
 *
 * ── LE MÊME REGISTRE QUE LE PANIER ────────────────────────────────────────
 *
 * Le bien de référence n'est pas un objet séparé : en base, c'est la colonne
 * `subject` du panier (`comparable_sets`). Il suit donc le panier, et le même
 * registre s'applique : le COMPTE quand il y en a un, le NAVIGATEUR sinon.
 *
 * C'est `ComparablesProvider` qui bascule ce magasin, par
 * `attachSubjectAccount`, parce que c'est lui qui sait ce que le serveur a
 * répondu. Ce module ne connaît ni la session ni les actions serveur : il
 * reçoit un puits d'écriture et s'en sert. Le faire interroger la session de
 * son côté ferait deux vérités possibles pour une seule question.
 *
 * LES ÉCRITURES SONT DIFFÉRÉES d'un instant. Renseigner un bien, c'est cocher
 * six cases à la suite ; une écriture par case ferait six allers-retours pour
 * un seul geste.
 */

export interface SubjectDraft {
  type: PropertyType;
  address: GeoAddress | null;
  features: PropertyFeatures;
}

const STORAGE_KEY = "corpusimmo.pro.subject.v1";

/** Assez court pour être invisible, assez long pour absorber une saisie. */
const PUSH_DELAY_MS = 600;

const DEFAULT_SUBJECT: SubjectDraft = {
  type: "apartment",
  address: null,
  features: {},
};

/** Où vit le brouillon : dans le compte, ou dans ce navigateur. */
export type SubjectSource = "local" | "account";

let snapshot: SubjectDraft = DEFAULT_SUBJECT;
let source: SubjectSource = "local";
let hydrated = false;
const listeners = new Set<() => void>();

/** Le puits d'écriture posé par `ComparablesProvider`. Nul en mode navigateur. */
let sink: ((subject: PropertyDraft | null) => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

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

function getSource(): SubjectSource {
  return source;
}

function getServerSource(): SubjectSource {
  return "local";
}

/** Le brouillon sous la forme que la base range, ou nul tant qu'il n'a pas d'adresse. */
function toDraft(value: SubjectDraft): PropertyDraft | null {
  if (!value.address) return null;
  return { type: value.type, address: value.address, features: value.features };
}

function persist(): void {
  if (source === "account") {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      sink?.(toDraft(snapshot));
    }, PUSH_DELAY_MS);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / quota: in-memory is good enough for a draft.
  }
}

/** Ce que le navigateur porte, sans rien en décider. */
function readLocal(): SubjectDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const address =
      typeof record.address === "object" && record.address !== null
        ? (record.address as GeoAddress)
        : null;
    return {
      type: typeof record.type === "string" ? (record.type as PropertyType) : DEFAULT_SUBJECT.type,
      address,
      features:
        typeof record.features === "object" && record.features !== null
          ? (record.features as PropertyFeatures)
          : {},
    };
  } catch {
    // Corrupted payload: keep the default.
    return null;
  }
}

/** Runs once, after mount — never during render, to keep hydration clean. */
function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  if (source === "account") return;
  const stored = readLocal();
  if (!stored) return;
  snapshot = stored;
  emit();
}

/**
 * LA REPRISE DU BIEN DE RÉFÉRENCE.
 *
 * Deux cas, et ils ne se valent pas :
 *
 *   · le compte porte déjà un bien : c'est LUI qui fait foi, exactement comme
 *     pour les lignes du panier. Le brouillon local est remplacé ;
 *   · le compte n'en porte pas et le navigateur en porte un : il monte. C'est
 *     la même reprise que pour les comparables, et perdre l'adresse saisie
 *     juste avant de se connecter serait la même déception.
 *
 * Idempotent : rappeler la fonction avec le même bien ne produit ni doublon ni
 * écriture, `setComparableSubject` remplaçant une colonne plutôt qu'ajoutant
 * une ligne.
 */
export function attachSubjectAccount(
  stored: PropertyDraft | null,
  push: (subject: PropertyDraft | null) => void,
): void {
  sink = push;
  source = "account";
  hydrated = true;

  if (stored) {
    snapshot = { type: stored.type, address: stored.address, features: stored.features };
    emit();
    return;
  }

  // Rien dans le compte : ce que le navigateur porte y monte, s'il porte
  // quelque chose d'exploitable.
  const local = snapshot.address ? snapshot : readLocal();
  if (local?.address) {
    snapshot = local;
    emit();
    push(toDraft(local));
  }
}

/** Retour au navigateur : déconnexion, base absente, jeton périmé. */
export function detachSubjectAccount(): void {
  if (source === "local") return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  sink = null;
  source = "local";
  emit();
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
  /** Où le brouillon est rangé, pour que l'écran puisse le dire. */
  source: SubjectSource;
  /** `PropertyDraft` is only well-formed once an address has been resolved. */
  toPropertyDraft: () => PropertyDraft | null;
} {
  const subject = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const draftSource = useSyncExternalStore(subscribe, getSource, getServerSource);

  useEffect(() => {
    hydrateOnce();
  }, []);

  const toPropertyDraft = useCallback((): PropertyDraft | null => toDraft(subject), [subject]);

  return {
    subject,
    setSubject: setSubjectDraft,
    setFeatures: setSubjectFeatures,
    reset: resetSubjectDraft,
    source: draftSource,
    toPropertyDraft,
  };
}
