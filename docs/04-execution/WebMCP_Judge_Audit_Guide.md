# CargoMesh WebMCP Judge Audit Guide

Status: REL-02 technical evidence package  

Runtime audited against: `origin/main@ff5b9d8`; public read-only WebMCP
revalidation completed on 2026-09-03.

Audience: WebMCP Challenge judges, technical reviewers, and demo operators

For a short, copy-paste-safe presentation sequence, use the
[WebMCP demo console runbook](./WebMCP_Demo_Console_Runbook.md). It reads the
current request identity, version, totals, and execution window from the
authenticated server response instead of freezing them in presentation code.

## 1. What this guide proves

CargoMesh discovers a variable collection of `0..N` registered carrier services. For each discovered candidate it preserves the exact `providerUrl` and `matchingServiceId`, opens the provider document, and invokes the provider tools through the browser-native `document.modelContext` API.

Andes Freight, Inca Logistics, and Pacific Cargo are reproducible Golden Flow fixtures. They are not a closed carrier list in discovery, orchestration, persistence, or ranking code.

This guide covers the five tools hosted by a provider portal:

1. `check_service_coverage`;
2. `check_capacity`;
3. `quote_freight`;
4. `book_freight`;
5. `get_provider_booking_status`.

The CargoMesh intake tool `get_freight_request_recommendations` is a separate read-only tool hosted by the CargoMesh intake page. It is intentionally outside this provider-tool audit.

## 2. Security and evidence boundaries

- A provider page is resolved by `carrierSlug + matchingServiceId`, not by slug alone.
- A valid URL has the form `/providers/<carrierSlug>?serviceId=<matchingServiceId>`.
- `/providers/andes`, `/providers/inca`, or `/providers/pacific` without `serviceId` returns `404` intentionally.
- The service must exist, be active, belong to the carrier in the URL, and have a non-null `provider_service_code`.
- Cross-origin tools use an explicit `exposedTo` allowlist containing the exact CargoMesh origin. Wildcards are rejected.
- `service_role`, authentication cookies, access tokens, private keys, and authorization payloads must never appear in screenshots or console exports.
- Direct DevTools calls prove the WebMCP contract. A booking is part of the CargoMesh business flow only after server-side authorization and Booking Bridge persistence.
- The fixture control `ACCEPT | REJECT | NO_RESPONSE` is test-side/provider-side control. It is not a public WebMCP tool and must not be presented as one.

Canonical local demo service identities are shown below. In a deployed run, use the `matchingServiceId` returned by the actual discovery snapshot instead of copying an ID from this table.

| Fixture | Provider path | Canonical local service ID | Provider service code |
|---|---|---|---|
| Andes Freight | `/providers/andes` | `d0000000-0000-0000-0000-000000000001` | `ANDES-PECL-FTL` |
| Inca Logistics | `/providers/inca` | `d0000000-0000-0000-0000-000000000002` | `INCA-PECL-FTL` |
| Pacific Cargo | `/providers/pacific` | `d0000000-0000-0000-0000-000000000003` | `PACIFIC-PECL-FTL` |

## 3. Browser audit procedure

### 3.1 Prerequisites

1. Use a browser build that exposes WebMCP.
2. Enable the browser's WebMCP testing feature if the browser requires it.
3. Open the deployed CargoMesh origin or `http://localhost:3000` for a local audit.
4. Obtain a candidate from the real discovery snapshot and retain its `providerUrl` and `matchingServiceId`.
5. Build the navigation URL without changing the service identity:

```text
<providerUrl>?serviceId=<matchingServiceId>
```

For the canonical local seed, an Andes example is:

```text
http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001
```

### 3.2 Inspect the registered tools

Open the provider URL, wait until the page reports that all five tools are registered, open DevTools, and run:

```js
const mc = document.modelContext;
if (!mc) throw new Error("WebMCP is unavailable in this browser document.");

const tools = await mc.getTools();
const providerToolNames = [
  "check_service_coverage",
  "check_capacity",
  "quote_freight",
  "book_freight",
  "get_provider_booking_status",
];

const providerTools = tools.filter((tool) =>
  providerToolNames.includes(tool.name),
);

console.table(providerTools.map(({ name, title, description, origin }) => ({
  name,
  title,
  description,
  origin,
})));
```

