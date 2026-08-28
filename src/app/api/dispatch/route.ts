import { NextRequest, NextResponse } from "next/server";
import { runAutonomousDispatchAgent } from "@/features/orchestration/agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId parameter" }, { status: 400 });
    }

    const result = await runAutonomousDispatchAgent(requestId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Dispatch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during autonomous dispatch" },
      { status: 500 }
    );
  }
}
