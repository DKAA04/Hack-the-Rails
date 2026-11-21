"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { JourneyView } from "../comparison/mappers/journey";

export interface SavedTrip {
  id: string;
  name: string;
  savedAt: string;
  items: JourneyView[];
}

export type AddResult = "leg" | "option";

/** A journey that covers the same route as, or overlaps, a leg already in the
 * trip is an alternative to compare, not the next leg of the journey. */
export function isAlternative(j: JourneyView, items: JourneyView[]) {
  return items.some(
    (x) =>
      (x.origin.id === j.origin.id && x.destination.id === j.destination.id) ||
      (Date.parse(j.departureUtc) < Date.parse(x.arrivalUtc) &&
        Date.parse(x.departureUtc) < Date.parse(j.arrivalUtc)),
  );
}

interface TripState {
  ready: boolean;
  items: JourneyView[];
  options: JourneyView[];
  saved: SavedTrip[];
  add: (j: JourneyView) => AddResult;
  remove: (id: string) => void;
  /** Swap an option in for the leg(s) it conflicts with; they become options. */
  promoteOption: (id: string) => void;
  roleOf: (id: string) => AddResult | null;
  move: (id: string, delta: -1 | 1) => void;
  sortByDeparture: () => void;
  clear: () => void;
  has: (id: string) => boolean;
  saveCurrent: (name: string) => void;
  restore: (id: string) => void;
  deleteSaved: (id: string) => void;
}

const TripContext = createContext<TripState | null>(null);
const KEY = "wayward.trip.v1";
const OPTIONS_KEY = "wayward.tripOptions.v1";
const SAVED_KEY = "wayward.savedTrips.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the trip still works for this session.
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<JourneyView[]>([]);
  const [options, setOptions] = useState<JourneyView[]>([]);
  const [saved, setSaved] = useState<SavedTrip[]>([]);

  useEffect(() => {
    setItems(read<JourneyView[]>(KEY, []));
    setOptions(read<JourneyView[]>(OPTIONS_KEY, []));
    setSaved(read<SavedTrip[]>(SAVED_KEY, []));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read<JourneyView[]>(KEY, []));
      if (e.key === OPTIONS_KEY) setOptions(read<JourneyView[]>(OPTIONS_KEY, []));
      if (e.key === SAVED_KEY) setSaved(read<SavedTrip[]>(SAVED_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (ready) write(KEY, items);
  }, [items, ready]);
  useEffect(() => {
    if (ready) write(OPTIONS_KEY, options);
  }, [options, ready]);
  useEffect(() => {
    if (ready) write(SAVED_KEY, saved);
  }, [saved, ready]);

  const add = useCallback(
    (j: JourneyView): AddResult => {
      if (items.some((x) => x.id === j.id)) return "leg";
      if (options.some((x) => x.id === j.id)) return "option";
      if (isAlternative(j, items)) {
        setOptions((os) => [...os, j]);
        return "option";
      }
      setItems((xs) => [...xs, j]);
      return "leg";
    },
    [items, options],
  );
  const remove = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    setOptions((os) => os.filter((x) => x.id !== id));
  }, []);
  const promoteOption = useCallback(
    (id: string) => {
      const opt = options.find((o) => o.id === id);
      if (!opt) return;
      const displaced = items.filter((x) => isAlternative(opt, [x]));
      const kept = items.filter((x) => !displaced.includes(x));
      const at = Math.max(0, items.findIndex((x) => displaced.includes(x)));
      const next = [...kept];
      next.splice(Math.min(at, next.length), 0, opt);
      setItems(next);
      setOptions((os) => [...os.filter((o) => o.id !== id), ...displaced]);
    },
    [items, options],
  );
  const roleOf = useCallback(
    (id: string): AddResult | null =>
      items.some((x) => x.id === id) ? "leg" : options.some((x) => x.id === id) ? "option" : null,
    [items, options],
  );
  const move = useCallback(
    (id: string, delta: -1 | 1) =>
      setItems((xs) => {
        const i = xs.findIndex((x) => x.id === id);
        const k = i + delta;
        if (i < 0 || k < 0 || k >= xs.length) return xs;
        const next = [...xs];
        [next[i], next[k]] = [next[k]!, next[i]!];
        return next;
      }),
    [],
  );
  const sortByDeparture = useCallback(
    () =>
      setItems((xs) =>
        [...xs].sort((a, b) => Date.parse(a.departureUtc) - Date.parse(b.departureUtc)),
      ),
    [],
  );
  const clear = useCallback(() => {
    setItems([]);
    setOptions([]);
  }, []);
  const has = useCallback(
    (id: string) => items.some((x) => x.id === id) || options.some((x) => x.id === id),
    [items, options],
  );
  const saveCurrent = useCallback(
    (name: string) =>
      setSaved((s) => [
        {
          id: `trip-${Date.now().toString(36)}`,
          name,
          savedAt: new Date().toISOString(),
          items,
        },
        ...s,
      ]),
    [items],
  );
  const restore = useCallback(
    (id: string) => {
      const t = saved.find((s) => s.id === id);
      if (t) setItems(t.items);
    },
    [saved],
  );
  const deleteSaved = useCallback(
    (id: string) => setSaved((s) => s.filter((t) => t.id !== id)),
    [],
  );

  const value = useMemo(
    () => ({
      ready,
      items,
      options,
      saved,
      add,
      remove,
      promoteOption,
      roleOf,
      move,
      sortByDeparture,
      clear,
      has,
      saveCurrent,
      restore,
      deleteSaved,
    }),
    [ready, items, options, saved, add, remove, promoteOption, roleOf, move, sortByDeparture, clear, has, saveCurrent, restore, deleteSaved],
  );
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside TripProvider");
  return ctx;
}
