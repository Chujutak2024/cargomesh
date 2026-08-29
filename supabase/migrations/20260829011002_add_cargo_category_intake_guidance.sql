alter table public.cargo_categories
  add column recommended_entry_methods jsonb not null default '["TOTAL_WEIGHT"]'::jsonb,
  add column intake_specification_schema jsonb not null default '{"fields":[]}'::jsonb,
  add column suggested_requirements jsonb not null default '{}'::jsonb,
  add column recommended_vehicle_classes jsonb not null default '[]'::jsonb,
  add column updated_at timestamptz not null default now();

alter table public.cargo_categories
  add constraint cargo_categories_entry_methods_array
    check (jsonb_typeof(recommended_entry_methods) = 'array'),
  add constraint cargo_categories_intake_schema_object
    check (jsonb_typeof(intake_specification_schema) = 'object'),
  add constraint cargo_categories_requirements_object
    check (jsonb_typeof(suggested_requirements) = 'object'),
  add constraint cargo_categories_vehicle_classes_array
    check (jsonb_typeof(recommended_vehicle_classes) = 'array');

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
