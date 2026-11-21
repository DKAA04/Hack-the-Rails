import { customerEndpoint, updateTravellers } from "@wayward/server";
import { IdSchema, UpdateTravellersRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function PUT(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return customerEndpoint(request, async (customer) =>
    updateTravellers(
      IdSchema.parse((await context.params).orderId),
      UpdateTravellersRequestSchema.parse(await request.json()),
      customer,
    ),
  );
}
