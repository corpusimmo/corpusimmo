"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import {
  addComparableAction,
  clearComparablesAction,
  removeComparableAction,
  setComparableSubjectAction,
  syncComparablesAction,
  updateComparableAction,
} from "@/app/(site)/observatoire/comparables/actions";
import {
  MAX_ITEMS,
  newEntry,
  normaliseWeight,
  parseComparableEntries,
  type ComparableEntry,
} from "@/app/(site)/observatoire/comparables/wire";
import { useSessionStatus } from "./session-status";
import type { DvfTransaction } from "@/types/dvf";

import { attachSubjectAccount, detachSubjectAccount } from "./subject-store";

/**
 * THE comparables basket.
 *
 * Monté DEUX fois, et c'est voulu : dans le layout de `/observatoire` (public)
 * et dans celui du workspace `/pro` (derrière la porte). Les deux instances
 * portent la même sélection, si bien qu'elle survit au passage de
 * `/observatoire` à `/observatoire/transactions`, à `/observatoire/comparables`,
 * puis à `/pro/valorisation/comparaison`.
 *
 * Persisté parce qu'un utilisateur qui choisit quatorze comparables et
 * recharge la page ne doit pas perdre son après-midi.
 *
 * On stocke la `DvfTransaction` entière, pas seulement son id :
 * `/observatoire/comparables` doit rendre un tableau sans aller-retour réseau,
 * et une ligne DVF est un fait historique immuable — il n'y a rien à invalider.
 *
 * ── DEUX REGISTRES, ET LEQUEL FAIT FOI ────────────────────────────────────
 *
 * Depuis que la base existe, la sélection peut vivre à deux endroits :
 *
 *   · LE COMPTE, dès qu'une personne est connectée. C'est le seul registre qui
 *     suit d'un appareil à l'autre, donc le seul qui fasse foi pour elle. Les
 *     écritures passent par les actions serveur de
 *     `src/app/(site)/observatoire/comparables/actions.ts` ;
 *   · LE NAVIGATEUR, pour tous les autres. `localStorage` reste le registre des
 *     visiteurs anonymes et n'a pas vocation à disparaître : l'observatoire est
 *     libre en consultation, et demander un compte pour cocher trois ventes
 *     rendrait le produit indémontrable.
 *
 * `source` dit lequel des deux s'applique, et les écrans le RÉPÈTENT à
 * l'utilisateur. Laisser croire à une sauvegarde qui n'existe pas est la seule
 * chose qu'on ne peut pas se permettre ici.
 *
 * LA SESSION EST RETIRÉE POUR L'INSTANT, et tout le monde est donc anonyme.
 * La bascule vers le registre d'un compte reste écrite et testée ici : voir
 * `session-status.ts`, seul fichier à rouvrir quand les comptes reviendront.
 *
 * LA REPRISE. Quelqu'un qui a constitué un panier sans compte, puis se
 * connecte, doit le RETROUVER. Le contenu local est donc versé dans le compte
 * au premier chargement authentifié, puis effacé du navigateur une fois la
 * reprise confirmée. Le détail de ce qui rend l'opération idempotente est en
 * tête du fichier d'actions.
 */

const STORAGE_KEY = "corpusimmo.pro.comparables.v1";

/**
 * Ce navigateur sait-il déjà que la sélection vit dans un compte ?
 *
 * Sans ce repère, un retour sur le site afficherait le panier local (vide,
 * puisqu'il a été repris) le temps de l'aller-retour, avant de le remplacer par
 * celui du compte. Un panier qui apparaît vide puis se remplit fait croire à
 * une perte. Le repère ne porte AUCUNE donnée : il dit seulement où regarder.
 */
const SOURCE_KEY = "corpusimmo.pro.comparables.source.v1";

export { MAX_ITEMS } from "@/app/(site)/observatoire/comparables/wire";
export type { ComparableEntry } from "@/app/(site)/observatoire/comparables/wire";

/**
 * Engine floor (statistical secrecy, not a product choice): below five retained
 * comparables `POST /api/estimation` returns `status: "failed"` with no value.
 * Surfaced in the UI so the pro never hits it blind.
 */
export const MIN_COMPARABLES = 5;

/** Où vit la sélection affichée. */
export type ComparablesSource = "local" | "account";

interface State {
  items: ComparableEntry[];
  /** False until the basket's source is known — prevents a flash of empty basket. */
  hydrated: boolean;
  source: ComparablesSource;
  /** Nombre d'écritures en vol vers le compte. */
  inFlight: number;
  /** La dernière opération n'a pas atteint le compte. */
  failed: boolean;
}

