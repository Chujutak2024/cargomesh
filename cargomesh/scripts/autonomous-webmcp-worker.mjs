import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const runId = process.argv.slice(2).find((value) => value !== "--")?.trim();
if (!runId || !UUID_PATTERN.test(runId)) {
  throw new Error("Usage: pnpm worker:webmcp -- <orchestration-run-uuid>");
}

const baseUrl = new URL(
  process.env.CARGOMESH_WEBMCP_WORKER_BASE_URL ?? "http://127.0.0.1:3000",
);
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!localHosts.has(baseUrl.hostname)) {
  throw new Error("Autonomous Provider Execution V1 is restricted to a local CargoMesh origin.");
}
if (baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
  throw new Error("CARGOMESH_WEBMCP_WORKER_BASE_URL must contain only the local origin.");
}

const chromePath = process.env.CARGOMESH_WEBMCP_CHROME ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = Number(process.env.CARGOMESH_WEBMCP_DEBUG_PORT ?? 9334);
const timeoutMs = Number(process.env.CARGOMESH_WEBMCP_WORKER_TIMEOUT_MS ?? 180_000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("CARGOMESH_WEBMCP_DEBUG_PORT must be a valid non-privileged port.");
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 900_000) {
  throw new Error("CARGOMESH_WEBMCP_WORKER_TIMEOUT_MS must be between 10000 and 900000.");
}

const suppliedProfile = process.env.CARGOMESH_WEBMCP_WORKER_PROFILE_DIR?.trim();
const profile = suppliedProfile || await mkdtemp(join(tmpdir(), "cargomesh-webmcp-worker-"));
const temporaryProfile = !suppliedProfile;
const authMode = process.env.CARGOMESH_WEBMCP_WORKER_AUTH ?? "demo";
if (!new Set(["demo", "existing-profile", "cookie"]).has(authMode)) {
  throw new Error("CARGOMESH_WEBMCP_WORKER_AUTH must be demo, existing-profile or cookie.");
}
if (authMode === "existing-profile" && temporaryProfile) {
  throw new Error("existing-profile auth requires CARGOMESH_WEBMCP_WORKER_PROFILE_DIR.");
}
const workerCookie = process.env.CARGOMESH_WEBMCP_WORKER_COOKIE?.trim();
if (authMode === "cookie" && !workerCookie) {
  throw new Error("cookie auth requires CARGOMESH_WEBMCP_WORKER_COOKIE.");
}

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--enable-experimental-web-platform-features",
  "--enable-features=WebMCPTesting,DevToolsWebMCPSupport",
  "about:blank",
], { stdio: "ignore" });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.json();
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready (code ${chrome.exitCode}).`);
    }
    try {
      return await readJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError ?? new Error("Chrome DevTools endpoint did not start.");
}

function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("open", () => resolve({
      send(method, params = {}) {
        const id = ++nextId;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((commandResolve, commandReject) => {
          pending.set(id, { resolve: commandResolve, reject: commandReject });
        });
      },
      close() {
        socket.close();
      },
    }), { once: true });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
    );
  }
  return result.result.value;
}

async function navigate(cdp, url) {
  const navigation = await cdp.send("Page.navigate", { url });
  if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = await evaluate(
      cdp,
      "({ url: location.href, readyState: document.readyState })",
    );
    if (state.url === url && state.readyState === "complete") return;
    await delay(100);
  }
  throw new Error(`Timed out loading ${url}`);
}

let cdp;
try {
  const browser = await waitForDebugger();
  const page = await readJson(`http://127.0.0.1:${port}/json/new`, { method: "PUT" });
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  if (authMode === "cookie") {
    const cookies = workerCookie.split(";").map((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) throw new Error("Invalid worker cookie header.");
      return {
        name: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim(),
        url: baseUrl.origin,
      };
    });
    await cdp.send("Network.setCookies", { cookies });
  }

  await navigate(cdp, baseUrl.toString());
  if (authMode === "demo") {
    const login = await evaluate(cdp, String.raw`(async () => {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    })()`);
    if (login.status < 200 || login.status >= 300 || login.body?.ok !== true) {
      throw new Error(`Demo authentication failed with HTTP ${login.status}.`);
    }
  }

  const workerUrl = new URL(`/dispatch/${encodeURIComponent(runId)}`, baseUrl);
  workerUrl.searchParams.set("autonomous", "1");
  await navigate(cdp, workerUrl.toString());

  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await evaluate(cdp, String.raw`(() => {
      const marker = document.querySelector("#cargomesh-autonomous-worker-status");
      return {
        pageUrl: location.href,
        status: marker?.dataset.status ?? null,
        runId: marker?.dataset.runId ?? null,
        error: marker?.dataset.error ?? null,
      };
    })()`);

    if (state.pageUrl.includes("/login")) {
      throw new Error("The worker session was redirected to login.");
    }
    if (state.runId && state.runId !== runId) {
      throw new Error("The worker page returned a different orchestration run.");
    }
    if (["success", "no-match", "error"].includes(state.status)) break;
    await delay(250);
  }

  if (!state || !["success", "no-match", "error"].includes(state.status)) {
    throw new Error(`Autonomous provider execution timed out after ${timeoutMs} ms.`);
  }
  if (state.status === "error") {
    throw new Error(state.error || "Autonomous provider execution failed.");
  }

  const persisted = await evaluate(cdp, String.raw`(async () => {
    const response = await fetch("/api/orchestration/runs/${encodeURIComponent(runId)}", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  })()`);
  if (persisted.status !== 200 || persisted.body?.ok !== true) {
    throw new Error(`Could not read final persisted state (HTTP ${persisted.status}).`);
  }

  console.log(JSON.stringify({
    schemaVersion: "1.0",
    worker: "AUTONOMOUS_PROVIDER_EXECUTION_V1",
    providerKind: "DEMO_AUTO_OFFER_CARRIERS",
    runId,
    browser: browser.Browser,
    status: state.status,
    viewModel: persisted.body.data,
  }, null, 2));
} finally {
  cdp?.close();
  chrome.kill();
  await Promise.race([
    new Promise((resolve) => chrome.once("exit", resolve)),
    delay(2_000),
  ]);
  if (temporaryProfile) {
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      console.error("Could not remove temporary Chrome profile:", error.message);
    }
  }
}
