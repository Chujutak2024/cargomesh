# HAC-54 — dated local preparation for October 21

This separate **synthetic, local-only** package does not redate or replace the October 20 H4 recipe. It reuses the H2 catalog/network references and the existing local Client/Carrier identities. Business records are created by authenticated native commands, never SQL inserts or runtime fixture fallback. Jean's base manifest is unchanged.

Prerequisites: approved main `f17fdc6` merged into the registered HAC-54 branch, the existing V2 Docker bank on gateway `127.0.0.1:61321`, current migrations, existing H2 references and the app on port 3000. This is not a clean-database bootstrap. See the [integration/limitations report](../../../docs/v2-amazon/delivery/HAC54_OCT21_PREPARATION_2026-10-20.md).

## Explicit dates (2026)

| Purpose | UTC | America/Bogota / Lima (UTC−5) |
| --- | --- | --- |
| Synthetic evidence observed | Oct 20 19:00 | Oct 20 14:00 |
| Pickup window | Oct 21 11:00–18:00 | Oct 21 06:00–13:00 |
| Opportunity response deadline | Oct 21 18:00 | Oct 21 13:00 |
| Delivery window | Oct 21 17:00–Oct 22 03:00 | Oct 21 12:00–22:00 |
| Plan / assignment window | Oct 21 11:00–Oct 22 03:00 | Oct 21 06:00–22:00 |
| Capacity hold expiry | Oct 22 03:00 | Oct 21 22:00 |
| Quote expiry | Oct 22 05:00 | Oct 22 00:00 (end of Oct 21) |
| Catalog evidence validity | Oct 28 00:00 | Oct 27 19:00 |

The quote, response and hold horizons are distinct. A response deadline cannot exceed the pickup window; a hold cannot outlive its assignment. Preparation does **not** record future physical events. This is a day-specific dataset, not evergreen data or live transport.

## Prepare (already run locally)

From `cargomesh/`, PowerShell:

```powershell
$env:HAC54_LOCAL_ACCESS_FILE='C:/Users/holap/Documents/Codex/CargoMesh-HAC54-local-access.txt'
$env:HAC54_LOCAL_AUTHORIZE_SYNTHETIC_BOOKING='1'
$env:HAC54_LOCAL_SCENARIO='v2-hac54-validation-2026-10-21'
$env:HAC54_LOCAL_PHASE='prepare'
node --env-file=.env.local --conditions=react-server --import tsx scripts/hac54-h4-local.mjs
```

Do not publish the access file or `.env.local`. The runner verifies the named local Docker gateway. New dated namespace/action keys preserve earlier H2/H3/H4 records; repeated preparation in this bank reuses the same native IDs. Native entity UUIDs are database-generated, not portable deterministic IDs. Expired/future evidence or arbitrary scenario names/phases fail before login.

Observed preparation: **12 cases; six exact execution chains verified**, including one cancelled execution. Transit/delivery/incident cases remain `PLANNED` with no position/start/delivery/incident events. Case 07 has two available native ranked offers, **zero decisions and zero bookings**. Replays inspect, never overwrite, later human selection/authorization.

## Native execution phase (not run on October 20)

Between October 21 06:00 and 22:00 Bogota time, the authorized local test runner can use the same command with `HAC54_LOCAL_PHASE='execute'` to record native synthetic operator starts/positions/completion/incident. It refuses before or after the assignment window; it does not change the system clock or forge event timestamps. Do not run `prepare` after changing these executions. This is a synthetic fixture command, not a human acceptance test.

Case 07 is always left for the human Client. Open `/clients/requests/8671391b-89a8-44c0-9e14-b99c5af26bc7`, compare USD 325/350, review selection, explicitly confirm, then review/authorize booking with consent. A booking authorization is not Carrier confirmation, a capacity hold or an execution. Continue using the Carrier's valid resource/confirmation operations; no automatic substitute booking is created.

## Observed local manifest

All request links are `/clients/requests/{id}`; execution links are `/clients/tracking/{id}`.

| Case | Request | Booking | Execution / actual preparation state |
| --- | --- | --- | --- |
| 01 planned | `cc83f1b6-eaec-4fa2-b8db-dd20f6f6375f` | `731008fa-49f4-40ae-a164-f12c6fc00c00` | `4263816c-7646-4424-80a0-6b718e91415d` PLANNED |
| 02 future transit | `2b9bd666-f89b-49ef-b00d-d3bdd9b9dc69` | `da5d0f2f-c1f7-4b5b-98fd-66b2ec9f5e04` | `e80b1fac-4aff-4e0d-b375-e87fc5c6217e` PLANNED |
| 03 future delivery | `64d20af3-d150-4286-8779-8751c104db13` | `6885a386-1479-4d59-9f08-f2346d567d8d` | `1435985c-2bdc-4dd8-81b1-732d76ff76a3` PLANNED |
| 04 future incident | `66527968-1b5e-414f-b8ca-f1306f58ca7b` | `ebcf57f2-45ae-452c-8d80-ad87cc124a37` | `162e8453-bd1b-4dc2-a146-1bbf9b00aff7` PLANNED |
| 05 cancellation | `c6bff083-1f61-4983-8ae3-d03743d7be89` | `74104629-315e-4a6d-adc2-3787c93ea606` CANCELLED | `670b155d-d369-4e7e-be7e-04ce14c88ab7` CANCELLED |
| 06 rejection | `0cc3897a-d789-41e6-a4a4-0cdefe9a7ef9` | `4e928884-8038-433a-833e-5332fd7b5f81` REJECTED | None; rejection is not physical tracking |
| 07 human comparison | `8671391b-89a8-44c0-9e14-b99c5af26bc7` | None | Two offers, selection and consent pending |
| 08 cold compatible | `cadf8926-8906-474b-b28c-9a7a0bbc52f2` | `cc353ae6-9727-4217-b5d0-d6d336960e16` | `747c5750-0996-47a9-86ff-4181daeb40ef` PLANNED |
| 09 thermal mismatch | `4c508773-2db4-4ab4-916e-d2552adfb581` | None | UNKNOWN, `TEMPERATURE_CAPABILITY_UNKNOWN`; selection 409 |
| 10 no coverage | `4ab077db-dc5f-4d64-a261-aa946118d0f2` | None | INELIGIBLE; no offers/bookings |
| 11 occupied | `80be6dc8-8bc8-489a-8a24-d7e5879c765a` | None | INELIGIBLE, `RESOURCE_OCCUPIED`; selection 409 |
| 12 unknown | `a25712ca-4570-49a5-a63c-ddfa5034d93d` | None | UNKNOWN, `RESOURCE_WINDOW_UNKNOWN`; selection 409 |

The previous October 20 transit/delivery/incident cases remain readable for immediate visual inspection; they are not fresh October 21 commercial offers. No records were deleted.
