-- HAC-29 reference migration. Frozen V1 cutoff: e289801f209902ebfe8e54b39c50ce62a16c4b6f
-- SHA-256 uses UTF-8 / LF normalized source content.
-- Source: supabase/migrations/20260828200000_baseline_legacy_schema.sql SHA-256: 0084024f7c86096826a91881d1125399344830ea00f29ee262714958abcb7687
-- Source: supabase/migrations/20260829011002_add_cargo_category_intake_guidance.sql SHA-256: f664d4cf51017ca4581ed33d01caa67a994b8050d2ec28e42421de8abad99c9b
-- Schema-ready compatibility is not feature-live. No V1 fixture is executed here.
insert into public.cargo_categories (id, code, name, description, active)
values
  ('c0000000-0000-0000-0000-000000000001', 'GENERAL', 'General Cargo', 'Standard palletized or packaged general freight', true),
  ('c0000000-0000-0000-0000-000000000002', 'FOOD', 'Food & Perishables', 'Perishable food requiring hygiene and temperature monitoring', true),
  ('c0000000-0000-0000-0000-000000000003', 'PHARMA', 'Pharmaceuticals', 'High-value medical and pharmaceutical products', true),
  ('c0000000-0000-0000-0000-000000000004', 'CHEMICAL', 'Chemicals & Hazmat', 'Chemical substances requiring safety documentation', true),
  ('c0000000-0000-0000-0000-000000000005', 'MACHINERY', 'Machinery & Heavy Industrial', 'Industrial equipment, machinery components and spare parts', true),
  ('c0000000-0000-0000-0000-000000000006', 'CONSTRUCTION', 'Construction Materials', 'Heavy building materials and structural equipment', true),
  ('c0000000-0000-0000-0000-000000000007', 'AGRICULTURAL', 'Agricultural Products', 'Bulk and sacked raw agricultural commodities', true),
  ('c0000000-0000-0000-0000-000000000008', 'LIQUID', 'Liquids & Bulk', 'Liquid cargo requiring specialized tanker transport', true)
on conflict (code) do nothing;


update public.cargo_categories
set recommended_entry_methods = case code
      when 'GENERAL' then '["UNITS","PACKAGES","PALLETS","TOTAL_WEIGHT"]'::jsonb
      when 'FOOD' then '["PACKAGES","PALLETS","SACKS","LOTS"]'::jsonb
      when 'PHARMA' then '["PACKAGES","PALLETS","LOTS"]'::jsonb
      when 'CHEMICAL' then '["PACKAGES","LOTS","TOTAL_WEIGHT"]'::jsonb
      when 'MACHINERY' then '["UNITS","PALLETS","LOTS"]'::jsonb
      when 'CONSTRUCTION' then '["LOTS","PALLETS","SACKS","TOTAL_WEIGHT"]'::jsonb
      when 'AGRICULTURAL' then '["SACKS","LOTS","PALLETS","TOTAL_WEIGHT"]'::jsonb
      when 'LIQUID' then '["TOTAL_WEIGHT","LOTS"]'::jsonb
    end,
    intake_specification_schema = case code
      when 'GENERAL' then '{"fields":["dimensions","is_fragile","is_stackable","declared_value"]}'::jsonb
      when 'FOOD' then '{"fields":["product_type","temperature_min_c","temperature_max_c","expiration_date","lot_number"]}'::jsonb
      when 'PHARMA' then '{"fields":["temperature_min_c","temperature_max_c","lot_number","expiration_date","handling_protocol"]}'::jsonb
      when 'CHEMICAL' then '{"fields":["un_number","hazard_class","safety_data_sheet","container_type"]}'::jsonb
      when 'MACHINERY' then '{"fields":["dimensions","declared_value","center_of_gravity_notes","lifting_requirements"]}'::jsonb
      when 'CONSTRUCTION' then '{"fields":["material_type","dimensions","unloading_method","weather_protection"]}'::jsonb
      when 'AGRICULTURAL' then '{"fields":["product_type","moisture_limit_pct","temperature_range","harvest_or_lot_reference"]}'::jsonb
      when 'LIQUID' then '{"fields":["liters","density_kg_l","food_grade","un_number","tank_requirements"]}'::jsonb
    end,
    suggested_requirements = case code
      when 'GENERAL' then '{"ask_fragility":true,"ask_stackability":true}'::jsonb
      when 'FOOD' then '{"ask_refrigeration":true,"ask_expiration":true,"ask_food_grade":true}'::jsonb
      when 'PHARMA' then '{"requires_temperature_validation":true,"suggest_fragile":true,"suggest_high_value":true}'::jsonb
      when 'CHEMICAL' then '{"requires_hazardous_classification":true,"requires_safety_data_sheet":true}'::jsonb
      when 'MACHINERY' then '{"ask_oversized":true,"suggest_high_value":true,"ask_stackability":true}'::jsonb
      when 'CONSTRUCTION' then '{"ask_oversized":true,"ask_unloading_method":true}'::jsonb
      when 'AGRICULTURAL' then '{"ask_refrigeration":true,"ask_moisture_limit":true}'::jsonb
      when 'LIQUID' then '{"ask_hazardous":true,"ask_food_grade":true,"requires_tank_compatibility":true}'::jsonb
    end,
    recommended_vehicle_classes = case code
      when 'GENERAL' then '["BOX_TRUCK","TRACTOR_TRAILER"]'::jsonb
      when 'FOOD' then '["REFRIGERATED_TRUCK","BOX_TRUCK","TRACTOR_TRAILER"]'::jsonb
      when 'PHARMA' then '["REFRIGERATED_TRUCK","SECURE_BOX_TRUCK"]'::jsonb
      when 'CHEMICAL' then '["HAZMAT_TRUCK","TRACTOR_TRAILER"]'::jsonb
      when 'MACHINERY' then '["TRACTOR_TRAILER","FLATBED"]'::jsonb
      when 'CONSTRUCTION' then '["FLATBED","DUMP_TRUCK","TRACTOR_TRAILER"]'::jsonb
      when 'AGRICULTURAL' then '["BOX_TRUCK","REFRIGERATED_TRUCK","TRACTOR_TRAILER"]'::jsonb
      when 'LIQUID' then '["TANKER_TRUCK"]'::jsonb
    end,
    updated_at = now()
where code in (
  'GENERAL','FOOD','PHARMA','CHEMICAL',
  'MACHINERY','CONSTRUCTION','AGRICULTURAL','LIQUID'
);
