import { configuration, credentialsPresent } from "../../config";
import { ServiceError } from "../../errors";
import { supplierJson } from "../http";
export function duffelJson(path: string, body?: unknown): Promise<unknown> {
  if (!configuration().valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid WAYWARD_ENV configuration.",
      503,
    );
  if (!credentialsPresent("DUFFEL_ACCESS_TOKEN"))
    throw new ServiceError(
      "NOT_CONFIGURED",
      "DUFFEL_ACCESS_TOKEN is missing.",
      503,
    );
  return supplierJson(`https://api.duffel.com${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