Expected result: exactly the five provider tool names above. The `origin` must match the active registered provider origin.

### 3.3 Execute a tool through WebMCP

Use the `RegisteredTool` object returned by `getTools()`. Do not call an internal TypeScript handler directly.

```js
async function executeProviderTool(name, input) {
  const currentTools = await document.modelContext.getTools();
  const tool = currentTools.find((item) => item.name === name);
  if (!tool) throw new Error(`Tool not registered: ${name}`);

  const raw = await document.modelContext.executeTool(
    tool,
    JSON.stringify(input),
  );

  return raw === null ? null : JSON.parse(raw);
}
```

Example:

```js
await executeProviderTool("check_service_coverage", {
  origin: "Callao, Peru",
  destination: "Santiago, Chile",
  transport_mode: "ROAD",
  service_type: "FTL",
  cargo_category: "machinery",
});
```

### 3.4 Verify cleanup

Leave the provider page by navigating to the CargoMesh root. After the new document loads, run:

```js
const remaining = (await document.modelContext?.getTools?.() ?? [])
  .map((tool) => tool.name)
  .filter((name) => [
    "check_service_coverage",
    "check_capacity",
    "quote_freight",
    "book_freight",
    "get_provider_booking_status",
  ].includes(name));

console.log({ remainingProviderTools: remaining });
```

Expected result:

```json
{ "remainingProviderTools": [] }
```

Other future CargoMesh tools may remain registered on their own pages. Cleanup passes when the five tools belonging to the abandoned provider document are absent.

## 4. Common output envelope

Every provider tool returns one of these two closed shapes. The success `data` schema is tool-specific and documented in the following sections.

```json
{
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "ok": { "const": true },
        "data": { "type": "object" }
      },
      "required": ["ok", "data"]
    },
    {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "ok": { "const": false },
        "error": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "code": { "type": "string" },
            "message": { "type": "string" },
            "retryable": { "type": "boolean" }
          },
          "required": ["code", "message", "retryable"]
        }
      },
      "required": ["ok", "error"]
    }
  ]
}
```

Malformed inputs return `ok:false` with `error.code = "INVALID_INPUT"`. Commercial coverage or capacity rejection is normally a successful tool execution with `ok:true` and `supported:false` or `available:false`; it is not fabricated into a technical exception.

## 5. Exact provider tool schemas

### 5.1 `check_service_coverage`

Annotation: `readOnlyHint: true`.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "origin": { "type": "string", "minLength": 2 },
    "destination": { "type": "string", "minLength": 2 },
    "transport_mode": { "type": "string", "minLength": 1 },
    "service_type": { "type": "string", "minLength": 1 },
    "cargo_category": { "type": "string", "minLength": 1 }
  },
  "required": [
    "origin",
    "destination",
    "transport_mode",
    "service_type",
    "cargo_category"
  ]
}
```

Success `data` schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "providerServiceCode": { "type": "string" },
    "supported": { "type": "boolean" },
    "crossBorderSupported": { "type": "boolean" },
    "corridor": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "origin": { "type": "string" },
        "destination": { "type": "string" }
      },
      "required": ["origin", "destination"]
    },
    "customsCoordinationAvailable": { "type": "boolean" },
    "serviceNotes": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": [
    "schemaVersion",
    "providerServiceCode",
    "supported",
    "crossBorderSupported",
    "corridor",
    "customsCoordinationAvailable",
    "serviceNotes"
  ]
}
```

### 5.2 `check_capacity`

