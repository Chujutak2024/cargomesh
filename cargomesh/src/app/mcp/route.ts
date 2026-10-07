import { createMcpHttpHandler } from "@/server/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createMcpHttpHandler();
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
