import type { RecalledErrorCode } from "./types.js";

export class RecalledError extends Error {
  readonly code: RecalledErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: {
      code: RecalledErrorCode;
      status?: number;
      details?: unknown;
      requestId?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "RecalledError";
    this.code = options.code;
    this.status = options.status ?? 0;
    this.details = options.details;
    this.requestId = options.requestId;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isRecalledError(value: unknown): value is RecalledError {
  return value instanceof RecalledError;
}