Annotation: `readOnlyHint: true`.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "origin": { "type": "string", "minLength": 2 },
    "destination": { "type": "string", "minLength": 2 },
    "cargo_weight_kg": { "type": "number", "exclusiveMinimum": 0 },
    "cargo_volume_m3": { "type": "number", "exclusiveMinimum": 0 },
    "cargo_category": { "type": "string", "minLength": 1 },
    "pickup_mode": { "type": "string", "enum": ["ASAP", "SCHEDULED"] },
    "pickup_window_start": { "type": "string", "format": "date-time" },
    "pickup_window_end": { "type": "string", "format": "date-time" },
    "delivery_deadline": { "type": "string", "format": "date-time" },
    "special_requirements": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    }
  },
  "required": [
    "origin",
    "destination",
    "cargo_weight_kg",
    "cargo_category",
    "pickup_mode"
  ]
}
```

Runtime refinements: `SCHEDULED` requires both pickup window fields; the end must be later than the start; the delivery deadline must be later than pickup; requirements must be non-empty and unique after normalization.

Success `data` schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "providerServiceCode": { "type": "string" },
    "available": { "type": "boolean" },
    "availabilityClass": {
      "type": "string",
      "enum": [
        "EXACT_CONFIRMED_SLOT",
        "AVAILABLE_IN_WINDOW",
        "LIMITED_WINDOW",
        "WAITLIST",
        "UNAVAILABLE"
      ]
    },
    "availableCapacityKg": { "type": "number" },
    "availableVolumeM3": { "type": ["number", "null"] },
    "earliestPickup": { "type": ["string", "null"], "format": "date-time" },
    "requestedWindowAvailable": { "type": "boolean" },
    "reportedVehicleType": { "type": ["string", "null"] },
    "estimatedDelivery": { "type": ["string", "null"], "format": "date-time" },
    "capabilityNotes": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": [
    "schemaVersion",
    "providerServiceCode",
    "available",
    "availabilityClass",
    "availableCapacityKg",
    "availableVolumeM3",
    "earliestPickup",
    "requestedWindowAvailable",
    "reportedVehicleType",
    "estimatedDelivery",
    "capabilityNotes"
  ]
}
```

### 5.3 `quote_freight`

Annotation: `readOnlyHint: true`. A quote does not create a booking.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "freight_request_id": { "type": "string", "minLength": 1 },
    "origin": { "type": "string", "minLength": 2 },
    "destination": { "type": "string", "minLength": 2 },
    "cargo_weight_kg": { "type": "number", "exclusiveMinimum": 0 },
    "cargo_volume_m3": { "type": "number", "exclusiveMinimum": 0 },
    "cargo_category": { "type": "string", "minLength": 1 },
    "pickup_mode": { "type": "string", "enum": ["ASAP", "SCHEDULED"] },
    "pickup_window_start": { "type": "string", "format": "date-time" },
    "pickup_window_end": { "type": "string", "format": "date-time" },
    "delivery_deadline": { "type": "string", "format": "date-time" },
    "available_documents": {
      "type": "array",
      "items": { "type": "string", "minLength": 1 },
      "uniqueItems": true
    }
  },
  "required": [
    "freight_request_id",
    "origin",
    "destination",
    "cargo_weight_kg"
  ]
}
```

Runtime refinement: when `pickup_mode` is `SCHEDULED`, both pickup window fields are required and ordered.

Success `data` schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "freightRequestId": { "type": "string" },
    "providerOfferReference": { "type": "string" },
    "price": { "type": "number" },
    "currency": { "const": "USD" },
    "priceBreakdown": {
      "type": "object",
      "additionalProperties": { "type": "number" }
    },
    "estimatedPickup": { "type": "string", "format": "date-time" },
    "estimatedDelivery": { "type": "string", "format": "date-time" },
    "transitHours": { "type": "number" },
    "availableCapacityKg": { "type": "number" },
    "availabilityClass": {
      "type": "string",
      "enum": [
        "EXACT_CONFIRMED_SLOT",
        "AVAILABLE_IN_WINDOW",
        "LIMITED_WINDOW",
        "WAITLIST",
        "UNAVAILABLE"
      ]
    },
    "crossBorderSupported": { "type": "boolean" },
    "customsCoordinationIncluded": { "type": "boolean" },
    "requiredDocuments": {
      "type": "array",
      "items": { "type": "string" }
    },
    "borderHandlingNotes": { "type": ["string", "null"] },
    "validUntil": { "type": "string", "format": "date-time" }
  },
  "required": [
    "schemaVersion",
    "freightRequestId",
    "providerOfferReference",
    "price",
    "currency",
    "priceBreakdown",
    "estimatedPickup",
    "estimatedDelivery",
    "transitHours",
    "availableCapacityKg",
    "availabilityClass",
    "crossBorderSupported",
    "customsCoordinationIncluded",
    "requiredDocuments",
    "borderHandlingNotes",
    "validUntil"
  ]
}
```

