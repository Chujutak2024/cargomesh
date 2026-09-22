import { authorizationServerMetadata, createMetadataHandler } from "@/server/mcp/auth/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createMetadataHandler(authorizationServerMetadata);
