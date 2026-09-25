# CargoMesh WebMCP Demo Console Runbook

Status: verified read-only presentation sequence

Public origin: `https://cargomesh.vercel.app`

Verified on: 2026-09-03 against `origin/main@5a94821`

This runbook complements the complete
[judge audit guide](./WebMCP_Judge_Audit_Guide.md). It deliberately executes
only the read-only provider tools. Booking must continue through the CargoMesh
UI and its server-generated authorization context; do not manufacture a
`book_freight` payload in DevTools.

## 1. Preconditions

1. Use a WebMCP-compatible browser with WebMCP enabled.
2. Sign in to CargoMesh with an ACTIVE demo membership.
3. Reset and load the canonical `FR-1042` case before the Golden Flow.
4. Never paste cookies, tokens, passwords, or `service_role` credentials into
   the console or evidence.

The provider routes used by the current live demo share the CargoMesh Vercel
origin. They prove native `document.modelContext` discovery and execution, but
must not be described as independently hosted partner domains.

## 2. Discover the five Andes provider tools

Open:

`https://cargomesh.vercel.app/providers/andes?serviceId=30000000-0000-0000-0000-000000000001`

Run in DevTools:

```js
await (async () => {
  const expected = [
    "check_service_coverage",
    "check_capacity",
    "quote_freight",
    "book_freight",
    "get_provider_booking_status",
  ];
  const mc = document.modelContext;
  if (!mc) throw new Error("WebMCP is unavailable in this document.");

  const tools = await mc.getTools();
  const providerTools = tools.filter((tool) => expected.includes(tool.name));
  console.table(providerTools.map(({ name, title, description, origin }) => ({
    name,
    title,
    description,
    origin,
  })));
  if (providerTools.length !== expected.length) {
    throw new Error(`Expected 5 provider tools; found ${providerTools.length}.`);
  }
  return providerTools;
})();
```

Expected names: `check_service_coverage`, `check_capacity`, `quote_freight`,
`book_freight`, and `get_provider_booking_status`.

## 3. Execute coverage, capacity, and quote from canonical server data

Stay on the Andes page. The following block loads the current intake and
execution intent first, so it does not hardcode the database UUID,
`draftVersion`, totals, or scheduled dates:

```js
await (async () => {
  const requestCode = "FR-1042";
  const mc = document.modelContext;
  if (!mc) throw new Error("WebMCP is unavailable in this document.");

  const intakeResponse = await fetch(
    `/api/freight-requests/intake/${encodeURIComponent(requestCode)}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  const intakeBody = await intakeResponse.json();
  if (!intakeResponse.ok || !intakeBody.ok) {
    throw new Error(`Unable to load intake: ${JSON.stringify(intakeBody)}`);
  }
  const intake = intakeBody.data;

  const intentResponse = await fetch(
    `/api/freight-requests/${encodeURIComponent(intake.freightRequestId)}/execution-intent`,
    { cache: "no-store", credentials: "same-origin" },
  );
  const intentBody = await intentResponse.json();
  if (!intentResponse.ok || !intentBody.ok) {
    throw new Error(`Unable to load execution intent: ${JSON.stringify(intentBody)}`);
  }
  const intent = intentBody.data;

  const tools = await mc.getTools();
  const execute = async (name, input) => {
    const tool = tools.find((item) => item.name === name);
    if (!tool) throw new Error(`Tool not registered: ${name}`);
    const raw = await mc.executeTool(tool, JSON.stringify(input));
    return raw === null ? null : JSON.parse(raw);
  };

  const schedule = {
    pickup_mode: intent.pickupMode,
    ...(intent.pickupWindowStart
      ? { pickup_window_start: intent.pickupWindowStart }
      : {}),
    ...(intent.pickupWindowEnd
      ? { pickup_window_end: intent.pickupWindowEnd }
      : {}),
    ...(intent.deliveryDeadline
      ? { delivery_deadline: intent.deliveryDeadline }
      : {}),
  };

  const common = {
    origin: intake.route.origin,
    destination: intake.route.destination,
    cargo_weight_kg: intake.cargo.totalWeightKg,
    ...(intake.cargo.totalVolumeM3
      ? { cargo_volume_m3: intake.cargo.totalVolumeM3 }
      : {}),
    cargo_category: intake.cargo.categoryCode,
  };

  const coverage = await execute("check_service_coverage", {
    origin: common.origin,
    destination: common.destination,
    transport_mode: intake.execution.transportMode,
    service_type: intake.execution.serviceType,
    cargo_category: common.cargo_category,
  });

  const capacity = await execute("check_capacity", {
    ...common,
    ...schedule,
  });

  const quote = await execute("quote_freight", {
    freight_request_id: intake.freightRequestId,
    ...common,
    ...schedule,
    available_documents: intake.execution.availableDocuments,
  });

  console.table([
    {
      tool: "check_service_coverage",
      commercialResult: coverage?.data?.supported,
      providerServiceCode: coverage?.data?.providerServiceCode,
    },
    {
      tool: "check_capacity",
      commercialResult: capacity?.data?.available,
      availabilityClass: capacity?.data?.availabilityClass,
    },
    {
      tool: "quote_freight",
      price: quote?.data?.price,
      currency: quote?.data?.currency,
      transitHours: quote?.data?.transitHours,
      validUntil: quote?.data?.validUntil,
    },
  ]);
  return { intake, intent, coverage, capacity, quote };
})();
```

For the reproducible Andes fixture, the quote is USD 1,760 with 31 transit
hours and `AVAILABLE_IN_WINDOW`. The `priceBreakdown` represents line haul,
handling, and customs coordination; it is not a customs-duty or tax estimate.
The quote is valid for six hours from its execution clock and does not create a
booking or persist a CarrierOffer by itself.

## 4. Compare Inca with the same canonical request

Open:

`https://cargomesh.vercel.app/providers/inca?serviceId=30000000-0000-0000-0000-000000000003`

