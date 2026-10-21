\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'V2_CASES_LOCAL_ONLY'; end $$;
\endif
begin read only;
select $scenario$
{
  "schemaVersion": "2.0",
  "scenarioId": "CLIENT_CARRIER_ORDERED_CASES_20261021_V1",
  "scope": "LOCAL_ONLY",
  "provenanceStatus": "SIMULATED",
  "activation": "RECIPE_ONLY",
  "validUntil": "2026-10-26T00:00:00Z",
  "pickupWindow": {
    "startsAt": "2026-10-22T13:00:00Z",
    "endsAt": "2026-10-22T15:00:00Z"
  },
  "deliveryWindow": {
    "startsAt": "2026-10-23T13:00:00Z",
    "endsAt": "2026-10-23T18:00:00Z"
  },
  "routes": [
    {
      "key": "DIRECT",
      "cities": [
        "Lima",
        "Arequipa"
      ],
      "distanceKm": 100,
      "durationSeconds": 3600,
      "source": "SIMULATED",
      "realRoadDistance": false
    },
    {
      "key": "TRANSFER",
      "cities": [
        "Lima",
        "Ica",
        "Arequipa"
      ],
      "distanceKm": 200,
      "durationSeconds": 7200,
      "source": "SIMULATED",
      "realRoadDistance": false
    }
  ],
  "cases": [
    {
      "code": "01_FTL",
      "phase": 1,
      "description": "Una oferta y un camión, autorización y capacidad separadas",
      "expected": "PREPARED_AWAITING_CARRIER",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] FTL base",
        "packaging": "PALLET",
        "totalWeightKg": 100,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 100,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "trucks": [
        {
          "usefulCapacityKg": 10000,
          "volumeM3": 40
        }
      ],
      "expectedBookings": 1,
      "expectedHolds": 1,
      "automatedQuote": true,
      "evidenceFile": "supabase/tests/40_v2_quote_automation.test.sql"
    },
    {
      "code": "02_TWO_BOOKINGS",
      "phase": 2,
      "description": "Dos ofertas complementarias de dos tramos de una misma solicitud",
      "expected": "AUTHORIZED",
      "route": "TRANSFER",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] ofertas complementarias",
        "packaging": "PALLET",
        "totalWeightKg": 1000,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 1000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "expectedBookings": 2,
      "expectedHolds": 2,
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/41_v2_multiple_bookings.test.sql"
    },
    {
      "code": "03_RETRY",
      "phase": 2,
      "description": "Reintentar la misma autorización conserva el booking original",
      "expected": "REPLAY",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] reintento",
        "packaging": "PALLET",
        "totalWeightKg": 100,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 100,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "expectedBookings": 1,
      "expectedHolds": 1,
      "automatedQuote": true,
      "evidenceFile": "supabase/tests/41_v2_multiple_bookings.test.sql"
    },
    {
      "code": "04_TWO_TRUCKS",
      "phase": 3,
      "description": "Dos pallets enteros de 4 t, uno por camión de 5 t",
      "expected": "ELIGIBLE_PLAN",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] dos camiones",
        "packaging": "PALLET",
        "totalWeightKg": 8000,
        "totalVolumeM3": 4,
        "divisible": true,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 2,
            "weightPerUnitKg": 4000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "trucks": [
        {
          "usefulCapacityKg": 5000,
          "volumeM3": 40
        },
        {
          "usefulCapacityKg": 5000,
          "volumeM3": 40
        }
      ],
      "corridorPayloadLimitKg": 10000,
      "allocations": [
        {
          "unitIndex": 0,
          "quantity": 1,
          "truckIndex": 0
        },
        {
          "unitIndex": 0,
          "quantity": 1,
          "truckIndex": 1
        }
      ],
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/42_v2_multiple_trucks.test.sql"
    },
    {
      "code": "05_INDIVISIBLE",
      "phase": 3,
      "description": "Una pieza de 12 t no puede dividirse entre dos camiones de 10 t",
      "expected": "INELIGIBLE",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] pieza indivisible",
        "packaging": "PALLET",
        "totalWeightKg": 12000,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 12000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "trucks": [
        {
          "usefulCapacityKg": 10000,
          "volumeM3": 40
        },
        {
          "usefulCapacityKg": 10000,
          "volumeM3": 40
        }
      ],
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/26_v2_hac40_workflow_constraints.test.sql"
    },
    {
      "code": "06_ROUTE_TOTAL_LIMIT",
      "phase": 3,
      "description": "Dos piezas de 6 t y vía limitada a 10 t por vehículo: bloqueo actual del ruteador",
      "expected": "KNOWN_LIMITATION",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] límite agregado de ruta",
        "packaging": "PALLET",
        "totalWeightKg": 12000,
        "totalVolumeM3": 4,
        "divisible": true,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 2,
            "weightPerUnitKg": 6000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "corridorPayloadLimitKg": 10000,
      "automatedQuote": false,
      "blocker": "ROUTE_PAYLOAD_LIMIT_EXCEEDED",
      "evidenceFile": "supabase/tests/42_v2_multiple_trucks.test.sql"
    },
    {
      "code": "07_OVERLAP",
      "phase": 3,
      "description": "El mismo camión ya comprometido en la misma ventana",
      "expected": "INELIGIBLE",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] solape",
        "packaging": "PALLET",
        "totalWeightKg": 1000,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 1000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/32_v2_hac40_uml_cardinalities.test.sql"
    },
    {
      "code": "08_ROUTE_PROVENANCE",
      "phase": 4,
      "description": "Conservar dirección, nodos, versiones y evidencia de ruta",
      "expected": "PUBLISHED_CORRIDORS",
      "route": "TRANSFER",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] ruta dirigida",
        "packaging": "PALLET",
        "totalWeightKg": 1000,
        "totalVolumeM3": 2,
        "divisible": false,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 1,
            "weightPerUnitKg": 1000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/32_v2_hac40_uml_cardinalities.test.sql"
    },
    {
      "code": "09_EXPIRED_LIMITS",
      "phase": 4,
      "description": "Límites o evidencia vencidos no confirman disponibilidad",
      "expected": "UNKNOWN",
      "route": "DIRECT",
      "cargo": {
        "categoryCode": "GENERAL",
        "description": "[SYNTHETIC] evidencia vencida",
        "packaging": "PALLET",
        "totalWeightKg": 8000,
        "totalVolumeM3": 4,
        "divisible": true,
        "requirements": [],
        "units": [
          {
            "packageType": "PALLET",
            "quantity": 2,
            "weightPerUnitKg": 4000,
            "volumePerUnitM3": 2,
            "dimensionsCm": {
              "length": 100,
              "width": 100,
              "height": 200
            },
            "indivisible": true,
            "stackable": false
          }
        ]
      },
      "automatedQuote": false,
      "evidenceFile": "supabase/tests/42_v2_multiple_trucks.test.sql"
    }
  ],
  "deferred": [
    "Captura de categorías y temperatura independientes por línea",
    "Generación automática de un plan de varios camiones",
    "Activación de estos pedidos/reservas en Supabase alojado",
    "Corregir el límite agregado del ruteador antes de anunciar el caso 06 como operativo"
  ]
}
$scenario$::jsonb;
rollback;
