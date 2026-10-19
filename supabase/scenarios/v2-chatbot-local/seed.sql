\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
DO $$ BEGIN RAISE EXCEPTION 'CHATBOT_LOCAL_ONLY'; END $$;
\endif
DO $$ BEGIN
 IF inet_server_addr() IS NOT NULL AND inet_server_addr()::text NOT IN ('127.0.0.1','::1') THEN
  RAISE EXCEPTION 'CHATBOT_LOCAL_SOCKET_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='d4410000-0000-4000-8000-000000000001' AND email='local-only-hac44-1@cargomesh.test')
 OR NOT EXISTS (SELECT 1 FROM public.carrier_operators WHERE auth_user_id='d4410000-0000-4000-8000-000000000001' AND carrier_id='d4440000-0000-4000-8000-000000000001' AND status='ACTIVE')
 THEN RAISE EXCEPTION 'CHATBOT_FULL_FLOW_PREREQUISITE_MISSING'; END IF;
END $$;

BEGIN;
-- Only the synthetic HAC-44 account gains a local password login for manual browser QA.
UPDATE auth.users SET encrypted_password=extensions.crypt('LOCAL_ONLY_CARGOMESH_CHATBOT_2026!',extensions.gen_salt('bf')),
 raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,updated_at=now()
WHERE id='d4410000-0000-4000-8000-000000000001' AND email='local-only-hac44-1@cargomesh.test';
INSERT INTO auth.identities(id,user_id,identity_data,provider,provider_id,created_at,updated_at)
VALUES('ca700000-0000-4000-8000-000000000001','d4410000-0000-4000-8000-000000000001',
 '{"sub":"d4410000-0000-4000-8000-000000000001","email":"local-only-hac44-1@cargomesh.test"}'::jsonb,
 'email','local-only-hac44-1@cargomesh.test',now(),now())
ON CONFLICT(provider,provider_id) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS chatbot_qa;
CREATE TABLE IF NOT EXISTS chatbot_qa.current_alert(id text PRIMARY KEY,opportunity_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
SELECT CASE WHEN EXISTS (
 SELECT 1 FROM chatbot_qa.current_alert m JOIN public.carrier_opportunities o ON o.id=m.opportunity_id
 WHERE m.id='carrier-alert' AND o.status IN ('SENT','ACCEPTED')
 AND (o.data->>'responseDeadline')::timestamptz>now()+interval '10 minutes'
 AND NOT EXISTS(SELECT 1 FROM public.v2_carrier_offers f WHERE f.parent_id=o.id)
) THEN 'false' ELSE 'true' END AS seed_needed \gset

\if :seed_needed
-- The full-flow scenario supplies a valid persisted request, plan, assignment, route and carrier.
-- The new opportunity is issued through the authenticated native writer, never inserted directly.
SELECT o.freight_request_id AS request_id,o.data->>'planId' AS plan_id,
 o.data->'assignmentIds' AS assignment_ids
FROM public.carrier_opportunities o
WHERE o.carrier_id='d4440000-0000-4000-8000-000000000001'
 AND o.organization_id='d4400000-0000-4000-8000-000000000001'
 AND o.data->'assignmentSnapshots'->0->'routeLeg'->>'estimatedDistanceKm' IS NOT NULL
ORDER BY o.created_at DESC,o.id DESC LIMIT 1 \gset

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims"='{"sub":"d4410000-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT (public.command_v2_workflow(
 'd4400000-0000-4000-8000-000000000001','d4420000-0000-4000-8000-000000000001',
 'opportunities.create',
 jsonb_build_object('requestId',:'request_id'::uuid,'carrierId',null,'parentId',null,'id',null),
 gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','planId',:'plan_id'::uuid,
  'carrierId','d4440000-0000-4000-8000-000000000001',
  'assignmentIds',:'assignment_ids'::jsonb,
  'responseDeadline',now()+interval '1 hour','responseChannel','MANUAL')
)->'record'->>'id') AS new_opportunity_id \gset
RESET ROLE;
INSERT INTO chatbot_qa.current_alert(id,opportunity_id) VALUES('carrier-alert',:'new_opportunity_id'::uuid)
 ON CONFLICT(id) DO UPDATE SET opportunity_id=excluded.opportunity_id,created_at=now();
\endif
COMMIT;
SELECT opportunity_id AS chatbot_alert_opportunity_id FROM chatbot_qa.current_alert WHERE id='carrier-alert';
