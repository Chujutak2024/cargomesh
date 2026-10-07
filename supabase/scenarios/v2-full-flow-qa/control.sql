-- QA-only metadata, outside migrations. No Auth secret columns are read.
create schema if not exists hac44_qa;
create table if not exists hac44_qa.runs(
    id uuid primary key,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);
create table if not exists hac44_qa.baseline(
    run_id uuid not null,
    relation text not null,
    pk text[] not null,
    rows jsonb not null,
    primary key(
        run_id,
        relation
    )
);
create table if not exists hac44_qa.ids(
    run_id uuid not null,
    relation text not null,
    key jsonb not null,
    primary key(
        run_id,
        relation,
        key
    )
);
create table if not exists hac44_qa.triggers(
    run_id uuid not null,
    relation text not null,
    name text not null,
    enabled "char" not null,
    primary key(
        run_id,
        relation,
        name
    )
);
create or replace function hac44_qa.current_run() returns uuid language sql stable as
$$
    select id from hac44_qa.runs order by started_at desc,
    id desc limit 1
$$;
create or replace function hac44_qa.row_key(
    payload jsonb,
    cols text[]
) returns jsonb language sql immutable as
$$
    select jsonb_object_agg(
        k,
        payload -> k
    ) from unnest(
        cols
    ) k
$$;
create or replace function hac44_qa.where_key(
    key jsonb,
    alias text default 't'
) returns text language sql immutable as
$$
    select string_agg(
        format(
            '%I.%I is not distinct from %L',
            alias,
            k,
            key ->> k
        ),
        ' and ' order by k
    ) from jsonb_object_keys(
        key
    ) k
$$;
create or replace function hac44_qa.capture_ids() returns void language plpgsql as
$$
declare
    b record;
    r uuid := hac44_qa.current_run();
begin
    for b in select * from hac44_qa.baseline where run_id = r loop
        execute format(
            'insert into hac44_qa.ids select %L,%L,hac44_qa.row_key(to_jsonb(t),%L::text[]) from %s t where not '
            'exists(select 1 from jsonb_array_elements(%L::jsonb) old where '
            'hac44_qa.row_key(old,%L::text[])=hac44_qa.row_key(to_jsonb(t),%L::text[])) on conflict do '
            'nothing',
            r,
            b.relation,
            b.pk,
            b.relation,
            b.rows,
            b.pk,
            b.pk
        );
    end loop;
end
$$;
create or replace function hac44_qa.counts() returns jsonb language plpgsql as
$$
declare
    r uuid := hac44_qa.current_run();
    b record;
    n bigint;
    result jsonb := '{}';
begin
    for b in select * from hac44_qa.baseline where run_id = r order by relation loop
        execute format(
            'select count(*) from %s t join hac44_qa.ids i on i.run_id=%L and i.relation=%L and '
            'i.key=hac44_qa.row_key(to_jsonb(t),%L::text[])',
            b.relation,
            r,
            b.relation,
            b.pk
        ) into n;
        result := result || jsonb_build_object(
            b.relation,
            n
        );
    end loop;
    select count(
        *
    ) into n from auth.users where id in(
        'd4410000-0000-4000-8000-000000000001',
        'd4410000-0000-4000-8000-000000000002',
        'd4410000-0000-4000-8000-000000000003'
    );
    return result || jsonb_build_object(
        'auth.users',
        n
    );
end
$$;
do $$
declare
    r uuid := gen_random_uuid();
    b record;
    data jsonb;
    collision boolean;
begin
    if exists(
        select 1 from hac44_qa.runs where finished_at is null
    ) then
        raise exception 'HAC44_UNFINISHED_RUN: preserve backup and clean exact IDs first';
    end if;
    if exists(
        select 1 from auth.users where id in(
            'd4410000-0000-4000-8000-000000000001',
            'd4410000-0000-4000-8000-000000000002',
            'd4410000-0000-4000-8000-000000000003'
        )
    ) then
        raise exception 'HAC44_UUID_COLLISION';
    end if;
    for b in select table_schema || '.' || table_name relation from information_schema.columns where table_schema =
    'public' and column_name = 'id' and udt_name = 'uuid' loop
        execute format(
            'select exists(select 1 from %s where left(id::text,8) between ''d4400000'' and ''d44f0000'')',
            b.relation
        ) into collision;
        if collision then
            raise exception 'HAC44_UUID_COLLISION: %',
            b.relation;
        end if;
    end loop;
    insert into hac44_qa.runs(
        id
    ) values(
        r
    );
    for b in select n.nspname || '.' || c.relname relation,
    array_agg(
        a.attname order by u.ord
    ) pk from pg_constraint p join pg_class c on c.oid = p.conrelid join pg_namespace n on n.oid = c.relnamespace
    cross join lateral unnest(
        p.conkey
    ) with ordinality u(
        num,
        ord
    ) join pg_attribute a on a.attrelid = c.oid and a.attnum = u.num where p.contype = 'p' and n.nspname in(
        'public',
        'private'
    ) group by n.nspname,
    c.relname union all select 'private.v2_catalog_grants',
    array[
        'auth_user_id',
        'carrier_id',
        'permission'
    ] loop
        execute format(
            'select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from %s t',
            b.relation
        ) into data;
        insert into hac44_qa.baseline values(
            r,
            b.relation,
            b.pk,
            data
        );
    end loop;
    insert into hac44_qa.triggers select r,
    t.tgrelid::regclass::text,
    t.tgname,
    t.tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in(
        'public',
        'private'
    );
end
$$;
