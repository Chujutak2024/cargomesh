"""Remove owned replay fixtures by recorded physical keys, never by names.

Some historical migrations contain fixtures even with seed disabled. They remain
unchanged; teardown backs them up and deletes their explicit IDs child-first.
"""
import json
from common import OUT, save, write
from fk_strict import lit, table_ident


def clean_ids(bank):
    bank.own("exact-id-teardown")
    backup = bank.execute("teardown-backup-" + bank.project,
        ["docker", "exec", bank.db, "pg_dump", "-U", "postgres", "--data-only", "--schema=public", "--schema=private", "postgres"])
    if backup.returncode:
        raise RuntimeError("Cannot back up replay fixtures")
    write(OUT / "backups" / (bank.project + "-before-exact-teardown.sql"), backup.stdout)
    catalog = bank.raw_sql("teardown-key-catalog-" + bank.project, """
select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'keys',
 (select jsonb_agg(a.attname order by u.ord) from pg_constraint p
 cross join lateral unnest(p.conkey) with ordinality u(num,ord)
 join pg_attribute a on a.attrelid=p.conrelid and a.attnum=u.num
 where p.conrelid=c.oid and p.contype='p')) order by n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in('public','private') and c.relkind in('r','p')
and not(n.nspname='public' and c.relname='cargo_categories');
""")
    if catalog.returncode:
        raise RuntimeError("Cannot discover physical teardown keys")
    identifiers = []
    for table in json.loads(catalog.stdout):
        keys = table["keys"]
        if not keys and table["table"] == "private.v2_catalog_grants":
            keys = ["auth_user_id", "carrier_id", "permission"]
        if not keys:
            count = bank.raw_sql("teardown-keyless-" + table["table"], "select count(*) from " + table_ident(table["table"]) + ";")
            if count.returncode or count.stdout.strip() != "0":
                raise RuntimeError("Nonempty replay table has no reviewed physical key: " + table["table"])
            continue
        projection = ",".join(lit(key) + ',t."' + key + '"' for key in keys)
        rows = bank.raw_sql("teardown-ids-" + table["table"], "select coalesce(jsonb_agg(jsonb_build_object(" + projection + ")), '[]') from " + table_ident(table["table"]) + " t;")
        if rows.returncode:
            raise RuntimeError("Cannot capture replay fixture IDs")
        identifiers.extend({"relation": table["table"], "key": key} for key in json.loads(rows.stdout))
    save("teardown-explicit-ids-" + bank.project + ".json", identifiers)
    if not identifiers:
        return
    values = ",".join("(" + lit(row["relation"]) + "," + lit(row["key"]) + "::jsonb)" for row in identifiers)
    query = "begin; create temporary table own_remove(relation text,key jsonb,primary key(relation,key)) on commit drop;insert into own_remove values " + values + ";\n"
    query += r"""
-- Include ON DELETE CASCADE in the incoming-edge audit; no cascade may fire.
select jsonb_agg(jsonb_build_object('child',conrelid::regclass::text,
 'parent',confrelid::regclass::text,'constraint',conname,'onDelete',confdeltype,
 'definition',pg_get_constraintdef(oid))) from pg_constraint where contype='f';
create function pg_temp.key_where(k jsonb) returns text language sql as $$
 select string_agg(format('t.%I is not distinct from %L',name,k->>name),' and ')
 from jsonb_object_keys(k) name
$$;
create temporary table own_triggers as select tgrelid,tgname,tgenabled from pg_trigger
 where not tgisinternal and tgrelid in(select to_regclass(relation) from own_remove);
do $$declare t record;begin
 for t in select * from own_triggers loop
  execute format('alter table %s disable trigger %I',t.tgrelid::regclass,t.tgname);
 end loop;
end$$;
do $$declare item record;fk record;joins text;child_exists boolean;blocked boolean;
 progress integer;affected integer;removed integer:=0;begin
 while exists(select 1 from own_remove) loop
  progress:=0;
  for item in select * from own_remove order by relation,key loop
   blocked:=false;
   for fk in select * from pg_constraint where contype='f' and confrelid=to_regclass(item.relation) loop
    select string_agg(format('child.%I=t.%I',a.attname,b.attname),' and ')
     into joins from unnest(fk.conkey,fk.confkey) k(l,r)
     join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.l
     join pg_attribute b on b.attrelid=fk.confrelid and b.attnum=k.r;
    execute format('select exists(select 1 from %s child join %s t on %s where %s)',
     fk.conrelid::regclass,item.relation,joins,pg_temp.key_where(item.key)) into child_exists;
    if child_exists then blocked:=true;end if;
   end loop;
   if blocked then continue;end if;
   execute format('delete from %s t where %s',item.relation,pg_temp.key_where(item.key));
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'TEARDOWN_EXPLICIT_KEY_CHANGED';end if;
   removed:=removed+affected;
   delete from own_remove where relation=item.relation and key=item.key;
   progress:=progress+1;
  end loop;
  if progress=0 then raise exception 'TEARDOWN_EXTERNAL_CHILD_OR_FK_CYCLE';end if;
 end loop;
 raise notice 'Removed explicit replay rows: %',removed;
end$$;
do $$declare t record;begin
 for t in select * from own_triggers loop
  execute format('alter table %s %s trigger %I',t.tgrelid::regclass,
   case t.tgenabled when 'O' then 'enable' when 'A' then 'enable always'
    when 'R' then 'enable replica' else 'disable' end,t.tgname);
 end loop;
end$$;
commit;
"""
    bank.own("delete-explicit-ids")
    result = bank.raw_sql("teardown-exact-ids-" + bank.project, query)
    if result.returncode:
        raise RuntimeError("Exact-ID teardown aborted; transaction rolled back")
    remaining = 0
    for row in identifiers:
        where = " and ".join('t."' + key + '" is not distinct from ' + lit(value) for key, value in row["key"].items())
        count = bank.raw_sql("teardown-after-" + row["relation"] + "-" + str(remaining), "select count(*) from " + table_ident(row["relation"]) + " t where " + where + ";")
        if count.returncode or count.stdout.strip() != "0":
            raise RuntimeError("An explicit fixture ID remains after teardown")
    save("teardown-result-" + bank.project + ".json", {"status": "PASS", "before": len(identifiers),
         "after": remaining, "method": "Recorded physical keys; incoming FK audit; child-first; no CASCADE; triggers restored"})
