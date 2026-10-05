import { notFound } from "next/navigation";
import { ConversationPreview } from "./preview-client";

export default function Hac37PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ConversationPreview />;
}
