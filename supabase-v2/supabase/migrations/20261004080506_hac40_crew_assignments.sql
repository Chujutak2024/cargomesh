-- HAC-40 crew and assignments. Structural production change; fixtures remain separate.
-- Identity provisioning and execution creation are future commands, not granted to clients here.
create table public.carrier_operators (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),
 auth_user_id uuid references auth.users(id),display_name text not null check(length(trim(display_name))>0),
 role text not null,email text,phone text,status text not null check(status in ('ACTIVE','INACTIVE','INVITED')),
 verified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,carrier_id),unique(carrier_id,auth_user_id));
create table public.transport_executions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 freight_request_id uuid not null references public.freight_requests(id),carrier_id uuid not null references public.carriers(id),
 carrier_service_id uuid not null,status text not null check(status in ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 planned_starts_at timestamptz not null,planned_ends_at timestamptz not null,
 actual_started_at timestamptz,actual_completed_at timestamptz,last_known_position jsonb,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,carrier_id,carrier_service_id),foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 check(planned_ends_at>planned_starts_at),check(actual_completed_at is null or actual_started_at is not null and actual_completed_at>=actual_started_at));
create table public.drivers (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),carrier_service_id uuid not null,
 full_name text not null check(length(trim(full_name))>0),carrier_operator_id uuid,
 license_class text not null check(length(trim(license_class))>0),license_valid_until date not null,license_timezone text not null,
 qualifications jsonb not null check(jsonb_typeof(qualifications)='array'),experience_years numeric check(experience_years>=0),
 duty_status text not null check(duty_status in ('AVAILABLE','ON_DUTY','OFF_DUTY','SUSPENDED','UNKNOWN')),
 evidence jsonb,available_windows jsonb not null check(jsonb_typeof(available_windows)='array'),
 duty_starts_at timestamptz,duty_ends_at timestamptz,maximum_duty_seconds integer check(maximum_duty_seconds>0),
 used_duty_seconds integer not null check(used_duty_seconds>=0),
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,carrier_id,carrier_service_id),foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 foreign key(carrier_operator_id,carrier_id) references public.carrier_operators(id,carrier_id),
 check((duty_starts_at is null and duty_ends_at is null and maximum_duty_seconds is null) or
 (duty_starts_at is not null and duty_ends_at>duty_starts_at and maximum_duty_seconds is not null)),
 check(maximum_duty_seconds is null or used_duty_seconds<=maximum_duty_seconds));
create table public.vehicle_combinations (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),carrier_service_id uuid not null,
 kind text not null,configuration text not null,starts_at timestamptz,ends_at timestamptz,evidence jsonb not null check(jsonb_typeof(evidence)='array'),
 combined_tare_kg numeric check(combined_tare_kg>=0),gross_weight_limit_kg numeric check(gross_weight_limit_kg>0),compatibility_evidence jsonb,
 status text not null check(status in ('PROPOSED','COUPLED','RELEASED','CANCELLED')),
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,carrier_id,carrier_service_id),foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 check((starts_at is null and ends_at is null) or ends_at>starts_at),
 check(status<>'COUPLED' or starts_at is not null and ends_at is not null),
 check(combined_tare_kg is null or gross_weight_limit_kg is null or combined_tare_kg<gross_weight_limit_kg));
create table public.vehicle_combination_assets (
 combination_id uuid not null,transport_asset_id uuid not null,carrier_id uuid not null,carrier_service_id uuid not null,
 starts_at timestamptz,ends_at timestamptz,active boolean not null,
 primary key(combination_id,transport_asset_id),
 foreign key(combination_id,carrier_id,carrier_service_id) references public.vehicle_combinations(id,carrier_id,carrier_service_id),
 foreign key(transport_asset_id,carrier_id,carrier_service_id) references public.transport_assets(id,carrier_id,carrier_service_id),
 check(not active or starts_at is not null and ends_at>starts_at),
 exclude using gist(transport_asset_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(active));
create table public.driver_assignments (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),carrier_service_id uuid not null,
 execution_id uuid not null,driver_id uuid not null,starts_at timestamptz not null,ends_at timestamptz not null,
 role text not null check(role in ('PRIMARY','RELIEF')),status text not null check(status in ('PROPOSED','CONFIRMED','RELEASED','CANCELLED')),
 evidence jsonb,accepted_license_classes jsonb not null check(jsonb_typeof(accepted_license_classes)='array'),
 required_qualifications jsonb not null check(jsonb_typeof(required_qualifications)='array'),policy_evidence jsonb,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 foreign key(execution_id,carrier_id,carrier_service_id) references public.transport_executions(id,carrier_id,carrier_service_id),
 foreign key(driver_id,carrier_id,carrier_service_id) references public.drivers(id,carrier_id,carrier_service_id),check(ends_at>starts_at),
 exclude using gist(driver_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('PROPOSED','CONFIRMED')));
create table public.vehicle_assignments (
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),carrier_service_id uuid not null,
 execution_id uuid not null,transport_asset_id uuid not null,vehicle_combination_id uuid,
 capacity_reservation_id uuid references public.capacity_reservations(id),starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null check(status in ('PROPOSED','CONFIRMED','RELEASED','CANCELLED')),capacity_committed jsonb not null,evidence jsonb,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 foreign key(execution_id,carrier_id,carrier_service_id) references public.transport_executions(id,carrier_id,carrier_service_id),
 foreign key(transport_asset_id,carrier_id,carrier_service_id) references public.transport_assets(id,carrier_id,carrier_service_id),
 foreign key(vehicle_combination_id,carrier_id,carrier_service_id) references public.vehicle_combinations(id,carrier_id,carrier_service_id),
 check(ends_at>starts_at),check(status<>'CONFIRMED' or capacity_reservation_id is not null),
 check(jsonb_typeof(capacity_committed)='object' and capacity_committed ?& array['weightKg','volumeM3']
 and (capacity_committed->>'weightKg')::numeric>=0 and (capacity_committed->>'volumeM3')::numeric>=0));
alter table public.capacity_reservations add column committed_capacity jsonb,add column execution_id uuid references public.transport_executions(id),
 add column reference text,add column source text,add column evidence jsonb;
alter table public.capacity_reservations add constraint crew_reservation_capacity check(committed_capacity is null or
 (jsonb_typeof(committed_capacity)='object' and committed_capacity ?& array['weightKg','volumeM3']
 and jsonb_typeof(committed_capacity->'weightKg')='number' and jsonb_typeof(committed_capacity->'volumeM3')='number'
 and (committed_capacity->>'weightKg')::numeric>=0 and (committed_capacity->>'volumeM3')::numeric>=0));

create function private.crew_evidence(e jsonb,s timestamptz,f timestamptz) returns boolean language sql stable set search_path='' as $$
select coalesce(e->>'reference' is not null and length(trim(e->>'reference'))>0 and e->>'provenanceStatus' in ('VERIFIED','SIMULATED')
 and (e->>'verifiedAt')::timestamptz<=now() and (e->>'verifiedAt')::timestamptz<=s
 and (e->>'validUntil')::timestamptz>=f and (e->>'validUntil')::timestamptz>now(),false);$$;
create function private.crew_windows_cover(w jsonb,s timestamptz,f timestamptz) returns boolean language plpgsql immutable set search_path='' as $$
declare r record;through_at timestamptz:=s;begin
 for r in select (x->>'startsAt')::timestamptz a,(x->>'endsAt')::timestamptz b from jsonb_array_elements(w)x order by 1 loop
 if r.b<=r.a then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if r.a>through_at then exit;end if;through_at:=greatest(through_at,r.b);end loop;return through_at>=f;end;$$;
