# HAC-48 — Local Routes egress and legacy smoke mismatch

Date: 2026-10-17 (America/Lima). Scope: local validation only.

## IPv4 allowlist versus IPv6 transport

The supplied server credential had the coordinator's public IPv4 authorized. Node's default connection selected IPv6. Google returned HTTP 403 / `API_KEY_IP_ADDRESS_BLOCKED`, and safe error metadata identified the IPv6 source. An IPv4-only IP lookup had correctly shown the authorized IPv4 but did not establish which family a Google connection would use.

Resolution: process-scoped `node --dns-result-order=ipv4first scripts/dev-local.mjs`. The direct access probe and five application city-pair queries then returned HTTP 200. No allowlist expansion, global network change or restriction removal was needed. Future restarts must retain this flag while this local credential is IPv4-restricted. Vercel egress remains a separate deployment concern.

## Legacy UI smoke

The previous smoke asserts the lab title at `/carrier-route-lab` without a session. Navigation now redirects that URL into the Carrier workspace, whose existing session gate returns the sign-in screen. The assertion failed before its API checks. It was not suppressed or represented as green; dedicated backend checks passed separately. Authenticated visual verification and updating the UI smoke remain pending with the front work.

See [live validation](../HAC48_LIVE_ROAD_VALIDATION_2026-10-17.md) for scope, metrics and reproduction. No credentials, full provider bodies or stored geometry are included.
