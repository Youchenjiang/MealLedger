import type { CloudMutationError } from "./contracts";

export type CloudFailureCode = "transport" | "ownership" | "validation" | "conflict" | "idempotency";

export type CloudFailure = {
  code: CloudFailureCode;
  message: string;
  retryable: boolean;
  table: string;
};

export function classifyCloudError(error: CloudMutationError, table: string): CloudFailure {
  const code = error.code ?? "";
  if (code === "42501" || code === "PGRST301") {
    return { code: "ownership", message: error.message, retryable: false, table };
  }
  if (code === "23505" || code === "23514" || code === "22P02") {
    return { code: "validation", message: error.message, retryable: false, table };
  }
  if (code === "version_conflict") {
    return { code: "conflict", message: error.message, retryable: false, table };
  }
  if (code === "idempotency_hash_mismatch") {
    return { code: "idempotency", message: error.message, retryable: false, table };
  }
  return { code: "transport", message: error.message, retryable: true, table };
}

export function nextRetryAt(attempt: number, now: Date, maxAttempts = 5): string | null {
  if (attempt >= maxAttempts) return null;
  const delayMs = Math.min(60_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return new Date(now.getTime() + delayMs).toISOString();
}
