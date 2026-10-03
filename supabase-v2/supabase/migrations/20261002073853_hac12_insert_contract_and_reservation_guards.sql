-- HAC-12 re-review R-06/R-07/R-08/R-09. Production structure and guards only.
-- JSON Schema checks the complete embedded DTO; SQL checks cross-field invariants.
create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists btree_gist with schema extensions;

create function private.v2_freight_input_schema() returns json
language sql immutable security invoker set search_path = '' as $schema$
  select '{
  "type": "object",
  "properties": {
    "schemaVersion": {
      "const": "2.0"
    },
    "organizationId": {
      "type": "string",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    },
    "origin": {
      "type": "object",
      "properties": {
        "facilityId": {
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "label": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 200
        },
        "countryCode": {
          "type": "string",
          "pattern": "^[A-Z]{2}$"
        },
        "region": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 120
            },
            {
              "type": "null"
            }
          ]
        },
        "city": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 120
        },
        "lat": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -90,
              "maximum": 90
            },
            {
              "type": "null"
            }
          ]
        },
        "lng": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -180,
              "maximum": 180
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "destination": {
      "type": "object",
      "properties": {
        "facilityId": {
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "label": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 200
        },
        "countryCode": {
          "type": "string",
          "pattern": "^[A-Z]{2}$"
        },
        "region": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 120
            },
            {
              "type": "null"
            }
          ]
        },
        "city": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 120
        },
        "lat": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -90,
              "maximum": 90
            },
            {
              "type": "null"
            }
          ]
        },
        "lng": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -180,
              "maximum": 180
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "pickupWindow": {
      "type": "object",
      "properties": {
        "startsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        },
        "endsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        }
      },
      "required": [
        "startsAt",
        "endsAt"
      ],
      "additionalProperties": false
    },
    "deliveryWindow": {
      "type": "object",
      "properties": {
        "startsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        },
        "endsAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
        }
      },
      "required": [
        "startsAt",
        "endsAt"
      ],
      "additionalProperties": false
    },
    "acceptedModes": {
      "const": [
        "ROAD"
      ]
    },
    "requiredEquipment": {
      "anyOf": [
        {
          "enum": [
            "BOX_TRUCK",
            "REEFER_TRUCK",
            "FLATBED",
            "TANKER_TRUCK",
            "TRACTOR_TRAILER"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "cargoSpecification": {
      "type": "object",
      "properties": {
        "categoryCode": {
          "enum": [
            "GENERAL",
            "FOOD",
            "PHARMA",
            "CHEMICAL",
            "MACHINERY",
            "CONSTRUCTION",
            "AGRICULTURAL",
            "LIQUID"
          ]
        },
        "description": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S",
          "maxLength": 1000
        },
        "packaging": {
          "type": "string",
          "minLength": 1,
          "pattern": "\\S"
        },
        "totalWeightKg": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "totalVolumeM3": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "divisible": {
          "type": "boolean"
        },
        "requirements": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "pattern": "\\S"
          }
        },
        "temperatureRange": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "minCelsius": {
                  "type": "number"
                },
                "maxCelsius": {
                  "type": "number"
                }
              },
              "required": [
                "minCelsius",
                "maxCelsius"
              ],
              "additionalProperties": false
            },
            {
              "type": "null"
            }
          ]
        },
        "units": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "properties": {
              "packageType": {
                "type": "string",
                "minLength": 1,
                "pattern": "\\S"
              },
              "quantity": {
                "type": "integer",
                "minimum": 1,
                "maximum": 2147483647
              },
              "weightPerUnitKg": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "volumePerUnitM3": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "dimensionsCm": {
                "type": "object",
                "properties": {
                  "length": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "width": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  "height": {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                },
                "required": [
                  "length",
                  "width",
                  "height"
                ],
                "additionalProperties": false
              },
              "indivisible": {
                "type": "boolean"
              },
              "stackable": {
                "type": "boolean"
              }
            },
            "required": [
              "packageType",
              "quantity",
              "weightPerUnitKg",
              "volumePerUnitM3",
              "dimensionsCm",
              "indivisible",
              "stackable"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "categoryCode",
        "description",
        "packaging",
        "totalWeightKg",
        "totalVolumeM3",
        "divisible",
        "requirements",
        "units"
      ],
      "additionalProperties": false
    },
    "contacts": {
      "type": "object",
      "properties": {
        "pickup": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "pattern": "\\S",
              "maxLength": 150
            },
            "phoneE164": {
              "type": "string",
              "pattern": "^\\+[1-9]\\d{6,14}$"
            },
            "email": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "email"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "name",
            "phoneE164"
          ],
          "additionalProperties": false
        },
        "recipient": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "pattern": "\\S",
              "maxLength": 150
            },
            "phoneE164": {
              "type": "string",
              "pattern": "^\\+[1-9]\\d{6,14}$"
            },
            "email": {
              "anyOf": [
                {
                  "type": "string",
                  "format": "email"
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "name",
            "phoneE164"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "pickup",
        "recipient"
      ],
      "additionalProperties": false
    },
    "budget": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "amount": {
              "type": "number",
              "exclusiveMinimum": 0
            },
            "currency": {
              "const": "USD"
            }
          },
          "required": [
            "amount",
            "currency"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "schemaVersion",
    "origin",
    "destination",
    "pickupWindow",
    "deliveryWindow",
    "acceptedModes",
    "cargoSpecification",
    "contacts"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}'::json;
