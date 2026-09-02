-- =============================================================================
-- Preflight Check: expanded-fleet/preflight_check.sql
-- Description: Verifica el estado del entorno antes de aplicar el escenario expanded-fleet.
-- Invariante: Consulta de solo lectura. No muta datos. Cero secretos expuestos.
-- =============================================================================

select
  'PREFLIGHT CHECK' as check_phase,
  now() as executed_at;

-- 1. Verificar organizaciones canónicas existentes
select
  code as org_code,
  name as org_name,
  status as org_status
from public.organizations
order by code;

-- 2. Verificar transportistas base existentes
select
  code as carrier_code,
  name as carrier_name,
  status as carrier_status,
  supports_webmcp
from public.carriers
order by code;

-- 3. Verificar precondición de entidades expanded-fleet (deben ser 0 antes de la carga)
select
  count(*) filter (where code in ('AGRIVAS', 'CEMENTOS')) as existing_scenario_orgs,
  count(*) filter (where code in ('POLARIS_COLD_CHAIN', 'APEX_HAZMAT', 'VELOCITY_EXPRESS')) as existing_scenario_carriers
from (
  select code from public.organizations
  union all
  select code from public.carriers
) as entities;

-- 4. Verificar existencia de carrier NEXO (determina si sus vehículos se activan)
select
  case
    when exists (select 1 from public.carriers where code in ('NEXO', 'NEXO_DEMO') or id = 'b1000000-0000-0000-0000-000000000001')
    then 'NEXO DETECTED: Los vehículos de Nexo serán asociados.'
    else 'NEXO NOT FOUND: El bloque de vehículos de Nexo será omitido de forma segura.'
  end as nexo_dependency_status;

-- 5. Verificar preservación del Golden Flow (FR-1042)
select
  code as request_code,
  status as request_status,
  origin_city,
  destination_city,
  service_type,
  transport_mode
from public.freight_requests
where code = 'FR-1042';
