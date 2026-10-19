# HAC-50 — Juan registration fields without production persistence

Date: 2026-10-17. Scope: existing Carrier asset and driver contracts, Juan frontend.

## Observed gap

Juan's local form captures year, free-form description, vehicle photo, tank capacity, fuel/consumption and insurance/inspection dates. The canonical asset schema does not store several of these fields, while telemetry and document evidence need their own source/contract. Local examples are not production evidence.

## Current resolution

Preserve the visible field groups, disable unsupported inputs and label them pending. Submit only validated canonical fields. Do not overload `evidence` with arbitrary JSON or report an unsupported field as saved. Existing unedited persisted attributes survive revisions. Driver performance and photo/base/shift remain unknown when not present in the authorized record.

## Follow-up

Agree which profile fields belong to the asset, which belong to documented capability/compliance evidence, and which need telemetry or media storage. Add contracts and persistence before enabling those controls. Photo upload also needs storage access rules and validation. This increment did not modify hosted data or migrations.

Evidence: `HAC50_JUAN_FLEET_BACKEND_ADAPTATION_2026-10-17.md` and `salida/juan-fleet-backend-20261017/`.
