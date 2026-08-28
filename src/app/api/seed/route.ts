import { NextResponse } from "next/server";
import { dataStore } from "@/features/freight/store";

export async function POST() {
  dataStore.reset();
  return NextResponse.json({
    success: true,
    message: "CargoMesh dataset reset to deterministic initial seed.",
    counts: {
      requests: dataStore.getFreightRequests().length,
      carriers: dataStore.getCarriers().length,
      bookings: dataStore.getBookings().length,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    organization: dataStore.getOrganization(),
    requests: dataStore.getFreightRequests(),
    carriers: dataStore.getCarriers(),
    bookings: dataStore.getBookings(),
    disruptions: dataStore.getDisruptions(),
  });
}
