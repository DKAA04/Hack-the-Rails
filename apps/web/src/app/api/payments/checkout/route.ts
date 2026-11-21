import { endpoint, checkout } from "@wayward/server";
import { CheckoutRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(async () =>
    checkout(CheckoutRequestSchema.parse(await request.json())),
  );
}
