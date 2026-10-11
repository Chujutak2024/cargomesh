-- Adapted from ../v2-full-flow-qa/cleanup.sql; same exact-key child-first algorithm.
-- User-authorized exception: ordinary guards are suspended ONLY inside this teardown transaction.
\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$
begin
    raise exception 'HAC44_LOCAL_ONLY';
end
$$;
\endif
\if :{?backup_confirmed}
\else
\set backup_confirmed 0
\endif
\if :backup_confirmed
\else
do $$
begin
    raise exception 'HAC44_BACKUP_REQUIRED: use the external-evidence QA runner';
end
$$;
\endif
begin;
do $$ begin if inet_server_addr() is not null then raise exception 'LOCAL_DOCKER_SOCKET_REQUIRED'; end if; end $$;
select hac44_qa.capture_ids();
select 'HAC44_BEFORE:' || carrier_portal_qa.counts()::text;
-- Incoming FK audit includes all implicit CASCADE edges and Auth user children.
select c.conrelid::regclass child,
c.confrelid::regclass parent,
c.conname,
c.confdeltype,
pg_get_constraintdef(
    c.oid
) from pg_constraint c where c.contype = 'f' and(
    c.confrelid = 'auth.users'::regclass or c.confrelid in(
        select to_regclass(
            relation
        ) from hac44_qa.ids where run_id = hac44_qa.current_run()
    )
) order by 1,
2,
3;
create temporary table hac44_remove(
    relation text,
    key jsonb,
    primary key(
        relation,
        key
    )
) on commit drop;
insert into hac44_remove select relation,
key from hac44_qa.ids where run_id = hac44_qa.current_run();
-- Auth users, identities, sessions, refresh rows and audit entries already have
-- exact registered PKs and credential-free external backups. No implicit cascade.
create temporary table cp_affected on commit drop as
select distinct to_regclass(relation) relation from hac44_remove;
-- Capture current O/A/R/D state before changing only affected ordinary triggers.
create temporary table cp_trigger_states on commit drop as
select t.tgrelid relation,t.tgname name,t.tgenabled enabled
from pg_trigger t join cp_affected a on a.relation=t.tgrelid where not t.tgisinternal;
-- Snapshot exact rows in this same transaction before disabling any guard.
-- Auth snapshots deliberately exclude credential material; restore Auth by
-- provisioning fresh random credentials, never by copying hashes or sessions.
create temporary table cp_row_backups(relation text,key jsonb,rows jsonb) on commit drop;
do $$ declare item record; snapshot jsonb; begin
    for item in select * from hac44_remove order by relation,key loop
        execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from %s t where %s',
            item.relation,hac44_qa.where_key(item.key)) into snapshot;
        if item.relation like 'auth.%' then
            select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k,v),'{}')
                from jsonb_each(row_value) fields(k,v) where k in
                ('id','user_id','session_id','email','created_at','updated_at','aud','role','provider'))),'[]')
            into snapshot from jsonb_array_elements(snapshot) records(row_value);
        end if;
        insert into cp_row_backups values(item.relation,item.key,snapshot);
    end loop;
end $$;
select 'CARRIER_TRANSACTIONAL_BACKUP:'||jsonb_build_object(
    'rows',(select jsonb_agg(to_jsonb(b)) from cp_row_backups b),
    'triggers',(select jsonb_agg(to_jsonb(s)) from cp_trigger_states s))::text;
-- Domain guards alone are suspended for exact QA-row teardown. FK/CHECK stay active.
do $$
declare
    t record;
begin
    for t in select s.* from hac44_qa.triggers s join pg_trigger p on p.tgrelid = to_regclass(
        s.relation
    ) and p.tgname = s.name where s.run_id = hac44_qa.current_run() and not p.tgisinternal and exists(
        select 1 from hac44_remove d where to_regclass(
            d.relation
        ) = to_regclass(
            s.relation
        )
    ) loop
        execute format(
            'alter table %s disable trigger %I',
            t.relation,
            t.name
        );
    end loop;
end
$$;
do $$
declare
    item record;
    fk record;
    joins text;
    childkey text;
    found boolean;
    blocked boolean;
    progress integer;
    n integer;
