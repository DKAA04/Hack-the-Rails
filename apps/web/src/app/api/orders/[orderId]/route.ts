import { endpoint, getOrder } from "@wayward/server";
import { IdSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return endpoint(async () =>
    getOrder(IdSchema.parse((await context.params).orderId)),
  );
}
