import type { CheckoutRequest, CheckoutResponse } from "@wayward/contracts";
import { unfinished } from "../errors";
export async function checkout(
  _request: CheckoutRequest,
): Promise<CheckoutResponse> {
  return unfinished("Customer Stripe checkout");
}
