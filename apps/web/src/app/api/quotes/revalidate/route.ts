import { endpoint, revalidate } from "@wayward/server";
import { RevalidationRequestSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(async () =>
    revalidate(RevalidationRequestSchema.parse(await request.json())),
  );
}
