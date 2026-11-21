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

interface TripState {
  ready: boolean;
  items: JourneyView[];
  saved: SavedTrip[];
  add: (j: JourneyView) => void;
  remove: (id: string) => void;
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
  const [saved, setSaved] = useState<SavedTrip[]>([]);

  useEffect(() => {
    setItems(read<JourneyView[]>(KEY, []));
    setSaved(read<SavedTrip[]>(SAVED_KEY, []));
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read<JourneyView[]>(KEY, []));
      if (e.key === SAVED_KEY) setSaved(read<SavedTrip[]>(SAVED_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (ready) write(KEY, items);
  }, [items, ready]);
  useEffect(() => {
    if (ready) write(SAVED_KEY, saved);
  }, [saved, ready]);

  const add = useCallback(
    (j: JourneyView) =>
      setItems((xs) => (xs.some((x) => x.id === j.id) ? xs : [...xs, j])),
    [],
  );
  const remove = useCallback(
    (id: string) => setItems((xs) => xs.filter((x) => x.id !== id)),
    [],
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
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);
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
      saved,
      add,
      remove,
      move,
      sortByDeparture,
      clear,
      has,
      saveCurrent,
      restore,
      deleteSaved,
    }),
    [ready, items, saved, add, remove, move, sortByDeparture, clear, has, saveCurrent, restore, deleteSaved],
  );
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside TripProvider");
  return ctx;
}
