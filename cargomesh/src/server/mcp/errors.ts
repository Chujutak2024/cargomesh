
export function publicMcpError(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("UNAUTHENTICATED:")) {
    return { code: "UNAUTHENTICATED", message: "A CargoMesh session is required." };
  }
  if (message.startsWith("FORBIDDEN:")) {
    return { code: "FORBIDDEN", message: "Access to this resource is not permitted." };
  }
  return { code: "AUTHENTICATION_FAILED", message: "Unable to authenticate the CargoMesh request." };
}
