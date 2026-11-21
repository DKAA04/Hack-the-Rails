import { endpoint, createOrder } from "@wayward/server";
import { CreateOrderRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(async () =>
    createOrder(CreateOrderRequestSchema.parse(await request.json())),
  );
}
