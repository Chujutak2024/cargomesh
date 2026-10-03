import { notFound } from "next/navigation";
import { RoadMapPreviewClient } from "./road-map-preview-client";

export const dynamic = "force-dynamic";

/** Local QA surface; this route is unavailable in production builds. */
export default function RoadMapPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RoadMapPreviewClient />;
}
