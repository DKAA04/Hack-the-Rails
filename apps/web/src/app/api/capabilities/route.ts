import { endpoint, capabilities } from "@wayward/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(async () => capabilities());
}
