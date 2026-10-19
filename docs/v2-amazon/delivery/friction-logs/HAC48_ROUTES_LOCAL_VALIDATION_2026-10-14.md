# HAC-48 — Local road validation friction

Date: 2026-10-14. Branch: `codex/unified-workspaces-demo-boundary`.

## Separate server credential missing

The inspected local private configuration contains the browser Google Maps key, but no `GOOGLE_ROUTES_API_KEY`; the shell also has no Routes key. The user referred back to the supplied Markdown. The original `CargoMesh-mapa-misma-clave.zip` was inspected without printing its key: `google-maps.env` contains only the browser variable, and LEEME explicitly excludes Routes credentials and limits the key to Maps JavaScript. Basemap rendering at 3090 was verified. This does not authorize or prove Routes API access. City-to-city live route validation is blocked. The lab reports `SERVER_KEY_MISSING` with no replacement geometry. No key was requested in chat or reused across API purposes.

## Dependency junction and package-manager auto-install

Running pnpm scripts triggered a dependency freshness/install check. pnpm refused to remove node_modules because its resolved target is the existing reference checkout, outside the unified app. No directory was removed and no dependency was installed. Verification used the equivalent underlying Node commands against already installed tools: tests, TypeScript and architecture checker passed. Do not override pnpm's unsafe-modules protection or reinstall through this junction.

## Preview port collision

8080 was occupied when the lab launcher attempted to bind. The failed lab process was stopped only after verifying its helper path. The existing 8080 server was preserved. The lab was started on the previously authorized and available 3090 origin. Both previews initially used the unified checkout's `.next`, causing intermittent manifest/404 failures. The lab launcher now uses the separate `.next/road-routing-lab` output through its local Next configuration. This origin must match its server configuration and existing browser-key restrictions. No Google Cloud restriction or deployment setting was changed. Concurrent navigation edits belonging to the other chat are preserved and excluded from the routing delivery.

## Acceptance limits

No real route, commercial truck permission, navigation readiness or independent human validation was certified. Unit-provider fixtures are synthetic and kept solely in tests. See `../HAC48_GOOGLE_ROAD_ROUTING.md` for scenario matrix, sources and reproduction commands.
