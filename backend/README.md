# Legacy scaffold — not the running backend

This directory contains an unused Python scaffold from the initial project plan.
It has no implemented API or services and is not part of the current deployment.
Do not install its requirements to run CargoMesh.

The active backend uses TypeScript/Node.js in
[`frontend/src/server/`](../frontend/src/server/README.md), hosted by the same
Next.js application as the web interface. Database migrations, scenarios and
SQL tests live in [`supabase/`](../supabase/).
