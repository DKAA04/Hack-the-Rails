"use client";
import { newKey } from "../search/mappers/intent";

/**
 * One idempotency key per logical action (create-order per quote, reserve
 * and checkout per order), reused across retries and reloads in this tab so
 * a retry can never create a second supplier order or Checkout session.
 * Keys are opaque random IDs: no traveller data is stored.
 */
const KEY = "wayward.idempotency.v1";
type Action = "create" | "reserve" | "checkout";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

const memory: Record<string, string> = {};

export function idempotencyKeyFor(action: Action, scope: string): string {
  const id = `${action}:${scope}`;
  const all = readAll();
  const existing = all[id] ?? memory[id];
  if (existing) return existing;
  const key = newKey();
  memory[id] = key;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...all, [id]: key }));
  } catch {
    /* storage blocked: the in-memory key still covers retries on this page */
  }
  return key;
}
