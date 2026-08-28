import { NextRequest, NextResponse } from "next/server";
import {
  CARGOMESH_WEBMCP_TOOLS,
  executeGetOrganizationContext,
  executeGetFreightRequest,
  executeGetCarrierMetrics,
  executeEvaluateOffers,
} from "@/webmcp/cargomesh-tools";

export async function GET() {
  return NextResponse.json({
    standard: "WebMCP Challenge 2026",
    role: "CargoMesh Orchestration & Decision Engine",
    tools: CARGOMESH_WEBMCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { tool, input } = await req.json();

    switch (tool) {
      case "get_organization_context":
        return NextResponse.json(await executeGetOrganizationContext(input.organization_id));
      case "get_freight_request":
        return NextResponse.json(await executeGetFreightRequest(input.request_id));
      case "get_carrier_metrics":
        return NextResponse.json(await executeGetCarrierMetrics(input.carrier_id));
      case "evaluate_offers":
        return NextResponse.json(await executeEvaluateOffers(input.request_id));
      default:
        return NextResponse.json({ error: `Unknown CargoMesh tool: ${tool}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