create function private.guard_v2_crew() returns trigger language plpgsql set search_path='' as $$
declare e public.transport_executions%rowtype;d public.drivers%rowtype;a public.transport_assets%rowtype;w jsonb;
 c public.vehicle_combinations%rowtype;r public.capacity_reservations%rowtype;cal public.capacity_calendars%rowtype;
 sec numeric;occupied_weight numeric;occupied_volume numeric;point_at timestamptz;service_class text;begin
 if current_user<>'postgres' or tg_op='DELETE' then raise exception 'COMMAND_REQUIRED' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.carrier_id<>old.carrier_id or new.carrier_service_id<>old.carrier_service_id then raise exception 'IMMUTABLE_FLEET_SCOPE' using errcode='PT400';end if;
  new.version:=old.version+1;new.updated_at:=now();
 end if;
 perform 1 from public.carrier_services where id=new.carrier_service_id and carrier_id=new.carrier_id and transport_mode='ROAD';
 if not found then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if tg_table_name='drivers' then
  for w in select x from jsonb_array_elements(new.available_windows)x loop
   if (w->>'endsAt')::timestamptz<=(w->>'startsAt')::timestamptz then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  end loop;
  if not exists(select 1 from pg_timezone_names where name=new.license_timezone) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  if new.carrier_operator_id is not null and not exists(select 1 from public.carrier_operators where id=new.carrier_operator_id and carrier_id=new.carrier_id and status='ACTIVE') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' and exists(select 1 from public.driver_assignments where driver_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 elsif tg_table_name='vehicle_combinations' then
  if tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where vehicle_combination_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  if new.status='COUPLED' and not private.crew_evidence(new.compatibility_evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 else
  select * into e from public.transport_executions where id=new.execution_id;
  if e.id is null or e.carrier_id<>new.carrier_id or e.carrier_service_id<>new.carrier_service_id
   or new.starts_at<e.planned_starts_at or new.ends_at>e.planned_ends_at or e.status in ('CANCELLED','COMPLETED') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' then
   if new.execution_id<>old.execution_id or (old.status in ('RELEASED','CANCELLED') and new.status<>old.status)
    or (old.status='CONFIRMED' and new.status='PROPOSED') then raise exception 'INVALID_ASSIGNMENT_TRANSITION' using errcode='PT400';end if;
  end if;
  if tg_table_name='driver_assignments' then
   if tg_op='UPDATE' and new.driver_id<>old.driver_id then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into d from public.drivers where id=new.driver_id for update;
   if d.id is null or d.carrier_id<>new.carrier_id or d.carrier_service_id<>new.carrier_service_id then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) or not private.crew_evidence(new.policy_evidence,new.starts_at,new.ends_at)
     or not private.crew_evidence(d.evidence,new.starts_at,new.ends_at) or d.duty_starts_at is null or d.maximum_duty_seconds is null
     or jsonb_array_length(new.accepted_license_classes)=0 then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    if d.duty_status not in ('AVAILABLE','ON_DUTY') or ((d.license_valid_until+1)::timestamp at time zone d.license_timezone)<new.ends_at
     or not(new.accepted_license_classes ? d.license_class) or not(d.qualifications @> new.required_qualifications)
     or new.starts_at<d.duty_starts_at or new.ends_at>d.duty_ends_at or not private.crew_windows_cover(d.available_windows,new.starts_at,new.ends_at)
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select coalesce(sum(extract(epoch from ends_at-starts_at)),0) into sec from public.driver_assignments
     where driver_id=new.driver_id and id<>new.id and status in ('PROPOSED','CONFIRMED') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(d.duty_starts_at,d.duty_ends_at,'[)');
    if sec+d.used_duty_seconds+extract(epoch from new.ends_at-new.starts_at)>d.maximum_duty_seconds then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
  else
   if tg_op='UPDATE' and (new.transport_asset_id<>old.transport_asset_id or new.vehicle_combination_id is distinct from old.vehicle_combination_id
    or old.capacity_reservation_id is not null and new.capacity_reservation_id is distinct from old.capacity_reservation_id) then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into a from public.transport_assets where id=new.transport_asset_id for update;
   if a.id is null or a.carrier_id<>new.carrier_id or a.carrier_service_id<>new.carrier_service_id or a.mode<>'ROAD' then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if a.asset_role='ESCORT' and ((new.capacity_committed->>'weightKg')::numeric>0 or (new.capacity_committed->>'volumeM3')::numeric>0) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
   if new.vehicle_combination_id is not null then
    select * into c from public.vehicle_combinations where id=new.vehicle_combination_id;
    if c.id is null or not exists(select 1 from public.vehicle_combination_assets where combination_id=c.id and transport_asset_id=a.id)
     or c.status<>'COUPLED' or c.starts_at>new.starts_at or c.ends_at<new.ends_at then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
    -- One combined carrying assignment: cannot count tractor and trailer separately.
    if new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_assignments v where v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
     and (v.vehicle_combination_id=c.id or v.transport_asset_id in(select transport_asset_id from public.vehicle_combination_assets where combination_id=c.id))
     and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   elsif new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_combination_assets m where m.transport_asset_id=a.id and m.active
    and tstzrange(m.starts_at,m.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   if new.status in ('PROPOSED','CONFIRMED') then
    if exists(select 1 from public.capacity_reservations rr join public.capacity_calendars cc on cc.id=rr.capacity_calendar_id where cc.transport_asset_id=a.id
     and rr.id is distinct from new.capacity_reservation_id and rr.status in ('HELD','CONFIRMED')
     and (new.capacity_reservation_id is not null or rr.execution_id is distinct from new.execution_id)
     and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select s.service_type into service_class from public.carrier_services s where s.id=new.carrier_service_id;
    if exists(select 1 from public.vehicle_assignments v where v.transport_asset_id=a.id and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
      and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)') and (service_class='FTL' or v.execution_id<>new.execution_id))
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    for point_at in select new.starts_at union select greatest(v.starts_at,new.starts_at) from public.vehicle_assignments v where v.transport_asset_id=a.id
      and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED') and v.starts_at<new.ends_at and v.ends_at>new.starts_at loop
     select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0)
      into occupied_weight,occupied_volume from public.vehicle_assignments where transport_asset_id=a.id and id<>new.id and status in ('PROPOSED','CONFIRMED') and starts_at<=point_at and ends_at>point_at;
     if a.max_weight_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>a.max_weight_kg
      or a.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>a.max_volume_m3
      or exists(select 1 from public.carrier_services s where s.id=new.carrier_service_id and (
       s.max_capacity_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>s.max_capacity_kg
       or s.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>s.max_volume_m3)) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    end loop;
    if not a.active or exists(select 1 from public.scheduled_maintenances where transport_asset_id=a.id and status in ('SCHEDULED','IN_PROGRESS') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)'))
     or exists(select 1 from public.repositioning_blocks b join public.capacity_calendars cc on cc.id=b.capacity_calendar_id where cc.transport_asset_id=a.id and b.status in ('PLANNED','IN_PROGRESS')
       and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select * into r from public.capacity_reservations where id=new.capacity_reservation_id for update;
    select * into cal from public.capacity_calendars where id=r.capacity_calendar_id;
    if r.id is null or r.status<>'CONFIRMED' or r.execution_id is distinct from new.execution_id or r.freight_request_id is distinct from e.freight_request_id
     or cal.transport_asset_id is distinct from a.id or cal.carrier_id<>new.carrier_id or cal.carrier_service_id<>new.carrier_service_id
     or r.starts_at>new.starts_at or r.ends_at<new.ends_at then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if not private.crew_evidence(r.evidence,new.starts_at,new.ends_at) or r.committed_capacity is null
      or a.asset_role='CARRIER' and (a.max_weight_kg is null or a.max_volume_m3 is null or a.evidence is null)
      or not cal.complete or cal.provenance_status not in ('VERIFIED','SIMULATED') or cal.observed_at is null or cal.observed_at>now() or cal.valid_until is null or cal.valid_until<new.ends_at
      or not private.crew_windows_cover(cal.available_windows,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0) into occupied_weight,occupied_volume
     from public.vehicle_assignments where capacity_reservation_id=r.id and id<>new.id and status='CONFIRMED';
    if occupied_weight+(new.capacity_committed->>'weightKg')::numeric>(r.committed_capacity->>'weightKg')::numeric
     or occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>(r.committed_capacity->>'volumeM3')::numeric then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if new.vehicle_combination_id is not null then
     -- Gross/tare alone do not prove manufacturer/route limits. Keep confirmation blocked until the plan verifier exists.
     raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';
    end if;
   end if;
  end if;
 end if;return new;end;$$;

create function private.guard_v2_crew_members() returns trigger language plpgsql set search_path='' as $$declare c public.vehicle_combinations%rowtype;a public.transport_assets%rowtype;begin
 if current_user<>'postgres' then raise exception 'COMMAND_REQUIRED' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;
 select * into c from public.vehicle_combinations where id=new.combination_id;
 select * into a from public.transport_assets where id=new.transport_asset_id;
 if c.id is null or a.id is null or a.mode<>'ROAD' or c.carrier_id<>a.carrier_id or c.carrier_service_id<>a.carrier_service_id
  or new.active is distinct from (c.status='COUPLED') or new.starts_at is distinct from c.starts_at or new.ends_at is distinct from c.ends_at
  or new.active and not a.active then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if new.active and exists(select 1 from public.vehicle_assignments v where v.transport_asset_id=a.id and v.status in ('PROPOSED','CONFIRMED')
  and v.vehicle_combination_id is distinct from c.id and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 return new;end;$$;
create function private.check_v2_combination_members() returns trigger language plpgsql security definer set search_path='' as $$declare i uuid;begin
 if tg_table_name='vehicle_combinations' then i:=new.id;else i:=coalesce(new.combination_id,old.combination_id);end if;
 if exists(select 1 from public.vehicle_combinations where id=i) and not exists(select 1 from public.vehicle_combination_assets where combination_id=i)
 then raise exception 'EMPTY_COMBINATION' using errcode='PT400';end if;return null;end;$$;
create constraint trigger combination_nonempty after insert or update on public.vehicle_combinations deferrable initially deferred for each row execute function private.check_v2_combination_members();
create constraint trigger combination_members_nonempty after insert or update or delete on public.vehicle_combination_assets deferrable initially deferred for each row execute function private.check_v2_combination_members();
create trigger crew_member_guard before insert or update or delete on public.vehicle_combination_assets for each row execute function private.guard_v2_crew_members();

-- External writes to fleet/calendar/blocks must respect the new commitments too.
create function private.guard_v2_crew_dependencies() returns trigger language plpgsql security definer set search_path='' as $$declare asset_id uuid;sid uuid;begin
 if tg_table_name='capacity_reservations' then
  select transport_asset_id,carrier_service_id into asset_id,sid from public.capacity_calendars where id=new.capacity_calendar_id;
  perform 1 from public.carrier_services where id=sid for update;
  if tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where capacity_reservation_id=old.id and status='CONFIRMED') then
   if new.status<>'CONFIRMED' or new.capacity_calendar_id<>old.capacity_calendar_id or new.execution_id is distinct from old.execution_id
    or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at or new.committed_capacity is distinct from old.committed_capacity
    or new.evidence is distinct from old.evidence or new.freight_request_id is distinct from old.freight_request_id then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  end if;
  if new.status in ('HELD','CONFIRMED') and exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED')
   and capacity_reservation_id is distinct from new.id and (status='CONFIRMED' or execution_id is distinct from new.execution_id or capacity_reservation_id is not null)
   and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 elsif tg_table_name in ('transport_assets','capacity_calendars') then
  if tg_table_name='transport_assets' then asset_id:=new.id;else asset_id:=new.transport_asset_id;end if;
  if exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED') and ends_at>now())
   or exists(select 1 from public.vehicle_combination_assets where transport_asset_id=asset_id and active and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 else
  if tg_table_name='scheduled_maintenances' then asset_id:=new.transport_asset_id;else select transport_asset_id into asset_id from public.capacity_calendars where id=new.capacity_calendar_id;end if;
  if new.status in ('SCHEDULED','IN_PROGRESS','PLANNED') and exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED')
   and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 end if;return new;end;$$;
create trigger a_crew_reservation_guard before insert or update on public.capacity_reservations for each row execute function private.guard_v2_crew_dependencies();
create trigger a_crew_asset_guard before update on public.transport_assets for each row execute function private.guard_v2_crew_dependencies();
create trigger a_crew_calendar_guard before update on public.capacity_calendars for each row execute function private.guard_v2_crew_dependencies();
create trigger a_crew_maintenance_guard before insert or update on public.scheduled_maintenances for each row execute function private.guard_v2_crew_dependencies();
create trigger a_crew_repositioning_guard before insert or update on public.repositioning_blocks for each row execute function private.guard_v2_crew_dependencies();

create function private.guard_v2_execution_scope() returns trigger language plpgsql set search_path='' as $$begin
 if current_user<>'postgres' then raise exception 'COMMAND_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.freight_requests where id=new.freight_request_id and organization_id=new.organization_id and v2_snapshot is not null) then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if tg_op='UPDATE' and exists(select 1 from public.driver_assignments where execution_id=old.id and status in ('PROPOSED','CONFIRMED'))
  or tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where execution_id=old.id and status in ('PROPOSED','CONFIRMED')) then
  if new.organization_id<>old.organization_id or new.freight_request_id<>old.freight_request_id or new.carrier_id<>old.carrier_id or new.carrier_service_id<>old.carrier_service_id
   or new.planned_starts_at<>old.planned_starts_at or new.planned_ends_at<>old.planned_ends_at or new.status in ('COMPLETED','CANCELLED') then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 end if;return new;end;$$;
create trigger crew_execution_scope before insert or update on public.transport_executions for each row execute function private.guard_v2_execution_scope();
create function private.guard_v2_crew_service() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.transport_mode<>old.transport_mode and (exists(select 1 from public.drivers where carrier_service_id=old.id)
  or exists(select 1 from public.vehicle_combinations where carrier_service_id=old.id)) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 if (new.service_type<>old.service_type or new.max_capacity_kg is distinct from old.max_capacity_kg or new.max_volume_m3 is distinct from old.max_volume_m3 or new.active is distinct from old.active)
  and exists(select 1 from public.vehicle_assignments where carrier_service_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 return new;end;$$;
create trigger a_crew_service_guard before update on public.carrier_services for each row execute function private.guard_v2_crew_service();

do $$declare t text;begin
 foreach t in array array['carrier_operators','transport_executions','drivers','vehicle_combinations','vehicle_combination_assets','driver_assignments','vehicle_assignments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['drivers','vehicle_combinations','driver_assignments','vehicle_assignments'] loop
  execute format('create trigger crew_command_guard before insert or update or delete on public.%I for each row execute function private.guard_v2_crew()',t);
  execute format('create index %I on public.%I(carrier_id,created_at,id)',t||'_crew_scope_idx',t);
  execute format('create index %I on public.%I(carrier_service_id)',t||'_crew_service_idx',t);
 end loop;end;$$;
create index crew_operator_user_idx on public.carrier_operators(auth_user_id);
create index crew_execution_request_idx on public.transport_executions(freight_request_id);
create index crew_execution_org_idx on public.transport_executions(organization_id);
create index crew_execution_service_idx on public.transport_executions(carrier_service_id);
create index crew_driver_operator_idx on public.drivers(carrier_operator_id);
create index crew_driver_execution_idx on public.driver_assignments(execution_id);
create index crew_vehicle_execution_idx on public.vehicle_assignments(execution_id);
create index crew_vehicle_asset_idx on public.vehicle_assignments(transport_asset_id,starts_at,ends_at) where(status in ('PROPOSED','CONFIRMED'));
create index crew_vehicle_combination_idx on public.vehicle_assignments(vehicle_combination_id);
create index crew_vehicle_reservation_idx on public.vehicle_assignments(capacity_reservation_id);
create index crew_reservation_execution_idx on public.capacity_reservations(execution_id);
create index crew_combination_asset_idx on public.vehicle_combination_assets(transport_asset_id);
revoke all on function private.crew_evidence(jsonb,timestamptz,timestamptz),private.crew_windows_cover(jsonb,timestamptz,timestamptz),private.guard_v2_crew(),private.guard_v2_crew_members(),private.check_v2_combination_members(),private.guard_v2_crew_dependencies(),private.guard_v2_execution_scope(),private.guard_v2_crew_service() from public,anon,authenticated,service_role;

create function private.crew_target(k text) returns text language plpgsql immutable set search_path='' as $$begin case k
when 'drivers' then return 'drivers';
when 'vehicle-combinations' then return 'vehicle_combinations';
when 'driver-assignments' then return 'driver_assignments';
when 'vehicle-assignments' then return 'vehicle_assignments';
else raise exception 'VALIDATION_ERROR' using errcode='PT400';end case;end;$$;
create function private.crew_record(k text,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r record;v jsonb;begin case k
when 'drivers' then select * into r from public.drivers where id=i;v:=jsonb_build_object('schemaVersion','2.0','serviceId',r.carrier_service_id,'fullName',r.full_name,'portalAccountId',r.carrier_operator_id,'licenseClass',r.license_class,'licenseValidUntil',r.license_valid_until,'licenseTimezone',r.license_timezone,'qualifications',r.qualifications,'experienceYears',r.experience_years,'dutyStatus',r.duty_status,'evidence',r.evidence,'availableWindows',r.available_windows,'dutyWindow',case when r.duty_starts_at is null then null else jsonb_build_object('startsAt',r.duty_starts_at,'endsAt',r.duty_ends_at) end,'maximumDutySeconds',r.maximum_duty_seconds,'usedDutySeconds',r.used_duty_seconds);
when 'vehicle-combinations' then select * into r from public.vehicle_combinations where id=i;v:=jsonb_build_object('schemaVersion','2.0','serviceId',r.carrier_service_id,'kind',r.kind,'configuration',r.configuration,'coupledWindow',case when r.starts_at is null then null else jsonb_build_object('startsAt',r.starts_at,'endsAt',r.ends_at) end,'evidence',r.evidence,'combinedTareKg',r.combined_tare_kg,'grossWeightLimitKg',r.gross_weight_limit_kg,'status',r.status,'compatibilityEvidence',r.compatibility_evidence,'assetIds',(select jsonb_agg(transport_asset_id order by transport_asset_id) from public.vehicle_combination_assets where combination_id=r.id));
when 'driver-assignments' then select * into r from public.driver_assignments where id=i;v:=jsonb_build_object('schemaVersion','2.0','serviceId',r.carrier_service_id,'executionId',r.execution_id,'driverId',r.driver_id,'window',jsonb_build_object('startsAt',r.starts_at,'endsAt',r.ends_at),'status',r.status,'evidence',r.evidence,'role',r.role,'acceptedLicenseClasses',r.accepted_license_classes,'requiredQualifications',r.required_qualifications,'policyEvidence',r.policy_evidence);
when 'vehicle-assignments' then select * into r from public.vehicle_assignments where id=i;v:=jsonb_build_object('schemaVersion','2.0','serviceId',r.carrier_service_id,'executionId',r.execution_id,'assetId',r.transport_asset_id,'window',jsonb_build_object('startsAt',r.starts_at,'endsAt',r.ends_at),'status',r.status,'evidence',r.evidence,'combinationId',r.vehicle_combination_id,'reservationId',r.capacity_reservation_id,'capacityCommitted',r.capacity_committed);
end case;if r.id is null then raise exception 'CATALOG_NOT_FOUND' using errcode='PT404';end if;return jsonb_build_object('id',r.id,'organizationId',null,'carrierId',r.carrier_id,'serviceId',r.carrier_service_id,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'value',v);end;$$;

create function private.read_v2_crew(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,p_service_id uuid,p_id uuid,p_limit integer,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare t text;r record;result jsonb:='[]';begin
 if p_carrier_id is null or p_service_id is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,'services',p_carrier_id,null,true,null);
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 t:=private.crew_target(p_kind);
 for r in execute format('select id from public.%I where carrier_id=$1 and ($2 is null or id=$2) order by created_at,id limit $3 offset $4',t)
 using p_carrier_id,p_id,p_limit,p_offset loop result:=result||jsonb_build_array(private.crew_record(p_kind,r.id));end loop;return result;end;$$;
create function private.command_v2_crew(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,p_service_id uuid,p_id uuid,p_idempotency_key uuid,p_expected_version integer,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t text;s json;sid uuid;h text;receipt private.v2_catalog_receipts%rowtype;current_version integer;saved_id uuid;result jsonb;old_value jsonb;begin
 if p_carrier_id is null or p_service_id is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,'services',p_carrier_id,null,true,null);
 if p_idempotency_key is null or ((p_id is null) is distinct from (p_expected_version is null)) or p_expected_version<1 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 t:=private.crew_target(p_kind);case p_kind
when 'drivers' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"fullName":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"portalAccountId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"licenseClass":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"licenseValidUntil":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"},"licenseTimezone":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"qualifications":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"maxItems":100,"uniqueItems":true},"experienceYears":{"anyOf":[{"type":"number","minimum":0},{"type":"null"}]},"dutyStatus":{"type":"string","enum":["AVAILABLE","ON_DUTY","OFF_DUTY","SUSPENDED","UNKNOWN"]},"evidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]},"availableWindows":{"type":"array","items":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"maxItems":100},"dutyWindow":{"anyOf":[{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},{"type":"null"}]},"maximumDutySeconds":{"anyOf":[{"type":"integer","exclusiveMinimum":0},{"type":"null"}]},"usedDutySeconds":{"type":"integer","minimum":0}},"required":["schemaVersion","serviceId","fullName","portalAccountId","licenseClass","licenseValidUntil","licenseTimezone","qualifications","experienceYears","dutyStatus","evidence","availableWindows","dutyWindow","maximumDutySeconds","usedDutySeconds"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'vehicle-combinations' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"kind":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"configuration":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"assetIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":20,"uniqueItems":true},"coupledWindow":{"anyOf":[{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},{"type":"null"}]},"evidence":{"type":"array","items":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},"maxItems":100},"combinedTareKg":{"anyOf":[{"type":"number","minimum":0},{"type":"null"}]},"grossWeightLimitKg":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"status":{"type":"string","enum":["PROPOSED","COUPLED","RELEASED","CANCELLED"]},"compatibilityEvidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]}},"required":["schemaVersion","serviceId","kind","configuration","assetIds","coupledWindow","evidence","combinedTareKg","grossWeightLimitKg","status","compatibilityEvidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'driver-assignments' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"executionId":{"type":"string","format":"uuid"},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"status":{"type":"string","enum":["PROPOSED","CONFIRMED","RELEASED","CANCELLED"]},"evidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]},"driverId":{"type":"string","format":"uuid"},"role":{"type":"string","enum":["PRIMARY","RELIEF"]},"acceptedLicenseClasses":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"maxItems":100,"uniqueItems":true},"requiredQualifications":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"maxItems":100,"uniqueItems":true},"policyEvidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]}},"required":["schemaVersion","serviceId","executionId","window","status","evidence","driverId","role","acceptedLicenseClasses","requiredQualifications","policyEvidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'vehicle-assignments' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"executionId":{"type":"string","format":"uuid"},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"status":{"type":"string","enum":["PROPOSED","CONFIRMED","RELEASED","CANCELLED"]},"evidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","verifiedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]},"assetId":{"type":"string","format":"uuid"},"combinationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"reservationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"capacityCommitted":{"type":"object","properties":{"weightKg":{"type":"number","minimum":0},"volumeM3":{"type":"number","minimum":0}},"required":["weightKg","volumeM3"],"additionalProperties":false}},"required":["schemaVersion","serviceId","executionId","window","status","evidence","assetId","combinationId","reservationId","capacityCommitted"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
end case;if not coalesce(extensions.jsonb_matches_schema(s,p_value),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 sid:=(p_value->>'serviceId')::uuid;
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,'areas',p_carrier_id,sid,true,null);
 perform 1 from public.carrier_services where id=sid for update;
 h:=private.hash_v2_freight_payload(jsonb_build_object('kind',p_kind,'carrierId',p_carrier_id,'serviceId',null,'id',p_id,'expectedVersion',p_expected_version,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_member_id::text||':'||p_idempotency_key::text,0));
 select * into receipt from private.v2_catalog_receipts where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
 if found then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return jsonb_build_object('record',receipt.result,'replay',true);end if;
 if p_id is not null then
  execute format('select version from public.%I where id=$1 and carrier_id=$2 and carrier_service_id=$3 for update',t) into current_version using p_id,p_carrier_id,sid;
  if current_version is null then raise exception 'CATALOG_NOT_FOUND' using errcode='PT404';end if;
  if current_version<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  old_value:=private.crew_record(p_kind,p_id)->'value';
  if p_kind in ('driver-assignments','vehicle-assignments') and exists(select 1 from jsonb_each(old_value) e
   where e.key in ('executionId','driverId','assetId','combinationId') and e.value is distinct from p_value->e.key)
  then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
  if p_kind='vehicle-assignments' and old_value->>'reservationId' is not null and old_value->'reservationId' is distinct from p_value->'reservationId'
  then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
 end if;
 if p_kind='vehicle-combinations' and jsonb_array_length(p_value->'assetIds')<>(select count(distinct x) from jsonb_array_elements_text(p_value->'assetIds')x) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_kind='vehicle-combinations' then perform 1 from public.transport_assets where id in(select x::uuid from jsonb_array_elements_text(p_value->'assetIds')x) order by id for update;end if;
 case p_kind