$schema$;

create function private.validate_v2_freight_payload(p_payload jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_location jsonb;
  v_cargo jsonb := p_payload -> 'cargoSpecification';
  v_weight numeric;
  v_volume numeric;
begin
  if not coalesce(extensions.jsonb_matches_schema(private.v2_freight_input_schema(), p_payload), false) then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if (p_payload #>> '{pickupWindow,startsAt}')::timestamptz >= (p_payload #>> '{pickupWindow,endsAt}')::timestamptz
     or (p_payload #>> '{deliveryWindow,startsAt}')::timestamptz >= (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz
     or (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz <= (p_payload #>> '{pickupWindow,startsAt}')::timestamptz then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  for v_location in select value from jsonb_array_elements(jsonb_build_array(p_payload -> 'origin', p_payload -> 'destination')) loop
    if v_location ->> 'facilityId' is null and
       (v_location ->> 'label' is null or v_location ->> 'countryCode' is null or v_location ->> 'city' is null) then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    if (v_location ->> 'lat' is null) <> (v_location ->> 'lng' is null) then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
  end loop;
  select sum((u ->> 'quantity')::numeric * (u ->> 'weightPerUnitKg')::numeric),
         sum((u ->> 'quantity')::numeric * (u ->> 'volumePerUnitM3')::numeric)
    into v_weight, v_volume from jsonb_array_elements(v_cargo -> 'units') u;
  if abs((v_cargo ->> 'totalWeightKg')::numeric - v_weight) > 0.000001
     or abs((v_cargo ->> 'totalVolumeM3')::numeric - v_volume) > 0.000001
     or (v_cargo #>> '{temperatureRange,minCelsius}')::numeric > (v_cargo #>> '{temperatureRange,maxCelsius}')::numeric then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
exception when data_exception then
  raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
end;
$$;

-- Invoker identity and existing RLS apply to both RPC and direct Data API inserts.
create function private.resolve_v2_insert_location(p_location jsonb, p_organization_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_facility public.facilities%rowtype;
begin
  if p_location ->> 'facilityId' is not null then
    select * into v_facility from public.facilities where id = (p_location ->> 'facilityId')::uuid and active;
    if not found then
      perform private.assert_v2_facility_not_foreign((p_location ->> 'facilityId')::uuid, p_organization_id);
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    if v_facility.organization_id <> p_organization_id then
      raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
    end if;
    return jsonb_build_object('facilityId',v_facility.id,'label',v_facility.name,
      'countryCode',v_facility.country_code,'region',v_facility.region_code,'city',v_facility.city,
      'lat',v_facility.latitude,'lng',v_facility.longitude);
  end if;
  return jsonb_build_object('facilityId',null,'label',p_location ->> 'label',
    'countryCode',p_location ->> 'countryCode','region',p_location ->> 'region','city',p_location ->> 'city',
    'lat',p_location -> 'lat','lng',p_location -> 'lng');
end;
$$;

create function private.protect_v2_draft_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_origin jsonb;
  v_destination jsonb;
  v_expected jsonb;
  v_payload jsonb := new.v2_creation_payload;
  v_cargo jsonb := v_payload -> 'cargoSpecification';
begin
  if new.v2_contract_version is null and new.v2_snapshot is null and new.v2_creation_payload is null then
    return new; -- Legacy V1 writes retain their original contract and RLS.
  end if;
  if new.v2_contract_version is distinct from '2.0' or new.creation_idempotency_key is null
     or new.creation_payload_hash is null or new.creation_payload_hash !~ '^[0-9a-f]{64}$'
     or new.status is distinct from 'DRAFT' or new.draft_version is distinct from 1 then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  perform private.validate_v2_freight_payload(v_payload);
  if (v_payload ? 'organizationId' and v_payload ->> 'organizationId' is distinct from new.organization_id::text)
     or not exists(select 1 from public.organization_members m
       where m.id = new.requested_by_member_id and m.organization_id = new.organization_id
         and m.status = 'ACTIVE' and m.role in ('OWNER','SUPERVISOR')
         and (current_user = 'service_role' or m.auth_user_id = auth.uid())) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;
  v_origin := private.resolve_v2_insert_location(v_payload -> 'origin', new.organization_id);
  v_destination := private.resolve_v2_insert_location(v_payload -> 'destination', new.organization_id);
  v_expected := v_payload || jsonb_build_object('organizationId',new.organization_id,'origin',v_origin,'destination',v_destination);
  if new.v2_snapshot is distinct from v_expected
     or new.origin_facility_id is distinct from ((v_origin ->> 'facilityId')::uuid)
     or new.destination_facility_id is distinct from ((v_destination ->> 'facilityId')::uuid)
     or new.cargo_category_id is distinct from ((select id from public.cargo_categories where code = v_cargo ->> 'categoryCode' and active))
     or new.cargo_weight_kg is distinct from (round((v_cargo ->> 'totalWeightKg')::numeric,2))
     or new.cargo_volume_m3 is distinct from (round((v_cargo ->> 'totalVolumeM3')::numeric,3))
     or new.cargo_specifications is distinct from (v_cargo)
     or new.package_count is distinct from ((select sum((u ->> 'quantity')::integer) from jsonb_array_elements(v_cargo -> 'units') u))
     or new.transport_mode is distinct from ('ROAD')
     or new.service_type is distinct from ('FTL')
     or new.cargo_description is distinct from (v_cargo ->> 'description')
     or new.required_pickup is distinct from ((v_payload #>> '{pickupWindow,startsAt}')::timestamptz)
     or new.pickup_window_start is distinct from ((v_payload #>> '{pickupWindow,startsAt}')::timestamptz)
     or new.pickup_window_end is distinct from ((v_payload #>> '{pickupWindow,endsAt}')::timestamptz)
     or new.delivery_deadline is distinct from ((v_payload #>> '{deliveryWindow,endsAt}')::timestamptz)
     or new.delivery_window_start is distinct from ((v_payload #>> '{deliveryWindow,startsAt}')::timestamptz)
     or new.delivery_window_end is distinct from ((v_payload #>> '{deliveryWindow,endsAt}')::timestamptz)
     or new.budget_max is distinct from (round((v_payload #>> '{budget,amount}')::numeric,2))
     or new.budget_currency is distinct from (v_payload #>> '{budget,currency}')
     or new.required_equipment_code is distinct from (v_payload ->> 'requiredEquipment')
     or new.origin_country is distinct from (v_origin ->> 'countryCode')
     or new.origin_city is distinct from (v_origin ->> 'city')
     or new.origin_region is distinct from (v_origin ->> 'region')
     or new.origin_address is distinct from (v_origin ->> 'label')
     or new.destination_country is distinct from (v_destination ->> 'countryCode')
     or new.destination_city is distinct from (v_destination ->> 'city')
     or new.destination_region is distinct from (v_destination ->> 'region')
     or new.destination_address is distinct from (v_destination ->> 'label')
     or new.pickup_contact_name is distinct from (v_payload #>> '{contacts,pickup,name}')
     or new.pickup_contact_phone is distinct from (v_payload #>> '{contacts,pickup,phoneE164}')
     or new.pickup_contact_email is distinct from (v_payload #>> '{contacts,pickup,email}')
     or new.receiver_name is distinct from (v_payload #>> '{contacts,recipient,name}')
     or new.receiver_phone is distinct from (v_payload #>> '{contacts,recipient,phoneE164}')
     or new.recipient_contact_email is distinct from (v_payload #>> '{contacts,recipient,email}') then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_v2_draft_insert() from public, anon, authenticated;
create trigger protect_v2_draft_insert before insert on public.freight_requests
for each row execute function private.protect_v2_draft_insert();

-- These invoker helpers disclose no tenant rows and cannot mutate state.
revoke all on function private.v2_freight_input_schema(), private.validate_v2_freight_payload(jsonb),
  private.resolve_v2_insert_location(jsonb,uuid) from public, anon, authenticated;
grant execute on function private.v2_freight_input_schema(), private.validate_v2_freight_payload(jsonb),
  private.resolve_v2_insert_location(jsonb,uuid) to authenticated, service_role;

create or replace function public.create_v2_freight_request(
  p_organization_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_member public.organization_members%rowtype;
  v_category public.cargo_categories%rowtype;
  v_origin public.facilities%rowtype;
  v_destination public.facilities%rowtype;
  v_origin_json jsonb;
  v_destination_json jsonb;
  v_payload jsonb;
  v_cargo jsonb;
  v_unit jsonb;
  v_location jsonb;
  v_units_weight numeric := 0;
  v_units_volume numeric := 0;
  v_request public.freight_requests%rowtype;
  v_id uuid;
  v_replay boolean := false;
begin
  if p_idempotency_key is null or p_payload_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload ->> 'schemaVersion' is distinct from '2.0'
     or p_payload -> 'acceptedModes' is distinct from '["ROAD"]'::jsonb
     or (p_payload ? 'budget' and p_payload -> 'budget' <> 'null'::jsonb
         and p_payload #>> '{budget,currency}' is distinct from 'USD') then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if p_payload ? 'organizationId'
     and p_payload ->> 'organizationId' is distinct from p_organization_id::text then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  select * into v_member from public.organization_members
    where id = p_member_id and organization_id = p_organization_id
      and status = 'ACTIVE' and role in ('OWNER','SUPERVISOR');
  if not found or (current_user <> 'service_role'
                   and v_member.auth_user_id is distinct from auth.uid()) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  perform private.validate_v2_freight_payload(p_payload);

  -- The public RPC must enforce totals too, including callers outside Hono.
  v_cargo := p_payload -> 'cargoSpecification';
  if jsonb_typeof(v_cargo -> 'units') is distinct from 'array' then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if jsonb_array_length(v_cargo -> 'units') = 0
     or jsonb_typeof(v_cargo -> 'totalWeightKg') is distinct from 'number'
     or jsonb_typeof(v_cargo -> 'totalVolumeM3') is distinct from 'number' then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  for v_unit in select value from jsonb_array_elements(v_cargo -> 'units') loop
    if jsonb_typeof(v_unit -> 'quantity') is distinct from 'number'
       or jsonb_typeof(v_unit -> 'weightPerUnitKg') is distinct from 'number'
       or jsonb_typeof(v_unit -> 'volumePerUnitM3') is distinct from 'number' then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    if (v_unit ->> 'quantity')::numeric <= 0
       or mod((v_unit ->> 'quantity')::numeric, 1) <> 0
       or (v_unit ->> 'weightPerUnitKg')::numeric <= 0
       or (v_unit ->> 'volumePerUnitM3')::numeric <= 0 then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;
    v_units_weight := v_units_weight + (v_unit ->> 'quantity')::numeric
      * (v_unit ->> 'weightPerUnitKg')::numeric;
    v_units_volume := v_units_volume + (v_unit ->> 'quantity')::numeric
      * (v_unit ->> 'volumePerUnitM3')::numeric;
  end loop;
  if abs((v_cargo ->> 'totalWeightKg')::numeric - v_units_weight) > 0.000001
     or abs((v_cargo ->> 'totalVolumeM3')::numeric - v_units_volume) > 0.000001 then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  -- Manual pins are user assertions, not provider geometry or verified facilities.
  for v_location in select value from jsonb_array_elements(
    jsonb_build_array(p_payload -> 'origin', p_payload -> 'destination')) loop
    if v_location ->> 'facilityId' is null then
      if (v_location ->> 'lat' is null) <> (v_location ->> 'lng' is null) then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_location ->> 'lat' is not null then
        if jsonb_typeof(v_location -> 'lat') is distinct from 'number'
           or jsonb_typeof(v_location -> 'lng') is distinct from 'number' then
          raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
        end if;
        if (v_location ->> 'lat')::numeric not between -90 and 90
           or (v_location ->> 'lng')::numeric not between -180 and 180 then
          raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
        end if;
      end if;
    end if;
  end loop;

  select * into v_request from public.freight_requests
    where organization_id = p_organization_id
      and requested_by_member_id = p_member_id
      and creation_idempotency_key = p_idempotency_key;
  if found then
    if v_request.creation_payload_hash is distinct from p_payload_hash
       or v_request.v2_creation_payload is distinct from p_payload then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
    end if;
    v_replay := true;
  else
    select * into v_category from public.cargo_categories
      where code = p_payload #>> '{cargoSpecification,categoryCode}' and active;
    if not found then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;

    if p_payload #>> '{origin,facilityId}' is not null then
      select * into v_origin from public.facilities
        where id = (p_payload #>> '{origin,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{origin,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_origin.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', v_origin.id, 'label', v_origin.name,
        'countryCode', v_origin.country_code, 'region', v_origin.region_code,
        'city', v_origin.city, 'lat', v_origin.latitude, 'lng', v_origin.longitude);
    else
      if coalesce(p_payload #>> '{origin,label}', '') = ''
         or coalesce(p_payload #>> '{origin,countryCode}', '') = ''
         or coalesce(p_payload #>> '{origin,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{origin,label}',
        'countryCode', p_payload #>> '{origin,countryCode}',
        'region', p_payload #>> '{origin,region}',
        'city', p_payload #>> '{origin,city}',
        'lat', p_payload #> '{origin,lat}', 'lng', p_payload #> '{origin,lng}');
    end if;

    if p_payload #>> '{destination,facilityId}' is not null then
      select * into v_destination from public.facilities
        where id = (p_payload #>> '{destination,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{destination,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_destination.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', v_destination.id, 'label', v_destination.name,
        'countryCode', v_destination.country_code, 'region', v_destination.region_code,
        'city', v_destination.city, 'lat', v_destination.latitude, 'lng', v_destination.longitude);
    else
      if coalesce(p_payload #>> '{destination,label}', '') = ''
         or coalesce(p_payload #>> '{destination,countryCode}', '') = ''
         or coalesce(p_payload #>> '{destination,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{destination,label}',
        'countryCode', p_payload #>> '{destination,countryCode}',
        'region', p_payload #>> '{destination,region}',
        'city', p_payload #>> '{destination,city}',
        'lat', p_payload #> '{destination,lat}', 'lng', p_payload #> '{destination,lng}');
    end if;

    v_cargo := p_payload -> 'cargoSpecification';
    v_payload := p_payload || jsonb_build_object(
      'organizationId', p_organization_id,
      'origin', v_origin_json,
      'destination', v_destination_json);
    v_id := gen_random_uuid();
    insert into public.freight_requests (
      id, organization_id, requested_by_member_id, cargo_category_id, code,
      origin_country, origin_city, origin_region, origin_address, origin_facility_id,
      destination_country, destination_city, destination_region, destination_address,
      destination_facility_id, cargo_weight_kg, cargo_volume_m3, package_count,
      service_type, transport_mode, required_pickup, pickup_window_start,
      pickup_window_end, delivery_deadline, delivery_window_start, delivery_window_end,
      budget_max, budget_currency, cargo_description, cargo_specifications,
      pickup_contact_name, pickup_contact_phone, pickup_contact_email,
      receiver_name, receiver_phone, recipient_contact_email,
      required_equipment_code, status, draft_version, v2_contract_version,
      v2_snapshot, v2_creation_payload, creation_idempotency_key, creation_payload_hash
    ) values (
      v_id, p_organization_id, p_member_id, v_category.id,
      'V2-' || replace(v_id::text, '-', ''),
      v_origin_json ->> 'countryCode', v_origin_json ->> 'city',
      v_origin_json ->> 'region', v_origin_json ->> 'label', v_origin.id,
      v_destination_json ->> 'countryCode', v_destination_json ->> 'city',
      v_destination_json ->> 'region', v_destination_json ->> 'label', v_destination.id,
      (v_cargo ->> 'totalWeightKg')::numeric,
      (v_cargo ->> 'totalVolumeM3')::numeric,
      (select sum((unit ->> 'quantity')::integer)
       from jsonb_array_elements(v_cargo -> 'units') as unit),
      'FTL', 'ROAD', (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,startsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      nullif(p_payload #>> '{budget,amount}', '')::numeric,
      p_payload #>> '{budget,currency}', v_cargo ->> 'description', v_cargo,
      p_payload #>> '{contacts,pickup,name}',
      p_payload #>> '{contacts,pickup,phoneE164}',
      p_payload #>> '{contacts,pickup,email}',
      p_payload #>> '{contacts,recipient,name}',
      p_payload #>> '{contacts,recipient,phoneE164}',
      p_payload #>> '{contacts,recipient,email}',
      p_payload ->> 'requiredEquipment', 'DRAFT', 1, '2.0', v_payload,
      p_payload, p_idempotency_key, p_payload_hash
    ) on conflict (organization_id, requested_by_member_id, creation_idempotency_key)
      where creation_idempotency_key is not null do nothing
    returning * into v_request;
    if not found then
      select * into v_request from public.freight_requests
        where organization_id = p_organization_id
          and requested_by_member_id = p_member_id
          and creation_idempotency_key = p_idempotency_key;
      if v_request.creation_payload_hash is distinct from p_payload_hash
         or v_request.v2_creation_payload is distinct from p_payload then
        raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
      end if;
      v_replay := true;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_request.id, 'referenceCode', v_request.code,
    'organizationId', v_request.organization_id, 'status', v_request.status,
    'draftVersion', v_request.draft_version, 'snapshot', v_request.v2_snapshot,
    'createdAt', v_request.created_at, 'updatedAt', v_request.updated_at,
    'payloadHash', v_request.creation_payload_hash,
    'idempotentReplay', v_replay);
end;
$$;

-- R-08: an empty calendar is allowed as missing evidence; malformed entries are not.
create function private.valid_v2_capacity_windows(p_windows jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare v_window jsonb;
begin
  if not coalesce(extensions.jsonb_matches_schema('{"type": "array", "items": {"type": "object", "properties": {"startsAt": {"type": "string", "format": "date-time", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"}, "endsAt": {"type": "string", "format": "date-time", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"}}, "required": ["startsAt", "endsAt"], "additionalProperties": false}}'::json, p_windows), false) then
    return false;
  end if;
  for v_window in select value from jsonb_array_elements(p_windows) loop
    if (v_window ->> 'startsAt')::timestamptz >= (v_window ->> 'endsAt')::timestamptz then return false; end if;
  end loop;
  return true;
exception when data_exception then return false;
end;
$$;
revoke all on function private.valid_v2_capacity_windows(jsonb) from public, anon, authenticated;
grant execute on function private.valid_v2_capacity_windows(jsonb) to authenticated, service_role;
alter table public.capacity_calendars add constraint capacity_calendars_windows_shape
  check(private.valid_v2_capacity_windows(available_windows));

-- R-09: S2 reserves the entire source, including a pool. Partial LTL is unverified.
-- One calendar per asset/pool + exclusion also arbitrates concurrent transactions.
-- Half-open [start,end) permits adjacent reservations; RELEASED occupies no capacity.
set local search_path = public, extensions;
alter table public.capacity_reservations add constraint capacity_reservations_no_overlap
  exclude using gist (capacity_calendar_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('HELD','CONFIRMED'));
