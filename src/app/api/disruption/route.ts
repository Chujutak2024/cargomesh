import { NextRequest, NextResponse } from "next/server";
import { simulateAndRecoverDisruption } from "@/features/orchestration/disruption";

export async function POST(req: NextRequest) {
  try {
    const { bookingId, incidentType } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const result = await simulateAndRecoverDisruption(bookingId, incidentType || "BREAKDOWN");

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
