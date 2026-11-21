"use client";
import { api } from "../../lib/api-client";
import { toSearchIntent, type SearchFormState } from "./mappers/intent";

export const LAST_SEARCH_KEY = "wayward.search.v1";

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
  return receipt.searchId;
}
