import { customerEndpoint, reconcileOrder } from "@wayward/server";
import { IdSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return customerEndpoint(request, async (customer) =>
    reconcileOrder(IdSchema.parse((await context.params).orderId), customer),
  );
}
