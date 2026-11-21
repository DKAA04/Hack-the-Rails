import { customerEndpoint, reserveOrder } from "@wayward/server";
import { IdSchema, ReserveOrderRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return customerEndpoint(request, async (customer) =>
    reserveOrder(
      IdSchema.parse((await context.params).orderId),
      ReserveOrderRequestSchema.parse(await request.json()),
      customer,
    ),
  );
}
