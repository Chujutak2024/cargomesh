-- =============================================================================
-- Verification: expanded-fleet/verify.sql
-- Description: Valida el estado del entorno tras la aplicación de expanded-fleet/seed.sql.
-- Invariante: Consulta de solo lectura. Cero secretos expuestos.
-- =============================================================================

select
  'VERIFICATION CHECK' as check_phase,
  now() as executed_at;

-- 1. Verificar organizaciones (ACME, AGRIVAS, CEMENTOS)
select
  code as org_code,
  name as org_name,
  country_code,
  default_currency,
  status
from public.organizations
where code in ('ACME', 'AGRIVAS', 'CEMENTOS')
order by code;

-- 2. Verificar transportistas registrados (Base + 3 Internacionales)
select
  code as carrier_code,
  name as carrier_name,
  provider_type,
  status,
  provider_url,
  supports_webmcp
from public.carriers
order by code;

-- 3. Verificar nuevos servicios de transporte activos
select
  provider_service_code,
  transport_mode,
  service_type,
  origin_country || ' (' || origin_region || ') -> ' || destination_country || ' (' || destination_region || ')' as corridor,
  max_capacity_kg,
  supports_refrigerated,
  supports_hazardous,
  supports_cross_border,
  active
from public.carrier_services
where provider_service_code in (
  'POLARIS-PECL-REEFER-FTL',
  'APEX-PECL-HAZMAT-FTL',
  'VELOCITY-PE-EXPRESS-FTL'
)
order by provider_service_code;

-- 4. Verificar conteo de flota vehicular por carrier
select
  c.code as carrier_code,
  c.name as carrier_name,
  count(v.id) as vehicle_count
from public.carriers c
left join public.vehicles v on v.carrier_id = c.id
group by c.code, c.name
order by c.code;

-- 5. Verificar preservación estricta del Golden Flow canónico (FR-1042)
select
  fr.code as request_code,
  fr.status as request_status,
  fr.origin_city || ' -> ' || fr.destination_city as corridor,
  count(distinct fd.id) as decision_count,
  count(distinct co.id) as offer_count
from public.freight_requests fr
left join public.freight_decisions fd on fd.freight_request_id = fr.id
left join public.carrier_offers co on co.freight_request_id = fr.id
where fr.code = 'FR-1042'
group by fr.code, fr.status, fr.origin_city, fr.destination_city;
