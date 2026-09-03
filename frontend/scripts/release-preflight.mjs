import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const repositoryDirectory = path.resolve(frontendDirectory, "..");
const reportOnly = process.argv.includes("--report-only");

const checks = [];

function record(name, ok, message) {
  checks.push({ name, ok, message });
}

function readRequired(name) {
  const value = process.env[name]?.trim() ?? "";
  const placeholder = /replace-with|example\.com|example\.supabase\.co/i.test(value);
  record(name, Boolean(value) && !placeholder, value && !placeholder ? "configured" : "missing or placeholder");
  return value;
}

function parseSecureOrigin(name, value) {
  try {
    const parsed = new URL(value);
    const valid =
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.pathname === "/" || parsed.pathname === "") &&
      !parsed.search &&
      !parsed.hash;
    record(name, valid, valid ? parsed.origin : "must be an exact HTTPS origin");
    return valid ? parsed.origin : null;
  } catch {
    record(name, false, "must be a valid URL");
    return null;
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
record("Node.js", nodeMajor >= 22, nodeMajor >= 22 ? process.versions.node : "Node.js 22+ required");

const releaseUrlValue = readRequired("CARGOMESH_RELEASE_URL");
const releaseOrigin = parseSecureOrigin("CargoMesh release origin", releaseUrlValue);
const supabaseUrlValue = readRequired("NEXT_PUBLIC_SUPABASE_URL");
parseSecureOrigin("Supabase project origin", supabaseUrlValue);
readRequired("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleValue = readRequired("SUPABASE_SERVICE_ROLE_KEY");
const demoLoginEmail = readRequired("CARGOMESH_DEMO_LOGIN_EMAIL");
const demoLoginPassword = readRequired("CARGOMESH_DEMO_LOGIN_PASSWORD");

const callerOriginsValue = readRequired("NEXT_PUBLIC_CARGOMESH_TOOL_CALLER_ORIGINS");
const callerOrigins = callerOriginsValue
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const parsedCallerOrigins = callerOrigins.map((value, index) =>
  parseSecureOrigin(`WebMCP caller origin ${index + 1}`, value),
);
record(
  "WebMCP release origin allowlist",
  Boolean(releaseOrigin) && parsedCallerOrigins.includes(releaseOrigin),
  releaseOrigin && parsedCallerOrigins.includes(releaseOrigin)
    ? "release origin explicitly allowed"
    : "release origin is absent from the explicit allowlist",
);
record(
  "WebMCP wildcard rejection",
  !callerOriginsValue.includes("*"),
  callerOriginsValue.includes("*") ? "wildcards are forbidden" : "no wildcard",
);

const licensePresent = ["LICENSE", "LICENSE.md", "LICENSE.txt"].some((name) =>
  existsSync(path.join(repositoryDirectory, name)),
);
record("Open-source license", licensePresent, licensePresent ? "present" : "LICENSE file missing");

const staticDirectory = path.join(frontendDirectory, ".next", "static");
const staticFiles = walkFiles(staticDirectory);
record("Production bundle", staticFiles.length > 0, staticFiles.length > 0 ? `${staticFiles.length} static files` : "run npm run build first");

const forbidden = [
  { label: "service_role marker", pattern: /service_role/i },
  // Newer supabase-js bundles contain the literal `sb_secret_` as a browser-side
  // safety guard. Match only a credential-shaped value, not that defensive marker.
  { label: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_-]{10,}/i },
  { label: "service-role environment name", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
];
if (serviceRoleValue && !/replace-with/i.test(serviceRoleValue)) {
  forbidden.push({ label: "configured service-role value", pattern: serviceRoleValue });
}
if (demoLoginPassword && !/replace-with/i.test(demoLoginPassword)) {
  forbidden.push({ label: "configured demo-login password", pattern: demoLoginPassword });
}

const bundleFindings = [];
for (const file of staticFiles) {
  const contents = readFileSync(file, "utf8");
  for (const item of forbidden) {
    const found = typeof item.pattern === "string" ? contents.includes(item.pattern) : item.pattern.test(contents);
    if (found) bundleFindings.push(`${item.label} in ${path.relative(frontendDirectory, file)}`);
  }
}
record(
  "Client bundle secret scan",
  staticFiles.length > 0 && bundleFindings.length === 0,
  bundleFindings.length === 0 ? "no privileged markers found" : bundleFindings.join("; "),
);

try {
  const history = execFileSync(
    "git",
    ["log", "-p", "--all", "--", ".", ":(exclude)frontend/pnpm-lock.yaml"],
    { cwd: repositoryDirectory, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const tokens = [...new Set(history.match(/sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g) ?? [])];
  const unsafe = tokens.filter((token) => {
    if (token.startsWith("sb_secret_")) return true;
    const payload = decodeJwtPayload(token);
    return !payload || payload.iss !== "supabase-demo" || Boolean(payload.ref);
  });
  record(
    "Git history hosted-secret scan",
    unsafe.length === 0,
    unsafe.length > 0
      ? `${unsafe.length} potential hosted credential(s); rotate and purge before publishing`
      : tokens.length > 0
        ? `only ${tokens.length} standard local supabase-demo token(s) found`
        : "no Supabase credential patterns found",
  );
} catch {
  record("Git history hosted-secret scan", false, "unable to inspect Git history");
}

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.message}`);
}

const failures = checks.filter((check) => !check.ok);
console.log(`\nRelease preflight: ${checks.length - failures.length}/${checks.length} checks passed.`);

if (failures.length > 0 && !reportOnly) process.exitCode = 1;
