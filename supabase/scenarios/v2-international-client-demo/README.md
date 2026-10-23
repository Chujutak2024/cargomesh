# International Client demo — synthetic V2 scenario

Adds 32 facilities to the existing synthetic Pacific Produce organization: **37 facilities in 17 countries**: 5 existing facilities (Lima, Arequipa, Tacna and the two reviewed C01 facilities) plus 32 new facilities. Judges can describe a request using any of these saved locations. This does not add carriers, tariffs, service lanes, confirmed availability, quotes, users or memberships.

Countries added: US, CA, MX, CO, EC, CL, BR, AR, ES, FR, DE, GB, IN, JP, AU, ZA. Each has two cities; `manifest.json` is the complete dataset. Addresses are fictional, coordinates approximate city centres, operating hours unknown. Every new label is visibly `[SYNTHETIC]`. All five existing rows are unchanged. The two C01 exceptions require the exact ID, code and organization triples recorded in `manifest.json`; other IDs, renamed codes or another organization are rejected. They are pre-existing data, not new scenario fixtures.

## Apply and verify

Jean applies the reviewed PR head through Supabase Dashboard → project `cargomesh-v2` → SQL Editor after Cristhian authorizes it: run the whole `seed.sql` once, then `verify.sql`. Review the project and organization first; no database connection URL or keys are needed. The transaction refuses a missing/ordinary organization, missing baseline PE facilities, unexpected active facilities and ID/code/content collisions. An exact rerun is a no-op; it never overwrites edits. No production migration is needed. SQL has not been applied to hosted data by preparing this package.

Use `cleanup.sql` only for an explicit rollback after review. It deletes only this scenario's exact IDs from the synthetic tenant; references may prevent deletion and must be inspected instead of cascaded. Do not delete judges' requests to force cleanup.

## Acceptance

- Intake options for the demo member include the 32 new rows and all 5 existing facilities; another tenant sees none of them under native RLS.
- Voice catalog contains at most 40 locations; all 37 fit. A missing existing PE row is an environment discrepancy, not permission to fabricate it.
- Example domestic requests: New York → Los Angeles; Madrid → Barcelona; Tokyo → Osaka; Sydney → Melbourne. Example cross-border intake: Toronto → New York. Without Carrier coverage, evaluation ends with a "no coverage" explanation and no offers. This package creates no services or international Carrier coverage; customs and availability are not confirmed.
- ROAD is the implemented transport path. Intercontinental endpoints may be saved as an intake draft, but this dataset does not create a ROAD connection across oceans or certify AIR/SEA/RAIL.
- Browser: select and correct locations in both the written and spoken conversation, review the structured draft, and explicitly confirm save. SQL counts alone do not certify the complete request/quote workflow.
