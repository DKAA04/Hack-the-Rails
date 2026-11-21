import { randomUUID } from "node:crypto";
export function requestId() {
  return randomUUID();
}
// Log only allowlisted event names and request IDs. Never log request bodies or credentials.
