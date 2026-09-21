import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = process.env.CARGOMESH_WEBMCP_CHROME ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const providerUrl = process.env.CARGOMESH_WEBMCP_PROVIDER_URL;
const mode = process.env.CARGOMESH_WEBMCP_BROWSER_MODE ?? "headless";
const flags = process.env.CARGOMESH_WEBMCP_FLAGS ?? "none";
const port = Number(process.env.CARGOMESH_WEBMCP_DEBUG_PORT ?? 9333);

if (!providerUrl) throw new Error("CARGOMESH_WEBMCP_PROVIDER_URL is required.");
if (!new Set(["headless", "headed"]).has(mode)) throw new Error("Browser mode must be headless or headed.");
if (!new Set(["none", "experimental"]).has(flags)) throw new Error("Flags must be none or experimental.");

const profile = await mkdtemp(join(tmpdir(), "cargomesh-webmcp-spike-"));
const args = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
];
if (mode === "headless") args.push("--headless=new", "--disable-gpu");
if (flags === "experimental") {
  args.push(
    "--enable-experimental-web-platform-features",
    "--enable-features=WebMCPTesting,DevToolsWebMCPSupport",
  );
}
args.push("about:blank");

const chrome = spawn(chromePath, args, { stdio: "ignore" });

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function json(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.json();
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { return await json(`http://127.0.0.1:${port}/json/version`); }
    catch (error) { lastError = error; await delay(125); }
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
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
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
      close() { socket.close(); },
    }), { once: true });
  });
}

const probeExpression = String.raw`(async () => {
  const expected = [
    "check_service_coverage", "check_capacity", "quote_freight",
    "book_freight", "get_provider_booking_status",
  ];
  const deadline = Date.now() + 12000;
  while (typeof document.modelContext !== "undefined" && Date.now() < deadline) {
    const names = (await document.modelContext.getTools()).map((tool) => tool.name);
    if (expected.every((name) => names.includes(name))) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const modelContext = document.modelContext;
  const result = {
    pageUrl: location.href,
    secureContext: isSecureContext,
    documentModelContextType: typeof modelContext,
    navigatorModelContextTestingType: typeof navigator.modelContextTesting,
    tools: [], coverage: null, quote: null, error: null,
  };
  if (!modelContext) return result;
  try {
    const tools = await modelContext.getTools();
    result.tools = tools.map((tool) => tool.name).sort();
    const execute = async (name, input) => {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error("Missing tool: " + name);
      const output = await modelContext.executeTool(
        tool,
        JSON.stringify(input),
        { signal: new AbortController().signal },
      );
      return output === null ? null : JSON.parse(output);
    };
    result.coverage = await execute("check_service_coverage", {
      origin: "Callao, PE", destination: "Santiago, CL",
      transport_mode: "ROAD", service_type: "FTL", cargo_category: "MACHINERY",
    });
    const day = 24 * 60 * 60 * 1000;
    const pickupStart = new Date(Date.now() + day);
    const pickupEnd = new Date(pickupStart.getTime() + day);
    const deliveryDeadline = new Date(pickupStart.getTime() + 4 * day);
    result.quote = await execute("quote_freight", {
      freight_request_id: "f2000000-0000-0000-0000-000000000001",
      origin: "Callao, PE", destination: "Santiago, CL",
      cargo_weight_kg: 1600, cargo_volume_m3: 3.6, cargo_category: "MACHINERY",
      pickup_mode: "SCHEDULED",
      pickup_window_start: pickupStart.toISOString(),
      pickup_window_end: pickupEnd.toISOString(),
      delivery_deadline: deliveryDeadline.toISOString(),
      available_documents: [],
    });
  } catch (error) {
    result.error = { name: error?.name ?? null, message: String(error?.message ?? error) };
  }
  return result;
})()`;

let cdp;
try {
  const version = await waitForDebugger();
  const page = await json(
    `http://127.0.0.1:${port}/json/new`,
    { method: "PUT" },
  );
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  const navigation = await cdp.send("Page.navigate", { url: providerUrl });
  if (navigation.errorText) throw new Error(`Provider navigation failed: ${navigation.errorText}`);
  let loaded = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await cdp.send("Runtime.evaluate", {
      expression: "({ url: location.href, ready: document.readyState })",
      returnByValue: true,
    });
    if (state.result.value.url === providerUrl && state.result.value.ready === "complete") {
      loaded = true;
      break;
    }
    await delay(125);
  }
  if (!loaded) throw new Error("Provider page did not finish loading in Chrome.");
  const evaluated = await cdp.send("Runtime.evaluate", {
    expression: probeExpression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (evaluated.exceptionDetails) {
    throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
  }
  const report = {
    schemaVersion: "1.0", technology: "Chrome DevTools Protocol",
    browser: version.Browser, userAgent: version["User-Agent"], mode, flags,
    providerUrl, probe: evaluated.result.value,
  };
  console.log(JSON.stringify(report, null, 2));
  if (process.env.CARGOMESH_WEBMCP_EXPECT_SUPPORTED === "true") {
    const expectedTools = [
      "check_service_coverage", "check_capacity", "quote_freight",
      "book_freight", "get_provider_booking_status",
    ];
    const probe = report.probe;
    if (probe.documentModelContextType !== "object" ||
        !expectedTools.every((name) => probe.tools.includes(name)) ||
        probe.coverage?.ok !== true || probe.quote?.ok !== true || probe.error) {
      throw new Error("Automated native WebMCP proof did not meet the expected contract.");
    }
  }
} finally {
  cdp?.close();
  chrome.kill();
  await Promise.race([
    new Promise((resolve) => chrome.once("exit", resolve)),
    delay(2000),
  ]);
  try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch (error) { console.error("Could not remove temporary Chrome profile:", error.message); }
}
