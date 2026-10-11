\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$ begin raise exception 'CARRIER_PORTAL_LOCAL_ONLY'; end $$;
\endif
do $$ begin if inet_server_addr() is not null then raise exception 'LOCAL_DOCKER_SOCKET_REQUIRED'; end if; end $$;
create or replace function carrier_portal_qa.counts() returns jsonb language plpgsql as $$
declare item record; amount bigint; result jsonb:='{}'; begin
    for item in select distinct relation from hac44_qa.ids where run_id=hac44_qa.current_run() order by relation loop
        amount:=0;
        for item in select relation,key from hac44_qa.ids where run_id=hac44_qa.current_run() and relation=item.relation loop
            execute format('select count(*) from %s t where %s',item.relation,hac44_qa.where_key(item.key)) into amount;
            result:=result||jsonb_build_object(item.relation,coalesce((result->>item.relation)::bigint,0)+amount);
        end loop;
    end loop;
    return result||jsonb_build_object(
        'auth.users',(select count(*) from auth.users u join carrier_portal_qa.actors a on a.auth_user_id=u.id and a.run_id=hac44_qa.current_run()),
        'auth.sessions',(select count(*) from auth.sessions s join carrier_portal_qa.actors a on a.auth_user_id=s.user_id and a.run_id=hac44_qa.current_run()),
        'auth.identities',(select count(*) from auth.identities i join carrier_portal_qa.actors a on a.auth_user_id=i.user_id and a.run_id=hac44_qa.current_run()),
        'auth.refresh_tokens',(select count(*) from auth.refresh_tokens t join carrier_portal_qa.actors a on a.auth_user_id::text=t.user_id and a.run_id=hac44_qa.current_run()));
end $$;
select 'CARRIER_PORTAL_COUNTS:'||carrier_portal_qa.counts()::text;
