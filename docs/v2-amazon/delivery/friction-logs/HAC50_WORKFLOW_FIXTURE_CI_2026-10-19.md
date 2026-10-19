# Workflow fixture CI adapter — 2026-10-19

PR #130 run 39203221440 passed application/build, V1 replay and the V2 migration/drift/pgTAP stage, but failed the workflow race fixture preparation. The adapter removes pgTAP planning/assertions from test 22 to reuse its native setup. HAC-50 added a throws_ok assertion before its hold boundary; the adapter kept it while removing no_plan, causing P0001 “test without a plan”.

The fixture adapter now also excludes throws_ok (including indentation), preserves the real Carrier response command, and restricts cleanup IDs to named direct records. The Carrier response envelope has a nested record and must not be treated as a direct-ID record. Production SQL, domain rules, assertions in test 22 and race expectations are unchanged. Three pure adapter regressions pass and are included before the V2 CI gate.

A local race run could not certify the fix: the existing dedicated local container lacks command_v2_carrier_workflow. Its transaction failed/rolled back during preparation; no schema was applied or local bank reset to repair this environment. The clean GitHub V2 bootstrap must confirm the complete race/HTTP/OAuth workflow on the corrected head before merge. No hosted database is modified.
