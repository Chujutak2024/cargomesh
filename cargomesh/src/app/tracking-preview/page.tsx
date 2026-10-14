import { notFound } from "next/navigation";
import { TrackingPreview } from "./preview-client";

/** Explicit visual QA only. No business data reads or writes; unavailable in production. */
export default function TrackingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TrackingPreview/>;
}
