import { endpoint, dependencies } from "@wayward/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return endpoint(() => dependencies());
}
