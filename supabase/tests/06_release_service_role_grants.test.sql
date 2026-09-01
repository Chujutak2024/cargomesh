begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(16);

select ok(has_table_privilege('service_role', 'public.bookings', 'SELECT'), 'service role can read bookings for the Booking Bridge');
select ok(has_table_privilege('service_role', 'public.carrier_offers', 'SELECT'), 'service role can read persisted carrier offers');
select ok(has_table_privilege('service_role', 'public.carrier_offers', 'INSERT'), 'service role can persist carrier offers');
select ok(has_table_privilege('service_role', 'public.carriers', 'SELECT'), 'service role can discover registered carriers');
select ok(has_table_privilege('service_role', 'public.carrier_services', 'SELECT'), 'service role can discover registered carrier services');
select ok(has_table_privilege('service_role', 'public.carrier_service_cargo_categories', 'SELECT'), 'service role can read service cargo eligibility');
select ok(has_table_privilege('service_role', 'public.carrier_metrics', 'SELECT'), 'service role can read carrier metrics');
select ok(has_table_privilege('service_role', 'public.freight_requests', 'SELECT'), 'service role can read freight requests');
select ok(has_table_privilege('service_role', 'public.freight_requests', 'UPDATE'), 'service role can update server-side freight state');
select ok(has_table_privilege('service_role', 'public.freight_decisions', 'INSERT'), 'service role can persist freight decisions');
select ok(has_table_privilege('service_role', 'public.organizations', 'SELECT'), 'service role can resolve organization context');
select ok(has_table_privilege('service_role', 'public.organization_preferences', 'SELECT'), 'service role can read organization preferences');
select ok(has_table_privilege('service_role', 'public.vehicles', 'SELECT'), 'service role can read vehicle context');

select ok(not has_table_privilege('anon', 'public.carriers', 'SELECT'), 'anon still cannot read registered carriers');
select ok(not has_table_privilege('anon', 'public.freight_requests', 'SELECT'), 'anon still cannot read freight requests');
select ok(not has_table_privilege('authenticated', 'public.carrier_offers', 'INSERT'), 'authenticated still cannot create commercial offers directly');

select * from finish();
rollback;