### 5.4 `book_freight`

Annotation: `readOnlyHint: false`.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "freight_request_id": { "type": "string", "minLength": 1 },
    "provider_offer_reference": { "type": "string", "minLength": 1 },
    "idempotency_key": { "type": "string", "minLength": 1 },
    "authorization_context": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "authorization_reference": { "type": "string", "minLength": 1 },
        "authorized_by": {
          "type": "string",
          "enum": ["HUMAN_SELECTION", "AUTO_BOOKING_POLICY"]
        }
      },
      "required": ["authorization_reference", "authorized_by"]
    },
    "selection_mode": {
      "type": "string",
      "enum": ["ASSISTED", "SMART_AUTO"]
    }
  },
  "required": [
    "freight_request_id",
    "provider_offer_reference",
    "idempotency_key",
    "authorization_context",
    "selection_mode"
  ]
}
```

Runtime refinements:

- `HUMAN_SELECTION` pairs only with `ASSISTED`;
- `AUTO_BOOKING_POLICY` pairs only with `SMART_AUTO`;
- `authorization_reference` must be generated and validated server-side in the real CargoMesh flow;
- replaying the same idempotency key with the same payload returns the same provider reference;
- replaying the key with a different payload returns `IDEMPOTENCY_CONFLICT`.

Success `data` schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "freightRequestId": { "type": "string" },
    "providerOfferReference": { "type": "string" },
    "providerReference": { "type": "string" },
    "providerBookingStatus": { "const": "PENDING_PROVIDER_CONFIRMATION" },
    "providerResponseDeadline": { "type": "string", "format": "date-time" },
    "paymentRequired": { "type": "boolean" },
    "paymentUrl": { "type": ["string", "null"] },
    "idempotentReplay": { "type": "boolean" }
  },
  "required": [
    "schemaVersion",
    "freightRequestId",
    "providerOfferReference",
    "providerReference",
    "providerBookingStatus",
    "providerResponseDeadline",
    "paymentRequired",
    "paymentUrl",
    "idempotentReplay"
  ]
}
```

### 5.5 `get_provider_booking_status`

Annotation: `readOnlyHint: true`.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "provider_reference": { "type": "string", "minLength": 1 }
  },
  "required": ["provider_reference"]
}
```

Success `data` schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "providerReference": { "type": "string" },
    "providerBookingStatus": {
      "type": "string",
      "enum": [
        "PENDING_PROVIDER_CONFIRMATION",
        "CONFIRMED",
        "REJECTED",
        "EXPIRED",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED"
      ]
    },
    "providerStatusReason": { "type": ["string", "null"] },
    "currentLocation": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "countryCode": { "type": "string" },
            "city": { "type": "string" }
          },
          "required": ["countryCode", "city"]
        }
      ]
    },
    "updatedEta": { "type": ["string", "null"], "format": "date-time" },
    "providerResponseDeadline": { "type": "string", "format": "date-time" },
    "paymentStatus": {
      "type": "string",
      "enum": ["NOT_REQUIRED", "PENDING", "PAID", "FAILED", "REFUNDED"]
    },
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "providerEventId": { "type": "string" },
          "eventType": { "type": "string" },
          "providerBookingStatus": {
            "type": "string",
            "enum": [
              "PENDING_PROVIDER_CONFIRMATION",
              "CONFIRMED",
              "REJECTED",
              "EXPIRED",
              "IN_TRANSIT",
              "DELIVERED",
              "CANCELLED"
            ]
          },
          "occurredAt": { "type": "string", "format": "date-time" },
          "location": {
            "oneOf": [
              { "type": "null" },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "countryCode": { "type": "string" },
                  "city": { "type": "string" }
                },
                "required": ["countryCode", "city"]
              }
            ]
          },
          "description": { "type": "string" }
        },
        "required": [
          "providerEventId",
          "eventType",
          "providerBookingStatus",
          "occurredAt",
          "location",
          "description"
        ]
      }
    }
  },
  "required": [
    "schemaVersion",
    "providerReference",
    "providerBookingStatus",
    "providerStatusReason",
    "currentLocation",
    "updatedEta",
    "providerResponseDeadline",
    "paymentStatus",
    "events"
  ]
}
```

