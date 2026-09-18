# D1-02 WebMCP recommendation runtime

This module owns only the CargoMesh-side WebMCP registration and execution
boundary for `get_freight_request_recommendations`.

- C owns the authenticated, organization-scoped endpoint and recommendation algorithm.
- A owns this strict tool contract, response validation, `document.modelContext` execution, and cleanup.
- B owns mounting the invisible host in `/freight-request/new`, presenting suggestions, and applying selected fields only after explicit consent.

The host is intentionally not mounted by this PR:

```tsx
import { FreightRecommendationWebMcpHost } from "@/features/recommendations/freight-recommendation-webmcp-host";

<FreightRecommendationWebMcpHost />
```

B can execute the registered tool without calling its handler directly:

```ts
import { executeFreightRecommendationToolViaWebMcp } from "@/features/recommendations/recommendation-webmcp-runtime";

const result = await executeFreightRecommendationToolViaWebMcp(
  document,
  { freightRequestId, draftVersion },
  abortController.signal,
);
```

Unmounting the host aborts the registration, so `getTools()` no longer exposes
the tool. The runtime never applies fields, persists a draft, queries Supabase
directly, or carries authorization/booking/runtime identities.
