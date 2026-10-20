# HAC-54 H2 — explicit local native transaction

This is a dated **synthetic local** scenario, not a hosted seed or runtime fallback. `seed.sql` emits a recipe in a read-only transaction; `cargomesh/scripts/hac54-h2-local.mjs` applies it through authenticated native HTTP actions. It refuses any Supabase origin other than `http://127.0.0.1:61321` and verifies the named local Docker gateway. It neither disables guards nor writes migrations.

Run from `cargomesh/`, loading the ignored local environment and supplying `HAC54_LOCAL_CLIENT_PASSWORD` and `HAC54_LOCAL_CARRIER_PASSWORD` in the process environment, then `node --conditions=react-server --import tsx scripts/hac54-h2-local.mjs`. Do not print or commit credentials. The existing Carrier ADMIN authenticates through the local Mailpit OTP only to publish physical limits; the quote issuer remains an independently authorized OPERATOR.

Clock: October 20, 2026 UTC. Quote expires **October 22, 2026 00:00 UTC**; pickup/delivery October 23. The runner refuses an expired recipe rather than silently changing historical dates. Native idempotency keys derive from the case/action and retain the original payload. No old resources, quotes or bookings are reset.

## Observed native records

| Entity | ID |
| --- | --- |
| Request | `745929db-5a19-48f1-8667-3c04358c0771` |
| Plan | `1c9996e2-e820-49ef-80f1-dff4d37388d0` |
| Opportunity | `8e589375-8ef1-4668-9c7e-ca450bc31b7f` |
| Superseded quote v1, USD 350 | `b7a755cd-6445-4eb4-9ae0-0de21c7125cb` |
| Current quote v2, USD 325 | `a1e63e89-7454-42bc-bf0e-d26c9d3338a8` |
| Ranking | `4ac9f305-3a6a-420f-84d7-dd4debf18bfd` |

Observed: eligible native plan; opportunity replay same ID; stale Carrier response 409; Client quote issuance 403; native supersession; same exact quote read by Client and Carrier; USD 325 backend-ranked option. **H2 created no decision, booking or execution.** Later H3 testing may extend this case explicitly; rerun H2's final no-booking assertion only before that extension.

The assigned Client can open `/clients/requests/745929db-5a19-48f1-8667-3c04358c0771`; Carrier uses `/carriers/requests`. Local access provisioning is documented separately in `docs/v2-amazon/delivery/HAC54_LOCAL_ACCESS_2026-10-20.md`.