type Action =
  | { type: "hydrate"; items: ComparableEntry[]; failed?: boolean }
  | { type: "adopt"; items: ComparableEntry[] }
  | { type: "write:start" }
  | { type: "write:end"; failed: boolean }
  | { type: "add"; transaction: DvfTransaction }
  | { type: "addMany"; transactions: DvfTransaction[] }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "setExcluded"; id: string; excluded: boolean }
  | { type: "setWeight"; id: string; weight: number | undefined }
  | { type: "setComment"; id: string; comment: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        items: action.items.slice(0, MAX_ITEMS),
        hydrated: true,
        source: "local",
        failed: action.failed === true,
      };

    // Le compte a répondu : c'est lui qui fait foi, y compris pour dire que la
    // sélection est vide.
    case "adopt":
      return {
        ...state,
        items: action.items.slice(0, MAX_ITEMS),
        hydrated: true,
        source: "account",
        failed: false,
      };

    case "write:start":
      return { ...state, inFlight: state.inFlight + 1 };

    // L'échec COLLE jusqu'à la prochaine hydratation, et ce n'est pas un
    // oubli : dès qu'une écriture n'est pas passée, ce que l'écran montre a
    // divergé de ce que le compte porte. Effacer l'avertissement à l'écriture
    // suivante laisserait croire que tout est rentré dans l'ordre.
    case "write:end":
      return {
        ...state,
        inFlight: Math.max(0, state.inFlight - 1),
        failed: action.failed || state.failed,
      };

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
        .map((transaction) => newEntry(transaction));
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

/** Ce que le navigateur porte, quelle que soit la suite. */
function readLocal(): ComparableEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseComparableEntries(JSON.parse(raw)) : [];
  } catch {
    // Charge illisible ou mode privé : un panier vide, jamais une page cassée.
    return [];
  }
}

function readMarker(): ComparablesSource | null {
  try {
    return window.localStorage.getItem(SOURCE_KEY) === "account" ? "account" : null;
  } catch {
    return null;
  }
}

function writeMarker(source: ComparablesSource | null): void {
  try {
    if (source === "account") window.localStorage.setItem(SOURCE_KEY, "account");
    else window.localStorage.removeItem(SOURCE_KEY);
  } catch {
    // Sans repère, on affichera une fois le panier local avant celui du compte.
  }
}

/**
 * Efface la copie locale, une fois la reprise CONFIRMÉE par le serveur.
 *
 * `readAccess` ne peut pas en faire autant du cookie signé, parce qu'écrire un
 * cookie depuis un composant serveur lève ; ici, rien ne l'empêche, et il ne
 * faut surtout pas s'en priver : une copie locale qui survit serait reversée à
 * chaque chargement et ferait RÉAPPARAÎTRE les comparables retirés du compte.
 */
