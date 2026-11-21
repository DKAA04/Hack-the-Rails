import { endpoint } from "@wayward/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return endpoint(() => {
    const candidate =
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.WAYWARD_SOURCE_SHA;
    return {
      version: 1,
      sourceSha:
        candidate && /^[a-f0-9]{40}$/.test(candidate) ? candidate : null,
      environment: process.env.WAYWARD_ENV || "development",
      runtime: "nodejs",
    };
  });
}
