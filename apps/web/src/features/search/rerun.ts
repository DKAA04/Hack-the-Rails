"use client";
import { api } from "../../lib/api-client";
import { toSearchIntent, type SearchFormState } from "./mappers/intent";

export const LAST_SEARCH_KEY = "wayward.search.v1";
export const LAST_SEARCH_ID_KEY = "wayward.searchId.v1";

export function rememberSearchId(id: string) {
  try {
    sessionStorage.setItem(LAST_SEARCH_ID_KEY, id);
  } catch {
    /* storage blocked */
  }
}
/** The stored form only describes this results page if it produced this searchId. */
export function lastSearchFor(searchId: string): SearchFormState | null {
  try {
    if (sessionStorage.getItem(LAST_SEARCH_ID_KEY) !== searchId) return null;
  } catch {
    return null;
  }
  return readLastSearch();
}

export function readLastSearch(): SearchFormState | null {
  try {
    const raw = sessionStorage.getItem(LAST_SEARCH_KEY);
    return raw ? (JSON.parse(raw) as SearchFormState) : null;
  } catch {
    return null;
  }
}

/** Re-runs the last submitted search. Returns null when there's nothing to re-run. */
export async function rerunLastSearch(): Promise<string | null> {
  const last = readLastSearch();
  if (!last) return null;
  const r = toSearchIntent(last);
  if (!r.ok) return null;
  const receipt = await api.search(r.intent);
  rememberSearchId(receipt.searchId);
  return receipt.searchId;
}

/** Adds whole days to an ISO date without time-zone drift. */
export function shiftIsoDate(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + days));
  return t.toISOString().slice(0, 10);
}

/** Runs a search for a given form, remembering it for this session. */
export async function searchWith(form: SearchFormState): Promise<string | null> {
  const r = toSearchIntent(form);
  if (!r.ok) return null;
  try {
    sessionStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(form));
  } catch {
    /* storage blocked */
  }
  const receipt = await api.search(r.intent);
  rememberSearchId(receipt.searchId);
  return receipt.searchId;
}
