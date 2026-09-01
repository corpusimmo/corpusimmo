"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { DvfTransaction } from "@/types/dvf";

/**
 * THE comparables basket.
 *
 * Monté DEUX fois, et c'est voulu : dans le layout de `/observatoire` (public)
 * et dans celui du workspace `/pro` (derrière la porte). Les deux instances
 * lisent et écrivent la MÊME clé de `localStorage`, si bien que la sélection
 * survit au passage de `/observatoire` à `/observatoire/transactions`, à
 * `/observatoire/comparables`, puis à `/pro/valorisation/comparaison` — y
 * compris à travers la connexion, qui recharge le document.
 *
 * Persisté parce qu'un utilisateur qui choisit quatorze comparables et
 * recharge la page ne doit pas perdre son après-midi.
 *
 * On stocke la `DvfTransaction` entière, pas seulement son id :
 * `/observatoire/comparables` doit rendre un tableau sans aller-retour réseau,
 * et une ligne DVF est un fait historique immuable — il n'y a rien à invalider.
 */

const STORAGE_KEY = "corpusimmo.pro.comparables.v1";
/** Beyond this, a "selection" is a dataset — and the weighting stops meaning anything. */
const MAX_ITEMS = 50;

/**
 * Engine floor (statistical secrecy, not a product choice): below five retained
 * comparables `POST /api/estimation` returns `status: "failed"` with no value.
 * Surfaced in the UI so the pro never hits it blind.
 */
export const MIN_COMPARABLES = 5;

export interface ComparableEntry {
  transaction: DvfTransaction;
  /** ISO timestamp, used for the default ordering. */
  addedAt: string;
  /** Kept in the basket but out of the computation. */
  excluded: boolean;
  /** Pro override, 0 → 3. `undefined` = use the engine's computed weight. */
  manualWeight?: number;
  comment?: string;
}

interface State {
  items: ComparableEntry[];
  /** False until localStorage has been read — prevents a flash of empty basket. */
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; items: ComparableEntry[] }
  | { type: "add"; transaction: DvfTransaction }
  | { type: "addMany"; transactions: DvfTransaction[] }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "setExcluded"; id: string; excluded: boolean }
  | { type: "setWeight"; id: string; weight: number | undefined }
  | { type: "setComment"; id: string; comment: string };

function newEntry(transaction: DvfTransaction): ComparableEntry {
  return { transaction, addedAt: new Date().toISOString(), excluded: false };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { items: action.items.slice(0, MAX_ITEMS), hydrated: true };

    case "add": {
      if (state.items.some((i) => i.transaction.id === action.transaction.id)) return state;
      if (state.items.length >= MAX_ITEMS) return state;
      return { ...state, items: [...state.items, newEntry(action.transaction)] };
    }

    case "addMany": {
      const known = new Set(state.items.map((i) => i.transaction.id));
      const additions = action.transactions
        .filter((t) => !known.has(t.id))
        .slice(0, Math.max(0, MAX_ITEMS - state.items.length))
        .map(newEntry);
      if (additions.length === 0) return state;
      return { ...state, items: [...state.items, ...additions] };
    }

    case "remove":
      return { ...state, items: state.items.filter((i) => i.transaction.id !== action.id) };

    case "clear":
      return { ...state, items: [] };

    case "setExcluded":
      return {
        ...state,
        items: state.items.map((i) =>
          i.transaction.id === action.id ? { ...i, excluded: action.excluded } : i,
        ),
      };

    case "setWeight":
      return {
        ...state,
        items: state.items.map((i) =>
          i.transaction.id === action.id
            ? { ...i, manualWeight: normaliseWeight(action.weight) }
            : i,
        ),
      };

    case "setComment":
      return {
        ...state,
        items: state.items.map((i) =>
          i.transaction.id === action.id
            ? { ...i, comment: action.comment.trim() === "" ? undefined : action.comment }
            : i,
        ),
      };

    default:
      return state;
  }
}

/** Engine contract: manual weights live in [0, 3]. */
function normaliseWeight(weight: number | undefined): number | undefined {
  if (weight === undefined || !Number.isFinite(weight)) return undefined;
  return Math.min(3, Math.max(0, Math.round(weight * 100) / 100));
}

/**
 * Structural guard over whatever localStorage hands back. A corrupted or
 * outdated payload must degrade to an empty basket, never crash the workspace.
 */
function parseStored(raw: string): ComparableEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: ComparableEntry[] = [];
  for (const candidate of parsed) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const record = candidate as Record<string, unknown>;
    const transaction = record.transaction;
    if (typeof transaction !== "object" || transaction === null) continue;
    const tx = transaction as Record<string, unknown>;
    if (typeof tx.id !== "string" || typeof tx.price !== "number") continue;
    if (typeof tx.coordinates !== "object" || tx.coordinates === null) continue;

    entries.push({
      transaction: transaction as unknown as DvfTransaction,
      addedAt: typeof record.addedAt === "string" ? record.addedAt : new Date().toISOString(),
      excluded: record.excluded === true,
      manualWeight:
        typeof record.manualWeight === "number" ? normaliseWeight(record.manualWeight) : undefined,
      comment: typeof record.comment === "string" ? record.comment : undefined,
    });
  }
  return entries;
}

