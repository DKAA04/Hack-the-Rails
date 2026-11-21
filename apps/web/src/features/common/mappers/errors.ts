import type { ErrorCode } from "@wayward/contracts";
import { ApiClientError, NetworkError } from "../../../lib/api-client";

export type ErrorKind =
  | "offline"
  | "not_implemented"
  | "unavailable"
  | "invalid"
  | "not_found"
  | "expired"
  | "conflict"
  | "unknown";

export interface ErrorView {
  kind: ErrorKind;
  title: string;
  message: string;
  retryable: boolean;
  requestId: string | null;
  code: ErrorCode | null;
}

const BY_CODE: Record<ErrorCode, { kind: ErrorKind; title: string }> = {
  INVALID_REQUEST: { kind: "invalid", title: "Something in the request isn't right" },
  NOT_CONFIGURED: { kind: "unavailable", title: "This service isn't set up yet" },
  NOT_IMPLEMENTED: { kind: "not_implemented", title: "Not available yet" },
  NOT_FOUND: { kind: "not_found", title: "We couldn't find that" },
  PROVIDER_UNAVAILABLE: { kind: "unavailable", title: "Suppliers aren't answering" },
  QUOTE_EXPIRED: { kind: "expired", title: "That price has expired" },
  CONFLICT: { kind: "conflict", title: "Something changed" },
  UNAUTHORIZED: { kind: "invalid", title: "You're not signed in" },
  INVALID_SIGNATURE: { kind: "invalid", title: "Request rejected" },
  INTERNAL_ERROR: { kind: "unknown", title: "Something went wrong on our side" },
};

export function toErrorView(error: unknown): ErrorView {
  if (error instanceof ApiClientError) {
    const e = error.response.error;
    const meta = BY_CODE[e.code];
    return {
      kind: meta.kind,
      title: meta.title,
      message: e.message,
      retryable: e.retryable,
      requestId: e.requestId,
      code: e.code,
    };
  }
  if (error instanceof NetworkError) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      kind: offline ? "offline" : "unknown",
      title: offline ? "You're offline" : "We couldn't reach Wayward",
      message: offline
        ? "Reconnect and try again. Nothing was sent."
        : "The request didn't complete. Check your connection and try again.",
      retryable: true,
      requestId: null,
      code: null,
    };
  }
  return {
    kind: "unknown",
    title: "Something went wrong",
    message:
      "We got a response we didn't expect. Try again, and if it keeps happening, start a new search.",
    retryable: true,
    requestId: null,
    code: null,
  };
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * For endpoints whose contract is published but not yet implemented: a 501,
 * or a route that doesn't exist yet (404/405 without an ApiError body), both
 * mean "not available yet", never success.
 */
export function toPendingEndpointErrorView(error: unknown): ErrorView {
  if (error instanceof NetworkError && (error.status === 404 || error.status === 405))
    return {
      kind: "not_implemented",
      title: "Not available yet",
      message: "This step isn't connected yet. Nothing was changed.",
      retryable: false,
      requestId: null,
      code: null,
    };
  return toErrorView(error);
}
