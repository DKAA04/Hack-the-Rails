import { endpoint, getSearch } from "@wayward/server";
import { IdSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ searchId: string }> },
) {
  return endpoint(async () =>
    getSearch(IdSchema.parse((await context.params).searchId)),
  );
}
