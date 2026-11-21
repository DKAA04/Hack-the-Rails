import { endpoint, stripeWebhook } from "@wayward/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(async () => stripeWebhook(request));
}
