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
  type SearchIntent,
  type RevalidationRequest,
  type CreateOrderRequest,
  type CheckoutRequest,
  type ApiError,
} from "@wayward/contracts";
export class ApiClientError extends Error {
  constructor(
    public response: ApiError,
    public status: number,
  ) {
    super(response.error.message);
  }
}
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const payload: unknown = await response.json();
  if (!response.ok)
    throw new ApiClientError(ApiErrorSchema.parse(payload), response.status);
  return schema.parse(payload);
}
export const api = {
  health: () => request("/health", HealthSchema),
  capabilities: () => request("/capabilities", CapabilitiesSchema),
  search: (intent: SearchIntent) =>
    request("/search", SearchReceiptSchema, SearchIntentSchema.parse(intent)),
  getSearch: (id: string) =>
    request(`/search/${encodeURIComponent(id)}`, SearchResultSchema),
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
  checkout: (input: CheckoutRequest) =>
    request(
      "/payments/checkout",
      CheckoutResponseSchema,
      CheckoutRequestSchema.parse(input),
    ),
};
