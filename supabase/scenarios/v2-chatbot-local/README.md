# Local chatbot and carrier offer scenario

Local synthetic fixture only. Requires the V2 migrations and the HAC-44 `v2-full-flow-qa/seed.sql` scenario. This companion seed enables a password login for HAC-44's synthetic active operator (who is both a shipper member and a carrier operator), then uses the authenticated native workflow command to create an **unquoted** ROAD opportunity. It reuses the recorded plan, 100 km route, BOX_TRUCK and carrier rather than inventing a quote or booking. No tariff is seeded: enter a USD/km rate in the carrier portal to test the estimator. Existing HAC-44 offered/booked/completed cases remain visible separately.

Run only against `supabase_db_cargomesh-v2-local` after verifying it is the local Docker profile and taking a backup. From the repository root in PowerShell:

```powershell
docker exec supabase_db_cargomesh-v2-local mkdir -p /tmp/cargomesh-chatbot-local
docker cp supabase/scenarios/v2-chatbot-local/seed.sql supabase_db_cargomesh-v2-local:/tmp/cargomesh-chatbot-local/seed.sql
docker cp supabase/scenarios/v2-chatbot-local/verify.sql supabase_db_cargomesh-v2-local:/tmp/cargomesh-chatbot-local/verify.sql
docker exec supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -v local_only=1 -U postgres -d postgres -f /tmp/cargomesh-chatbot-local/seed.sql
docker exec supabase_db_cargomesh-v2-local psql -X -v ON_ERROR_STOP=1 -v local_only=1 -U postgres -d postgres -f /tmp/cargomesh-chatbot-local/verify.sql
```

Local-only browser account: `local-only-hac44-1@cargomesh.test` / `LOCAL_ONLY_CARGOMESH_CHATBOT_2026!`. Never use this credential in hosted environments. The fixture's opportunity expires after one hour; rerun this companion seed to generate a new pending alert after expiry or after sending an offer. Earlier records remain as history. The `chatbot_qa.current_alert` row stores only the newest alert ID.

At `http://localhost:3000`, sign in, open the shipper request chat to test intake, then switch to the connected Carrier portal. The new alert opens Nova on the exact opportunity. The estimator must show `100 km · BOX_TRUCK`; entering `2.50 USD/km` yields an indicative `USD 250.00`. Say `change the price to 275 dollars` to test the override, then inspect the editable offer and its evidence before explicit submission. The existing offer and booking records belong to other opportunities; they must not be treated as this alert's response.
