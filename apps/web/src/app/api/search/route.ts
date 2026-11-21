import { endpoint, search } from "@wayward/server";
import { SearchIntentSchema } from "@wayward/contracts";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(async () =>
    search(SearchIntentSchema.parse(await request.json())),
  );
}
