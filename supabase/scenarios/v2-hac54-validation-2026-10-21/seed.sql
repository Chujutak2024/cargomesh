\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'HAC54_LOCAL_ONLY'; end $$;
\endif
-- New dated recipe, not an edit/replay of the historical October 20 package.
begin read only;
select jsonb_build_object(
 'package','HAC54-VALIDATION-2026-10-21','resourcePrefix','H54_21_',
 'clock','2026-10-20T19:00:00.000Z','expiresAt','2026-10-22T05:00:00.000Z','validUntil','2026-10-28T00:00:00.000Z',
 'responseDeadline','2026-10-21T18:00:00.000Z',
 'holdExpiresAt','2026-10-22T03:00:00.000Z',
 'pickupWindow','{"startsAt":"2026-10-21T11:00:00.000Z","endsAt":"2026-10-21T18:00:00.000Z"}'::jsonb,
 'deliveryWindow','{"startsAt":"2026-10-21T17:00:00.000Z","endsAt":"2026-10-22T03:00:00.000Z"}'::jsonb,
 'planWindow','{"startsAt":"2026-10-21T11:00:00.000Z","endsAt":"2026-10-22T03:00:00.000Z"}'::jsonb,
 'manualSelectionCase','07_COMPARISON',
 'driver',jsonb_build_object('schemaVersion','2.0','fullName','[SYNTHETIC] HAC54 Oct 21 ROAD operator','portalAccountId',null,
   'licenseClass','H54_QA','licenseValidUntil','2030-01-01','licenseTimezone','America/Lima','qualifications','[]'::jsonb,
   'experienceYears',null,'dutyStatus','AVAILABLE','maximumDutySeconds',86400,'usedDutySeconds',0),
 'cases','[
  {"code":"01_PLANNED","outcome":"PLANNED"},
  {"code":"02_TRANSIT","outcome":"IN_PROGRESS"},
  {"code":"03_DELIVERED","outcome":"COMPLETED"},
  {"code":"04_INCIDENT","outcome":"INCIDENT"},
  {"code":"05_CANCELLED","outcome":"CANCELLED"},
  {"code":"06_REJECTED","outcome":"REJECTED"},
  {"code":"07_COMPARISON","outcome":"COMPARE"},
  {"code":"08_COLD_COMPATIBLE","outcome":"COLD_OK","temperature":{"minCelsius":0,"maxCelsius":8}},
  {"code":"09_COLD_INCOMPATIBLE","outcome":"COLD_BAD","temperature":{"minCelsius":10,"maxCelsius":20}},
  {"code":"10_NO_COVERAGE_V2","outcome":"NO_COVERAGE"},
  {"code":"11_OCCUPIED_V2","outcome":"BUSY"},
  {"code":"12_UNKNOWN_V2","outcome":"UNKNOWN"}
 ]'::jsonb);
rollback;
