import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createTripoClient, TruckGenerationError } from "./tripo";
import { downloadTruckModel } from "./download-model";

const origin = "http://127.0.0.1:8080";
const maxInputBytes = 400_256;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function boundedBody(request: Request) {
  if (!request.body || Number(request.headers.get("content-length") ?? 0) > maxInputBytes) throw new Error("INVALID_PHOTO");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.length;
      if (bytes > maxInputBytes) { await reader.cancel(); throw new Error("INVALID_PHOTO"); } chunks.push(next.value); }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Local demo only. Hosted requests fail closed; no anonymous paid API exposed on Vercel. */
export function createLocalTruck3dHandler({ enabled, apiKey, fetcher = fetch, downloader = downloadTruckModel }: {
  enabled: boolean; apiKey?: string; fetcher?: typeof fetch; downloader?: (url: string) => Promise<Blob>;
}) {
  const available = enabled && !!apiKey?.trim();
  const client = available ? createTripoClient(apiKey!, fetcher) : null;
  const signingKey = createHash("sha256").update(`cargomesh-truck-demo:${apiKey??"disabled"}`).digest();
  const sign = (taskId: string) => {
    const data = Buffer.from(JSON.stringify({ taskId, expires: Date.now() + 45 * 60_000 })).toString("base64url");
    return `${data}.${createHmac("sha256", signingKey).update(data).digest("base64url")}`;
  };
  const readToken = (token: string | null) => {
    if (!token || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("INVALID_TASK");
    const [data, signature] = token.split("."), expected = createHmac("sha256", signingKey).update(data).digest(), actual = Buffer.from(signature,"base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("INVALID_TASK");
    const parsed = JSON.parse(Buffer.from(data,"base64url").toString("utf8"));
    if (!Number.isFinite(parsed.expires) || parsed.expires < Date.now() || !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.taskId)) throw new Error("INVALID_TASK");
    return parsed.taskId as string;
  };
  // Local, single-process cap and deduplication. Not a distributed production quota.
  const submissions = new Map<string, Promise<Response>>();
  let submitted = 0;
  return async (request: Request) => {
    const url = new URL(request.url);
    if (request.headers.get("host") !== new URL(origin).host || url.protocol !== "http:") return json({ error: "NOT_AVAILABLE" }, 404);
    const caller = request.headers.get("origin"), site = request.headers.get("sec-fetch-site");
    if (caller && caller !== origin || site && !["same-origin", "none"].includes(site)) return json({ error: "FORBIDDEN" }, 403);
    if (request.method === "GET" && !url.searchParams.has("task")) return json({ available, provider: available ? "Tripo" : null });
    if (!client) return json({ error: "NOT_CONFIGURED" }, 503);
    try {
      if (request.method === "GET") {
        const taskId = readToken(url.searchParams.get("task")), status = await client.status(taskId);
        if (url.searchParams.get("asset") === "1") {
          if (status.state !== "ready") return json({ error: "NOT_READY" }, 409);
          const blob = await downloader(status.modelUrl);
          return new Response(blob, { headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
        }
        // Signed output URLs and raw provider error details are never passed to UI.
        return json({ state: status.state, progress: status.progress });
      }
      if (request.method !== "POST" || caller !== origin || !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "INVALID_REQUEST" }, 400);
      const id = request.headers.get("idempotency-key");
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "INVALID_REQUEST" }, 400);
      const body = await boundedBody(request);
      if (body?.consent !== true || typeof body.photoDataUrl !== "string" || body.photoDataUrl.length > 400_000
        || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.photoDataUrl)) return json({ error: "INVALID_PHOTO" }, 400);
      const bytes = Buffer.from(body.photoDataUrl.split(",")[1], "base64");
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length < 100) return json({ error: "INVALID_PHOTO" }, 400);
      const fingerprint = createHash("sha256").update(body.photoDataUrl).digest("hex"), submissionKey = `${id}:${fingerprint}`;
      const existing = submissions.get(submissionKey);
      if (existing) return (await existing).clone();
      if (Array.from(submissions.keys()).some(key => key.startsWith(`${id}:`))) return json({ error: "INVALID_REQUEST" }, 409);
      if (submitted >= 3) return json({ error: "DEMO_LIMIT" }, 429);
      submitted++;
      const result = client.start(new Blob([bytes], { type: "image/jpeg" }))
        .then(taskId => json({ token: sign(taskId), state: "processing", progress: null }, 202))
        .catch(error => json({ error: error instanceof TruckGenerationError ? error.code : "PROVIDER" }, 502));
      submissions.set(submissionKey, result);
      return (await result).clone();
    } catch (error) {
      return json({ error: error instanceof TruckGenerationError ? error.code : error instanceof Error && error.message === "INVALID_TASK" ? "INVALID_TASK" : "PROVIDER" }, 502);
    }
  };
}
