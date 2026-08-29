
delete from public.carrier_offers co using public.freight_requests fr
where co.freight_request_id=fr.id and fr.code='FR-1042';

update public.organizations set
  name='ACME Mining', legal_name='ACME Mining Corp S.A.', country_code='PE',
  business_identifier_type='RUC', business_identifier_value='20491827361',
  verified_corporate_email='carlos.mendoza@acmemining.pe',
  corporate_phone='+51 1 555 0100', default_currency='USD',
  status='ACTIVE', updated_at=now()
where code='ACME';

update public.organization_preferences op set
  default_strategy='BALANCED', budget_default=2000, allow_auto_booking=false,
  confidence_threshold=85, allow_auto_recovery=false, anomaly_threshold_pct=30,
  billing_mode='INVOICE', selection_mode='ASSISTED', updated_at=now()
from public.organizations o where op.organization_id=o.id and o.code='ACME';

update public.freight_requests fr set
  cargo_category_id=cc.id,
  origin_country='PE', origin_city='Callao',
  origin_address='Terminal portuario del Callao, Lima',
  pickup_contact_name='Juan Díaz', pickup_contact_phone='+51 999 555 101',
  destination_country='CL', destination_city='Santiago',
  destination_address='Centro de distribución San Bernardo, Santiago',
  receiver_name='Rodrigo Soto', receiver_company='ACME Mining Chile',
  receiver_phone='+56 9 5555 0102',
  cargo_description='Repuestos y componentes de maquinaria minera',
  cargo_entry_method='PALLETS', cargo_weight_kg=8000, cargo_volume_m3=18,
  package_count=10, service_type='FTL', transport_mode='ROAD',
  requires_refrigeration=false, temperature_min_c=null, temperature_max_c=null,
  is_hazardous=false, is_fragile=false, is_oversized=false,
  is_high_value=true, is_stackable=false,
  special_instructions='Carga transfronteriza. Coordinar documentación aduanera y mantener trazabilidad.',
  pickup_mode='SCHEDULED',
  required_pickup=date_trunc('day',now())+interval '1 day 13 hours',
  pickup_window_start=date_trunc('day',now())+interval '1 day 13 hours',
  pickup_window_end=date_trunc('day',now())+interval '1 day 17 hours',
  delivery_deadline=date_trunc('day',now())+interval '4 days 13 hours',
  budget_max=2000, optimization_strategy='BALANCED',
  available_documents=jsonb_build_array('COMMERCIAL_INVOICE','PACKING_LIST','CERTIFICATE_OF_ORIGIN'),
  cross_border=true, status='PENDING', confirmed_at=now(),
  confirmed_by_member_id=null, updated_at=now()
from public.cargo_categories cc
where fr.code='FR-1042' and cc.code='MACHINERY';

update public.carriers set
  provider_type='ENTERPRISE_CARRIER',
  provider_url=case code
    when 'ANDES' then '/providers/andes'
    when 'INCA' then '/providers/inca'
    when 'PACIFIC' then '/providers/pacific' end,
  supports_webmcp=true, status='ACTIVE', updated_at=now()
where code in ('ANDES','INCA','PACIFIC');

update public.carrier_services cs set
  transport_mode='ROAD', service_type='FTL',
  origin_country='PE', origin_region='Callao',
  destination_country='CL', destination_region='Santiago',
  max_capacity_kg=case c.code when 'ANDES' then 18000 when 'INCA' then 24000 when 'PACIFIC' then 15000 end,
  max_volume_m3=case c.code when 'ANDES' then 55 when 'INCA' then 70 when 'PACIFIC' then 45 end,
  supports_refrigerated=false, temperature_min_c=null, temperature_max_c=null,
  supports_hazardous=false, supports_fragile=true, supports_oversized=false,
  supports_cross_border=true, customs_coordination_included=true,
  provider_service_code=case c.code
    when 'ANDES' then 'ANDES-PECL-FTL'
    when 'INCA' then 'INCA-PECL-FTL'
    when 'PACIFIC' then 'PACIFIC-PECL-FTL' end,
  active=true, updated_at=now()
