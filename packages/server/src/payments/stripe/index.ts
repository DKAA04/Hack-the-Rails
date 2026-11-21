import { credentialsPresent } from "../../config";
import { ServiceError, unfinished } from "../../errors";
export async function stripeWebhook(_request: Request): Promise<never> {
  if (!credentialsPresent("STRIPE_WEBHOOK_SECRET"))
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Stripe webhook verification is not configured.",
      503,
    );
  return unfinished(
    "Raw-body signature verification and idempotent webhook processing",
  );
}
