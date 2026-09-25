\set ON_ERROR_STOP on

-- Snapshot every relation explicitly written by this package, including Auth.
select 'auth.users' as relation, count(*) as rows from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select 'public.organizations', count(*) from public.organizations
union all select 'public.organization_members', count(*) from public.organization_members
union all select 'public.facilities', count(*) from public.facilities
union all select 'public.carriers', count(*) from public.carriers
union all select 'public.carrier_depots', count(*) from public.carrier_depots
union all select 'public.carrier_services', count(*) from public.carrier_services
union all select 'public.service_areas', count(*) from public.service_areas
union all select 'public.service_lanes', count(*) from public.service_lanes
order by relation;