## 6. Golden Flow evidence: FR-1042

### 6.1 Causality

1. Reset leaves FR-1042 in its controlled pre-orchestration state and removes only its runtime records.
2. Authenticated discovery returns `0..N` candidates. In the canonical fixture it returns Andes, Inca, and Pacific with exact service IDs.
3. For each candidate, CargoMesh opens the exact provider URL and invokes coverage, capacity, and quote in that order through WebMCP.
4. Coverage/capacity rejection stops quote for that candidate without fabricating an offer.
5. Successful `ProviderToolEnvelope<ProviderQuote>` records cross the server-side Result Bridge.
6. The Result Bridge creates runtime offers idempotently.
7. BALANCED ranks the resulting variable collection without carrier-name branches.
8. The canonical result is Andes `89`, Inca `84`, Pacific `72`, with decision confidence `88`.
9. Human selection creates server-side authorization before `book_freight` is called.
10. Booking status is polled through WebMCP and persisted through the separate Booking Bridge.

Andes' `96% SLA` is historical reliability input used by the server-side BALANCED engine. It is not a field returned by `quote_freight`. The provider quote proves `$1,760`, `31h`, and `AVAILABLE_IN_WINDOW`; the server snapshot adds the 96% reliability metric.

The canonical BALANCED weights are `25%` cost, `25%` historical reliability, `20%` transit time, `10%` availability, `10%` route experience, and `10%` organization history.

### 6.2 Representative FR-1042 provider inputs

For a live run, obtain dates and the request UUID from the authenticated execution intent. Do not replace them with the browser clock. The following payload is sanitized evidence from the canonical fixture shape:

```json
{
  "coverage": {
    "origin": "Callao, Peru",
    "destination": "Santiago, Chile",
    "transport_mode": "ROAD",
    "service_type": "FTL",
    "cargo_category": "machinery"
  },
  "capacity": {
    "origin": "Callao, Peru",
    "destination": "Santiago, Chile",
    "cargo_weight_kg": 8000,
    "cargo_volume_m3": 18,
    "cargo_category": "machinery",
    "pickup_mode": "SCHEDULED",
    "pickup_window_start": "2026-08-31T13:00:00.000Z",
    "pickup_window_end": "2026-08-31T17:00:00.000Z",
    "delivery_deadline": "2026-09-03T13:00:00.000Z",
    "special_requirements": ["customs coordination"]
  },
  "quote": {
    "freight_request_id": "f2000000-0000-0000-0000-000000000001",
    "origin": "Callao, Peru",
    "destination": "Santiago, Chile",
    "cargo_weight_kg": 8000,
    "cargo_volume_m3": 18,
    "cargo_category": "machinery",
    "pickup_mode": "SCHEDULED",
    "pickup_window_start": "2026-08-31T13:00:00.000Z",
    "pickup_window_end": "2026-08-31T17:00:00.000Z",
    "delivery_deadline": "2026-09-03T13:00:00.000Z",
    "available_documents": ["commercial_invoice", "packing_list"]
  }
}
```

### 6.3 Expected Andes quote evidence