from public.carriers c
where cs.carrier_id=c.id and c.code in ('ANDES','INCA','PACIFIC');

update public.vehicles v set
  code=case c.code when 'ANDES' then 'AND-TRK-101' when 'INCA' then 'INC-TRK-201' when 'PACIFIC' then 'PAC-TRK-301' end,
  brand=case c.code when 'ANDES' then 'Scania' when 'INCA' then 'Volvo' when 'PACIFIC' then 'Freightliner' end,
  model=case c.code when 'ANDES' then 'R450' when 'INCA' then 'FH' when 'PACIFIC' then 'Cascadia' end,
  license_plate=case c.code when 'ANDES' then 'AND-101' when 'INCA' then 'INC-201' when 'PACIFIC' then 'PAC-301' end,
  vehicle_type='TRACTOR_TRAILER',
  capacity_kg=case c.code when 'ANDES' then 18000 when 'INCA' then 24000 when 'PACIFIC' then 15000 end,
  volume_m3=case c.code when 'ANDES' then 55 when 'INCA' then 70 when 'PACIFIC' then 45 end,
  supports_refrigerated=false, supports_hazardous=false, supports_oversized=false,
  location='Callao, PE', status='AVAILABLE', updated_at=now()
from public.carriers c
where v.carrier_id=c.id and c.code in ('ANDES','INCA','PACIFIC');

update public.carrier_metrics cm set
  cargo_category_id=cc.id, organization_id=null, transport_mode='ROAD',
  origin_country='PE', origin_city='Callao',
  destination_country='CL', destination_city='Santiago',
  completed_freight_requests=case c.code when 'ANDES' then 100 when 'INCA' then 50 when 'PACIFIC' then 50 end,
  successful_freight_requests=case c.code when 'ANDES' then 96 when 'INCA' then 49 when 'PACIFIC' then 43 end,
  success_rate=case c.code when 'ANDES' then 96 when 'INCA' then 98 when 'PACIFIC' then 86 end,
  average_route_cost=case c.code when 'ANDES' then 1732 when 'INCA' then 1880 when 'PACIFIC' then 1650 end,
  avg_cost=case c.code when 'ANDES' then 1732 when 'INCA' then 1880 when 'PACIFIC' then 1650 end,
  route_completed_freight_requests=case c.code when 'ANDES' then 100 when 'INCA' then 50 when 'PACIFIC' then 50 end,
  organization_completed_freight_requests=0,
  organization_successful_freight_requests=0,
  updated_at=now()
from public.carriers c cross join public.cargo_categories cc
where cm.carrier_id=c.id and c.code in ('ANDES','INCA','PACIFIC') and cc.code='MACHINERY';

insert into public.carrier_service_cargo_categories(carrier_service_id,cargo_category_id)
select cs.id,cc.id
from public.carrier_services cs
join public.carriers c on c.id=cs.carrier_id
cross join public.cargo_categories cc
where c.code in ('ANDES','INCA','PACIFIC') and cc.code='MACHINERY'
on conflict do nothing;

alter table public.carrier_offers
  alter column offer_reference drop not null,
  alter column orchestration_run_id set not null,
  alter column tool_call_id set not null,
  alter column provider_offer_reference set not null,
  alter column transit_hours set not null,
  alter column availability_class set not null,
  alter column availability_score set not null,
  alter column reliability_score set not null,
  alter column status set default 'RECEIVED';

alter table public.carrier_offers drop constraint if exists carrier_offers_status_check;
alter table public.carrier_offers add constraint carrier_offers_status_check
check(status in ('RECEIVED','ELIGIBLE','INELIGIBLE','SELECTED','EXPIRED','SUPERSEDED'));

alter table public.freight_requests drop constraint if exists freight_requests_status_check;
alter table public.freight_requests add constraint freight_requests_status_check
check(status in ('DRAFT','PENDING','ORCHESTRATING','AWAITING_SELECTION','BOOKING','BOOKED','FAILED','CANCELLED'));
;
