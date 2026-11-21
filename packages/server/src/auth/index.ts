import { createHash, randomBytes } from "node:crypto";
import { configuration } from "../config";
import { endpoint } from "../http";
import { ServiceError } from "../errors";
export interface CustomerContext {
  ownerHash: string;
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function customerSession(
  request: Request,
  create = false,
): { context: CustomerContext; cookie: string | null } {
  const config = configuration();
  if (!config.valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid environment configuration.",
      503,
    );
  const origin = request.headers.get("origin");
  if (process.env.APP_URL) {
    try {
      const configured = new URL(process.env.APP_URL);
      if (
        !["http:", "https:"].includes(configured.protocol) ||
        configured.username ||
        configured.password ||
        (config.environment === "live" && configured.protocol !== "https:")
      )
        throw new Error();
    } catch {
      throw new ServiceError(
        "NOT_CONFIGURED",
        "APP_URL must be a valid trusted HTTP(S) URL; live mode requires HTTPS.",
        503,
      );
    }
  }
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (config.environment === "live" && !process.env.APP_URL)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "APP_URL is required for live customer sessions.",
      503,
    );
  if (origin && origin !== expected)
    throw new ServiceError(
      "UNAUTHORIZED",
      "Cross-origin order operations are not permitted.",
      401,
    );
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("wayward_session="))
    ?.slice("wayward_session=".length);
  const valid = value && /^[a-f0-9]{64}$/.test(value);
  if (!valid && !create)
    throw new ServiceError(
      "UNAUTHORIZED",
      "This order requires the browser session that created it.",
      401,
    );
  const token = valid ? value : randomBytes(32).toString("hex");
  return {
    context: { ownerHash: hash(token) },
    cookie: valid
      ? null
      : `wayward_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${config.environment === "live" ? "; Secure" : ""}`,
  };
}
export async function customerEndpoint(
  request: Request,
  run: (context: CustomerContext) => Promise<unknown>,
  create = false,
): Promise<Response> {
  let cookie: string | null = null;
  const response = await endpoint(async () => {
    const session = customerSession(request, create);
    cookie = session.cookie;
    return run(session.context);
  });
  if (cookie && response.ok) response.headers.append("Set-Cookie", cookie);
  return response;
}
