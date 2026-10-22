-- Authorized synthetic demo fixture, 2026-10-22.
-- Declarative manifest for native Carrier ADMIN commands.
-- This SELECT does not activate data. Replay driver creations and regular-driver
-- links through authenticated native APIs with idempotency and expectedVersion.
-- Existing records belong to the authorized demo Carrier; no real identity,
-- license, driving experience or availability is asserted by these fixtures.
select
$fixture$
{
  "schemaVersion": "2.0",
  "scenario": "v2-demo-fleet-crew-20261022",
  "carrierId": "e4440000-0000-4000-8000-000000000001",
  "provenance": "SIMULATED",
  "drivers": [
    {
      "id": "e8f86f55-96ef-4223-9199-91f2e61493b6",
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "e4460000-0000-4000-8000-000000000001",
        "fullName": "Pedro Sánchez",
        "portalAccountId": null,
        "licenseClass": "SIMULATED_A_III",
        "licenseValidUntil": "2027-10-22",
        "licenseTimezone": "America/Lima",
        "qualifications": [],
        "experienceYears": null,
        "dutyStatus": "UNKNOWN",
        "evidence": {
          "reference": "simulation:demo-fleet-crew-20261022:CAM-002",
          "verifiedAt": "2026-10-22T17:38:28.882Z",
          "validUntil": "2027-10-23T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "availableWindows": [],
        "dutyWindow": null,
        "maximumDutySeconds": null,
        "usedDutySeconds": 0
      }
    },
    {
      "id": "9531da61-3a8e-4ed0-95d6-f258b090c1e9",
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "e4460000-0000-4000-8000-000000000001",
        "fullName": "Valeria Mendoza",
        "portalAccountId": null,
        "licenseClass": "SIMULATED_A_III",
        "licenseValidUntil": "2027-10-22",
        "licenseTimezone": "America/Lima",
        "qualifications": [],
        "experienceYears": null,
        "dutyStatus": "UNKNOWN",
        "evidence": {
          "reference": "simulation:demo-fleet-crew-20261022:CAM-003",
          "verifiedAt": "2026-10-22T17:38:36.589Z",
          "validUntil": "2027-10-23T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "availableWindows": [],
        "dutyWindow": null,
        "maximumDutySeconds": null,
        "usedDutySeconds": 0
      }
    },
    {
      "id": "f488243b-b87c-4916-8c66-8134977eb796",
      "value": {
        "schemaVersion": "2.0",
        "serviceId": "1e48a996-9889-4d82-adb2-08ea6963f7bf",
        "fullName": "Miguel Quispe",
        "portalAccountId": null,
        "licenseClass": "SIMULATED_A_III",
        "licenseValidUntil": "2027-10-22",
        "licenseTimezone": "America/Lima",
        "qualifications": [],
        "experienceYears": null,
        "dutyStatus": "UNKNOWN",
        "evidence": {
          "reference": "simulation:demo-fleet-crew-20261022:CAM-008",
          "verifiedAt": "2026-10-22T17:38:39.503Z",
          "validUntil": "2027-10-23T00:00:00Z",
          "provenanceStatus": "SIMULATED"
        },
        "availableWindows": [],
        "dutyWindow": null,
        "maximumDutySeconds": null,
        "usedDutySeconds": 0
      }
    }
  ],
  "regularDrivers": [
    {
      "assetId": "d8d2e9b3-03f1-43c7-bf1d-6cc174f5605e",
      "serviceId": "c5160928-d446-482b-835f-7164e122eab0",
      "driverId": "c90f9675-6229-4ec7-868b-003da77dba6a",
      "truck": "C01-T1",
      "driver": "Mariana Torres"
    },
    {
      "assetId": "add626e5-07d5-4bce-bf69-3c7dd109fd3c",
      "serviceId": "c5160928-d446-482b-835f-7164e122eab0",
      "driverId": "ad89876d-af4f-41d2-a0a1-be6689bfa0e1",
      "truck": "C01-T2",
      "driver": "Carlos Medina"
    },
    {
      "assetId": "fbc945f6-52f4-4165-8383-4454f8f45a18",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "17d0325e-8e8b-4721-9756-bf00e60e55a2",
      "truck": "CAM-001",
      "driver": "Roberto Salazar"
    },
    {
      "assetId": "3dae46b9-925d-4678-a5f8-7b081068570f",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "93192799-6ad7-46a8-882a-d92b0a197e38",
      "truck": "CAM-004",
      "driver": "Diego Vargas"
    },
    {
      "assetId": "11134912-5bae-40c4-91df-cc3743d58567",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "4b23aba5-e319-407d-b037-5f8f9d325933",
      "truck": "CAM-005",
      "driver": "Ana Rojas"
    },
    {
      "assetId": "57ca661f-d94a-4565-a4e4-d95a19b1d2ed",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "984407b0-cb4a-4969-9f58-d6ca60f1cc53",
      "truck": "CAM-006",
      "driver": "Jorge Castillo"
    },
    {
      "assetId": "b6f55177-d8d6-498e-ac94-f7c95336ed86",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "fb9cf63a-d75b-45f9-bb7d-965f38d4727c",
      "truck": "CAM-007",
      "driver": "Lucía Paredes"
    },
    {
      "assetId": "ac095705-e8d1-4966-8213-87dd20e3fa43",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "e8f86f55-96ef-4223-9199-91f2e61493b6",
      "truck": "CAM-002",
      "driver": "Pedro Sánchez"
    },
    {
      "assetId": "db387c12-dd81-42cc-9e11-060dca589031",
      "serviceId": "e4460000-0000-4000-8000-000000000001",
      "driverId": "9531da61-3a8e-4ed0-95d6-f258b090c1e9",
      "truck": "CAM-003",
      "driver": "Valeria Mendoza"
    },
    {
      "assetId": "b63b1772-5317-4eea-9de4-030c8d5dda37",
      "serviceId": "1e48a996-9889-4d82-adb2-08ea6963f7bf",
      "driverId": "f488243b-b87c-4916-8c66-8134977eb796",
      "truck": "CAM-008",
      "driver": "Miguel Quispe"
    }
  ]
}
$fixture$::jsonb as native_command_manifest;

