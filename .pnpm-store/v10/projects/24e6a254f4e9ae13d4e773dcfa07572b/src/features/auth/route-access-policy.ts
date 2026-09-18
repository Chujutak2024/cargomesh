export type ActiveMemberResolver<Member> = () => Promise<Member>;
export type RouteRedirect = (destination: string) => never;

function isAccessDenied(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.startsWith("UNAUTHENTICATED:") || error.message.startsWith("FORBIDDEN:"))
  );
}

export async function requireActiveMemberForOperationalRoute<Member>(
  resolveActiveMember: ActiveMemberResolver<Member>,
  redirectTo: RouteRedirect,
): Promise<Member> {
  try {
    return await resolveActiveMember();
  } catch (error) {
    if (!isAccessDenied(error)) throw error;
    return redirectTo("/login");
  }
}

export async function redirectActiveMemberFromLogin<Member>(
  resolveActiveMember: ActiveMemberResolver<Member>,
  redirectTo: RouteRedirect,
): Promise<void> {
  try {
    await resolveActiveMember();
  } catch (error) {
    if (!isAccessDenied(error)) throw error;
    return;
  }

  redirectTo("/dashboard");
}
