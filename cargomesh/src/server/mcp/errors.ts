import { OrchestrationError } from "@/features/orchestration/contracts";

export function publicMcpError(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) {
    return { code: "UNAUTHENTICATED", message: "A CargoMesh session is required." };
  }
  if (message.startsWith("FORBIDDEN:") ||
      (error instanceof OrchestrationError && error.code === "FORBIDDEN")) {
    return { code: "FORBIDDEN", message: "Access to this resource is not permitted." };
  }
  if (error instanceof OrchestrationError && error.code === "NOT_FOUND") {
    return { code: "NOT_FOUND", message: "Orchestration run not found." };
  }
  return { code: "ORCHESTRATION_VIEW_MODEL_FAILED", message: "Unable to read persisted freight options." };
}
