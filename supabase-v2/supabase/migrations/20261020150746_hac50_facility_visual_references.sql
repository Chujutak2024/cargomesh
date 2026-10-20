-- HAC-50 integration with HAC-52: explicit presentation metadata only.
-- No Facilities, organization, fleet, request or operational data is created.
begin;
create table public.facility_visual_references(
 facility_id uuid primary key references public.facilities(id),
 organization_id uuid not null references public.organizations(id),
 template_id text check(template_id in ('compact','distribution','cold','workshop','transfer','cross-dock','service-yard','cold-campus','silo-terminal','urban-courtyard','industrial-plant','agricultural-hub','retail-store','pharmaceutical-centre','fulfilment-centre')),
 version integer not null check(version>0),updated_at timestamptz not null default now(),
 foreign key(facility_id,organization_id) references public.facilities(id,organization_id)
);
create index facility_visual_scope_idx on public.facility_visual_references(organization_id,facility_id);
alter table public.facility_visual_references enable row level security;
create policy facility_visual_read on public.facility_visual_references for select to authenticated using(
 exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
 where m.organization_id=facility_visual_references.organization_id and m.auth_user_id=(select auth.uid()) and m.status='ACTIVE' and o.status='ACTIVE')
 and exists(select 1 from public.facilities f where f.id=facility_visual_references.facility_id and f.organization_id=facility_visual_references.organization_id)
);
revoke all on public.facility_visual_references from public,anon,authenticated,service_role;
grant select on public.facility_visual_references to authenticated;
create table private.facility_visual_receipts(
 organization_id uuid not null references public.organizations(id),member_id uuid not null references public.organization_members(id),
 key uuid not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,
 primary key(organization_id,member_id,key)
);
alter table private.facility_visual_receipts enable row level security;
revoke all on private.facility_visual_receipts from public,anon,authenticated,service_role;

-- Managed writes require definer access: direct writes and receipt reads are revoked.
-- Identity, active organization, membership and Facility ownership are rechecked here.
create function private.facility_visual_reference(o uuid,m uuid,f uuid,t text,v integer,k uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_role text;r public.facility_visual_references;receipt private.facility_visual_receipts;h text;result jsonb;begin
 select member.role into actor_role from public.organization_members member join public.organizations org on org.id=member.organization_id
 where member.id=m and member.organization_id=o and member.auth_user_id=auth.uid() and member.status='ACTIVE' and org.status='ACTIVE'
 for share of member,org;
 if actor_role is null then raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
 if not exists(select 1 from public.facilities where id=f and organization_id=o) then raise exception 'FACILITY_NOT_FOUND' using errcode='PT404';end if;
 if v is null and k is null and t is null then
  select * into r from public.facility_visual_references where facility_id=f and organization_id=o;
  return jsonb_build_object('schemaVersion','2.0','data',jsonb_build_object('facilityId',f,'organizationId',o,
   'templateId',r.template_id,'version',coalesce(r.version,0),'updatedAt',r.updated_at),'meta',jsonb_build_object('idempotentReplay',false));
 end if;
 if actor_role not in ('OWNER','SUPERVISOR') then raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
 if v is null or v<0 or v>2147483646 or k is null or t is not null and t not in ('compact','distribution','cold','workshop','transfer','cross-dock','service-yard','cold-campus','silo-terminal','urban-courtyard','industrial-plant','agricultural-hub','retail-store','pharmaceutical-centre','fulfilment-centre')
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('facilityId',f,'templateId',t,'expectedVersion',v));
 perform pg_advisory_xact_lock(hashtextextended(o::text||':'||m::text||':'||k::text,50));
 select * into receipt from private.facility_visual_receipts where organization_id=o and member_id=m and key=k;
 if found then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return receipt.result||jsonb_build_object('meta',jsonb_build_object('idempotentReplay',true));
 end if;
 perform 1 from public.facilities where id=f and organization_id=o for update;
 select * into r from public.facility_visual_references where facility_id=f for update;
 if coalesce(r.version,0)<>v then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 insert into public.facility_visual_references(facility_id,organization_id,template_id,version) values(f,o,t,v+1)
 on conflict(facility_id) do update set template_id=excluded.template_id,version=excluded.version,updated_at=now() returning * into r;
 result:=jsonb_build_object('schemaVersion','2.0','data',jsonb_build_object('facilityId',f,'organizationId',o,
  'templateId',r.template_id,'version',r.version,'updatedAt',r.updated_at),'meta',jsonb_build_object('idempotentReplay',false));
 insert into private.facility_visual_receipts values(o,m,k,h,result);
 return result;
end;$$;
create function public.facility_visual_reference_v2(p_organization_id uuid,p_member_id uuid,p_facility_id uuid,
 p_template_id text,p_expected_version integer,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.facility_visual_reference(p_organization_id,p_member_id,p_facility_id,p_template_id,p_expected_version,p_key);
$$;
revoke all on function private.facility_visual_reference(uuid,uuid,uuid,text,integer,uuid),public.facility_visual_reference_v2(uuid,uuid,uuid,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function private.facility_visual_reference(uuid,uuid,uuid,text,integer,uuid),public.facility_visual_reference_v2(uuid,uuid,uuid,text,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
