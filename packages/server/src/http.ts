import { z } from "zod";
import { ApiErrorSchema } from "@wayward/contracts";
import { ServiceError } from "./errors";
import { requestId } from "./observability";
export async function endpoint(
  run: () => unknown | Promise<unknown>,
): Promise<Response> {
  const id = requestId();
  try {
    return Response.json(await run(), {
      headers: { "Cache-Control": "no-store", "X-Request-ID": id },
    });
  } catch (error) {
    const e =
      error instanceof ServiceError
        ? error
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? new ServiceError(
              "INVALID_REQUEST",
              "Request does not match contract v1.",
              400,
            )
          : new ServiceError("INTERNAL_ERROR", "Unexpected server error.", 500);
    return Response.json(
      ApiErrorSchema.parse({
        version: 1,
        error: {
          code: e.code,
          message: e.message,
          retryable: e.retryable,
          requestId: id,
        },
      }),
      {
        status: e.status,
        headers: { "Cache-Control": "no-store", "X-Request-ID": id },
      },
    );
  }
}
