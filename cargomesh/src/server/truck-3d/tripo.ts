/** Official Tripo v3 protocol. No automatic retry of billed task creation. */
const base = "https://openapi.tripo3d.ai/v3";
type Payload = Record<string, unknown>;
export class TruckGenerationError extends Error {
  constructor(public readonly code: "CREDITS" | "PROVIDER" | "SUBMISSION_UNKNOWN") { super(code); }
}
export function createTripoClient(apiKey: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit = {}): Promise<Payload> {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, { ...init, cache: "no-store", redirect: "error",
        headers: { ...init.headers, Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000) });
    } catch { throw new TruckGenerationError(init.method === "POST" ? "SUBMISSION_UNKNOWN" : "PROVIDER"); }
    if (response.status === 402) throw new TruckGenerationError("CREDITS");
    if (!response.ok) throw new TruckGenerationError(init.method === "POST" && response.status >= 500 ? "SUBMISSION_UNKNOWN" : "PROVIDER");
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new TruckGenerationError("PROVIDER");
    let envelope: Payload;
    try { envelope = JSON.parse(raw); } catch { throw new TruckGenerationError("PROVIDER"); }
    if (!envelope || typeof envelope !== "object" || "code" in envelope && envelope.code !== 0) throw new TruckGenerationError("PROVIDER");
    const data = "data" in envelope ? envelope.data : envelope;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new TruckGenerationError("PROVIDER");
    return data as Payload;
  }
  return {
    async start(photo: Blob) {
      const form = new FormData(); form.append("file", photo, "truck.jpg");
      const uploaded = await request("/files", { method: "POST", body: form });
      if (typeof uploaded.file_token !== "string") throw new TruckGenerationError("PROVIDER");
      const result = await request("/generation/image-to-model", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { file_token: uploaded.file_token }, model: "v3.1-20260211", face_limit: 30_000, texture: true, pbr: true, texture_quality: "standard" }) });
      if (typeof result.task_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(result.task_id)) throw new TruckGenerationError("SUBMISSION_UNKNOWN");
      return result.task_id;
    },
    async status(taskId: string) {
      const task = await request(`/tasks/${encodeURIComponent(taskId)}`);
      const progress = typeof task.progress === "number" && Number.isFinite(task.progress) ? Math.max(0, Math.min(99, task.progress)) : null;
      if (task.status === "success") {
        const output = task.output as Payload | undefined;
        if (!output || typeof output.model_url !== "string") throw new TruckGenerationError("PROVIDER");
        return { state: "ready" as const, progress: 100, modelUrl: output.model_url };
      }
      if (["failed", "cancelled", "banned", "expired"].includes(String(task.status))) return { state: "failed" as const, progress: null };
      if (!["queued", "running"].includes(String(task.status))) throw new TruckGenerationError("PROVIDER");
      return { state: "processing" as const, progress };
    },
  };
}
