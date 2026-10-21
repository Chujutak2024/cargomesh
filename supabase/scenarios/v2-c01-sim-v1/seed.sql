-- C-01-SIM v1: explicit guarded activation; no historical UPDATE/DELETE.
\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  \if :{?c01_rollout_approved}
  \else
    \echo 'STOP: requires explicit approval of dataset and tariffs; this is a preview.'
    \quit 3
  \endif
  \if :c01_rollout_approved
  \else
    \quit 3
  \endif
\endif
\if :{?c01_expected_sha256}
\else
  \echo 'STOP: pass the reviewed dataset SHA-256, even for a local run.'
  \quit 3
\endif
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
create temporary table c01_manifest(value jsonb not null) on commit drop;
insert into c01_manifest values($c01manifest${
  "schemaVersion": "C01_SIM_MANIFEST_V1",
  "dataset": "C-01-SIM",
  "version": 1,
  "status": "PREPARED_AWAITING_ROLLOUT_APPROVAL",
  "projectRef": "yhimeajpzicjbxpbzsyh",
  "existingReferences": {
    "client": {
      "organizationId": "52000000-0000-4000-8000-000000000001",
      "memberId": "52020000-0000-4000-8000-000000000002",
      "expectedCode": "HAC52_PE",
      "expectedRole": "SUPERVISOR"
    },
    "carrier": {
      "carrierId": "e4440000-0000-4000-8000-000000000001",
      "operatorId": "460388d2-0f66-400f-8fe4-0296093266c6",
      "expectedCode": "HAC44_ROAD",
      "expectedRole": "ADMIN"
    },
    "catalogAdmin": {
      "resolution": "Exact existing technical catalog member observed in hosted preflight; no new grants and no fallback to a different actor",
      "memberId": "e4420000-0000-4000-8000-000000000001",
      "organizationId": "e4400000-0000-4000-8000-000000000001"
    },
    "category": {
      "resolution": "existing active GENERAL category; never overwrite normative category"
    }
  },
  "provenance": "SIMULATED",
  "distanceIsMeasured": false,
  "locationsAreRealFacilities": false,
  "mandatoryApprovals": [
    "code publication and two DDL",
    "isolated scenario activation and automatic quote policy by Carrier ADMIN"
  ],
  "autoConfirmAllowed": false,
  "evidence": {
    "reference": "simulation:C01-SIM-v1",
    "provider": "CargoMesh C-01-SIM fixture",
    "observedAt": "2026-10-21T00:00:00Z",
    "validUntil": "2026-11-04T00:00:00Z",
    "provenanceStatus": "SIMULATED"
  },
  "pickupWindow": {
    "startsAt": "2026-11-02T08:00:00-05:00",
    "endsAt": "2026-11-02T10:00:00-05:00"
  },
  "deliveryWindow": {
    "startsAt": "2026-11-02T14:00:00-05:00",
    "endsAt": "2026-11-02T18:00:00-05:00"
  },
  "availability": {
    "startsAt": "2026-11-02T07:00:00-05:00",
    "endsAt": "2026-11-02T19:00:00-05:00"
  },
  "costFixtureSource": "supabase/tests/46_v2_route_admission.test.sql",
  "costFixtureSourceSHA256": "2fb568032c7dac0b28810c9fb93321f408568a87f5d35c4576c8b0e78a3a9f01",
  "originalFixturePrice": {
    "amount": 310.8,
    "currency": "USD",
    "reuseAsFixedPrice": false
  },
  "operations": [
    {
      "ref": "facilityA",
      "api": "facility",
      "actor": "client",
      "idempotencyKey": "c3c0248b-b18c-5edb-8dd1-e8c27f5859ba",
      "scope": {},
      "value": {
        "schemaVersion": "2.0",
        "code": "C01_SIM_V1_A",
        "name": "[SIMULATED] C-01-SIM Point A",
        "facilityType": "WAREHOUSE",
        "location": {
          "label": "[SIMULATED] C-01-SIM Point A",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_A",
          "lat": -12,
          "lng": -77
        },
        "active": true,
        "accessRestrictions": [
          {
            "code": "SIMULATED_SITE",
            "description": "Synthetic fixture only; no real address or transport operation is represented.",
            "evidenceReference": "simulation:C01-SIM-v1"
          }
        ],
        "operatingHours": null
      }
    },
    {
      "ref": "facilityB",
      "api": "facility",
      "actor": "client",
      "idempotencyKey": "cc32be8c-543f-511e-b63d-c987c8bf7756",
      "scope": {},
      "value": {
        "schemaVersion": "2.0",
        "code": "C01_SIM_V1_B",
        "name": "[SIMULATED] C-01-SIM Point B",
        "facilityType": "WAREHOUSE",
        "location": {
          "label": "[SIMULATED] C-01-SIM Point B",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_B",
          "lat": -12.5,
          "lng": -77
        },
        "active": true,
        "accessRestrictions": [
          {
            "code": "SIMULATED_SITE",
            "description": "Synthetic fixture only; no real address or transport operation is represented.",
            "evidenceReference": "simulation:C01-SIM-v1"
          }
        ],
        "operatingHours": null
      }
    },
    {
      "ref": "service",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "75f6fbb3-1f66-5247-b32b-f35f032c7927",
      "scope": {
        "kind": "services"
      },
      "value": {
        "schemaVersion": "2.0",
        "mode": "ROAD",
        "serviceClass": "FTL",
        "maxWeightKg": 20000,
        "maxVolumeM3": 60,
        "responseChannels": [
          "MANUAL"
        ],
        "status": "ACTIVE",
        "admittedCargoTypes": [
          {
            "$ref": "category"
          }
        ],
        "temperatureRange": null,
        "requiredCertifications": [],
        "supportsHazardous": false,
        "supportsFragile": false,
        "supportsOversized": false
      }
    },
    {
      "ref": "depot",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "2644df13-21e1-5616-a74f-8dfa41d6e5d1",
      "scope": {
        "kind": "depots"
      },
      "value": {
        "schemaVersion": "2.0",
        "code": "C01_SIM_V1_DEPOT",
        "name": "[SIMULATED] C01 depot",
        "location": {
          "label": "[SIMULATED] C-01-SIM Point A",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_A",
          "lat": -12,
          "lng": -77
        },
        "active": true,
        "handling": [
          "SIMULATED_HEAVY_CRATE_HANDLING"
        ]
      }
    },
    {
      "ref": "areaA",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "3e2b9fc4-625a-543b-9a2c-f322b07513b8",
      "scope": {
        "kind": "areas",
        "serviceId": {
          "$ref": "service"
        }
      },
      "value": {
        "schemaVersion": "2.0",
        "role": "PICKUP",
        "inclusion": "INCLUDE",
        "geography": {
          "granularity": "CITY",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_A",
          "postalCode": null
        },
        "source": "OWN",
        "partnerId": null,
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validFrom": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true
      }
    },
    {
      "ref": "areaB",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "c33e7a6b-c01a-5a1c-8dc7-bd0e94ccfe5c",
      "scope": {
        "kind": "areas",
        "serviceId": {
          "$ref": "service"
        }
      },
      "value": {
        "schemaVersion": "2.0",
        "role": "DELIVERY",
        "inclusion": "INCLUDE",
        "geography": {
          "granularity": "CITY",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_B",
          "postalCode": null
        },
        "source": "OWN",
        "partnerId": null,
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validFrom": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true
      }
    },
    {
      "ref": "lane",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "239002c1-8fae-5f4e-ad62-a456f6ed8792",
      "scope": {
        "kind": "lanes",
        "serviceId": {
          "$ref": "service"
        }
      },
      "value": {
        "schemaVersion": "2.0",
        "pickupAreaId": {
          "$ref": "areaA"
        },
        "deliveryAreaId": {
          "$ref": "areaB"
        },
        "kind": "DIRECT",
        "mode": "ROAD",
        "borderReviewRequired": false,
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validFrom": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true,
        "plannedTransitMinutes": 120,
        "transitProvenanceStatus": "SIMULATED",
        "crossBorderProhibited": false,
        "crossBorderProhibitionReference": null
      }
    },
    {
      "ref": "capabilityDefinition",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "7bc9f20c-1fb4-5f06-8f3c-2b583e079328",
      "scope": {
        "kind": "capability-definitions"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "categoryId": {
          "$ref": "category"
        },
        "requirements": [],
        "maxWeightKg": 10000,
        "temperatureRange": null,
        "certifications": [],
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true
      }
    },
    {
      "ref": "truck1",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "9e170c7b-d778-5bff-9ff4-bb2784a0db6d",
      "scope": {
        "kind": "assets"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "code": "C01_SIM_V1_T1",
        "mode": "ROAD",
        "equipmentType": "BOX_TRUCK",
        "role": "LOAD_BEARING",
        "usefulCapacityKg": 10000,
        "usableVolumeM3": 28,
        "operatingStatus": "AVAILABLE",
        "homeDepotId": {
          "$ref": "depot"
        },
        "provenance": "OWN",
        "partnerId": null,
        "evidence": "simulation:C01-SIM-v1",
        "roadVehicle": {
          "plate": "SIM-C01-T1",
          "registrationCode": "SIM-C01-T1",
          "registeredAt": "2026-10-21",
          "brand": "Synthetic",
          "model": "C01-T1",
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
          "axleConfig": "SIMULATED_2S1"
        }
      }
    },
    {
      "ref": "capability1",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "74bd87d2-5cfa-551f-88f3-d9c41cb532b4",
      "scope": {
        "kind": "asset-capabilities"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck1"
        },
        "definitionId": {
          "$ref": "capabilityDefinition"
        },
        "categoryId": {
          "$ref": "category"
        },
        "temperatureRange": null,
        "certifications": [],
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true
      }
    },
    {
      "ref": "calendar1",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "3ad4a173-0a13-58be-a192-0b3765227147",
      "scope": {
        "kind": "calendars"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck1"
        },
        "capacityPoolId": null,
        "timezone": "America/Lima",
        "horizon": {
          "startsAt": "2026-11-02T07:00:00-05:00",
          "endsAt": "2026-11-02T19:00:00-05:00"
        },
        "source": "simulation:C01-SIM-v1",
        "lastVerifiedAt": "2026-10-21T00:00:00Z",
        "freshness": "SIMULATED",
        "validUntil": "2026-11-04T00:00:00Z",
        "complete": true,
        "availableWindows": [
          {
            "startsAt": "2026-11-02T07:00:00-05:00",
            "endsAt": "2026-11-02T19:00:00-05:00"
          }
        ],
        "readyPickupAreaId": {
          "$ref": "areaA"
        }
      }
    },
    {
      "ref": "driver1",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "0f123845-1bed-5698-beee-e08e159ad5ed",
      "scope": {
        "kind": "drivers"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "fullName": "[SIMULATED] C01 Driver 1",
        "portalAccountId": null,
        "licenseClass": "SIMULATED_A_III",
        "licenseValidUntil": "2026-11-04",
        "licenseTimezone": "America/Lima",
        "qualifications": [
          "SIMULATED_BOX_TRUCK",
          "SIMULATED_HEAVY_CRATES"
        ],
        "experienceYears": 5,
        "dutyStatus": "AVAILABLE",
        "evidence": {
          "reference": "simulation:C01-D1-qualification",
          "verifiedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "availableWindows": [
          {
            "startsAt": "2026-11-02T07:00:00-05:00",
            "endsAt": "2026-11-02T19:00:00-05:00"
          }
        ],
        "dutyWindow": {
          "startsAt": "2026-11-02T07:00:00-05:00",
          "endsAt": "2026-11-02T19:00:00-05:00"
        },
        "maximumDutySeconds": 43200,
        "usedDutySeconds": 0
      }
    },
    {
      "ref": "truck2",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "9beaa709-f3e0-5dc8-b8e7-a11702c978c6",
      "scope": {
        "kind": "assets"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "code": "C01_SIM_V1_T2",
        "mode": "ROAD",
        "equipmentType": "BOX_TRUCK",
        "role": "LOAD_BEARING",
        "usefulCapacityKg": 10000,
        "usableVolumeM3": 28,
        "operatingStatus": "AVAILABLE",
        "homeDepotId": {
          "$ref": "depot"
        },
        "provenance": "OWN",
        "partnerId": null,
        "evidence": "simulation:C01-SIM-v1",
        "roadVehicle": {
          "plate": "SIM-C01-T2",
          "registrationCode": "SIM-C01-T2",
          "registeredAt": "2026-10-21",
          "brand": "Synthetic",
          "model": "C01-T2",
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
          "axleConfig": "SIMULATED_2S1"
        }
      }
    },
    {
      "ref": "capability2",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "cf7ac26d-b83c-5b30-8821-aa1e4c110faf",
      "scope": {
        "kind": "asset-capabilities"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck2"
        },
        "definitionId": {
          "$ref": "capabilityDefinition"
        },
        "categoryId": {
          "$ref": "category"
        },
        "temperatureRange": null,
        "certifications": [],
        "evidence": "simulation:C01-SIM-v1",
        "verifiedAt": "2026-10-21T00:00:00Z",
        "validUntil": "2026-11-04T00:00:00Z",
        "active": true
      }
    },
    {
      "ref": "calendar2",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "4ebbd32e-22d7-5fb7-9343-4d491f1079bb",
      "scope": {
        "kind": "calendars"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck2"
        },
        "capacityPoolId": null,
        "timezone": "America/Lima",
        "horizon": {
          "startsAt": "2026-11-02T07:00:00-05:00",
          "endsAt": "2026-11-02T19:00:00-05:00"
        },
        "source": "simulation:C01-SIM-v1",
        "lastVerifiedAt": "2026-10-21T00:00:00Z",
        "freshness": "SIMULATED",
        "validUntil": "2026-11-04T00:00:00Z",
        "complete": true,
        "availableWindows": [
          {
            "startsAt": "2026-11-02T07:00:00-05:00",
            "endsAt": "2026-11-02T19:00:00-05:00"
          }
        ],
        "readyPickupAreaId": {
          "$ref": "areaA"
        }
      }
    },
    {
      "ref": "driver2",
      "api": "catalog",
      "actor": "carrier",
      "idempotencyKey": "e93fd4a0-422d-5ef6-8b92-5b331ca1fec5",
      "scope": {
        "kind": "drivers"
      },
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "fullName": "[SIMULATED] C01 Driver 2",
        "portalAccountId": null,
        "licenseClass": "SIMULATED_A_III",
        "licenseValidUntil": "2026-11-04",
        "licenseTimezone": "America/Lima",
        "qualifications": [
          "SIMULATED_BOX_TRUCK",
          "SIMULATED_HEAVY_CRATES"
        ],
        "experienceYears": 5,
        "dutyStatus": "AVAILABLE",
        "evidence": {
          "reference": "simulation:C01-D2-qualification",
          "verifiedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "availableWindows": [
          {
            "startsAt": "2026-11-02T07:00:00-05:00",
            "endsAt": "2026-11-02T19:00:00-05:00"
          }
        ],
        "dutyWindow": {
          "startsAt": "2026-11-02T07:00:00-05:00",
          "endsAt": "2026-11-02T19:00:00-05:00"
        },
        "maximumDutySeconds": 43200,
        "usedDutySeconds": 0
      }
    },
    {
      "ref": "nodeA",
      "api": "workflow",
      "actor": "catalogAdmin",
      "idempotencyKey": "f91f296c-87c7-52dd-b456-2dbc8cf2425a",
      "scope": {
        "action": "nodes.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "kind": "HUB",
        "name": "[SIMULATED] C-01-SIM Point A",
        "location": {
          "label": "[SIMULATED] C-01-SIM Point A",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_A",
          "lat": -12,
          "lng": -77
        },
        "jurisdiction": "PE",
        "source": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "verifiedAt": "2026-10-21T00:00:00Z"
      }
    },
    {
      "ref": "nodeB",
      "api": "workflow",
      "actor": "catalogAdmin",
      "idempotencyKey": "fb06141f-2e48-5799-912f-3a6c51d9e14e",
      "scope": {
        "action": "nodes.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "kind": "HUB",
        "name": "[SIMULATED] C-01-SIM Point B",
        "location": {
          "label": "[SIMULATED] C-01-SIM Point B",
          "countryCode": "PE",
          "region": null,
          "city": "C01_SIM_B",
          "lat": -12.5,
          "lng": -77
        },
        "jurisdiction": "PE",
        "source": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "verifiedAt": "2026-10-21T00:00:00Z"
      }
    },
    {
      "ref": "corridor",
      "api": "workflow",
      "actor": "catalogAdmin",
      "idempotencyKey": "f114e946-4759-5a7c-bf87-f439c121b855",
      "scope": {
        "action": "corridors.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "originNodeId": {
          "$ref": "nodeA"
        },
        "destinationNodeId": {
          "$ref": "nodeB"
        },
        "mode": "ROAD",
        "estimatedDistanceKm": 100,
        "estimatedDurationSeconds": 3600,
        "restrictions": [],
        "source": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "version": "C01-SIM-v1",
        "validUntil": "2026-11-04T00:00:00Z",
        "grossWeightLimitKg": 15000,
        "payloadLimitKg": 10000,
        "usableDimensions": {
          "length": 500,
          "width": 240,
          "height": 250
        },
        "limitsEvidence": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "waypoints": [
          {
            "kind": "REST",
            "location": {
              "label": "[SIMULATED] C-01-SIM Point A",
              "countryCode": "PE",
              "region": null,
              "city": "C01_SIM_A",
              "lat": -12,
              "lng": -77
            },
            "source": {
              "reference": "simulation:C01-SIM-v1",
              "provider": "CargoMesh C-01-SIM fixture",
              "observedAt": "2026-10-21T00:00:00Z",
              "validUntil": "2026-11-04T00:00:00Z",
              "provenanceStatus": "SIMULATED"
            },
            "verifiedAt": null
          },
          {
            "kind": "FUEL",
            "location": {
              "label": "[SIMULATED] C-01-SIM Point B",
              "countryCode": "PE",
              "region": null,
              "city": "C01_SIM_B",
              "lat": -12.5,
              "lng": -77
            },
            "source": {
              "reference": "simulation:C01-SIM-v1",
              "provider": "CargoMesh C-01-SIM fixture",
              "observedAt": "2026-10-21T00:00:00Z",
              "validUntil": "2026-11-04T00:00:00Z",
              "provenanceStatus": "SIMULATED"
            },
            "verifiedAt": null
          }
        ],
        "operatingProfile": {
          "version": "ROAD_COST_INPUT_V1",
          "drivingSeconds": 3600,
          "tollAmount": 10,
          "stops": [
            {
              "waypointIndex": 0,
              "afterDrivingSeconds": 1800,
              "restMinutes": 15,
              "feeAmount": 5
            }
          ],
          "source": {
            "reference": "simulation:C01-SIM-v1:costs",
            "provider": "CargoMesh C-01-SIM fixture",
            "observedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          },
          "endpoints": {
            "origin": {
              "lat": -12,
              "lng": -77
            },
            "destination": {
              "lat": -12.5,
              "lng": -77
            }
          }
        }
      }
    },
    {
      "ref": "routePolicy",
      "api": "workflow",
      "actor": "catalogAdmin",
      "idempotencyKey": "396f5970-11c7-5c6a-b0a2-2eaba5df5980",
      "scope": {
        "action": "route-policies.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "version": "C01-SIM-v1",
        "objective": "SHORTEST",
        "constraints": [],
        "weights": {
          "distance": 1,
          "duration": 0
        },
        "missingDataRule": "UNKNOWN"
      }
    },
    {
      "ref": "limit1",
      "api": "workflow",
      "actor": "carrier",
      "idempotencyKey": "82b98020-118e-500f-be4c-26cee2f6dc26",
      "scope": {
        "action": "limits.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck1"
        },
        "combinationId": null,
        "corridorId": {
          "$ref": "corridor"
        },
        "manufacturerPayloadLimitKg": 10000,
        "routeGrossLimitKg": 15000,
        "combinedTareKg": 5000,
        "usableVolumeM3": 28,
        "usableDimensions": {
          "length": 500,
          "width": 240,
          "height": 250
        },
        "compatibilityConfirmed": true,
        "source": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "admission": {
          "decision": "ALLOWED",
          "reasonCode": "SIMULATED_ACCESS_CONFIRMED"
        }
      }
    },
    {
      "ref": "limit2",
      "api": "workflow",
      "actor": "carrier",
      "idempotencyKey": "661a47f9-fe14-5a85-9bcc-c8da775348cc",
      "scope": {
        "action": "limits.publish"
      },
      "value": {
        "schemaVersion": "2.0",
        "active": true,
        "serviceId": {
          "$ref": "service"
        },
        "assetId": {
          "$ref": "truck2"
        },
        "combinationId": null,
        "corridorId": {
          "$ref": "corridor"
        },
        "manufacturerPayloadLimitKg": 10000,
        "routeGrossLimitKg": 15000,
        "combinedTareKg": 5000,
        "usableVolumeM3": 28,
        "usableDimensions": {
          "length": 500,
          "width": 240,
          "height": 250
        },
        "compatibilityConfirmed": true,
        "source": {
          "reference": "simulation:C01-SIM-v1",
          "provider": "CargoMesh C-01-SIM fixture",
          "observedAt": "2026-10-21T00:00:00Z",
          "validUntil": "2026-11-04T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "admission": {
          "decision": "ALLOWED",
          "reasonCode": "SIMULATED_ACCESS_CONFIRMED"
        }
      }
    },
    {
      "ref": "quotePolicy",
      "api": "quotePolicy",
      "actor": "carrier",
      "idempotencyKey": "65e182ac-2eee-57f0-a034-ed57e9fd4bba",
      "scope": {},
      "value": {
        "schemaVersion": "2.0",
        "serviceId": {
          "$ref": "service"
        },
        "laneId": {
          "$ref": "lane"
        },
        "active": true,
        "autoIssue": true,
        "basis": "COST_PLUS",
        "baseAmount": 0,
        "ratePerKm": 0,
        "minimumAmount": 0,
        "fuelAmount": 0,
        "tollAmount": 0,
        "handlingAmount": 0,
        "taxAmount": 0,
        "validityMinutes": 60,
        "confirmationMinutes": 30,
        "validUntil": "2026-11-04T00:00:00Z",
        "terms": "SIMULATED C01 fixture; no commercial real-world transport quote. Return and repositioning are excluded in this isolated scenario.",
        "provenanceStatus": "SIMULATED",
        "acknowledgeAuthority": true,
        "maxResources": 2,
        "resourcePricing": "PER_RESOURCE",
        "operatingCosts": {
          "version": "COST_PLUS_V1",
          "fuelLitresPer100Km": 30,
          "fuelPricePerLitre": 1.2,
          "driverHourlyCost": 6,
          "vehicleCostPerKm": 0.15,
          "fixedCostPerVehicle": 25,
          "handlingCostPerShipment": 20,
          "maxContinuousDrivingMinutes": 60,
          "breakMinutes": 15,
          "maxDailyDrivingMinutes": 120,
          "dailyRestMinutes": 600,
          "payRestTime": true,
          "markupPercent": 20,
          "taxPercent": 0,
          "fleet": {
            "version": "TRUCK_PROFILES_V1",
            "profiles": [
              {
                "id": "rigid",
                "label": "Rigid model",
                "equipmentCode": "BOX_TRUCK",
                "fuelLitresPer100Km": 30,
                "driverHourlyCost": 6,
                "vehicleCostPerKm": 0.15,
                "fixedCostPerVehicle": 25,
                "maxSpeedKph": 120
              },
              {
                "id": "larger",
                "label": "Larger model",
                "equipmentCode": "BOX_TRUCK",
                "fuelLitresPer100Km": 20,
                "driverHourlyCost": 8,
                "vehicleCostPerKm": 0.2,
                "fixedCostPerVehicle": 40,
                "maxSpeedKph": 120
              }
            ],
            "assets": [
              {
                "assetId": {
                  "$ref": "truck1"
                },
                "profileId": "rigid",
                "overrides": {}
              },
              {
                "assetId": {
                  "$ref": "truck2"
                },
                "profileId": "larger",
                "overrides": {}
              }
            ]
          }
        },
        "dispatch": {
          "allowedPriorities": [
            "URGENT",
            "SCHEDULED"
          ],
          "minNoticeMinutes": 0,
          "loadingMinutes": 30,
          "unloadingMinutes": 30,
          "autoConfirm": false,
          "maxBookingAmount": null,
          "acknowledgeSchedulingAuthority": false
        }
      }
    }
  ],
  "requestTemplate": {
    "schemaVersion": "2.0",
    "origin": {
      "facilityId": {
        "$ref": "facilityA"
      }
    },
    "destination": {
      "facilityId": {
        "$ref": "facilityB"
      }
    },
    "pickupWindow": {
      "startsAt": "2026-11-02T08:00:00-05:00",
      "endsAt": "2026-11-02T10:00:00-05:00"
    },
    "deliveryWindow": {
      "startsAt": "2026-11-02T14:00:00-05:00",
      "endsAt": "2026-11-02T18:00:00-05:00"
    },
    "acceptedModes": [
      "ROAD"
    ],
    "requiredEquipment": null,
    "cargoSpecification": {
      "categoryCode": "GENERAL",
      "description": "[SIMULATED] C-01-SIM v1 industrial spare parts",
      "packaging": "CRATE",
      "totalWeightKg": 12000,
      "totalVolumeM3": 15.552,
      "divisible": true,
      "requirements": [],
      "units": [
        {
          "packageType": "CRATE",
          "quantity": 2,
          "weightPerUnitKg": 6000,
          "volumePerUnitM3": 7.776,
          "dimensionsCm": {
            "length": 240,
            "width": 180,
            "height": 180
          },
          "indivisible": true,
          "stackable": false
        }
      ]
    },
    "contacts": {
      "pickup": {
        "name": "SIM C01 pickup contact",
        "phoneE164": "+51900000001"
      },
      "recipient": {
        "name": "SIM C01 delivery contact",
        "phoneE164": "+51900000002"
      }
    },
    "budget": {
      "amount": 500,
      "currency": "USD"
    },
    "selectionObjective": "LOWEST_COST",
    "planningPreferences": {
      "urgency": "SCHEDULED",
      "loadSize": "HEAVY",
      "timeZone": "America/Lima",
      "pickupWindows": [
        {
          "startsAt": "2026-11-02T08:00:00-05:00",
          "endsAt": "2026-11-02T10:00:00-05:00"
        }
      ],
      "deliveryWindows": [
        {
          "startsAt": "2026-11-02T14:00:00-05:00",
          "endsAt": "2026-11-02T18:00:00-05:00"
        }
      ]
    }
  },
  "expectedResult": {
    "requestWeightKg": 12000,
    "wholePackages": 2,
    "resources": 2,
    "offers": 1,
    "bookings": 1,
    "confirmedReservations": 2,
    "executionStatus": "PLANNED"
  },
  "limitations": [
    "Synthetic licensing, site access, load/unload and load securing declarations; not real certification",
    "Return/deadhead/repositioning excluded, not unknown costs silently assumed covered",
    "Dates and source lifetime versioned; after expiry require new reviewed revision",
    "Native confirmation by Carrier; autoConfirm remains false",
    "Phone numbers are synthetic placeholders and must not trigger notifications"
  ],
  "postBookingAssignments": {
    "phase": "Only after actual booking and reservations are confirmed; not executed by seed.sql",
    "requires": "Carrier explicit confirmation; resolve actual execution and reservation IDs",
    "scheduleMustMatchActualExecution": true,
    "operations": [
      {
        "ref": "driverAssignment1",
        "kind": "driver-assignments",
        "actor": "carrier",
        "value": {
          "schemaVersion": "2.0",
          "serviceId": {
            "$ref": "service"
          },
          "executionId": {
            "$ref": "execution"
          },
          "window": {
            "startsAt": "2026-11-02T08:00:00-05:00",
            "endsAt": "2026-11-02T14:30:00-05:00"
          },
          "status": "CONFIRMED",
          "evidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          },
          "driverId": {
            "$ref": "driver1"
          },
          "role": "PRIMARY",
          "acceptedLicenseClasses": [
            "SIMULATED_A_III"
          ],
          "requiredQualifications": [
            "SIMULATED_BOX_TRUCK",
            "SIMULATED_HEAVY_CRATES"
          ],
          "policyEvidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          }
        }
      },
      {
        "ref": "vehicleAssignment1",
        "kind": "vehicle-assignments",
        "actor": "carrier",
        "value": {
          "schemaVersion": "2.0",
          "serviceId": {
            "$ref": "service"
          },
          "executionId": {
            "$ref": "execution"
          },
          "window": {
            "startsAt": "2026-11-02T08:00:00-05:00",
            "endsAt": "2026-11-02T14:30:00-05:00"
          },
          "status": "CONFIRMED",
          "evidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          },
          "assetId": {
            "$ref": "truck1"
          },
          "combinationId": null,
          "reservationId": {
            "$ref": "reservation1"
          },
          "capacityCommitted": {
            "weightKg": 6000,
            "volumeM3": 7.776
          }
        }
      },
      {
        "ref": "driverAssignment2",
        "kind": "driver-assignments",
        "actor": "carrier",
        "value": {
          "schemaVersion": "2.0",
          "serviceId": {
            "$ref": "service"
          },
          "executionId": {
            "$ref": "execution"
          },
          "window": {
            "startsAt": "2026-11-02T08:00:00-05:00",
            "endsAt": "2026-11-02T14:30:00-05:00"
          },
          "status": "CONFIRMED",
          "evidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          },
          "driverId": {
            "$ref": "driver2"
          },
          "role": "PRIMARY",
          "acceptedLicenseClasses": [
            "SIMULATED_A_III"
          ],
          "requiredQualifications": [
            "SIMULATED_BOX_TRUCK",
            "SIMULATED_HEAVY_CRATES"
          ],
          "policyEvidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          }
        }
      },
      {
        "ref": "vehicleAssignment2",
        "kind": "vehicle-assignments",
        "actor": "carrier",
        "value": {
          "schemaVersion": "2.0",
          "serviceId": {
            "$ref": "service"
          },
          "executionId": {
            "$ref": "execution"
          },
          "window": {
            "startsAt": "2026-11-02T08:00:00-05:00",
            "endsAt": "2026-11-02T14:30:00-05:00"
          },
          "status": "CONFIRMED",
          "evidence": {
            "reference": "simulation:C01-SIM-v1:crew",
            "verifiedAt": "2026-10-21T00:00:00Z",
            "validUntil": "2026-11-04T00:00:00Z",
            "provenanceStatus": "SIMULATED"
          },
          "assetId": {
            "$ref": "truck2"
          },
          "combinationId": null,
          "reservationId": {
            "$ref": "reservation2"
          },
          "capacityCommitted": {
            "weightKg": 6000,
            "volumeM3": 7.776
          }
        }
      }
    ]
  }
}
$c01manifest$::jsonb);
create temporary table c01_refs(name text primary key,id uuid not null) on commit drop;
create temporary table c01_actors(name text primary key,organization_id uuid,actor_id uuid,auth_user_id uuid not null,carrier_id uuid) on commit drop;
create temporary table c01_receipts(name text primary key,result jsonb not null) on commit drop;
select set_config('c01.expected_sha256',:'c01_expected_sha256',true);
do $check$
declare m jsonb;begin
 if current_user<>'postgres' then raise exception 'C01_CONTROLLED_ACTIVATION_OWNER_REQUIRED';end if;
 if current_setting('c01.expected_sha256')<>'3ec394684362182803144cc34185614a1faa23f9bb8681c3211947ca85e39ab6' then raise exception 'C01_DATASET_HASH_NOT_APPROVED';end if;
 select value into m from c01_manifest;
 if m#>>'{autoConfirmAllowed}'<>'false' or exists(select 1 from jsonb_array_elements(m->'operations') x where x->>'api'='quotePolicy' and x#>>'{value,dispatch,autoConfirm}'<>'false') then raise exception 'C01_AUTOCONFIRM_NOT_APPROVED';end if;
 if to_regprocedure('public.read_v2_dispatch_options_with_admission(uuid,uuid,uuid,integer)') is null then raise exception 'C01_DDL_REQUIRED';end if;
 insert into c01_actors select 'client',o.id,member.id,member.auth_user_id,null from public.organizations o join public.organization_members member on member.organization_id=o.id
 where o.id=(m#>>'{existingReferences,client,organizationId}')::uuid and o.code=m#>>'{existingReferences,client,expectedCode}' and o.status='ACTIVE'
 and member.id=(m#>>'{existingReferences,client,memberId}')::uuid and member.role in('OWNER','SUPERVISOR') and member.status='ACTIVE' and member.auth_user_id is not null;
 insert into c01_actors select 'carrier',null,op.id,op.auth_user_id,c.id from public.carriers c join public.carrier_operators op on op.carrier_id=c.id
 where c.id=(m#>>'{existingReferences,carrier,carrierId}')::uuid and c.code=m#>>'{existingReferences,carrier,expectedCode}' and c.status='ACTIVE'
 and op.id=(m#>>'{existingReferences,carrier,operatorId}')::uuid and op.role='ADMIN' and op.status='ACTIVE' and op.verified_at<=now();
 -- Resolve an already authorized technical catalog administrator; never add a grant.
 insert into c01_actors select 'catalogAdmin',member.organization_id,member.id,member.auth_user_id,null from public.organization_members member join public.organizations o on o.id=member.organization_id
 where member.id=(m#>>'{existingReferences,catalogAdmin,memberId}')::uuid and member.organization_id=(m#>>'{existingReferences,catalogAdmin,organizationId}')::uuid
 and member.status='ACTIVE' and member.role in('OWNER','SUPERVISOR') and o.status='ACTIVE' and exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=member.auth_user_id and g.permission='CATALOG_ADMIN' and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()));
 if (select count(*) from c01_actors)<>3 then raise exception 'C01_EXISTING_IDENTITIES_OR_CATALOG_ADMIN_REQUIRED';end if;
 insert into c01_refs select 'category',id from public.cargo_categories where code='GENERAL' and active;
 if not exists(select 1 from c01_refs where name='category') then raise exception 'C01_GENERAL_CATEGORY_REQUIRED';end if;
 if (m#>>'{evidence,validUntil}')::timestamptz<=now() or (m#>>'{pickupWindow,startsAt}')::timestamptz<=now() then raise exception 'C01_DATASET_EXPIRED_NEW_VERSION_REQUIRED';end if;
end;$check$;

create function pg_temp.c01_resolve(v jsonb) returns jsonb language plpgsql as $f$
declare answer jsonb;key text;item jsonb;ident uuid;begin
 if jsonb_typeof(v)='object' and v?'$ref' then
  if (select count(*) from jsonb_object_keys(v))<>1 then raise exception 'C01_BAD_REFERENCE';end if;
  select id into ident from c01_refs where name=v->>'$ref';if ident is null then raise exception 'C01_UNRESOLVED_REFERENCE: %',v->>'$ref';end if;return to_jsonb(ident);
 elsif jsonb_typeof(v)='object' then
  answer:='{}';for key,item in select * from jsonb_each(v) loop answer:=answer||jsonb_build_object(key,pg_temp.c01_resolve(item));end loop;return answer;
 elsif jsonb_typeof(v)='array' then
  answer:='[]';for item in select value from jsonb_array_elements(v) loop answer:=answer||jsonb_build_array(pg_temp.c01_resolve(item));end loop;return answer;
 end if;return v;end;$f$;

do $activate$
declare op jsonb;actor record;v jsonb;s jsonb;r jsonb;ident uuid;c uuid;key uuid;begin
 for op in select item.value from c01_manifest m cross join lateral jsonb_array_elements(m.value->'operations') item loop
  select * into actor from c01_actors where name=op->>'actor';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated')::text,true);
  v:=pg_temp.c01_resolve(op->'value');s:=pg_temp.c01_resolve(op->'scope');key:=(op->>'idempotencyKey')::uuid;c:=actor.carrier_id;
  if op->>'api'='facility' then
   r:=public.command_v2_facility(actor.organization_id,actor.actor_id,key,null,null,v);ident:=(r#>>'{row,id}')::uuid;
  elsif op->>'api'='catalog' then
   r:=public.command_v2_carrier_catalog(actor.actor_id,s->>'kind',c,(s->>'serviceId')::uuid,null,key,null,v);ident:=(r#>>'{record,id}')::uuid;
  elsif op->>'api'='workflow' and op->>'actor'='carrier' then
   r:=public.command_v2_carrier_workflow(actor.actor_id,s->>'action',jsonb_build_object('carrierId',c,'requestId',null,'parentId',null,'id',null),key,v);ident:=(r#>>'{record,id}')::uuid;
  elsif op->>'api'='workflow' then
   r:=public.command_v2_workflow(actor.organization_id,actor.actor_id,s->>'action',jsonb_build_object('carrierId',null,'requestId',null,'parentId',null,'id',null),key,v);ident:=(r#>>'{record,id}')::uuid;
  elsif op->>'api'='quotePolicy' then
   r:=public.configure_v2_quote_policy(c,actor.actor_id,key,0,v);ident:=(r->>'id')::uuid;
  else raise exception 'C01_UNKNOWN_OPERATION';end if;
  if ident is null then raise exception 'C01_NATIVE_RECORD_ID_REQUIRED: %',op->>'ref';end if;
  insert into c01_refs values(op->>'ref',ident);insert into c01_receipts values(op->>'ref',r);
 end loop;
end;$activate$;
select jsonb_build_object('dataset','C-01-SIM','version',1,'manifestSHA256','3ec394684362182803144cc34185614a1faa23f9bb8681c3211947ca85e39ab6','autoConfirm',false,
 'references',(select jsonb_object_agg(name,id) from c01_refs),
 'operations',(select jsonb_agg(jsonb_build_object('ref',name,'id',coalesce(result#>>'{record,id}',result#>>'{row,id}',result->>'id'),'replay',coalesce(result->'replay',result#>'{meta,idempotentReplay}'))) from c01_receipts),
 'requestTemplate',pg_temp.c01_resolve((select value->'requestTemplate' from c01_manifest))) as activation_result;
commit;