Timestamps are runtime values. `validUntil` is always derived from one frozen provider clock read and equals issue time plus six hours.

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "1.0",
    "freightRequestId": "f2000000-0000-0000-0000-000000000001",
    "providerOfferReference": "AND-OFF-8821",
    "price": 1760,
    "currency": "USD",
    "priceBreakdown": {
      "lineHaul": 1500,
      "handling": 115,
      "customsCoordination": 145
    },
    "estimatedPickup": "2026-08-31T13:00:00.000Z",
    "estimatedDelivery": "2026-09-01T20:00:00.000Z",
    "transitHours": 31,
    "availableCapacityKg": 10000,
    "availabilityClass": "AVAILABLE_IN_WINDOW",
    "crossBorderSupported": true,
    "customsCoordinationIncluded": true,
    "requiredDocuments": ["commercial_invoice", "packing_list"],
    "borderHandlingNotes": "Coordinación documental fronteriza incluida en el fixture técnico del provider.",
    "validUntil": "<provider issue time + 6 hours>"
  }
}
```

Expected final ranking evidence:

| Rank | Fixture | Price | Transit | Historical SLA | Availability | Score |
|---:|---|---:|---:|---:|---|---:|
| 1 | Andes Freight | USD 1,760 | 31 h | 96% | `AVAILABLE_IN_WINDOW` | 89 |
| 2 | Inca Logistics | USD 1,920 | 29 h | 98% | `AVAILABLE_IN_WINDOW` | 84 |
| 3 | Pacific Cargo | USD 1,590 | 60 h | 86% | `LIMITED_WINDOW` | 72 |

## 7. Recovery contingency evidence — approved public UAT

The public UAT completed the sequence below in a separate controlled run. Andes reached `REJECTED`, the user explicitly selected an alternative contained in `recoveryOfferIds`, and the Inca replacement reached `CONFIRMED`. The sanitized captures 06 and 06b keep the rejection and replacement evidence distinct.

### 7.1 Causality

1. Complete discovery, quoting, ranking, and explicit `ASSISTED` selection of Andes.
2. CargoMesh creates a server-side authorization reference for the selected Andes offer.
3. Execute `book_freight` through WebMCP. The provider returns `PENDING_PROVIDER_CONFIRMATION`.
4. In the controlled demo harness, set the next provider fixture response to `REJECT`. This control is one-shot and is not exposed as a sixth provider tool.
5. Execute `get_provider_booking_status`. The provider returns `REJECTED` and appends one stable `BOOKING_REJECTED` event.
6. The Booking Bridge persists the rejection and returns `recoveryOfferIds` from eligible alternatives only.
7. The user explicitly selects an ID from `recoveryOfferIds`. CargoMesh must not auto-book an alternative.
8. CargoMesh generates a new server-side authorization and a new offer-scoped idempotency key.
9. Execute `book_freight` against the selected alternative. In the canonical contingency, Inca is USD 1,920 with 29-hour transit.
10. Poll Inca status through WebMCP until `CONFIRMED`; persist the resulting events through the Booking Bridge.

The recovery flow never copies the failed Andes authorization or booking reference. It never invents a new quote, bypasses `recoveryOfferIds`, or changes the original ranking.

### 7.2 Representative booking request

Values in angle brackets must come from server responses. They are not user-created credentials.

```json
{
  "freight_request_id": "f2000000-0000-0000-0000-000000000001",
  "provider_offer_reference": "AND-OFF-8821",
  "idempotency_key": "<offer-scoped booking idempotency key>",
  "authorization_context": {
    "authorization_reference": "<server-issued authorization reference>",
    "authorized_by": "HUMAN_SELECTION"
  },
  "selection_mode": "ASSISTED"
}
```

Representative first response:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "1.0",
    "freightRequestId": "f2000000-0000-0000-0000-000000000001",
    "providerOfferReference": "AND-OFF-8821",
    "providerReference": "<stable Andes provider reference>",
    "providerBookingStatus": "PENDING_PROVIDER_CONFIRMATION",
    "providerResponseDeadline": "<single provider clock read + 15 minutes>",
    "paymentRequired": false,
    "paymentUrl": null,
    "idempotentReplay": false
  }
}
```

Replay the exact same request. Expected invariants:

