const states = new Map<string, "verified" | "failed">();
export function connectivity(id: string) {
  return states.get(id) ?? "not_checked";
}
export function markConnectivity(id: string, state: "verified" | "failed") {
  states.set(id, state);
}
