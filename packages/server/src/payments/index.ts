import type { CheckoutRequest, CheckoutResponse } from "@wayward/contracts";
import { CheckoutRequestSchema } from "@wayward/contracts";
import type { CustomerContext } from "../auth";
import { authorizedOrder } from "../orders";
import { ServiceError } from "../errors";
import { stripeClient } from "./stripe/client";
export async function checkout(
  input: CheckoutRequest,
  context: CustomerContext,
): Promise<CheckoutResponse> {
  const request = CheckoutRequestSchema.parse(input);
  const stored = await authorizedOrder(request.orderId, context);
  if (stored.order.state !== "draft")
    throw new ServiceError(
      "CONFLICT",
      "Order is not eligible for a new checkout.",
      409,
    );
  stripeClient(); // Validate configuration, but never send a request until supplier fulfillment is enabled.
  throw new ServiceError(
    "NOT_IMPLEMENTED",
    "Checkout is disabled until supplier booking, passenger identity collection, settlement and compensation are implemented. No payment session or charge was created.",
    501,
  );
}
