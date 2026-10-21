-- Explicitly opt-in synthetic scenario. The authenticated runner provisions these values via native RPCs.
-- Running this SQL alone returns the recipe; it does not grant roles or create business records.
select $scenario$
{
  "schemaVersion": "2.0",
  "scenarioId": "CLIENT_CARRIER_QUOTES_20261020_V1",
  "targetProjectRef": "yhimeajpzicjbxpbzsyh",
  "organizationId": "52000000-0000-4000-8000-000000000001",
  "carrierId": "e4440000-0000-4000-8000-000000000001",
  "validUntil": "2026-10-26T00:00:00Z",
  "provenanceStatus": "SIMULATED",
  "notes": [
    "No credentials, orders, offers, bookings or crew assignments are seeded.",
    "Existing HAC44 corridor is a SIMULATED 100 km fixture, not verified Lima–Arequipa road distance.",
    "All new resources are separate; existing scenarios and calendars remain intact."
  ],
  "steps": [
    {
      "key": "service",
      "family": "catalog",
      "kind": "services",
      "serviceScope": null,
      "value": {
        "schemaVersion": "2.0",
        "mode": "ROAD",
        "serviceClass": "FTL",
        "maxWeightKg": 10000,
        "maxVolumeM3": 30,
        "responseChannels": [
          "MANUAL"
        ],
        "status": "ACTIVE",
        "admittedCargoTypes": [
          "c0000000-0000-0000-0000-000000000001"
        ],
        "temperatureRange": null,
        "requiredCertifications": [],
        "supportsHazardous": false,
        "supportsFragile": false,
        "supportsOversized": false
      }
    },
    {
      "key": "pickup",
      "family": "catalog",
      "kind": "areas",
      "serviceScope": "$service",
      "value": {
        "schemaVersion": "2.0",
        "evidence": "SIMULATED: isolated client-carrier quotation demo",
        "verifiedAt": "2026-10-20T12:00:00Z",
        "validFrom": "2026-10-20T12:00:00Z",
        "validUntil": "2026-10-26T00:00:00Z",
        "role": "PICKUP",
        "inclusion": "INCLUDE",
        "geography": {
          "granularity": "CITY",
          "countryCode": "PE",
          "region": "Lima",
          "city": "Lima",
          "postalCode": null
        },
        "source": "OWN",
        "partnerId": null,
        "active": true
      }
    },
    {
      "key": "delivery",
      "family": "catalog",
      "kind": "areas",
      "serviceScope": "$service",
      "value": {
        "schemaVersion": "2.0",
        "evidence": "SIMULATED: isolated client-carrier quotation demo",
        "verifiedAt": "2026-10-20T12:00:00Z",
        "validFrom": "2026-10-20T12:00:00Z",
        "validUntil": "2026-10-26T00:00:00Z",
        "role": "DELIVERY",
        "inclusion": "INCLUDE",
        "geography": {
          "granularity": "CITY",
          "countryCode": "PE",
          "region": "Arequipa",
          "city": "Arequipa",
          "postalCode": null
        },
        "source": "OWN",
        "partnerId": null,
        "active": true
      }
    },
    {
      "key": "lane",
      "family": "catalog",
      "kind": "lanes",
      "serviceScope": "$service",
      "value": {
        "schemaVersion": "2.0",
        "evidence": "SIMULATED: isolated client-carrier quotation demo",
        "verifiedAt": "2026-10-20T12:00:00Z",
        "validFrom": "2026-10-20T12:00:00Z",
        "validUntil": "2026-10-26T00:00:00Z",
        "pickupAreaId": "$pickup",
        "deliveryAreaId": "$delivery",
        "kind": "DIRECT",
        "mode": "ROAD",
        "borderReviewRequired": false,
        "active": true,
        "plannedTransitMinutes": 960,
        "transitProvenanceStatus": "SIMULATED",
        "crossBorderProhibited": false,
        "crossBorderProhibitionReference": null
      }
    },
    {
      "key": "definition",
      "family": "catalog",
      "kind": "capability-definitions",
      "serviceScope": null,
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "$service",
        "categoryId": "c0000000-0000-0000-0000-000000000001",
        "requirements": [
          "KEEP_DRY"
        ],
        "maxWeightKg": 10000,
        "temperatureRange": null,
        "certifications": [],
        "evidence": "SIMULATED: dry enclosed box",
        "verifiedAt": "2026-10-20T12:00:00Z",
        "validUntil": "2026-10-26T00:00:00Z",
        "active": true
      }
    },
    {
      "key": "asset",
      "family": "catalog",
      "kind": "assets",
      "serviceScope": null,
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "$service",
        "code": "DEMO_DRY_TRUCK_20261020",
        "mode": "ROAD",
        "equipmentType": "BOX_TRUCK",
        "role": "LOAD_BEARING",
        "usefulCapacityKg": 10000,
        "usableVolumeM3": 30,
        "operatingStatus": "AVAILABLE",
        "homeDepotId": "e4450000-0000-4000-8000-000000000001",
        "provenance": "OWN",
        "partnerId": null,
        "evidence": "SIMULATED: demonstration vehicle, not a real truck",
        "roadVehicle": {
          "plate": "DEMO-021",
          "registrationCode": "SIMULATED-DEMO-021",
          "registeredAt": "2026-01-01",
          "brand": "Demo Motors",
          "model": "Dry box 10 t",
          "variant": null,
          "bodyType": "BOX",
          "usableDimensions": {
            "length": 500,
            "width": 240,
            "height": 250
          },
          "grossWeightLimitKg": 15000,
          "odometerKm": 0,
          "conditionReason": null,
          "axleConfig": "2S1"
        }
      }
    },
    {
      "key": "calendar",
      "family": "catalog",
      "kind": "calendars",
      "serviceScope": null,
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "$service",
        "assetId": "$asset",
        "capacityPoolId": null,
        "timezone": "America/Lima",
        "horizon": {
          "startsAt": "2026-10-21T00:00:00Z",
          "endsAt": "2026-10-26T00:00:00Z"
        },
        "source": "SIMULATED: demo calendar 21–25 October",
        "lastVerifiedAt": "2026-10-20T12:00:00Z",
        "freshness": "SIMULATED",
        "validUntil": "2026-10-26T00:00:00Z",
        "complete": true,
        "availableWindows": [
          {
            "startsAt": "2026-10-21T00:00:00Z",
            "endsAt": "2026-10-26T00:00:00Z"
          }
        ],
        "readyPickupAreaId": "$pickup"
      }
    },
    {
      "key": "capability",
      "family": "catalog",
      "kind": "asset-capabilities",
      "serviceScope": null,
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "$service",
        "assetId": "$asset",
        "definitionId": "$definition",
        "categoryId": "c0000000-0000-0000-0000-000000000001",
        "temperatureRange": null,
        "certifications": [],
        "evidence": "SIMULATED: dry enclosed box",
        "verifiedAt": "2026-10-20T12:00:00Z",
        "validUntil": "2026-10-26T00:00:00Z",
        "active": true
      }
    },
    {
      "key": "limits",
      "family": "workflow",
      "action": "limits.publish",
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "serviceId": "$service",
        "assetId": "$asset",
        "combinationId": null,
        "corridorId": "60088569-9ff7-4a9a-bdcb-88444a43dd08",
        "manufacturerPayloadLimitKg": 10000,
        "routeGrossLimitKg": 15000,
        "combinedTareKg": 5000,
        "usableVolumeM3": 30,
        "usableDimensions": {
          "length": 500,
          "width": 240,
          "height": 250
        },
        "compatibilityConfirmed": true,
        "source": {
          "reference": "SIMULATED:quote-demo-20261020",
          "provider": "CargoMesh synthetic scenario",
          "observedAt": "2026-10-20T12:00:00Z",
          "validUntil": "2026-10-26T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        }
      }
    }
  ],
  "policy": {
    "schemaVersion": "2.0",
    "serviceId": "$service",
    "laneId": "$lane",
    "active": true,
    "autoIssue": true,
    "basis": "PER_TRIP",
    "baseAmount": 500,
    "ratePerKm": 0,
    "minimumAmount": 500,
    "fuelAmount": 0,
    "tollAmount": 0,
    "handlingAmount": 0,
    "taxAmount": 0,
    "validityMinutes": 120,
    "confirmationMinutes": 30,
    "validUntil": "2026-10-26T00:00:00Z",
    "terms": "SIMULATED DEMO ONLY. USD 500 fixed per trip for this directed FTL service, up to 10,000 kg / 30 m3. Subject to current eligibility and explicit booking/resource confirmation. Not a market quotation.",
    "provenanceStatus": "SIMULATED",
    "acknowledgeAuthority": true
  }
}
$scenario$::jsonb as scenario;
