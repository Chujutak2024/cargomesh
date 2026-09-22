import { createMcpTokenHandler } from "@/server/mcp/auth/token-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createMcpTokenHandler();
