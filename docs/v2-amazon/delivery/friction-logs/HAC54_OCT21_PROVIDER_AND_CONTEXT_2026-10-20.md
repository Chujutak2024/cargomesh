# HAC-54 — local provider/context blockers, October 20

Scope: local-only October 21 preparation, approved main `f17fdc6` synchronized through `742ea70`. Full [evidence and reproduction](../HAC54_OCT21_PREPARATION_2026-10-20.md).

## Google Maps restriction

The configured browser key loads Google's script but Google reports `RefererNotAllowedMapError` for localhost. The user has no Google Cloud access. A key administrator must allow `http://localhost:3000/*`, preserve restrictions and reload/retest. No key/billing/project/permissions were changed remotely and no secret was committed. The unavailable-provider state is truthful; successful basemap recovery remains blocked, not PASS. The 3D scene is conceptual and not a workaround for real map/GPS data.

## Shared Client context vs historical QA bank

Cookie-authenticated `GET /api/v2/client-context?limit=25&offset=0` returns 400 `VALIDATION_ERROR` on `value.defaultCurrency`. Historical QA A organization metadata is PEN; the current Organization V2 schema requires USD. A current-version `organization.revise` proposal for that exact synthetic organization returns 403 `FORBIDDEN_TENANT`: its only active synthetic member is SUPERVISOR, while the native confirmation contract requires OWNER. No proposal was persisted, role was granted, SQL repair was forced or schema was relaxed.

The independent intake options, Facilities list, DRAFT POST/replay/GET, cargo-readiness and commercial refresh remain usable. The seam runner explicitly prints the context blocker and exits 2, never disguising it as a successful integrated response. Resolution belongs to a coordinated authorized-owner / base-data correction with HAC-52; no silent edit to Jean's seed. It is unrelated to Google or Carrier quote prices.

## Dated native command constraints

The first October 21 preparation attempt used quote expiry as opportunity deadline and native creation rejected `INVALID_RESPONSE_DEADLINE` (400). A later hold attempt similarly returned `HOLD_EVIDENCE_OR_EXPIRY_INVALID` (400). The test recipe now uses response deadline within pickup and hold expiry within assignment; it does not weaken native guards. Same action keys/records were replayed after correcting previously rejected commands. New future execution events are deferred until the assignment opens. No reset, deletion or historical redating occurred.

Human CP validation and final authorized integration remain pending; none of these technical checks close HAC-54.
