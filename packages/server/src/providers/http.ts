import { ServiceError } from "../errors";
export async function supplierJson(
  url: URL | string,
  init: RequestInit = {},
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        `Supplier request failed (HTTP ${response.status}).`,
        503,
        response.status === 429 || response.status >= 500,
      );
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "Supplier could not be reached or returned invalid JSON.",
      503,
      true,
    );
  }
}
