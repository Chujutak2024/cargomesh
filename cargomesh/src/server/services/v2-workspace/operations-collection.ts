/** Read orchestration only: native services still own schemas, authorization and domain rules. */
export type OperationsPage<T> = {
  data: T[];
  meta?: { limit: number; offset: number; nextOffset: number | null };
};
export type OperationsCollection<T> = {
  data: T[];
  offset: number;
  batchSize: number;
  nextOffset: number | null;
  complete: boolean;
  error: { code: "OPERATIONS_READ_UNAVAILABLE" } | null;
};
export type OperationsReadIssue = { resource: string; reason: "unavailable" | "partial" };
export const OPERATIONS_BATCH_SIZE = 500;

export class OperationsReadContractError extends Error {
  readonly code = "INVALID_OPERATIONS_READ";
}

function mustPropagate(error: unknown) {
  if (error instanceof OperationsReadContractError) return true;
  if (!error || typeof error !== "object") return false;
  const status = "httpStatus" in error ? error.httpStatus : "status" in error ? error.status : undefined;
  return (typeof status === "number" && status >= 400 && status < 500)
    || ("name" in error && (error.name === "ZodError" || error.name === "AbortError"));
}

/** Bounded pagination: never turn a failed page into a complete empty collection. */
export async function collectOperationsPages<T extends { id: string }>(
  read: (page: { limit: number; offset: number }) => Promise<OperationsPage<T>>,
  validate: (record: T) => void,
  offset = 0,
): Promise<OperationsCollection<T>> {
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new OperationsReadContractError("Invalid offset.");
  const data: T[] = [], seen = new Set<string>();
  const start = offset;
  for (let page = 0; page < OPERATIONS_BATCH_SIZE / 100; page++) {
    let result: OperationsPage<T>;
    try { result = await read({ limit: 100, offset }); }
    catch (error) {
      if (mustPropagate(error)) throw error;
      return { data, offset: start, batchSize: OPERATIONS_BATCH_SIZE, nextOffset: offset, complete: false, error: { code: "OPERATIONS_READ_UNAVAILABLE" } };
    }
    const meta = result.meta;
    if (!Array.isArray(result.data) || result.data.length > 100 || !meta || meta.limit !== 100 || meta.offset !== offset
      || (meta.nextOffset !== null && (meta.nextOffset !== offset + 100 || result.data.length !== 100))) {
      throw new OperationsReadContractError("Invalid pagination response.");
    }
    for (const record of result.data) {
      validate(record);
      if (!record.id || seen.has(record.id)) throw new OperationsReadContractError("Duplicate or missing record ID.");
      seen.add(record.id); data.push(record);
    }
    if (meta.nextOffset === null) return { data, offset: start, batchSize: OPERATIONS_BATCH_SIZE, nextOffset: null, complete: start === 0, error: null };
    offset = meta.nextOffset;
    if (offset > 100000) break;
  }
  return { data, offset: start, batchSize: OPERATIONS_BATCH_SIZE, nextOffset: offset <= 100000 ? offset : null, complete: false, error: null };
}

export function operationsReadIssues(collections: Record<string, OperationsCollection<unknown>>): OperationsReadIssue[] {
  return Object.entries(collections).flatMap<OperationsReadIssue>(([resource, value]) => value.error
    ? [{ resource, reason: "unavailable" as const }]
    : !value.complete ? [{ resource, reason: "partial" as const }] : []);
}

export function operationsCount(collection: OperationsCollection<unknown>): string {
  if (collection.error) return "—";
  return `${collection.data.length}${collection.complete ? "" : "+"}`;
}
