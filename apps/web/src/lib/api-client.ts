import { z } from "zod";
import {
  ApiErrorSchema,
  CapabilitiesSchema,
  HealthSchema,
  SearchIntentSchema,
  SearchReceiptSchema,
  SearchResultSchema,
  RevalidationRequestSchema,
  RevalidationResponseSchema,
  CreateOrderRequestSchema,
  OrderSchema,
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  PlaceLookupResponseSchema,
  DependencyHealthSchema,
  UpdateTravellersRequestSchema,
  ReserveOrderRequestSchema,
  type UpdateTravellersRequest,
  type ReserveOrderRequest,
  type SearchIntent,
  type RevalidationRequest,
  type CreateOrderRequest,
  type CheckoutRequest,
  type ApiError,
  type Mode,
} from "@wayward/contracts";

/** The server answered with a typed v1 ApiError. */
export class ApiClientError extends Error {
  constructor(
    public response: ApiError,
    public status: number,
  ) {
    super(response.error.message);
  }
}

/** The request never produced a usable response (offline, DNS, bad JSON). */
export class NetworkError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  signal?: AbortSignal,
  method?: "GET" | "POST" | "PUT",
): Promise<T> {
  let response: Response;
  try {
    // Same-origin fetch sends the HttpOnly wayward_session cookie automatically.
    response = await fetch(`/api${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new NetworkError("Network request failed.");
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new NetworkError("The server sent an unreadable response.", response.status);
  }
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    if (parsed.success) throw new ApiClientError(parsed.data, response.status);
    throw new NetworkError("The server sent an unexpected error.", response.status);
  }
  return schema.parse(payload);
}

export const api = {
  health: () => request("/health", HealthSchema),
  capabilities: () => request("/capabilities", CapabilitiesSchema),
  dependencies: () => request("/health/dependencies", DependencyHealthSchema),
  places: (
    query: string,
    opts: { limit?: number; modes?: Mode[]; signal?: AbortSignal } = {},
  ) => {
    const params = new URLSearchParams({ query });
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.modes?.length) params.set("modes", opts.modes.join(","));
    return request(
      `/places?${params.toString()}`,
      PlaceLookupResponseSchema,
      undefined,
      opts.signal,
    );
  },
  search: (intent: SearchIntent) =>
    request("/search", SearchReceiptSchema, SearchIntentSchema.parse(intent)),
  getSearch: (id: string, signal?: AbortSignal) =>
    request(`/search/${encodeURIComponent(id)}`, SearchResultSchema, undefined, signal),
  revalidate: (input: RevalidationRequest) =>
    request(
      "/quotes/revalidate",
      RevalidationResponseSchema,
      RevalidationRequestSchema.parse(input),
    ),
  createOrder: (input: CreateOrderRequest) =>
    request("/orders", OrderSchema, CreateOrderRequestSchema.parse(input)),
  getOrder: (id: string) =>
    request(`/orders/${encodeURIComponent(id)}`, OrderSchema),
  /** Implemented by backend d65cb07; a 501 still renders "not available yet". */
  updateTravellers: (orderId: string, input: UpdateTravellersRequest) =>
    request(
      `/orders/${encodeURIComponent(orderId)}/travellers`,
      OrderSchema,
      UpdateTravellersRequestSchema.parse(input),
      undefined,
      "PUT",
    ),
  /** Implemented by backend d65cb07; a 501 still renders "not available yet". */
  reserve: (orderId: string, input: ReserveOrderRequest) =>
    request(
      `/orders/${encodeURIComponent(orderId)}/reserve`,
      OrderSchema,
      ReserveOrderRequestSchema.parse(input),
    ),
  /** Implemented by backend d65cb07; a 501 still renders "not available yet". */
  /** Session-protected; no body. May advance an authorised test transaction. */
  reconcile: (orderId: string) =>
    request(`/orders/${encodeURIComponent(orderId)}/reconcile`, OrderSchema, undefined, undefined, "POST"),
  checkout: (input: CheckoutRequest) =>
    request(
      "/payments/checkout",
      CheckoutResponseSchema,
      CheckoutRequestSchema.parse(input),
    ),
};
