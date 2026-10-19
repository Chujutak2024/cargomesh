-- HAC-50: administrative regular driver. Does not reserve time or create an execution.
begin;
create table public.vehicle_regular_drivers(
 asset_id uuid primary key references public.transport_assets(id),
 carrier_id uuid not null references public.carriers(id),
 driver_id uuid references public.drivers(id),
 version integer not null check(version>0),
 updated_at timestamptz not null default now()
);
create index vehicle_regular_drivers_carrier_idx on public.vehicle_regular_drivers(carrier_id,asset_id);
create index vehicle_regular_drivers_driver_idx on public.vehicle_regular_drivers(driver_id) where driver_id is not null;
create table private.regular_driver_receipts(
 carrier_id uuid not null references public.carriers(id),operator_id uuid not null,
 key uuid not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,
 primary key(carrier_id,operator_id,key),foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create table private.regular_driver_events(
 id bigint generated always as identity primary key,carrier_id uuid not null references public.carriers(id),
 asset_id uuid not null references public.transport_assets(id),operator_id uuid not null,
 driver_id uuid references public.drivers(id),version integer not null check(version>0),created_at timestamptz not null default now(),
 foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create index regular_driver_events_scope_idx on private.regular_driver_events(carrier_id,asset_id,created_at);
alter table public.vehicle_regular_drivers enable row level security;
alter table private.regular_driver_receipts enable row level security;
alter table private.regular_driver_events enable row level security;
create function private.regular_driver_read_access(c uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
begin return auth.uid() is not null and private.identity_carrier(c) is not null;
exception when sqlstate 'PT403' then return false;end;$$;
create policy regular_driver_read on public.vehicle_regular_drivers for select to authenticated using(private.regular_driver_read_access(carrier_id));
revoke all on public.vehicle_regular_drivers,private.regular_driver_receipts,private.regular_driver_events from public,anon,authenticated,service_role;
grant select on public.vehicle_regular_drivers to authenticated;

create function private.check_regular_driver_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.transport_assets%rowtype;begin
 select * into a from public.transport_assets where id=new.asset_id;
 if not found or a.carrier_id<>new.carrier_id or a.mode<>'ROAD' or new.driver_id is not null and not exists(
  select 1 from public.drivers d where d.id=new.driver_id and d.carrier_id=a.carrier_id and d.carrier_service_id=a.carrier_service_id
 ) then raise exception 'INVALID_DRIVER_REFERENCE' using errcode='PT400';end if;
 return new;
end;$$;
create trigger regular_driver_scope before insert or update on public.vehicle_regular_drivers for each row execute function private.check_regular_driver_scope();

-- Carrier/service revisions must not silently invalidate an existing association.
create function private.guard_regular_driver_resource() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.carrier_id is distinct from old.carrier_id or new.carrier_service_id is distinct from old.carrier_service_id then
  if tg_table_name='transport_assets' then
   if exists(select 1 from public.vehicle_regular_drivers r left join public.drivers d on d.id=r.driver_id where r.asset_id=old.id and (r.carrier_id is distinct from new.carrier_id or r.driver_id is not null and (d.carrier_id is distinct from new.carrier_id or d.carrier_service_id is distinct from new.carrier_service_id))) then raise exception 'REGULAR_DRIVER_SCOPE_CONFLICT' using errcode='PT409';end if;
  elsif exists(select 1 from public.vehicle_regular_drivers r join public.transport_assets a on a.id=r.asset_id where r.driver_id=old.id and (a.carrier_id is distinct from new.carrier_id or a.carrier_service_id is distinct from new.carrier_service_id)) then raise exception 'REGULAR_DRIVER_SCOPE_CONFLICT' using errcode='PT409';end if;
 end if;return new;
end;$$;
create trigger regular_driver_asset_guard before update of carrier_id,carrier_service_id on public.transport_assets for each row execute function private.guard_regular_driver_resource();
create trigger regular_driver_driver_guard before update of carrier_id,carrier_service_id on public.drivers for each row execute function private.guard_regular_driver_resource();

create function private.regular_driver_record(a uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('assetId',r.asset_id,'carrierId',r.carrier_id,'serviceId',t.carrier_service_id,'driverId',r.driver_id,'version',r.version,'updatedAt',r.updated_at)
 from public.vehicle_regular_drivers r join public.transport_assets t on t.id=r.asset_id where r.asset_id=a;
$$;
create function private.regular_vehicle_driver(op uuid,c uuid,a uuid,v jsonb,k uuid,f integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt private.regular_driver_receipts; rec public.vehicle_regular_drivers; result jsonb; fingerprint text; driver_ref uuid; service_ref uuid; expected integer;begin
 perform private.carrier_portal_catalog_scope(op,'assets',c,null,a is not null,a);
 if f is null or f<0 or f>100000 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if a is null then
  if v is not null or k is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  select coalesce(jsonb_agg(private.regular_driver_record(rows.asset_id)),'[]'::jsonb) into result from (select asset_id from public.vehicle_regular_drivers where carrier_id=c order by asset_id limit 100 offset f) rows;
  return jsonb_build_object('data',result);
 end if;
 if k is null or not coalesce(extensions.jsonb_matches_schema('{"type":"object","additionalProperties":false,"required":["schemaVersion","serviceId","driverId","expectedVersion"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"driverId":{"type":["string","null"],"format":"uuid"},"expectedVersion":{"type":"integer","minimum":0,"maximum":2147483646}}}'::json,v),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 service_ref:=(v->>'serviceId')::uuid;driver_ref:=(v->>'driverId')::uuid;expected:=(v->>'expectedVersion')::integer;
 fingerprint:=encode(extensions.digest(jsonb_build_object('carrierId',c,'assetId',a,'value',v)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('regular-driver-key:'||c||':'||op||':'||k,0));
 select * into receipt from private.regular_driver_receipts where carrier_id=c and operator_id=op and key=k;
 if found then if receipt.payload_hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return receipt.result||jsonb_build_object('replay',true);end if;
 perform 1 from public.transport_assets where id=a and carrier_id=c and carrier_service_id=service_ref and mode='ROAD' for update;
 if not found then raise exception 'ASSET_NOT_FOUND' using errcode='PT404';end if;
 if driver_ref is not null then
  perform 1 from public.drivers where id=driver_ref and carrier_id=c and carrier_service_id=service_ref for update;
  if not found then raise exception 'INVALID_DRIVER_REFERENCE' using errcode='PT400';end if;
 end if;
 select * into rec from public.vehicle_regular_drivers where asset_id=a for update;
 if coalesce(rec.version,0)<>expected then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 insert into public.vehicle_regular_drivers(asset_id,carrier_id,driver_id,version) values(a,c,driver_ref,expected+1)
 on conflict(asset_id) do update set driver_id=excluded.driver_id,version=excluded.version,updated_at=now();
 insert into private.regular_driver_events(carrier_id,asset_id,operator_id,driver_id,version) values(c,a,op,driver_ref,expected+1);
 result:=jsonb_build_object('data',private.regular_driver_record(a),'replay',false);
 insert into private.regular_driver_receipts(carrier_id,operator_id,key,payload_hash,result) values(c,op,k,fingerprint,result);
 return result;
end;$$;
create function public.regular_vehicle_driver_v2(p_operator_id uuid,p_carrier_id uuid,p_asset_id uuid,p_value jsonb,p_key uuid,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.regular_vehicle_driver(p_operator_id,p_carrier_id,p_asset_id,p_value,p_key,p_offset);$$;
revoke all on function public.regular_vehicle_driver_v2(uuid,uuid,uuid,jsonb,uuid,integer),private.regular_vehicle_driver(uuid,uuid,uuid,jsonb,uuid,integer),private.regular_driver_record(uuid),private.regular_driver_read_access(uuid),private.check_regular_driver_scope(),private.guard_regular_driver_resource() from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function public.regular_vehicle_driver_v2(uuid,uuid,uuid,jsonb,uuid,integer),private.regular_vehicle_driver(uuid,uuid,uuid,jsonb,uuid,integer),private.regular_driver_read_access(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
