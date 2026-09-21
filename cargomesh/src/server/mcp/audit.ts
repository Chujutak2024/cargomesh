import type { Database, Json } from "@/types/database.types";

export type McpAuditEventInput = {
  toolName: string;
  requestId: string | null;
  startedAt: string;
  durationMs: number;
  httpStatus: number;
  status: "success" | "error";
  inputPayload: Record<string, unknown> | null;
  outputPayload: Record<string, unknown> | null;
};

// Persist only a fixed set of non-secret contract fields. In particular, the
// draft payload, idempotency key, cookie, authorization and response body stay out.
export function extractMcpAuditInput(body: unknown): {
  toolName: string; requestId: string | null; inputPayload: Record<string, unknown> | null;
} | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const rpc = body as Record<string, unknown>;
  if (rpc.method !== "tools/call") return null;
  const params = rpc.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const { name, arguments: args } = params as Record<string, unknown>;
  if (typeof name !== "string" || !/^[a-z_]{1,64}$/.test(name)) return null;
  const requestId = typeof rpc.id === "string" || typeof rpc.id === "number"
    ? String(rpc.id).slice(0, 100) : null;
  const runId = args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>).runId : null;
  return { toolName: name, requestId,
    inputPayload: name === "get_freight_options" && typeof runId === "string" && /^[0-9a-f-]{36}$/i.test(runId)
      ? { runId } : null };
}

export function extractMcpAuditOutput(body: unknown): {
  status: "success" | "error"; outputPayload: Record<string, unknown> | null;
} {
  if (!body || typeof body !== "object") return { status: "error", outputPayload: null };
  const rpc = body as Record<string, unknown>;
  const result = rpc.result && typeof rpc.result === "object" ? rpc.result as Record<string, unknown> : null;
  const structured = result?.structuredContent && typeof result.structuredContent === "object"
    ? result.structuredContent as Record<string, unknown> : null;
  const data = structured?.data && typeof structured.data === "object"
    ? structured.data as Record<string, unknown> : null;
  const error = structured?.error && typeof structured.error === "object"
    ? structured.error as Record<string, unknown> : null;
  const outputPayload: Record<string, unknown> = {};
  if (typeof structured?.ok === "boolean") outputPayload.ok = structured.ok;
  if (typeof data?.status === "string") outputPayload.status = data.status;
  if (typeof data?.runId === "string") outputPayload.runId = data.runId;
  if (typeof data?.code === "string") outputPayload.code = data.code;
  if (typeof error?.code === "string") outputPayload.errorCode = error.code;
  if (typeof (rpc.error as Record<string, unknown> | undefined)?.code === "number")
    outputPayload.rpcErrorCode = (rpc.error as Record<string, unknown>).code;
  return { status: rpc.error || result?.isError || structured?.ok === false ? "error" : "success",
    outputPayload: Object.keys(outputPayload).length ? outputPayload : null };
}

export async function persistMcpAuditEvent(event: McpAuditEventInput): Promise<void> {
  // Lazy Next imports keep the pure HTTP/SDK contract tests independent of Next.
  const { requireAuthenticatedMember } = await import("@/server/auth/member");
  const { createClient } = await import("@supabase/supabase-js");
  const member = await requireAuthenticatedMember();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MCP_AUDIT_UNAVAILABLE");
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const row: Database["public"]["Tables"]["mcp_audit_events"]["Insert"] = {
    organization_id: member.organizationId, member_id: member.memberId,
    tool_name: event.toolName, request_id: event.requestId,
    started_at: event.startedAt, duration_ms: event.durationMs,
    http_status: event.httpStatus, status: event.status,
    input_payload: event.inputPayload as Json | null, output_payload: event.outputPayload as Json | null,
  };
  const { error } = await supabase.from("mcp_audit_events").insert(row);
  if (error) throw new Error("MCP_AUDIT_UNAVAILABLE");
}