begin
    while exists(
        select 1 from hac44_remove
    ) loop
        progress := 0;
        for item in select * from hac44_remove order by relation,
        key loop
            blocked := false;
            for fk in select c.* from pg_constraint c where c.contype = 'f' and c.confrelid = to_regclass(
                item.relation
            ) loop
                select string_agg(
                    format(
                        'child.%I=parent.%I',
                        a.attname,
                        b.attname
                    ),
                    ' and '
                ) into joins from unnest(
                    fk.conkey,
                    fk.confkey
                ) k(
                    l,
                    r
                ) join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = k.l join pg_attribute b on b.
                attrelid = fk.confrelid and b.attnum = k.r;
                -- A referenced parent waits for every actual child, so no CASCADE fires.
                execute format(
                    'select exists(select 1 from %s child join %s parent on %s where %s)',
                    fk.conrelid::regclass,
                    item.relation,
                    joins,
                    hac44_qa.where_key(
                        item.key,
                        'parent'
                    )
                ) into found;
                if found then
                    blocked := true;
                end if;
            end loop;
            if blocked then
                continue;
            end if;
            execute format(
                'delete from %s t where %s',
                item.relation,
                hac44_qa.where_key(
                    item.key
                )
            );
            get diagnostics n = row_count;
            if n > 1 then
                raise exception 'HAC44_NONUNIQUE_CLEANUP_KEY';
            end if;
            delete from hac44_remove where relation = item.relation and key = item.key;
            progress := progress + 1;
        end loop;
        if progress = 0 then
            raise notice 'HAC44_BLOCKED_KEYS:%', (select jsonb_agg(jsonb_build_object('relation',relation,'key',key) order by relation,key) from hac44_remove);
            raise exception 'HAC44_EXTERNAL_CHILD_OR_FK_CYCLE: exact IDs remain, preserve backup';
        end if;
    end loop;
end
$$;
do $$
declare
    t record;
    b record;
    actual jsonb;
    r uuid := hac44_qa.current_run();
begin
    for t in select s.* from hac44_qa.triggers s join pg_trigger p on p.tgrelid = to_regclass(
        s.relation
    ) and p.tgname = s.name join cp_affected a on a.relation=p.tgrelid where s.run_id = r and not p.tgisinternal loop
        execute format(
            'alter table %s %s trigger %I',
            t.relation,
            case t.enabled when 'O' then 'enable' when 'A' then 'enable always' when 'R' then 'enable replica' else
            'disable' end,
            t.name
        );
    end loop;
    for b in select * from hac44_qa.baseline where run_id = r loop
        execute format(
            'select coalesce(jsonb_agg(to_jsonb(t) order by hac44_qa.row_key(to_jsonb(t),%L::text[])),''[]'') from '
            '%s '
            't',
            b.pk,
            b.relation
        ) into actual;
        if actual <>(
            select coalesce(
                jsonb_agg(
                    x order by hac44_qa.row_key(
                        x,
                        b.pk
                    )
                ),
                '[]'
            ) from jsonb_array_elements(
                b.rows
            ) x
        ) then
            raise exception 'HAC44_BASELINE_CHANGED: %',
            b.relation;
        end if;
    end loop;
    if exists(
        select 1 from hac44_qa.triggers s left join pg_trigger pt on pt.tgrelid = to_regclass(
            s.relation
        ) and pt.tgname = s.name where s.run_id = r and(
            pt.oid is null or pt.tgenabled <> s.enabled
        )
    ) then
        raise exception 'HAC44_TRIGGER_STATE_CHANGED';
    end if;
    if exists(
        select 1 from jsonb_each(
            carrier_portal_qa.counts()
        ) x where x.value <> '0'::jsonb
    ) then
        raise exception 'HAC44_CLEANUP_NOT_ZERO';
    end if;
    if exists(select 1 from cp_trigger_states s left join pg_trigger actual_trigger on actual_trigger.tgrelid=s.relation and actual_trigger.tgname=s.name
        where actual_trigger.oid is null or actual_trigger.tgenabled<>s.enabled) then raise exception 'CARRIER_CLEANUP_TRIGGER_DRIFT'; end if;
    update hac44_qa.runs set finished_at = now() where id = r;
end
$$;
select 'HAC44_AFTER:' || carrier_portal_qa.counts()::text;
commit;