export interface ComparablesApi {
  items: ComparableEntry[];
  /** Ids in the basket, in insertion order. */
  ids: string[];
  /** Ids that will actually feed the computation. */
  activeIds: string[];
  excludedIds: string[];
  manualWeights: Record<string, number>;
  count: number;
  activeCount: number;
  hydrated: boolean;
  isFull: boolean;
  maxItems: number;
  has: (id: string) => boolean;
  add: (transaction: DvfTransaction) => void;
  addMany: (transactions: DvfTransaction[]) => void;
  remove: (id: string) => void;
  toggle: (transaction: DvfTransaction) => void;
  clear: () => void;
  setExcluded: (id: string, excluded: boolean) => void;
  setWeight: (id: string, weight: number | undefined) => void;
  setComment: (id: string, comment: string) => void;
}

const ComparablesContext = createContext<ComparablesApi | null>(null);

export function ComparablesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], hydrated: false });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "hydrate", items: raw ? parseStored(raw) : [] });
    } catch {
      dispatch({ type: "hydrate", items: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Quota or private mode: the basket stays in memory, which is enough.
    }
  }, [state.items, state.hydrated]);

  const has = useCallback(
    (id: string) => state.items.some((i) => i.transaction.id === id),
    [state.items],
  );

  const value = useMemo<ComparablesApi>(() => {
    const active = state.items.filter((i) => !i.excluded);
    const manualWeights: Record<string, number> = {};
    for (const item of state.items) {
      if (item.manualWeight !== undefined) manualWeights[item.transaction.id] = item.manualWeight;
    }

    return {
      items: state.items,
      ids: state.items.map((i) => i.transaction.id),
      activeIds: active.map((i) => i.transaction.id),
      excludedIds: state.items.filter((i) => i.excluded).map((i) => i.transaction.id),
      manualWeights,
      count: state.items.length,
      activeCount: active.length,
      hydrated: state.hydrated,
      isFull: state.items.length >= MAX_ITEMS,
      maxItems: MAX_ITEMS,
      has,
      add: (transaction) => dispatch({ type: "add", transaction }),
      addMany: (transactions) => dispatch({ type: "addMany", transactions }),
      remove: (id) => dispatch({ type: "remove", id }),
      toggle: (transaction) =>
        dispatch(
          state.items.some((i) => i.transaction.id === transaction.id)
            ? { type: "remove", id: transaction.id }
            : { type: "add", transaction },
        ),
      clear: () => dispatch({ type: "clear" }),
      setExcluded: (id, excluded) => dispatch({ type: "setExcluded", id, excluded }),
      setWeight: (id, weight) => dispatch({ type: "setWeight", id, weight }),
      setComment: (id, comment) => dispatch({ type: "setComment", id, comment }),
    };
  }, [state.items, state.hydrated, has]);

  return <ComparablesContext.Provider value={value}>{children}</ComparablesContext.Provider>;
}

export function useComparables(): ComparablesApi {
  const ctx = useContext(ComparablesContext);
  if (!ctx) {
    throw new Error(
      "useComparables() doit être appelé sous <ComparablesProvider /> (monté dans le layout de /observatoire et dans celui du workspace Pro).",
    );
  }
  return ctx;
}

/** Descriptive stats over the basket, shared by `/observatoire/comparables` and the workbench. */
export function comparableStats(items: ComparableEntry[]): {
  count: number;
  pricesPerSqm: number[];
  median?: number;
  average?: number;
  min?: number;
  max?: number;
  /** Interquartile spread relative to the median, in percent. */
  dispersion?: number;
  yearRange?: [number, number];
  totalArea: number;
} {
  const pricesPerSqm = items
    .map((i) => i.transaction.pricePerSqm)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  const years = items.map((i) => i.transaction.year).filter((y) => Number.isFinite(y));
  const totalArea = items.reduce((sum, i) => sum + (i.transaction.builtArea ?? 0), 0);

  const pick = (q: number): number | undefined => {
    if (pricesPerSqm.length === 0) return undefined;
    const pos = (pricesPerSqm.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const a = pricesPerSqm[lo];
    const b = pricesPerSqm[hi];
    if (a === undefined || b === undefined) return undefined;
    return a + (b - a) * (pos - lo);
  };

  const median = pick(0.5);
  const q1 = pick(0.25);
  const q3 = pick(0.75);
  const average =
    pricesPerSqm.length > 0
      ? pricesPerSqm.reduce((s, v) => s + v, 0) / pricesPerSqm.length
      : undefined;

  return {
    count: items.length,
    pricesPerSqm,
    median,
    average,
    min: pricesPerSqm[0],
    max: pricesPerSqm[pricesPerSqm.length - 1],
    dispersion:
      median !== undefined && median > 0 && q1 !== undefined && q3 !== undefined
        ? ((q3 - q1) / median) * 100
        : undefined,
    yearRange:
      years.length > 0 ? [Math.min(...years), Math.max(...years)] : undefined,
    totalArea,
  };
}
