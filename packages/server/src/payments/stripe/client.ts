import Stripe from "stripe";
import { configuration } from "../../config";
import { ServiceError } from "../../errors";
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "STRIPE_SECRET_KEY is missing.",
      503,
    );
  const config = configuration();
  if (!config.valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid WAYWARD_ENV configuration.",
      503,
    );
  if (config.environment === "development" && !/^(sk|rk)_test_/.test(key))
    throw new ServiceError(
      "CONFLICT",
      "Development requires a Stripe test-mode secret key.",
      409,
    );
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 8000 });
}
