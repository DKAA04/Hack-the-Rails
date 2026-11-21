import { customerEndpoint, createOrder } from "@wayward/server";
import { CreateOrderRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return customerEndpoint(
    request,
    async (context) =>
      createOrder(
        CreateOrderRequestSchema.parse(await request.json()),
        context,
      ),
    true,
  );
}
