import { customerEndpoint, getOrder } from "@wayward/server";
import { IdSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return customerEndpoint(request, async (customer) =>
    getOrder(IdSchema.parse((await context.params).orderId), customer),
  );
}
