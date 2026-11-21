import Stripe from "stripe";
import { ServiceError } from "../../errors";
export function verifyStripeEvent(
  raw: string,
  signature: string | null,
  secret: string,
): Stripe.Event {
  if (!signature)
    throw new ServiceError(
      "INVALID_SIGNATURE",
      "Stripe signature is missing.",
      401,
    );
  const timestamp = signature
    .split(",")
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    throw new ServiceError(
      "INVALID_SIGNATURE",
      "Stripe signature timestamp is outside tolerance.",
      401,
    );
  try {
    return Stripe.webhooks.constructEvent(raw, signature, secret, 300);
  } catch {
    throw new ServiceError(
      "INVALID_SIGNATURE",
      "Stripe signature is invalid or its timestamp is outside tolerance.",
      401,
    );
  }
}
export async function readWebhookBody(request: Request): Promise<string> {
  const limit = 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Webhook payload is too large.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ServiceError(
        "INVALID_REQUEST",
        "Webhook payload is too large.",
        413,
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