Run the complete block from section 3 again. Full-document navigation creates
a new WebMCP context, so always rediscover the tool object with `getTools()`.

Expected reproducible quote:

| Provider | Price | Transit | Availability |
|---|---:|---:|---|
| Andes Freight | USD 1,760 | 31 h | `AVAILABLE_IN_WINDOW` |
| Inca Logistics | USD 1,920 | 29 h | `AVAILABLE_IN_WINDOW` |

These are declared technical-demo fixtures, not live market prices.

## 5. Query the separate intake recommendation tool

Open the authenticated intake page:

`https://cargomesh.vercel.app/freight-request/new?requestCode=FR-1042`

Run:

```js
await (async () => {
  const response = await fetch("/api/freight-requests/intake/FR-1042", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    throw new Error(`Unable to load intake: ${JSON.stringify(body)}`);
  }

  const { freightRequestId, draftVersion } = body.data;
  const mc = document.modelContext;
  if (!mc) throw new Error("WebMCP is unavailable in this document.");
  const tools = await mc.getTools();
  const tool = tools.find(
    (item) => item.name === "get_freight_request_recommendations",
  );
  if (!tool) throw new Error("Recommendation tool is not registered.");

  const raw = await mc.executeTool(
    tool,
    JSON.stringify({ freightRequestId, draftVersion }),
  );
  const result = raw === null ? null : JSON.parse(raw);
  console.log({ freightRequestId, draftVersion, result });
  return result;
})();
```

This is a separate, read-only intake tool. It is not a sixth provider tool and
does not apply a recommendation automatically.

## 6. Verify provider cleanup

Navigate to `https://cargomesh.vercel.app/` and run:

```js
await (async () => {
  const providerToolNames = new Set([
    "check_service_coverage",
    "check_capacity",
    "quote_freight",
    "book_freight",
    "get_provider_booking_status",
  ]);
  const tools = await document.modelContext?.getTools?.() ?? [];
  const remainingProviderTools = tools
    .map((tool) => tool.name)
    .filter((name) => providerToolNames.has(name));
  console.log({ remainingProviderTools });
  return remainingProviderTools;
})();
```

Expected result:

```json
{ "remainingProviderTools": [] }
```

Filter the five provider names instead of asserting that every future
CargoMesh document must expose zero tools.

## 7. Corrections to avoid during the presentation

- Do not pass `{ name: "tool_name" }` to `executeTool`; use the actual
  `RegisteredTool` returned by `getTools()`.
- Provider tools use their documented `snake_case` inputs. Coverage locations
  are strings, not `{ countryCode, city }` objects.
- `check_capacity` does not accept `packageCount` or a structured
  `specialRequirements` object.
- `quote_freight` uses `freight_request_id`, not `requestCode`.
- Do not freeze `draftVersion: 1`; read the current version from the intake
  response to avoid `STALE_DRAFT`.
- Cleanup concerns the five abandoned provider tools. A different CargoMesh
  page may legitimately expose its own tools in the future.
