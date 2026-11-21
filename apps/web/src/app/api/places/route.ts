import { PlaceLookupRequestSchema } from "@wayward/contracts";
import { endpoint, lookupPlaces } from "@wayward/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(async () => {
    const params = new URL(request.url).searchParams;
    return lookupPlaces(
      PlaceLookupRequestSchema.parse({
        query: params.get("query"),
        limit: params.get("limit") ?? undefined,
        modes: params.has("modes")
          ? params.get("modes")!.split(",")
          : undefined,
      }),
    );
  });
}
