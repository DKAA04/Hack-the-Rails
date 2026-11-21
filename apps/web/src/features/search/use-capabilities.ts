"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api-client";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import { toCapabilitiesView, type CapabilitiesView } from "./mappers/capabilities";

export type CapabilitiesState =
  | { status: "loading" }
  | { status: "ready"; data: CapabilitiesView }
  | { status: "error"; error: ErrorView };

export function useCapabilities() {
  const [state, setState] = useState<CapabilitiesState>({ status: "loading" });
  const load = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    api
      .capabilities()
      .then((c) => active && setState({ status: "ready", data: toCapabilitiesView(c) }))
      .catch((e) => active && setState({ status: "error", error: toErrorView(e) }));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => load(), [load]);
  return { state, retry: load };
}
