import { NextRequest, NextResponse } from "next/server";
import {
  PROVIDER_WEBMCP_TOOLS,
  executeCheckCapacity,
  executeCheckServiceCoverage,
  executeQuoteFreight,
  executeBookFreight,
  executeGetBookingStatus,
} from "@/webmcp/provider-tools";

export async function GET() {
  return NextResponse.json({
    standard: "WebMCP Challenge 2026",
    role: "Logistics Carrier Capabilities",
    tools: PROVIDER_WEBMCP_TOOLS.map((t) => ({
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
      case "check_service_coverage":
        return NextResponse.json(await executeCheckServiceCoverage(input));
      case "check_capacity":
        return NextResponse.json(await executeCheckCapacity(input));
      case "quote_freight":
        return NextResponse.json(await executeQuoteFreight(input));
      case "book_freight":
        return NextResponse.json(await executeBookFreight(input));
      case "get_booking_status":
        return NextResponse.json(await executeGetBookingStatus(input.booking_id));
      default:
        return NextResponse.json({ error: `Unknown provider WebMCP tool: ${tool}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
