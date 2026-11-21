"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api-client";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import { toOrderView, type OrderView } from "../checkout/mappers/order";

export type OrderLoad =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; order: OrderView }
  | { status: "error"; error: ErrorView };

/**
 * Loads an order and polls it only while workflow.nextAction is "poll",
 * at workflow.retryAfterMs (default 2000ms). Stops on any other action,
 * on terminal phases, on errors and on unmount.
 */
export function useOrder(orderId: string | null, initial?: OrderView) {
  const [load, setLoad] = useState<OrderLoad>(
    initial ? { status: "ready", order: initial } : orderId ? { status: "loading" } : { status: "idle" },
  );
  const [lastChecked, setLastChecked] = useState<number | null>(initial ? Date.now() : null);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  const fetchOnce = useCallback(
    async (quiet = false) => {
      if (!orderId) return;
      if (!quiet) setLoad((l) => (l.status === "ready" ? l : { status: "loading" }));
      try {
        const o = await api.getOrder(orderId);
        if (!alive.current) return;
        setLoad({ status: "ready", order: toOrderView(o) });
        setLastChecked(Date.now());
      } catch (e) {
        if (!alive.current) return;
        setLoad({ status: "error", error: toErrorView(e) });
      }
    },
    [orderId],
  );

  useEffect(() => {
    alive.current = true;
    if (orderId && !initial) void fetchOnce();
    return () => {
      alive.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [orderId, initial, fetchOnce]);

  const pollMs = load.status === "ready" ? load.order.workflow?.pollMs ?? null : null;
  const terminal = load.status === "ready" && !!load.order.workflow?.terminal;
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (pollMs === null || terminal) return;
    timer.current = window.setTimeout(() => void fetchOnce(true), pollMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [pollMs, terminal, lastChecked, fetchOnce]);

  const setOrder = useCallback((o: OrderView) => {
    setLoad({ status: "ready", order: o });
    setLastChecked(Date.now());
  }, []);

  return { load, refresh: () => fetchOnce(), setOrder, polling: pollMs !== null && !terminal, pollMs, lastChecked };
}
