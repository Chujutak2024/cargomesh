\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
DO $$ BEGIN RAISE EXCEPTION 'CHATBOT_LOCAL_ONLY'; END $$;
\endif
DO $$ DECLARE o public.carrier_opportunities%ROWTYPE; BEGIN
 IF (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261015122904' THEN
  RAISE EXCEPTION 'CHATBOT_V2_MIGRATIONS_OUTDATED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN auth.identities i ON i.user_id=u.id AND i.provider='email'
  WHERE u.id='d4410000-0000-4000-8000-000000000001' AND u.encrypted_password IS NOT NULL) THEN
  RAISE EXCEPTION 'CHATBOT_LOCAL_LOGIN_MISSING';
 END IF;
 SELECT c.* INTO o FROM chatbot_qa.current_alert m JOIN public.carrier_opportunities c ON c.id=m.opportunity_id WHERE m.id='carrier-alert';
 IF o.id IS NULL OR o.status NOT IN('SENT','ACCEPTED') OR o.carrier_id<>'d4440000-0000-4000-8000-000000000001'
  OR o.organization_id<>'d4400000-0000-4000-8000-000000000001'
  OR (o.data->>'responseDeadline')::timestamptz<=now()
  OR (o.data->'assignmentSnapshots'->0->'routeLeg'->>'estimatedDistanceKm')::numeric<>100
  OR o.data->'assignmentSnapshots'->0->'resource'->>'equipment'<>'BOX_TRUCK'
  OR EXISTS(SELECT 1 FROM public.v2_carrier_offers f WHERE f.parent_id=o.id) THEN
  RAISE EXCEPTION 'CHATBOT_ALERT_FIXTURE_INVALID';
 END IF;
END $$;
SELECT 'CHATBOT_LOCAL_SCENARIO_OK' AS result;
