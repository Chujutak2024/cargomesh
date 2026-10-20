\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'HAC54_LOCAL_ONLY'; end $$;
\endif
-- Separate commercial recipe: native authenticated commands perform every business write.
begin read only;
select jsonb_build_object(
 'package','HAC54-H4-2026-10-20','clock','2026-10-20T00:00:00.000Z',
 'expiresAt','2026-10-20T22:00:00.000Z','validUntil','2026-10-28T00:00:00.000Z',
 'pickupWindow','{"startsAt":"2026-10-20T08:00:00.000Z","endsAt":"2026-10-20T23:00:00.000Z"}'::jsonb,
 'deliveryWindow','{"startsAt":"2026-10-20T16:00:00.000Z","endsAt":"2026-10-21T06:00:00.000Z"}'::jsonb,
 'planWindow','{"startsAt":"2026-10-20T08:00:00.000Z","endsAt":"2026-10-21T06:00:00.000Z"}'::jsonb,
 'driver',jsonb_build_object('schemaVersion','2.0','fullName','[SYNTHETIC] HAC54 ROAD operator','portalAccountId',null,
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
