# Control Tower map failure containment — 22 October 2026

## Reported production failure

The owner supplied a Control Tower screenshot showing a client-side application failure. Its console records both `RefererNotAllowedMapError` and an SDK `getRootNode` exception. The former remains a Google Cloud browser-key authorization problem; no key, referrer or environment configuration is changed by this fix.

The Control Tower map previously continued initialization after an authentication failure during the awaited marker-library import. It also created advanced markers before observing a successful tile load and allowed marker/update/cleanup exceptions to escape its effects.

## Correction

- Each map attempt is invalidated on authentication failure, timeout and unmount. Late library completion cannot create a map after invalidation.
- Markers and route overlays wait for the tile-ready signal. A denied provider does not become a ready map merely because its constructor exists.
- SDK update failures switch only the map to its existing unavailable state. Cleanup is best effort; an isolated React boundary prevents a map exception from replacing the Carrier workspace.
- Map controls and delayed callbacks are scoped to the active instance. The operation list, authorized data and navigation remain independent.
- An explicit retry after an authentication failure reloads the page so it can observe a corrected provider configuration. It does not grant access or rotate keys.

## Evidence and boundaries

Five tests execute the actual component with inert SDK and DOM adapters: auth failure during library loading, unmount during loading, successful tile readiness, injected `getRootNode` failure, timeout and failing cleanup. They use no browser, Google request, business command or visual inspection. TypeScript/architecture and PR CI validate the delivered SHA separately.

This change is confined to `carrier-control-tower/google-operation-map.tsx`. Ramón's PR151 owns the shared schematic renderer and Maps loader changes; those files are not modified here. Production authorization for `https://cargomesh.vercel.app` remains the key administrator's responsibility. The owner performs visual acceptance.
