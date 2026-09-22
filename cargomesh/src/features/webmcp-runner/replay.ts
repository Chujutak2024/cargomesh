import type { ProviderToolCallRecord } from "./contracts";

export type ProviderToolCallReplaySink<TResult> = (
  record: ProviderToolCallRecord,
) => TResult | Promise<TResult>;

/**
 * Re-sends the original record without navigating or invoking WebMCP again.
 * The clone prevents the persistence adapter from mutating replay evidence.
 */
export async function replayProviderToolCallRecord<TResult>(
  originalRecord: ProviderToolCallRecord,
  sink: ProviderToolCallReplaySink<TResult>,
): Promise<TResult> {
  return sink(structuredClone(originalRecord));
}