when 'drivers' then if p_id is null then insert into public.drivers(carrier_service_id,full_name,carrier_operator_id,license_class,license_valid_until,license_timezone,qualifications,experience_years,duty_status,evidence,available_windows,duty_starts_at,duty_ends_at,maximum_duty_seconds,used_duty_seconds,carrier_id) values((p_value#>>'{serviceId}')::uuid,(p_value#>>'{fullName}')::text,(p_value#>>'{portalAccountId}')::uuid,(p_value#>>'{licenseClass}')::text,(p_value#>>'{licenseValidUntil}')::date,(p_value#>>'{licenseTimezone}')::text,nullif(p_value#>'{qualifications}','null'::jsonb),(p_value#>>'{experienceYears}')::numeric,(p_value#>>'{dutyStatus}')::text,nullif(p_value#>'{evidence}','null'::jsonb),nullif(p_value#>'{availableWindows}','null'::jsonb),(p_value#>>'{dutyWindow,startsAt}')::timestamptz,(p_value#>>'{dutyWindow,endsAt}')::timestamptz,(p_value#>>'{maximumDutySeconds}')::integer,(p_value#>>'{usedDutySeconds}')::integer,p_carrier_id) returning id into saved_id;else update public.drivers set carrier_service_id=(p_value#>>'{serviceId}')::uuid,full_name=(p_value#>>'{fullName}')::text,carrier_operator_id=(p_value#>>'{portalAccountId}')::uuid,license_class=(p_value#>>'{licenseClass}')::text,license_valid_until=(p_value#>>'{licenseValidUntil}')::date,license_timezone=(p_value#>>'{licenseTimezone}')::text,qualifications=nullif(p_value#>'{qualifications}','null'::jsonb),experience_years=(p_value#>>'{experienceYears}')::numeric,duty_status=(p_value#>>'{dutyStatus}')::text,evidence=nullif(p_value#>'{evidence}','null'::jsonb),available_windows=nullif(p_value#>'{availableWindows}','null'::jsonb),duty_starts_at=(p_value#>>'{dutyWindow,startsAt}')::timestamptz,duty_ends_at=(p_value#>>'{dutyWindow,endsAt}')::timestamptz,maximum_duty_seconds=(p_value#>>'{maximumDutySeconds}')::integer,used_duty_seconds=(p_value#>>'{usedDutySeconds}')::integer where id=p_id returning id into saved_id;end if;
when 'vehicle-combinations' then if p_id is null then insert into public.vehicle_combinations(carrier_service_id,kind,configuration,starts_at,ends_at,evidence,combined_tare_kg,gross_weight_limit_kg,status,compatibility_evidence,carrier_id) values((p_value#>>'{serviceId}')::uuid,(p_value#>>'{kind}')::text,(p_value#>>'{configuration}')::text,(p_value#>>'{coupledWindow,startsAt}')::timestamptz,(p_value#>>'{coupledWindow,endsAt}')::timestamptz,nullif(p_value#>'{evidence}','null'::jsonb),(p_value#>>'{combinedTareKg}')::numeric,(p_value#>>'{grossWeightLimitKg}')::numeric,(p_value#>>'{status}')::text,nullif(p_value#>'{compatibilityEvidence}','null'::jsonb),p_carrier_id) returning id into saved_id;else update public.vehicle_combinations set carrier_service_id=(p_value#>>'{serviceId}')::uuid,kind=(p_value#>>'{kind}')::text,configuration=(p_value#>>'{configuration}')::text,starts_at=(p_value#>>'{coupledWindow,startsAt}')::timestamptz,ends_at=(p_value#>>'{coupledWindow,endsAt}')::timestamptz,evidence=nullif(p_value#>'{evidence}','null'::jsonb),combined_tare_kg=(p_value#>>'{combinedTareKg}')::numeric,gross_weight_limit_kg=(p_value#>>'{grossWeightLimitKg}')::numeric,status=(p_value#>>'{status}')::text,compatibility_evidence=nullif(p_value#>'{compatibilityEvidence}','null'::jsonb) where id=p_id returning id into saved_id;end if;
when 'driver-assignments' then if p_id is null then insert into public.driver_assignments(carrier_service_id,execution_id,driver_id,starts_at,ends_at,status,evidence,role,accepted_license_classes,required_qualifications,policy_evidence,carrier_id) values((p_value#>>'{serviceId}')::uuid,(p_value#>>'{executionId}')::uuid,(p_value#>>'{driverId}')::uuid,(p_value#>>'{window,startsAt}')::timestamptz,(p_value#>>'{window,endsAt}')::timestamptz,(p_value#>>'{status}')::text,nullif(p_value#>'{evidence}','null'::jsonb),(p_value#>>'{role}')::text,nullif(p_value#>'{acceptedLicenseClasses}','null'::jsonb),nullif(p_value#>'{requiredQualifications}','null'::jsonb),nullif(p_value#>'{policyEvidence}','null'::jsonb),p_carrier_id) returning id into saved_id;else update public.driver_assignments set carrier_service_id=(p_value#>>'{serviceId}')::uuid,execution_id=(p_value#>>'{executionId}')::uuid,driver_id=(p_value#>>'{driverId}')::uuid,starts_at=(p_value#>>'{window,startsAt}')::timestamptz,ends_at=(p_value#>>'{window,endsAt}')::timestamptz,status=(p_value#>>'{status}')::text,evidence=nullif(p_value#>'{evidence}','null'::jsonb),role=(p_value#>>'{role}')::text,accepted_license_classes=nullif(p_value#>'{acceptedLicenseClasses}','null'::jsonb),required_qualifications=nullif(p_value#>'{requiredQualifications}','null'::jsonb),policy_evidence=nullif(p_value#>'{policyEvidence}','null'::jsonb) where id=p_id returning id into saved_id;end if;
when 'vehicle-assignments' then if p_id is null then insert into public.vehicle_assignments(carrier_service_id,execution_id,transport_asset_id,starts_at,ends_at,status,evidence,vehicle_combination_id,capacity_reservation_id,capacity_committed,carrier_id) values((p_value#>>'{serviceId}')::uuid,(p_value#>>'{executionId}')::uuid,(p_value#>>'{assetId}')::uuid,(p_value#>>'{window,startsAt}')::timestamptz,(p_value#>>'{window,endsAt}')::timestamptz,(p_value#>>'{status}')::text,nullif(p_value#>'{evidence}','null'::jsonb),(p_value#>>'{combinationId}')::uuid,(p_value#>>'{reservationId}')::uuid,nullif(p_value#>'{capacityCommitted}','null'::jsonb),p_carrier_id) returning id into saved_id;else update public.vehicle_assignments set carrier_service_id=(p_value#>>'{serviceId}')::uuid,execution_id=(p_value#>>'{executionId}')::uuid,transport_asset_id=(p_value#>>'{assetId}')::uuid,starts_at=(p_value#>>'{window,startsAt}')::timestamptz,ends_at=(p_value#>>'{window,endsAt}')::timestamptz,status=(p_value#>>'{status}')::text,evidence=nullif(p_value#>'{evidence}','null'::jsonb),vehicle_combination_id=(p_value#>>'{combinationId}')::uuid,capacity_reservation_id=(p_value#>>'{reservationId}')::uuid,capacity_committed=nullif(p_value#>'{capacityCommitted}','null'::jsonb) where id=p_id returning id into saved_id;end if;
end case;
 if p_kind='vehicle-combinations' then
  delete from public.vehicle_combination_assets where combination_id=saved_id;
  insert into public.vehicle_combination_assets(combination_id,transport_asset_id,carrier_id,carrier_service_id,starts_at,ends_at,active)
  select saved_id,x::uuid,p_carrier_id,sid,(p_value#>>'{coupledWindow,startsAt}')::timestamptz,(p_value#>>'{coupledWindow,endsAt}')::timestamptz,p_value->>'status'='COUPLED' from jsonb_array_elements_text(p_value->'assetIds')x;
 end if;
 result:=private.crew_record(p_kind,saved_id);
 insert into private.v2_catalog_receipts(organization_id,member_id,idempotency_key,payload_hash,result) values(p_organization_id,p_member_id,p_idempotency_key,h,result);
 return jsonb_build_object('record',result,'replay',false);end;$$;
revoke all on function private.crew_target(text),private.crew_record(text,uuid),private.read_v2_crew(uuid,uuid,text,uuid,uuid,uuid,integer,integer),private.command_v2_crew(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
create or replace function private.read_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,
 p_service_id uuid,p_id uuid,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare target record; entry record; result jsonb:='[]'; begin
 if p_kind in ('drivers','vehicle-combinations','driver-assignments','vehicle-assignments') then return private.read_v2_crew(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_limit,p_offset);end if;
 if p_kind in ('capability-definitions','assets','capacity-pools','calendars','maintenances','repositioning-blocks','asset-capabilities') then return private.read_v2_fleet(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_limit,p_offset);end if;
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,false,p_id);
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then
 raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 select * into target from private.catalog_target(p_kind,p_organization_id,p_carrier_id,p_service_id);
 for entry in execute format('select id from public.%I where %s and ($1 is null or id=$1) order by created_at,id limit $2 offset $3',target.table_name,target.scope_sql)
 using p_id,p_limit,p_offset loop result:=result||jsonb_build_array(private.catalog_record(p_kind,entry.id)); end loop;
 return result;
end;$$;
create or replace function private.command_v2_catalog(p_organization_id uuid,p_member_id uuid,p_kind text,p_carrier_id uuid,
 p_service_id uuid,p_id uuid,p_idempotency_key uuid,p_expected_version integer,p_value jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare target record; receipt private.v2_catalog_receipts%rowtype; hash text; current_version integer; saved_id uuid; result jsonb;
 schema json; partner public.fulfilment_partners%rowtype; begin
 if p_kind in ('drivers','vehicle-combinations','driver-assignments','vehicle-assignments') then return private.command_v2_crew(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_idempotency_key,p_expected_version,p_value);end if;
 if p_kind in ('capability-definitions','assets','capacity-pools','calendars','maintenances','repositioning-blocks','asset-capabilities') then return private.command_v2_fleet(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,p_id,p_idempotency_key,p_expected_version,p_value);end if;
 perform private.authorize_v2_catalog(p_organization_id,p_member_id,p_kind,p_carrier_id,p_service_id,true,p_id);
 if p_idempotency_key is null or ((p_id is null) is distinct from (p_expected_version is null))
 or p_expected_version<1 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 case p_kind
when 'preferences' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","objective","maximumWaitMinutes","preferredMode","preferredEquipment","usualBudget","validUntil"],"properties":{"schemaVersion":{"const":"2.0"},"objective":{"anyOf":[{"enum":["LOWEST_COST","FASTEST","WEIGHTED"]},{"type":"null"}]},"maximumWaitMinutes":{"type":["integer","null"],"minimum":0,"maximum":525600},"preferredMode":{"anyOf":[{"enum":["ROAD","RAIL","SEA","AIR"]},{"type":"null"}]},"preferredEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"usualBudget":{"type":["object","null"],"additionalProperties":false,"required":["amount","currency"],"properties":{"amount":{"type":"number","exclusiveMinimum":0},"currency":{"const":"USD"}}},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"}}}'::json;
when 'cargo-profiles' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","name","categoryId","typicalUnits","requirements","preferredEquipment","active"],"properties":{"schemaVersion":{"const":"2.0"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"categoryId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"typicalUnits":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["packageType","quantity","weightPerUnitKg","volumePerUnitM3","dimensionsCm","indivisible","stackable","unitsPerPackage"],"properties":{"packageType":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"quantity":{"type":"integer","minimum":1},"weightPerUnitKg":{"type":"number","exclusiveMinimum":0},"volumePerUnitM3":{"type":"number","exclusiveMinimum":0},"dimensionsCm":{"type":"object","additionalProperties":false,"required":["length","width","height"],"properties":{"length":{"type":"number","exclusiveMinimum":0},"width":{"type":"number","exclusiveMinimum":0},"height":{"type":"number","exclusiveMinimum":0}}},"indivisible":{"type":"boolean"},"stackable":{"type":"boolean"},"unitsPerPackage":{"type":"integer","minimum":1,"maximum":1000000}}},"minItems":0,"maxItems":100},"requirements":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true},"preferredEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"active":{"type":"boolean"}}}'::json;
when 'cargo-categories' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","name","guidance","suggestedEquipment","active"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"guidance":{"type":"object","additionalProperties":false,"required":["recommendedEntryMethods","intakeSpecificationSchema","suggestedRequirements","recommendedVehicleClasses"],"properties":{"recommendedEntryMethods":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":1,"maxItems":100,"uniqueItems":true},"intakeSpecificationSchema":{"type":"object"},"suggestedRequirements":{"type":"object"},"recommendedVehicleClasses":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true}}},"suggestedEquipment":{"anyOf":[{"enum":["BOX_TRUCK","REEFER_TRUCK","FLATBED","TANKER_TRUCK","TRACTOR_TRAILER","ISO_CONTAINER","RAIL_WAGON","AIR_ULD"]},{"type":"null"}]},"active":{"type":"boolean"}}}'::json;
when 'carriers' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","commercialName","legalName","businessIdType","businessIdValue","registeredCountry","providerType","status","operationalPhone"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"commercialName":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"legalName":{"type":["string","null"],"minLength":1,"maxLength":200,"pattern":"\\S"},"businessIdType":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"businessIdValue":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"registeredCountry":{"type":["string","null"],"pattern":"^[A-Z]{2}$"},"providerType":{"enum":["OWNER_OPERATOR","SMALL_FLEET","CARRIER","ENTERPRISE_CARRIER"]},"status":{"enum":["ACTIVE","INACTIVE"]},"operationalPhone":{"type":["string","null"],"pattern":"^\\+[1-9]\\d{6,14}$"}}}'::json;
when 'depots' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","code","name","location","active","handling"],"properties":{"schemaVersion":{"const":"2.0"},"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,99}$"},"name":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"location":{"type":"object","additionalProperties":false,"required":["label","countryCode","region","city","lat","lng"],"properties":{"label":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"],"minLength":1,"maxLength":120,"pattern":"\\S"},"city":{"type":"string","minLength":1,"maxLength":120,"pattern":"\\S"},"lat":{"type":["number","null"],"minimum":-90,"maximum":90},"lng":{"type":["number","null"],"minimum":-180,"maximum":180}}},"active":{"type":"boolean"},"handling":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true}}}'::json;
when 'services' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","mode","serviceClass","maxWeightKg","maxVolumeM3","responseChannels","status","admittedCargoTypes","temperatureRange","requiredCertifications","supportsHazardous","supportsFragile","supportsOversized"],"properties":{"schemaVersion":{"const":"2.0"},"mode":{"enum":["ROAD","RAIL","SEA","AIR"]},"serviceClass":{"enum":["FTL","LTL"]},"maxWeightKg":{"type":["number","null"],"exclusiveMinimum":0},"maxVolumeM3":{"type":["number","null"],"exclusiveMinimum":0},"responseChannels":{"type":"array","items":{"enum":["MANUAL","API","MCP"]},"minItems":1,"maxItems":3,"uniqueItems":true},"status":{"enum":["ACTIVE","INACTIVE"]},"admittedCargoTypes":{"type":"array","items":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"minItems":0,"maxItems":100,"uniqueItems":true},"temperatureRange":{"type":["object","null"],"additionalProperties":false,"required":["minCelsius","maxCelsius"],"properties":{"minCelsius":{"type":"number"},"maxCelsius":{"type":"number"}}},"requiredCertifications":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"minItems":0,"maxItems":100,"uniqueItems":true},"supportsHazardous":{"type":"boolean"},"supportsFragile":{"type":"boolean"},"supportsOversized":{"type":"boolean"}}}'::json;
when 'areas' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","role","inclusion","geography","source","partnerId","evidence","verifiedAt","validFrom","validUntil","active"],"properties":{"schemaVersion":{"const":"2.0"},"role":{"enum":["PICKUP","DELIVERY"]},"inclusion":{"enum":["INCLUDE","EXCLUDE"]},"geography":{"type":"object","additionalProperties":false,"required":["granularity","countryCode","region","city","postalCode"],"properties":{"granularity":{"enum":["COUNTRY","REGION","CITY","POSTAL_CODE","POLYGON","POINTS"]},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"city":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"postalCode":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"geometry":{"type":["object","null"]}}},"source":{"enum":["OWN","PARTNER"]},"partnerId":{"type":["string","null"],"pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"evidence":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validFrom":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"active":{"type":"boolean"}}}'::json;
when 'lanes' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","pickupAreaId","deliveryAreaId","kind","mode","borderReviewRequired","evidence","verifiedAt","validFrom","validUntil","active","plannedTransitMinutes","transitProvenanceStatus","crossBorderProhibited","crossBorderProhibitionReference"],"properties":{"schemaVersion":{"const":"2.0"},"pickupAreaId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"deliveryAreaId":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"kind":{"enum":["DIRECT","WITHIN_AREA"]},"mode":{"enum":["ROAD","RAIL","SEA","AIR"]},"borderReviewRequired":{"type":"boolean"},"evidence":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validFrom":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"validUntil":{"type":["string","null"],"pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"active":{"type":"boolean"},"plannedTransitMinutes":{"type":["integer","null"],"minimum":1},"transitProvenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]},"crossBorderProhibited":{"type":"boolean"},"crossBorderProhibitionReference":{"type":["string","null"],"minLength":1,"maxLength":500,"pattern":"\\S"}}}'::json;
when 'partners' then schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","registeredName","partnerCarrierRef","agreementValidFrom","agreementValidUntil","status","coverageEvidence"],"properties":{"schemaVersion":{"const":"2.0"},"registeredName":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"partnerCarrierRef":{"type":["string","null"],"pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"agreementValidFrom":{"type":"string","pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"agreementValidUntil":{"type":"string","pattern":"^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(\\.\\d+)?(Z|[+-]\\d\\d:\\d\\d)$"},"status":{"enum":["ACTIVE","INACTIVE"]},"coverageEvidence":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"}}}'::json;
end case;
 if not coalesce(extensions.jsonb_matches_schema(schema,p_value),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_kind='carriers' and ((p_value->>'businessIdType' is null)<>(p_value->>'businessIdValue' is null))
 or p_kind='depots' and ((p_value#>>'{location,lat}' is null)<>(p_value#>>'{location,lng}' is null))
 or p_kind='services' and (p_value#>>'{temperatureRange,maxCelsius}')::numeric<(p_value#>>'{temperatureRange,minCelsius}')::numeric
 or p_kind in ('areas','lanes') and (p_value->>'validUntil')::timestamptz<=(p_value->>'validFrom')::timestamptz
 or p_kind='partners' and (p_value->>'agreementValidUntil')::timestamptz<=(p_value->>'agreementValidFrom')::timestamptz
 or p_kind='lanes' and ((p_value->>'plannedTransitMinutes' is null) is distinct from (p_value->>'transitProvenanceStatus'='UNKNOWN'))
 then raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
 hash:=private.hash_v2_freight_payload(jsonb_build_object('kind',p_kind,'carrierId',p_carrier_id,'serviceId',p_service_id,'id',p_id,'expectedVersion',p_expected_version,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_member_id::text||':'||p_idempotency_key::text,0));
 select * into receipt from private.v2_catalog_receipts where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
 if found then
  if receipt.payload_hash<>hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 if p_kind='areas' then
  if ((p_value->>'source'='OWN') is distinct from (p_value->>'partnerId' is null)) then
   raise exception 'INVALID_PARTNER_SOURCE' using errcode='PT400';end if;
  if p_value->>'partnerId' is not null then
   select * into partner from public.fulfilment_partners where id=(p_value->>'partnerId')::uuid and carrier_id=p_carrier_id for share;
   if not found then raise exception 'INVALID_PARTNER_SOURCE' using errcode='PT400';end if;
  end if;
 end if;
 if p_kind='services' and exists(select 1 from jsonb_array_elements_text(p_value->'admittedCargoTypes') v
  where not exists(select 1 from public.cargo_categories where id=v::uuid and active)) then
  raise exception 'INVALID_CARGO_CATEGORY' using errcode='PT400';end if;
 if p_kind='cargo-profiles' and not exists(select 1 from public.cargo_categories where id=(p_value->>'categoryId')::uuid and active) then
  raise exception 'INVALID_CARGO_CATEGORY' using errcode='PT400';end if;
 select * into target from private.catalog_target(p_kind,p_organization_id,p_carrier_id,p_service_id);
 if p_id is not null then
  execute format('select version from public.%I where id=$1 and %s for update',target.table_name,target.scope_sql) into current_version using p_id;
  if current_version is null then raise exception 'CATALOG_NOT_FOUND' using errcode='PT404';end if;
  if current_version<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 end if;
 if p_kind='cargo-categories' and p_id is not null and exists(select 1 from public.cargo_categories where id=p_id and code<>p_value->>'code') then
 raise exception 'IMMUTABLE_CATEGORY_CODE' using errcode='PT400';end if;
 -- Lock the service while revising its mode or creating/revising lanes. This prevents a concurrent mode mismatch.
 if p_kind in ('areas','lanes') then perform 1 from public.carrier_services where id=p_service_id for update;end if;
 if p_kind='services' and p_id is not null and exists(select 1 from public.service_lanes where carrier_service_id=p_id and transport_mode<>p_value->>'mode') then
  raise exception 'SERVICE_MODE_HAS_LANES' using errcode='PT400';end if;
 case p_kind
when 'preferences' then
 if p_id is null then insert into public.organization_preferences (allow_auto_booking,objective,maximum_wait_minutes,preferred_mode,preferred_equipment,usual_budget,valid_until,organization_id) values(false,(p_value#>>'{objective}')::text,(p_value#>>'{maximumWaitMinutes}')::integer,(p_value#>>'{preferredMode}')::text,(p_value#>>'{preferredEquipment}')::text,nullif(p_value#>'{usualBudget}','null'::jsonb),(p_value#>>'{validUntil}')::timestamptz,p_organization_id) returning id into saved_id;
 else update public.organization_preferences set objective=(p_value#>>'{objective}')::text,maximum_wait_minutes=(p_value#>>'{maximumWaitMinutes}')::integer,preferred_mode=(p_value#>>'{preferredMode}')::text,preferred_equipment=(p_value#>>'{preferredEquipment}')::text,usual_budget=nullif(p_value#>'{usualBudget}','null'::jsonb),valid_until=(p_value#>>'{validUntil}')::timestamptz where id=p_id returning id into saved_id;end if;
when 'cargo-profiles' then
 if p_id is null then insert into public.organization_cargo_profiles (profile_name,cargo_category_id,typical_units,requirements,preferred_equipment,active,organization_id,default_entry_method) values((p_value#>>'{name}')::text,(p_value#>>'{categoryId}')::uuid,nullif(p_value#>'{typicalUnits}','null'::jsonb),nullif(p_value#>'{requirements}','null'::jsonb),(p_value#>>'{preferredEquipment}')::text,(p_value#>>'{active}')::boolean,p_organization_id,'PACKAGES') returning id into saved_id;
 else update public.organization_cargo_profiles set profile_name=(p_value#>>'{name}')::text,cargo_category_id=(p_value#>>'{categoryId}')::uuid,typical_units=nullif(p_value#>'{typicalUnits}','null'::jsonb),requirements=nullif(p_value#>'{requirements}','null'::jsonb),preferred_equipment=(p_value#>>'{preferredEquipment}')::text,active=(p_value#>>'{active}')::boolean where id=p_id returning id into saved_id;end if;
when 'cargo-categories' then
 if p_id is null then insert into public.cargo_categories (code,name,recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes,suggested_equipment,active) values((p_value#>>'{code}')::text,(p_value#>>'{name}')::text,nullif(p_value#>'{guidance,recommendedEntryMethods}','null'::jsonb),nullif(p_value#>'{guidance,intakeSpecificationSchema}','null'::jsonb),nullif(p_value#>'{guidance,suggestedRequirements}','null'::jsonb),nullif(p_value#>'{guidance,recommendedVehicleClasses}','null'::jsonb),(p_value#>>'{suggestedEquipment}')::text,(p_value#>>'{active}')::boolean) returning id into saved_id;
 else update public.cargo_categories set code=(p_value#>>'{code}')::text,name=(p_value#>>'{name}')::text,recommended_entry_methods=nullif(p_value#>'{guidance,recommendedEntryMethods}','null'::jsonb),intake_specification_schema=nullif(p_value#>'{guidance,intakeSpecificationSchema}','null'::jsonb),suggested_requirements=nullif(p_value#>'{guidance,suggestedRequirements}','null'::jsonb),recommended_vehicle_classes=nullif(p_value#>'{guidance,recommendedVehicleClasses}','null'::jsonb),suggested_equipment=(p_value#>>'{suggestedEquipment}')::text,active=(p_value#>>'{active}')::boolean where id=p_id returning id into saved_id;end if;
when 'carriers' then
 if p_id is null then insert into public.carriers (code,name,legal_name,business_identifier_type,business_identifier_value,registered_country,provider_type,status,operational_phone) values((p_value#>>'{code}')::text,(p_value#>>'{commercialName}')::text,(p_value#>>'{legalName}')::text,(p_value#>>'{businessIdType}')::text,(p_value#>>'{businessIdValue}')::text,(p_value#>>'{registeredCountry}')::text,(p_value#>>'{providerType}')::text,(p_value#>>'{status}')::text,(p_value#>>'{operationalPhone}')::text) returning id into saved_id;
 else update public.carriers set code=(p_value#>>'{code}')::text,name=(p_value#>>'{commercialName}')::text,legal_name=(p_value#>>'{legalName}')::text,business_identifier_type=(p_value#>>'{businessIdType}')::text,business_identifier_value=(p_value#>>'{businessIdValue}')::text,registered_country=(p_value#>>'{registeredCountry}')::text,provider_type=(p_value#>>'{providerType}')::text,status=(p_value#>>'{status}')::text,operational_phone=(p_value#>>'{operationalPhone}')::text where id=p_id returning id into saved_id;end if;
when 'depots' then
 if p_id is null then insert into public.carrier_depots (code,name,country_code,region_code,city,address_line,latitude,longitude,active,handling,carrier_id) values((p_value#>>'{code}')::text,(p_value#>>'{name}')::text,(p_value#>>'{location,countryCode}')::text,(p_value#>>'{location,region}')::text,(p_value#>>'{location,city}')::text,(p_value#>>'{location,label}')::text,(p_value#>>'{location,lat}')::numeric,(p_value#>>'{location,lng}')::numeric,(p_value#>>'{active}')::boolean,nullif(p_value#>'{handling}','null'::jsonb),p_carrier_id) returning id into saved_id;
 else update public.carrier_depots set code=(p_value#>>'{code}')::text,name=(p_value#>>'{name}')::text,country_code=(p_value#>>'{location,countryCode}')::text,region_code=(p_value#>>'{location,region}')::text,city=(p_value#>>'{location,city}')::text,address_line=(p_value#>>'{location,label}')::text,latitude=(p_value#>>'{location,lat}')::numeric,longitude=(p_value#>>'{location,lng}')::numeric,active=(p_value#>>'{active}')::boolean,handling=nullif(p_value#>'{handling}','null'::jsonb) where id=p_id returning id into saved_id;end if;
when 'services' then
 if p_id is null then insert into public.carrier_services (transport_mode,service_type,max_capacity_kg,max_volume_m3,response_channels,active,temperature_min_c,temperature_max_c,required_certifications,supports_hazardous,supports_fragile,supports_oversized,carrier_id,supports_refrigerated) values((p_value#>>'{mode}')::text,(p_value#>>'{serviceClass}')::text,(p_value#>>'{maxWeightKg}')::numeric,(p_value#>>'{maxVolumeM3}')::numeric,nullif(p_value#>'{responseChannels}','null'::jsonb),(p_value->>'status'='ACTIVE'),(p_value#>>'{temperatureRange,minCelsius}')::numeric,(p_value#>>'{temperatureRange,maxCelsius}')::numeric,nullif(p_value#>'{requiredCertifications}','null'::jsonb),(p_value#>>'{supportsHazardous}')::boolean,(p_value#>>'{supportsFragile}')::boolean,(p_value#>>'{supportsOversized}')::boolean,p_carrier_id,(p_value->>'temperatureRange' is not null)) returning id into saved_id;
 else update public.carrier_services set transport_mode=(p_value#>>'{mode}')::text,service_type=(p_value#>>'{serviceClass}')::text,max_capacity_kg=(p_value#>>'{maxWeightKg}')::numeric,max_volume_m3=(p_value#>>'{maxVolumeM3}')::numeric,response_channels=nullif(p_value#>'{responseChannels}','null'::jsonb),active=(p_value->>'status'='ACTIVE'),temperature_min_c=(p_value#>>'{temperatureRange,minCelsius}')::numeric,temperature_max_c=(p_value#>>'{temperatureRange,maxCelsius}')::numeric,required_certifications=nullif(p_value#>'{requiredCertifications}','null'::jsonb),supports_hazardous=(p_value#>>'{supportsHazardous}')::boolean,supports_fragile=(p_value#>>'{supportsFragile}')::boolean,supports_oversized=(p_value#>>'{supportsOversized}')::boolean,supports_refrigerated=(p_value->>'temperatureRange' is not null) where id=p_id returning id into saved_id;end if;
delete from public.carrier_service_cargo_categories where carrier_service_id=saved_id;
insert into public.carrier_service_cargo_categories(carrier_service_id,cargo_category_id) select saved_id,value::uuid from jsonb_array_elements_text(p_value->'admittedCargoTypes');
when 'areas' then
 if p_id is null then insert into public.service_areas (area_role,coverage,granularity,country_code,region_code,city,postal_code,geometry,fulfilment_source,fulfilment_partner_id,evidence_reference,verified_at,valid_from,valid_until,active,carrier_service_id,partner_reference) values((p_value#>>'{role}')::text,(p_value#>>'{inclusion}')::text,(p_value#>>'{geography,granularity}')::text,(p_value#>>'{geography,countryCode}')::text,(p_value#>>'{geography,region}')::text,(p_value#>>'{geography,city}')::text,(p_value#>>'{geography,postalCode}')::text,nullif(p_value#>'{geography,geometry}','null'::jsonb),(p_value#>>'{source}')::text,(p_value#>>'{partnerId}')::uuid,(p_value#>>'{evidence}')::text,(p_value#>>'{verifiedAt}')::timestamptz,(p_value#>>'{validFrom}')::timestamptz,(p_value#>>'{validUntil}')::timestamptz,(p_value#>>'{active}')::boolean,p_service_id,p_value->>'partnerId') returning id into saved_id;
 else update public.service_areas set area_role=(p_value#>>'{role}')::text,coverage=(p_value#>>'{inclusion}')::text,granularity=(p_value#>>'{geography,granularity}')::text,country_code=(p_value#>>'{geography,countryCode}')::text,region_code=(p_value#>>'{geography,region}')::text,city=(p_value#>>'{geography,city}')::text,postal_code=(p_value#>>'{geography,postalCode}')::text,geometry=nullif(p_value#>'{geography,geometry}','null'::jsonb),fulfilment_source=(p_value#>>'{source}')::text,fulfilment_partner_id=(p_value#>>'{partnerId}')::uuid,evidence_reference=(p_value#>>'{evidence}')::text,verified_at=(p_value#>>'{verifiedAt}')::timestamptz,valid_from=(p_value#>>'{validFrom}')::timestamptz,valid_until=(p_value#>>'{validUntil}')::timestamptz,active=(p_value#>>'{active}')::boolean,partner_reference=p_value->>'partnerId' where id=p_id returning id into saved_id;end if;
when 'lanes' then
 if p_id is null then insert into public.service_lanes (pickup_area_id,delivery_area_id,lane_kind,transport_mode,cross_border_review_required,evidence_reference,verified_at,valid_from,valid_until,active,planned_transit_minutes,transit_provenance_status,cross_border_prohibited,cross_border_prohibition_reference,carrier_service_id) values((p_value#>>'{pickupAreaId}')::uuid,(p_value#>>'{deliveryAreaId}')::uuid,(p_value#>>'{kind}')::text,(p_value#>>'{mode}')::text,(p_value#>>'{borderReviewRequired}')::boolean,(p_value#>>'{evidence}')::text,(p_value#>>'{verifiedAt}')::timestamptz,(p_value#>>'{validFrom}')::timestamptz,(p_value#>>'{validUntil}')::timestamptz,(p_value#>>'{active}')::boolean,(p_value#>>'{plannedTransitMinutes}')::integer,(p_value#>>'{transitProvenanceStatus}')::text,(p_value#>>'{crossBorderProhibited}')::boolean,(p_value#>>'{crossBorderProhibitionReference}')::text,p_service_id) returning id into saved_id;
 else update public.service_lanes set pickup_area_id=(p_value#>>'{pickupAreaId}')::uuid,delivery_area_id=(p_value#>>'{deliveryAreaId}')::uuid,lane_kind=(p_value#>>'{kind}')::text,transport_mode=(p_value#>>'{mode}')::text,cross_border_review_required=(p_value#>>'{borderReviewRequired}')::boolean,evidence_reference=(p_value#>>'{evidence}')::text,verified_at=(p_value#>>'{verifiedAt}')::timestamptz,valid_from=(p_value#>>'{validFrom}')::timestamptz,valid_until=(p_value#>>'{validUntil}')::timestamptz,active=(p_value#>>'{active}')::boolean,planned_transit_minutes=(p_value#>>'{plannedTransitMinutes}')::integer,transit_provenance_status=(p_value#>>'{transitProvenanceStatus}')::text,cross_border_prohibited=(p_value#>>'{crossBorderProhibited}')::boolean,cross_border_prohibition_reference=(p_value#>>'{crossBorderProhibitionReference}')::text where id=p_id returning id into saved_id;end if;
when 'partners' then
 if p_id is null then insert into public.fulfilment_partners (registered_name,partner_carrier_ref,agreement_valid_from,agreement_valid_until,status,coverage_evidence,carrier_id) values((p_value#>>'{registeredName}')::text,(p_value#>>'{partnerCarrierRef}')::uuid,(p_value#>>'{agreementValidFrom}')::timestamptz,(p_value#>>'{agreementValidUntil}')::timestamptz,(p_value#>>'{status}')::text,(p_value#>>'{coverageEvidence}')::text,p_carrier_id) returning id into saved_id;
 else update public.fulfilment_partners set registered_name=(p_value#>>'{registeredName}')::text,partner_carrier_ref=(p_value#>>'{partnerCarrierRef}')::uuid,agreement_valid_from=(p_value#>>'{agreementValidFrom}')::timestamptz,agreement_valid_until=(p_value#>>'{agreementValidUntil}')::timestamptz,status=(p_value#>>'{status}')::text,coverage_evidence=(p_value#>>'{coverageEvidence}')::text where id=p_id returning id into saved_id;end if;
end case;
 result:=private.catalog_record(p_kind,saved_id);
 insert into private.v2_catalog_receipts(organization_id,member_id,idempotency_key,payload_hash,result)
 values(p_organization_id,p_member_id,p_idempotency_key,hash,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;
