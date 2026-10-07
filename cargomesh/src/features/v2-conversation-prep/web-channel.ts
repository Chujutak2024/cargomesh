/** Isolated Web port. Runtime wiring must use the canonical HAC-12 Zod parsers. */
export type Parser<T> = { parse(input: unknown): T };

export class ConversationWebError extends Error {
  constructor(readonly status: number, readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}

export function createPreparatoryWebChannel<TCreate, TDraft, TRoad>(options: {
  fetcher: typeof fetch;
  createInput: Parser<TCreate>;
  draftResponse: Parser<TDraft>;
  roadResponse: Parser<TRoad>;
}) {
  async function parseResponse<T>(response: Response, parser: Parser<T>): Promise<T> {
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new ConversationWebError(response.status, "INVALID_SERVER_RESPONSE", true); }
    if (!response.ok) {
      const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      const error = typeof record.error === "object" && record.error !== null
        ? record.error as Record<string, unknown> : {};
      throw new ConversationWebError(response.status,
        typeof error.code === "string" ? error.code : "REQUEST_FAILED",
        error.retryable === true);
    }
    return parser.parse(body);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function ensureId(id: string): string {
    if (!uuidPattern.test(id)) {
      throw new ConversationWebError(400, "INVALID_REQUEST_ID", false);
    }
    return encodeURIComponent(id);
  }

  return {
    async createDraft(payload: unknown, idempotencyKey: string): Promise<TDraft> {
      if (!uuidPattern.test(idempotencyKey)) {
        throw new ConversationWebError(400, "INVALID_IDEMPOTENCY_KEY", false);
      }
      // The injected canonical schema rejects incomplete/provisional payloads.
      const valid = options.createInput.parse(payload);
      const response = await options.fetcher("/api/v2/freight/requests", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(valid),
      });
      return parseResponse(response, options.draftResponse);
    },
    async readDraft(requestId: string): Promise<TDraft> {
      const response = await options.fetcher(`/api/v2/freight/requests/${ensureId(requestId)}`, {
        credentials: "same-origin", cache: "no-store",
      });
      return parseResponse(response, options.draftResponse);
    },
    async evaluateRoad(requestId: string, expectedDraftVersion: number): Promise<TRoad> {
      if (!Number.isSafeInteger(expectedDraftVersion) || expectedDraftVersion < 1) {
        throw new ConversationWebError(400, "INVALID_DRAFT_VERSION", false);
      }
      const response = await options.fetcher(
        `/api/v2/freight/requests/${ensureId(requestId)}/serviceability?expectedDraftVersion=${expectedDraftVersion}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      return parseResponse(response, options.roadResponse);
    },
  };
}
