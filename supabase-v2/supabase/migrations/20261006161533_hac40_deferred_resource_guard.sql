-- Deferred constraint triggers execute after the SECURITY DEFINER command has
-- returned. Keep table access under the owner, without exposing a callable RPC.
alter function private.require_leg_resources() security definer;
alter function private.require_leg_resources() set search_path = '';
revoke all on function private.require_leg_resources() from public,anon,authenticated,service_role;

-- Match catalog evidence status to the invalidated operational calendar.
create or replace function private.workflow_release_execution(i uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.driver_assignments set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('PROPOSED','CONFIRMED');
 update public.vehicle_assignments set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('PROPOSED','CONFIRMED');
 update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('HELD','CONFIRMED');
 -- Movement invalidates the former ready-pickup assertion. Reconfirm availability/location through
 -- an evidenced calendar command; releasing a commitment does not teleport the physical resource.
 if exists(select 1 from public.transport_executions where id=i and status='IN_PROGRESS') then
  update public.capacity_calendars cc set complete=false,provenance_status='UNKNOWN',freshness='UNKNOWN',observed_at=now(),valid_until=null
   where cc.id in(select capacity_calendar_id from public.capacity_reservations where execution_id=i)
   and not exists(select 1 from public.capacity_reservations rr where rr.capacity_calendar_id=cc.id and rr.status in ('HELD','CONFIRMED'));
 end if;
end;$$;

-- Keep the existing commitment guard, extending its narrow invalidation path.
do $$declare definition text;begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='guard_v2_crew_dependencies' and p.prosrc like '%array[''complete'',''provenance_status'',''observed_at'',''valid_until'']%';
 if definition is null then raise exception 'CALENDAR_GUARD_NOT_FOUND';end if;
 execute replace(definition,'array[''complete'',''provenance_status'',''observed_at'',''valid_until'']',
  'array[''complete'',''provenance_status'',''freshness'',''observed_at'',''valid_until'']');
end;$$;
update public.capacity_calendars set freshness='UNKNOWN'
 where complete=false and provenance_status='UNKNOWN' and valid_until is null and freshness<>'UNKNOWN';
revoke all on function private.workflow_release_execution(uuid) from public,anon,authenticated,service_role;