function forgetLocal(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire de plus : la reprise reste idempotente côté base.
  }
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
  /** Où vit la sélection : dans le compte, ou dans ce navigateur. */
  source: ComparablesSource;
  /** Une écriture est en route vers le compte. */
  syncing: boolean;
  /** Le compte n'a pas pu être joint : ce qui est affiché n'y est pas rangé. */
  failed: boolean;
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
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    hydrated: false,
    source: "local",
    inFlight: 0,
    failed: false,
  });

  const status = useSessionStatus();
  const localRead = useRef(false);
  /** Le registre pour lequel la bascule a déjà été jouée. */
  const settledFor = useRef<"anonymous" | "account" | null>(null);

  /**
   * La sélection au dernier instant connu.
   *
   * La session met quelques centaines de millisecondes à revenir, et rien
   * n'empêche de cocher un comparable pendant ce temps. `localStorage` le
   * portera dans presque tous les cas, mais il peut REFUSER d'écrire : mode
   * privé, quota plein. Le panier ne vit alors qu'en mémoire, et le reprendre
   * depuis le stockage au moment de la connexion le perdrait. On reprend donc
   * ce que l'écran montre, le stockage servant de repli.
   */
  const latest = useRef<ComparableEntry[]>([]);
  useEffect(() => {
    latest.current = state.items;
  }, [state.items]);

  /**
   * Le panier du navigateur, tout de suite.
   *
   * Sauf si ce navigateur sait déjà que la sélection vit dans un compte : on
   * attend alors la réponse du serveur plutôt que d'afficher une seconde un
   * panier vide.
   */
  useEffect(() => {
    if (localRead.current) return;
    localRead.current = true;
    if (readMarker() === "account") return;
    dispatch({ type: "hydrate", items: readLocal() });
  }, []);

  /**
   * Puis la session, dès qu'elle est connue.
   *
   * `status` vaut « loading » le temps de l'appel à `/api/auth/session`. On
   * n'en fait rien : décider du registre sur une session inconnue reviendrait à
   * traiter tout le monde en anonyme pendant une demi-seconde, donc à écrire
   * dans le navigateur ce qui devait aller dans un compte.
   */
  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      if (settledFor.current === "anonymous") return;
      settledFor.current = "anonymous";
      detachSubjectAccount();
      writeMarker(null);
      dispatch({ type: "hydrate", items: readLocal() });
      return;
    }

    if (settledFor.current === "account") return;
    settledFor.current = "account";

    const local = latest.current.length > 0 ? latest.current : readLocal();

    void (async () => {
      try {
        const result = await syncComparablesAction(local);

        // Le serveur a le dernier mot : une session côté navigateur ne suffit
        // pas s'il n'y a pas de base, ou si le jeton est antérieur à son
        // arrivée. On reste alors sur le navigateur, sans rien effacer.
        if (!result.backed) {
          settledFor.current = null;
          writeMarker(null);
          dispatch({ type: "hydrate", items: local });
          return;
        }

        writeMarker("account");
        forgetLocal();
        dispatch({ type: "adopt", items: result.items });
        attachSubjectAccount(result.subject, (subject) => {
          void setComparableSubjectAction(subject);
        });
      } catch {
        // Le compte n'a pas répondu. On ne bascule pas, on n'efface rien, et
        // l'écran le dit : mieux vaut un panier local annoncé comme tel qu'un
        // panier vide sans explication.
        settledFor.current = null;
        dispatch({ type: "hydrate", items: local, failed: true });
      }
    })();
  }, [status]);

  /** Le navigateur ne porte la sélection que tant qu'aucun compte ne la porte. */
  useEffect(() => {
    if (!state.hydrated || state.source !== "local") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Quota or private mode: the basket stays in memory, which is enough.
    }
  }, [state.items, state.hydrated, state.source]);

  /**
   * Les écritures vers le compte, une par une.
   *
   * En file plutôt qu'en parallèle : « je coche puis je décoche » et « je
   * décoche puis je coche » ne donnent pas le même panier, et deux requêtes
   * lancées ensemble n'arrivent pas forcément dans l'ordre où elles sont
   * parties.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const push = useCallback((operation: () => Promise<boolean>) => {
    dispatch({ type: "write:start" });
    queue.current = queue.current.then(async () => {
      try {
        const stored = await operation();
        dispatch({ type: "write:end", failed: !stored });
      } catch {
        dispatch({ type: "write:end", failed: true });
      }
    });
  }, []);

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

    const backed = state.source === "account";

    const add = (transaction: DvfTransaction): void => {
      // Les mêmes garde-fous que le réducteur, pour ne pas envoyer au compte
      // une écriture que l'écran vient d'ignorer.
      if (state.items.some((i) => i.transaction.id === transaction.id)) return;
      if (state.items.length >= MAX_ITEMS) return;
      dispatch({ type: "add", transaction });
      if (backed) push(() => addComparableAction(newEntry(transaction)));
    };

    const remove = (id: string): void => {
      dispatch({ type: "remove", id });
      if (backed) push(() => removeComparableAction(id));
    };

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
      source: state.source,
      syncing: state.inFlight > 0,
      failed: state.failed,
      has,
      add,
      addMany: (transactions) => {
        const known = new Set(state.items.map((i) => i.transaction.id));
        const room = Math.max(0, MAX_ITEMS - state.items.length);
        const additions = transactions.filter((t) => !known.has(t.id)).slice(0, room);
        if (additions.length === 0) return;
        dispatch({ type: "addMany", transactions });
        if (backed) {
          for (const transaction of additions) {
            push(() => addComparableAction(newEntry(transaction)));
          }
        }
      },
      remove,
      toggle: (transaction) => {
        if (state.items.some((i) => i.transaction.id === transaction.id)) remove(transaction.id);
        else add(transaction);
      },
      clear: () => {
        dispatch({ type: "clear" });
        if (backed) push(() => clearComparablesAction());
      },
      setExcluded: (id, excluded) => {
        dispatch({ type: "setExcluded", id, excluded });
        if (backed) push(() => updateComparableAction(id, { excluded }));
      },
      setWeight: (id, weight) => {
        dispatch({ type: "setWeight", id, weight });
        // `null` remet la pondération calculée, ce qui n'est pas un poids de
        // zéro : le premier dit « je ne me prononce pas », le second « ne
        // compte pas ce bien ».
        if (backed) push(() => updateComparableAction(id, { manualWeight: normaliseWeight(weight) ?? null }));
      },
      setComment: (id, comment) => {
        dispatch({ type: "setComment", id, comment });
        if (backed) push(() => updateComparableAction(id, { comment: comment.trim() || null }));
      },
    };
  }, [state.items, state.hydrated, state.source, state.inFlight, state.failed, has, push]);

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
