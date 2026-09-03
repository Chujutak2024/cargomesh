begin;

-- =============================================================================
-- SCENARIO: EXPANDED ROUTES & MULTI-CORRIDOR COVERAGE
-- Demonstrates multi-region WebMCP execution across central corridors:
-- 1. Callao/Lima (PE) -> Santiago/Valparaíso (CL) (Andes, Inca, Pacific)
-- 2. Lima (PE) -> Arequipa (PE) (Velocity Express, Nexo Demo)
-- =============================================================================

-- 1. Enable nationwide regional coverage for enterprise cross-border services
update public.carrier_services
set origin_region = null,
    destination_region = null,
    updated_at = now()
where provider_service_code in ('ANDES-PECL-FTL', 'INCA-PECL-FTL', 'PACIFIC-PECL-FTL');

-- 2. Associate standard cargo categories with Andes, Inca, Pacific
insert into public.carrier_service_cargo_categories (carrier_service_id, cargo_category_id)
select cs.id, cc.id
from public.carrier_services cs
cross join public.cargo_categories cc
where cs.provider_service_code in ('ANDES-PECL-FTL', 'INCA-PECL-FTL', 'PACIFIC-PECL-FTL')
  and cc.code in ('GENERAL', 'MACHINERY', 'CONSTRUCTION', 'AGRICULTURAL')
on conflict do nothing;

-- 3. Historical metrics for expanded corridors (public.carrier_metrics)

-- Andes Freight (Lima -> Santiago)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000001', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Santiago',
  80, 76, 95.0, 1750, 1750, 0.9, 1.5, 80, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'ANDES' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Inca Logistics (Lima -> Santiago)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000002', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Santiago',
  70, 68, 97.1, 1900, 1900, 0.6, 1.0, 70, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'INCA' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Pacific Cargo (Lima -> Santiago)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000003', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Santiago',
  40, 34, 85.0, 1550, 1550, 2.5, 5.0, 40, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'PACIFIC' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Andes Freight (Callao -> Valparaíso / Valparaiso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000004', c.id, cc.id, null, 'ROAD',
  'PE', 'Callao', 'CL', 'Valparaiso',
  35, 34, 97.1, 1820, 1820, 0.7, 1.2, 35, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'ANDES' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000006', c.id, cc.id, null, 'ROAD',
  'PE', 'Callao', 'CL', 'Valparaíso',
  35, 34, 97.1, 1820, 1820, 0.7, 1.2, 35, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'ANDES' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Inca Logistics (Callao -> Valparaíso / Valparaiso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000005', c.id, cc.id, null, 'ROAD',
  'PE', 'Callao', 'CL', 'Valparaiso',
  30, 29, 96.7, 1980, 1980, 0.5, 1.0, 30, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'INCA' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000007', c.id, cc.id, null, 'ROAD',
  'PE', 'Callao', 'CL', 'Valparaíso',
  30, 29, 96.7, 1980, 1980, 0.5, 1.0, 30, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'INCA' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Pacific Cargo (Callao -> Valparaíso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000008', c.id, cc.id, null, 'ROAD',
  'PE', 'Callao', 'CL', 'Valparaíso',
  20, 17, 85.0, 1600, 1600, 2.8, 5.0, 20, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'PACIFIC' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Andes Freight (Lima -> Valparaíso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000009', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Valparaíso',
  25, 24, 96.0, 1840, 1840, 0.8, 1.2, 25, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'ANDES' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Inca Logistics (Lima -> Valparaíso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000010', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Valparaíso',
  22, 21, 95.5, 2010, 2010, 0.7, 1.0, 22, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'INCA' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

-- Pacific Cargo (Lima -> Valparaíso)
insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests, organization_successful_freight_requests,
  updated_at
)
select
  '51000000-0000-0000-0000-000000000011', c.id, cc.id, null, 'ROAD',
  'PE', 'Lima', 'CL', 'Valparaíso',
  15, 12, 80.0, 1620, 1620, 3.0, 5.0, 15, 0, 0, now()
from public.carriers c, public.cargo_categories cc
where c.code = 'PACIFIC' and cc.code = 'MACHINERY'
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    updated_at = now();

commit;
