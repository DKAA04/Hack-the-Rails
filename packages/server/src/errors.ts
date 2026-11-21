import type { ErrorCode } from "@wayward/contracts";
export class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public retryable = false,
  ) {
    super(message);
  }
}
export function unfinished(operation: string): never {
  throw new ServiceError(
    "NOT_IMPLEMENTED",
    `${operation} is not implemented. No booking, payment or ticket has been created.`,
    501,
  );
}
