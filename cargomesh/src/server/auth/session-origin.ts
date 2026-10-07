/** Cookie session mutations require a same-origin browser request. */
export function hasSessionOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host");
  if (!host || host === url.host) return origin === url.origin;
  // Next normalizes a loopback Request.url to localhost. Accept only the same port.
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  try {
    const authority = new URL(`${url.protocol}//${host}`);
    return loopback.has(url.hostname) && loopback.has(authority.hostname)
      && authority.host === host && authority.port === url.port && origin === authority.origin;
  } catch { return false; }
}
