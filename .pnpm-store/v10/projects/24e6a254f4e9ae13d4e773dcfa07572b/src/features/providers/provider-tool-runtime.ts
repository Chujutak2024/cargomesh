import type { ProviderToolEnvelope } from "./contracts";

export type ParsedProviderInput<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function isProviderInputRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyProviderString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveProviderNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isProviderDateTime(value: unknown): value is string {
  return isNonEmptyProviderString(value) && Number.isFinite(Date.parse(value));
}

export function createProviderToolError<T>(
  code: string,
  message: string,
  retryable = false,
): ProviderToolEnvelope<T> {
  return { ok: false, error: { code, message, retryable } };
}

export function waitForProviderTool(signal: AbortSignal, delayMs = 60): Promise<void> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    function handleAbort() {
      clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException("Tool execution cancelled", "AbortError"));
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
