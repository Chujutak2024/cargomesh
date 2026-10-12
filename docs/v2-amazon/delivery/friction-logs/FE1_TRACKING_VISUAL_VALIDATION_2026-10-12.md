# FE-1 tracking visual validation limits — 12 October 2026

- Branch: `codex/v2-full-shipper-flow`, working-tree refinement over `4c5d2e3`.
- Environment: local Next.js application, existing synthetic QA tenant/session.
- Scope: validation limitation, not a backend/data migration request.

## Provider map unavailable

The connected tracking detail has a valid persisted booking → decision → plan → route chain and geometry. The map component nevertheless rendered “Google Maps no está disponible. Los datos de la ruta siguen visibles.”

The precise provider/configuration failure has not been established by this UI review. It must not be labelled an invalid key, a broken route contract or a frontend regression without further evidence. No secret, provider key, hosted infrastructure or Vercel setting was changed.

Mitigation: preserve the geometry provenance, show the provider failure, keep the timeline available, and allow the clearly labelled conceptual 3D scene where the verified route permits it. Do not fabricate a substitute geographic route.

Next verification: the map/provider owner should confirm the approved local provider configuration and rerun the successful map-render case. This refinement does not claim that case passed.

## Dataset and accessibility limits

The connected tenant contains one started execution without position, delivery or incidents. Additional states were validated in an isolated, schema-valid development preview with an explicit synthetic-data banner and no API calls. No fixture fallback was added to operational routes.

The anonymous login redirect was exercised. An authenticated forbidden-user browser case, interactive reduced-motion setting and forced WebGL context loss remain unverified. Unit coverage and code guards do not replace those browser checks.

Full files, commands, screenshots and reproduction steps: [delivery report](../FE1_TRACKING_REFINEMENT_2026-10-12.md).
