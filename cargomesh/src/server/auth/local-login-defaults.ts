/** Local demo convenience only. Credentials are never bundled into browser code. */
export function createLocalLoginDefaultsHandler(config: {
  enabled: boolean; production: boolean; scenario?: boolean; email?: string; password?: string; clientEmail?: string; clientPassword?: string;
}) {
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: {
    "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Vary": "Origin, Referer, Sec-Fetch-Site",
  } });
  return async (request: Request) => {
    const url = new URL(request.url), host = request.headers.get("host");
    const hostname = host?.split(":")[0];
    if (!config.enabled || config.production || url.protocol !== "http:"
      || !["127.0.0.1", "localhost"].includes(hostname ?? "") || !(host?.endsWith(":8080") || config.scenario && host?.endsWith(":8083"))) return json({ ok: false }, 404);
    let referrer: URL;
    try { referrer = new URL(request.headers.get("referer") ?? ""); } catch { return json({ ok: false }, 403); }
    const origin = `http://${host}`;
    if (request.method !== "GET" || referrer.origin !== origin || referrer.pathname !== "/login"
      || request.headers.get("sec-fetch-site") !== "same-origin"
      || (request.headers.has("origin") && request.headers.get("origin") !== origin)) return json({ ok: false }, 403);
    const client=referrer.searchParams.get('returnTo')==='/clients';
    const email=client?config.clientEmail:config.email,password=client?config.clientPassword:config.password;
    if (!email || !password) return json({ ok: false }, 503);
    return json({ email, password });
  };
}
