import { customerEndpoint, checkout } from "@wayward/server";
import { CheckoutRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return customerEndpoint(request, async (context) =>
    checkout(CheckoutRequestSchema.parse(await request.json()), context),
  );
}
