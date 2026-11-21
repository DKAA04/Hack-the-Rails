import { z } from "zod";
export const ErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "NOT_CONFIGURED",
  "NOT_IMPLEMENTED",
  "NOT_FOUND",
  "PROVIDER_UNAVAILABLE",
  "QUOTE_EXPIRED",
  "CONFLICT",
  "UNAUTHORIZED",
  "INVALID_SIGNATURE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export const ApiErrorSchema = z.object({
  version: z.literal(1),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
