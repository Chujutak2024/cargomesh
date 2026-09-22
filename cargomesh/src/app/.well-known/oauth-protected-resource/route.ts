import { createMetadataHandler, protectedResourceMetadata } from "@/server/mcp/auth/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createMetadataHandler(protectedResourceMetadata);
