import process from "node:process";

const rawBaseUrl = process.env.CARGOMESH_RELEASE_URL?.trim();
if (!rawBaseUrl) {
  throw new Error("CARGOMESH_RELEASE_URL is required.");
}

const baseUrl = new URL(rawBaseUrl);
if (baseUrl.protocol !== "https:") {
  throw new Error("CARGOMESH_RELEASE_URL must use HTTPS.");
}

const targets = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  // Exact carrier_services.id values from the public demo registry. Keep these
  // distinct from stable Auth, carrier, and fixture identities.
  {
    name: "provider-andes",
    path: "/providers/andes?serviceId=30000000-0000-0000-0000-000000000001",
  },
  {
    name: "provider-inca",
    path: "/providers/inca?serviceId=30000000-0000-0000-0000-000000000003",
  },
  {
    name: "provider-pacific",
    path: "/providers/pacific?serviceId=30000000-0000-0000-0000-000000000002",
  },
];

for (const target of targets) {
  const url = new URL(target.path, baseUrl);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  const healthy = response.ok && !/Internal Server Error/i.test(body);
  console.log(`${healthy ? "PASS" : "FAIL"}  ${target.name}: HTTP ${response.status} ${url}`);
  if (!healthy) process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("\nPublic HTTP smoke test passed. WebMCP, authentication and Golden Flow still require browser validation.");
}
