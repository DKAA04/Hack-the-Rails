"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api-client";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import { DEFAULT_POLL_MS, toOrderView, type OrderView } from "../checkout/mappers/order";

export type OrderLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; order: OrderView }
  | { status: "error"; error: ErrorView };

/**
 * Loads an order and keeps it current.
 *
 * Per TRANSACTION_INTEGRATION.md: on return from Checkout, and while
 * workflow.nextAction is "poll", run the session-protected
 * POST /reconcile followed by GET, every retryAfterMs (default 2000ms).
 * One request chain at a time; stops on terminal phases, on errors and on
 * any action the customer has to take. The HttpOnly session cookie travels
 * with same-origin fetch automatically.
 */
export function useOrder(
  orderId: string | null,
  initial?: OrderView,
  opts: { reconcileOnLoad?: boolean } = {},
) {
  const [load, setLoad] = useState<OrderLoad>(
    initial ? { status: "ready", order: initial } : orderId ? { status: "loading" } : { status: "idle" },
  );
  const [lastChecked, setLastChecked] = useState<number | null>(initial ? Date.now() : null);
  const [syncError, setSyncError] = useState<ErrorView | null>(null);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /** GET only (read-only status). */
  const fetchOnce = useCallback(async () => {
    if (!orderId || inFlight.current) return;
    inFlight.current = true;
    try {
      const o = await api.getOrder(orderId);
      if (!alive.current) return;
      setLoad({ status: "ready", order: toOrderView(o) });
      setLastChecked(Date.now());
    } catch (e) {
      if (alive.current) setLoad((l) => (l.status === "ready" ? l : { status: "error", error: toErrorView(e) }));
    } finally {
      inFlight.current = false;
    }
  }, [orderId]);

  /** POST reconcile, then GET. Never overlaps with another chain. */
  const reconcile = useCallback(async () => {
    if (!orderId || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      await api.reconcile(orderId);
      const o = await api.getOrder(orderId);
      if (!alive.current) return;
      setSyncError(null);
      setLoad({ status: "ready", order: toOrderView(o) });
      setLastChecked(Date.now());
    } catch (e) {
      if (!alive.current) return;
      // Stop the loop: an error is shown with a manual "check again".
      setSyncError(toErrorView(e));
      clearTimer();
    } finally {
      inFlight.current = false;
      if (alive.current) setSyncing(false);
    }
  }, [orderId]);

  useEffect(() => {
    alive.current = true;
    if (orderId && !initial) void (opts.reconcileOnLoad ? reconcile() : fetchOnce());
    else if (orderId && initial && opts.reconcileOnLoad) void reconcile();
    return () => {
      alive.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const workflow = load.status === "ready" ? load.order.workflow : null;
  const shouldPoll = !!workflow && workflow.nextAction === "poll" && !workflow.terminal && !syncError;
  const pollMs = shouldPoll ? (workflow!.pollMs ?? DEFAULT_POLL_MS) : null;

  useEffect(() => {
    clearTimer();
    if (pollMs === null) return;
    timer.current = window.setTimeout(() => void reconcile(), pollMs);
    return clearTimer;
  }, [pollMs, lastChecked, reconcile]);

  const setOrder = useCallback((o: OrderView) => {
    setLoad({ status: "ready", order: o });
    setLastChecked(Date.now());
  }, []);

  return {
    load,
    refresh: fetchOnce,
    reconcile,
    setOrder,
    polling: pollMs !== null,
    pollMs,
    lastChecked,
    syncing,
    syncError,
  };
}
