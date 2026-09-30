import type { Metadata } from "next";
import { V2Workspace } from "@/features/v2-workspace/workspace";

export const metadata: Metadata = {
  title: "CargoMesh V2 | ROAD workspace",
  description: "Local V2 ROAD scenario workspace with explicit map provenance and browser-only draft state.",
};

export default function V2WorkspacePage() {
  return <V2Workspace />;
}
