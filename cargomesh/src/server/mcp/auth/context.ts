// Lazy server-only imports keep the HTTP boundary testable without mocking Next.
// The domain service still performs its own RLS/resource membership checks.
export async function authenticateMcpSession(): Promise<void> {
  const { requireAuthenticatedMember } = await import("@/server/auth/member");
  await requireAuthenticatedMember();
}