```json
{
  "sameProviderReference": true,
  "sameProviderResponseDeadline": true,
  "idempotentReplay": true,
  "duplicateProviderBooking": false
}
```

After the one-shot `REJECT`, query:

```json
{
  "provider_reference": "<stable Andes provider reference>"
}
```

Representative status evidence:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "1.0",
    "providerReference": "<stable Andes provider reference>",
    "providerBookingStatus": "REJECTED",
    "providerStatusReason": "El provider rechazó la solicitud mediante el fixture técnico.",
    "currentLocation": null,
    "updatedEta": null,
    "providerResponseDeadline": "<original unchanged deadline>",
    "paymentStatus": "NOT_REQUIRED",
    "events": [
      {
        "providerEventId": "<stable event ID>",
        "eventType": "BOOKING_REQUESTED",
        "providerBookingStatus": "PENDING_PROVIDER_CONFIRMATION",
        "occurredAt": "<booking issue time>",
        "location": null,
        "description": "Solicitud de reserva recibida por el provider."
      },
      {
        "providerEventId": "<stable event ID>",
        "eventType": "BOOKING_REJECTED",
        "providerBookingStatus": "REJECTED",
        "occurredAt": "<status transition time>",
        "location": null,
        "description": "El provider rechazó la reserva de transporte."
      }
    ]
  }
}
```

The subsequent Inca booking must reference `INC-OFF-9042`, use a newly issued authorization, and use a new idempotency key. Its quoted commercial evidence remains USD 1,920 and 29 hours.

## 8. Evidence capture template

Publish only sanitized values. IDs used solely for runtime correlation may remain, but actual authorization IDs/references and credentials must always be redacted.

| Evidence | Required capture |
|---|---|
| Deployment | Public HTTPS URL and exact deployed Git SHA |
| Discovery | Candidate count and sanitized `carrierId`, `providerUrl`, `matchingServiceId` |
| Registration | `typeof document.modelContext`, five tool names, exact provider origin |
| Execution | Tool name, sanitized input, complete envelope, start/end timestamps |
| Golden Flow | Three offers, `89/84/72`, confidence `88`, Andes recommended |
| Booking | Booking ID, provider reference, and proof of server-issued authorization correlation with the actual authorization ID redacted |
| Replay | Same booking/reference, deduplicated response, no duplicate rows |
| Recovery | Andes `REJECTED`, `recoveryOfferIds`, explicit Inca selection, new authorization, replacement booking, and `CONFIRMED`; approved in the public run with sanitized captures 06/06b |
| Cleanup | Empty list of the five provider tools after each provider is abandoned |
| Security | Client bundle scan with zero secret matches |

Recommended screenshots:

1. provider page reporting five registered tools;
2. DevTools `getTools()` table;
3. one coverage/capacity/quote execution chain;
4. Golden Flow ranking with Andes `89`, Inca `84`, Pacific `72`;
5. Andes rejection and Inca recovery selection;
6. Judge Drawer with persisted, deduplicated events;
7. cleanup result with no provider tools remaining.

## 9. Source-of-truth files

- `frontend/src/features/providers/check-service-coverage-tool.ts`
- `frontend/src/features/providers/check-capacity-tool.ts`
- `frontend/src/features/providers/quote-freight-tool.ts`
- `frontend/src/features/providers/book-freight-tool.ts`
- `frontend/src/features/providers/get-provider-booking-status-tool.ts`
- `frontend/src/features/providers/provider-booking-contracts.ts`
- `frontend/src/features/providers/provider-tool-registration.ts`
- `frontend/src/app/providers/[carrierSlug]/page.tsx`
- `frontend/src/app/providers/[carrierSlug]/provider-webmcp-host.tsx`
- `frontend/src/features/webmcp-runner/external-provider-navigation-adapter.ts`
- `frontend/src/features/webmcp-runner/provider-runner.ts`
- `frontend/src/features/decision-engine/balanced.ts`

When documentation and executable contracts differ, the code and its tests are authoritative. Update this guide in the same review that changes a provider contract.
