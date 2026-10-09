\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin
    raise exception 'V2_QA_LOCAL_ONLY: pass psql -v local_only=1; never run this cleanup on hosted Supabase';
  end $$;
\endif

\if :{?backup_confirmed}
\else
  \set backup_confirmed 0
\endif
\if :backup_confirmed
\else
  do $$ begin raise exception 'V2_QA_BACKUP_REQUIRED: use gate.py cleanup with an external evidence directory'; end $$;
\endif
begin;

-- Protect all incoming FKs, including implicit ON DELETE CASCADE. Reject unknown children.
create temporary table cleanup_ids (relation regclass, id uuid, primary key(relation,id)) on commit drop;
insert into cleanup_ids values
('public.service_lanes'::regclass, 'c2380000-0000-4000-8000-000000000001'::uuid),
('public.service_lanes'::regclass, 'c23c0000-0000-4000-8000-000000000001'::uuid),
('public.service_areas'::regclass, 'c2370000-0000-4000-8000-000000000001'::uuid),
('public.service_areas'::regclass, 'c2370000-0000-4000-8000-000000000002'::uuid),
('public.service_areas'::regclass, 'c2370000-0000-4000-8000-000000000003'::uuid),
('public.service_areas'::regclass, 'c2370000-0000-4000-8000-000000000004'::uuid),
('public.service_areas'::regclass, 'c23b0000-0000-4000-8000-000000000001'::uuid),
('public.service_areas'::regclass, 'c23b0000-0000-4000-8000-000000000002'::uuid),
('public.carrier_depots'::regclass, 'c2350000-0000-4000-8000-000000000001'::uuid),
('public.carrier_services'::regclass, 'c2360000-0000-4000-8000-000000000001'::uuid),
('public.carrier_services'::regclass, 'c23a0000-0000-4000-8000-000000000001'::uuid),
('public.carriers'::regclass, 'c2340000-0000-4000-8000-000000000001'::uuid),
('public.carriers'::regclass, 'c2390000-0000-4000-8000-000000000001'::uuid),
('public.facilities'::regclass, 'c2330000-0000-4000-8000-000000000001'::uuid),
('public.facilities'::regclass, 'c2330000-0000-4000-8000-000000000002'::uuid),
('public.facilities'::regclass, 'c2330000-0000-4000-8000-000000000003'::uuid),
('public.facilities'::regclass, 'c2330000-0000-4000-8000-000000000004'::uuid),
('public.organization_members'::regclass, 'c2320000-0000-4000-8000-000000000001'::uuid),
('public.organization_members'::regclass, 'c2320000-0000-4000-8000-000000000002'::uuid),
('auth.identities'::regclass, 'c2310000-0000-4000-8000-000000000001'::uuid),
('auth.identities'::regclass, 'c2310000-0000-4000-8000-000000000002'::uuid),
('auth.users'::regclass, 'c2310000-0000-4000-8000-000000000001'::uuid),
('auth.users'::regclass, 'c2310000-0000-4000-8000-000000000002'::uuid),
('public.organizations'::regclass, 'c2300000-0000-4000-8000-000000000001'::uuid),
('public.organizations'::regclass, 'c2300000-0000-4000-8000-000000000002'::uuid);

do $$begin
 if to_regclass('public.carrier_operators') is not null then
  insert into cleanup_ids values('public.carrier_operators'::regclass,'c23d0000-0000-4000-8000-000000000001'),
   ('public.carrier_operators'::regclass,'c23d0000-0000-4000-8000-000000000002');
 end if;
end;$$;

