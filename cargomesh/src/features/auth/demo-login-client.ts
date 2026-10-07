export type DemoLoginResult =
  | { ok: true }
  | { ok: false; kind: "unavailable" | "unauthorized" | "recoverable"; message: string };

type DemoLoginResponse = {
  ok?: boolean;
  error?: { code?: string; message?: string };
};

export async function startDemoSession(
  fetcher: typeof fetch = fetch,
): Promise<DemoLoginResult> {
  try {
    const response = await fetcher("/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as DemoLoginResponse;
    if (response.ok && body.ok === true) return { ok: true };
    if (response.status === 403) {
      return { ok: false, kind: "unauthorized", message: "DEMO_MEMBERSHIP_REQUIRED" };
    }
    if (response.status === 503) {
      return { ok: false, kind: "unavailable", message: "DEMO_LOGIN_UNAVAILABLE" };
    }
    return { ok: false, kind: "recoverable", message: body.error?.code ?? "DEMO_LOGIN_FAILED" };
  } catch {
    return { ok: false, kind: "recoverable", message: "DEMO_LOGIN_FAILED" };
  }
}