do $$
declare r record; joins text; outside text; found boolean;
begin
  for r in select distinct relation from cleanup_ids order by relation loop
    execute format('lock table %s in share row exclusive mode', r.relation);
  end loop;
  for r in select c.* from pg_constraint c where contype='f'
    and confrelid in (select relation from cleanup_ids) order by conrelid, oid loop
    execute format('lock table %s in share row exclusive mode', r.conrelid::regclass);
    select string_agg(format('child.%I = parent.%I', a.attname, b.attname), ' and ')
      into joins from unnest(r.conkey, r.confkey) k(child_col,parent_col)
      join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.child_col
      join pg_attribute b on b.attrelid=r.confrelid and b.attnum=k.parent_col;
    outside := 'true';
    if exists(select 1 from cleanup_ids where relation=r.conrelid) then
      outside := format('not exists(select 1 from cleanup_ids x where x.relation=%s and x.id=child.id)', r.conrelid);
    end if;
    execute format('select exists(select 1 from %s child join %s parent on %s
      join cleanup_ids target on target.relation=%s and target.id=parent.id where %s)',
      r.conrelid::regclass,r.confrelid::regclass,joins,r.confrelid,outside) into found;
    if found then raise exception 'V2_QA_CLEANUP_BLOCKED: external child at FK %; preserve it and coordinate with its owner', r.conname; end if;
  end loop;
end $$;
-- Before counts for the exact IDs in this transaction.
do $$ declare r record; n bigint; begin
  for r in select distinct relation from cleanup_ids loop
    execute format('select count(*) from %s t join cleanup_ids x on x.relation=%s and x.id=t.id',r.relation,r.relation::oid) into n;
    raise notice 'BEFORE %: %',r.relation,n;
  end loop;
end $$;


-- Exact IDs only. Never delete by city, date, organization code, or UUID prefix.
do $$begin
 if to_regclass('public.carrier_operators') is not null then
  delete from public.carrier_operators where id in('c23d0000-0000-4000-8000-000000000001','c23d0000-0000-4000-8000-000000000002');
 end if;
end;$$;
delete from public.service_lanes
where id in ('c2380000-0000-4000-8000-000000000001', 'c23c0000-0000-4000-8000-000000000001');

delete from public.service_areas
where id in (
  'c2370000-0000-4000-8000-000000000001',
  'c2370000-0000-4000-8000-000000000002',
  'c2370000-0000-4000-8000-000000000003',
  'c2370000-0000-4000-8000-000000000004', 'c23b0000-0000-4000-8000-000000000001', 'c23b0000-0000-4000-8000-000000000002'
);

delete from public.carrier_depots
where id in ('c2350000-0000-4000-8000-000000000001');

delete from public.carrier_services
where id in ('c2360000-0000-4000-8000-000000000001', 'c23a0000-0000-4000-8000-000000000001');

delete from public.carriers
where id in ('c2340000-0000-4000-8000-000000000001', 'c2390000-0000-4000-8000-000000000001');

delete from public.facilities
where id in (
  'c2330000-0000-4000-8000-000000000001',
  'c2330000-0000-4000-8000-000000000002',
  'c2330000-0000-4000-8000-000000000003',
  'c2330000-0000-4000-8000-000000000004'
);

delete from public.organization_members
where id in (
  'c2320000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000002'
);

delete from auth.identities
where id in (
  'c2310000-0000-4000-8000-000000000001',
  'c2310000-0000-4000-8000-000000000002'
);

delete from auth.users
where id in (
  'c2310000-0000-4000-8000-000000000001',
  'c2310000-0000-4000-8000-000000000002'
);

delete from public.organizations
where id in (
  'c2300000-0000-4000-8000-000000000001',
  'c2300000-0000-4000-8000-000000000002'
);


do $$ declare r record; n bigint; begin
  for r in select distinct relation from cleanup_ids loop
    execute format('select count(*) from %s t join cleanup_ids x on x.relation=%s and x.id=t.id',r.relation,r.relation::oid) into n;
    raise notice 'AFTER %: %',r.relation,n;
    if n <> 0 then raise exception 'V2_QA_CLEANUP_INCOMPLETE: %',r.relation; end if;
  end loop;
end $$;

commit;
