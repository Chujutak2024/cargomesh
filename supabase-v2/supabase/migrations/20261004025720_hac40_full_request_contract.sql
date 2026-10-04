-- HAC-40: full request attributes and mode acceptance. No scenario inserts.
-- Historical functions copied additively; actor/receipt/location guards retained.
-- transport_mode is the FIRST accepted mode for legacy compatibility only;
-- planning uses the complete acceptedModes snapshot, never this projection.
begin;
alter table public.freight_requests
  add column preferred_equipment_code text,
  add column selection_objective text check (selection_objective in ('LOWEST_COST','FASTEST','WEIGHTED'));
create or replace function private.v2_freight_input_schema() returns json
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
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
            },
            {
              "type": "null"
            }
          ]
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
          "anyOf": [
            {
              "type": "string",
              "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
            },
            {
              "type": "null"
            }
          ]
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
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "uniqueItems": true,
      "items": {
        "enum": [
          "ROAD",
          "RAIL",
          "SEA",
          "AIR"
        ]
      }
    },
    "requiredEquipment": {
      "anyOf": [
        {
          "enum": [
            "BOX_TRUCK",
            "REEFER_TRUCK",
            "FLATBED",
            "TANKER_TRUCK",
            "TRACTOR_TRAILER",
            "ISO_CONTAINER",
            "RAIL_WAGON",
            "AIR_ULD"
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
              },
              "unitsPerPackage": {
                "type": "integer",
                "minimum": 1,
                "maximum": 1000000
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
        },
        "availableDocuments": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "code",
              "reference",
              "issuedAt",
              "validUntil"
            ],
            "properties": {
              "code": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100,
                "pattern": "\\S"
              },
              "reference": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500,
                "pattern": "\\S"
              },
              "issuedAt": {
                "anyOf": [
                  {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "validUntil": {
                "anyOf": [
                  {
                    "type": "string",
                    "format": "date-time",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            }
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
            },
            "company": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "addressDetail": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "handlingInstructions": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 2000,
                  "pattern": "\\S"
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
            },
            "company": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 200,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "addressDetail": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 1000,
                  "pattern": "\\S"
                },
                {
                  "type": "null"
                }
              ]
            },
            "handlingInstructions": {
              "anyOf": [
                {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 2000,
                  "pattern": "\\S"
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
    },
    "serviceType": {
      "enum": [
        "FTL",
        "LTL"
      ]
    },
    "selectionObjective": {
      "enum": [
        "LOWEST_COST",
        "FASTEST",
        "WEIGHTED"
      ]
    },
    "preferredEquipment": {
      "anyOf": [
        {
          "enum": [
            "BOX_TRUCK",
            "REEFER_TRUCK",
            "FLATBED",
            "TANKER_TRUCK",
            "TRACTOR_TRAILER",
            "ISO_CONTAINER",
            "RAIL_WAGON",
            "AIR_ULD"
          ]
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
create or replace function private.validate_v2_freight_payload(p_payload jsonb) returns void
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
  if exists(select 1 from jsonb_array_elements(coalesce(v_cargo->'availableDocuments','[]'::jsonb)) d
    where (d->>'issuedAt')::timestamptz >= (d->>'validUntil')::timestamptz) then
    raise exception 'VALIDATION_ERROR' using errcode='PT400'; end if;
exception when data_exception then
  raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
end;
$$;

create or replace function private.protect_v2_draft_insert() returns trigger
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
     or new.transport_mode is distinct from (v_payload#>>'{acceptedModes,0}')
     or new.service_type is distinct from (coalesce(v_payload->>'serviceType','FTL'))
     or new.cargo_description is distinct from (v_cargo ->> 'description')
     or new.required_pickup is distinct from ((v_payload #>> '{pickupWindow,startsAt}')::timestamptz)
     or new.pickup_window_start is distinct from ((v_payload #>> '{pickupWindow,startsAt}')::timestamptz)
     or new.pickup_window_end is distinct from ((v_payload #>> '{pickupWindow,endsAt}')::timestamptz)
     or new.delivery_deadline is distinct from ((v_payload #>> '{deliveryWindow,endsAt}')::timestamptz)
     or new.delivery_window_start is distinct from ((v_payload #>> '{deliveryWindow,startsAt}')::timestamptz)
     or new.delivery_window_end is distinct from ((v_payload #>> '{deliveryWindow,endsAt}')::timestamptz)
     or new.budget_max is distinct from (round((v_payload #>> '{budget,amount}')::numeric,2))
     or new.budget_currency is distinct from (v_payload #>> '{budget,currency}')
     or new.preferred_equipment_code is distinct from (v_payload->>'preferredEquipment')
     or new.selection_objective is distinct from (v_payload->>'selectionObjective')
     or new.available_documents is distinct from (coalesce(v_cargo->'availableDocuments','[]'::jsonb))
     or new.receiver_company is distinct from (v_payload#>>'{contacts,recipient,company}')
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
      required_equipment_code, preferred_equipment_code, selection_objective, available_documents, receiver_company, status, draft_version, v2_contract_version,
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
      coalesce(p_payload->>'serviceType','FTL'), p_payload#>>'{acceptedModes,0}', (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
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
      p_payload ->> 'requiredEquipment', p_payload->>'preferredEquipment', p_payload->>'selectionObjective',
      coalesce(v_cargo->'availableDocuments','[]'::jsonb), p_payload#>>'{contacts,recipient,company}', 'DRAFT', 1, '2.0', v_payload,
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

create or replace function private.command_v2_freight_request(
  p_organization_id uuid, p_member_id uuid, p_idempotency_key uuid, p_request_id uuid,
  p_expected_version integer, p_action text, p_value jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.freight_requests%rowtype; v_scratch public.freight_requests%rowtype;
  v_receipt private.v2_request_command_receipts%rowtype; v_hash text; v_created jsonb;
  v_result jsonb; v_snapshot jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members m where m.id = p_member_id
      and m.organization_id = p_organization_id and m.auth_user_id = auth.uid()
      and m.status = 'ACTIVE' and m.role in ('OWNER','SUPERVISOR')
  ) then raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403'; end if;
  if p_idempotency_key is null or p_request_id is null or p_expected_version is null
    or p_expected_version <= 0 or p_action is null or p_action not in ('REVISE','SUBMIT')
    or (p_action = 'SUBMIT' and p_value is not null and p_value <> 'null'::jsonb)
    or (p_action = 'REVISE' and (p_value is null or jsonb_typeof(p_value) <> 'object'))
  then raise exception 'VALIDATION_ERROR' using errcode = 'PT400'; end if;
  v_hash := private.hash_v2_freight_payload(jsonb_build_object('id',p_request_id,
    'expectedVersion',p_expected_version,'action',p_action,'value',p_value));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_organization_id::text || ':' || p_member_id::text || ':' || p_idempotency_key::text, 1));
  select * into v_receipt from private.v2_request_command_receipts
    where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key;
  if found then
    if v_receipt.payload_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409'; end if;
    return v_receipt.result || '{"replay":true}'::jsonb;
  end if;
  select * into v_request from public.freight_requests where id=p_request_id
    and organization_id=p_organization_id and v2_contract_version='2.0' for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404'; end if;
  if v_request.draft_version <> p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409'; end if;
  if v_request.status <> 'DRAFT' then raise exception 'INVALID_TRANSITION' using errcode='PT409'; end if;
  if p_action = 'REVISE' then
    -- Reuse the native writer's entire SQL validator and canonical facility
    -- resolver. Its scratch row is created, copied and deleted within this same
    -- transaction; it cannot escape on failure and never changes the old receipt.
    v_created := public.create_v2_freight_request(p_organization_id,p_member_id,gen_random_uuid(),
      private.hash_v2_freight_payload(p_value),p_value);
    select * into strict v_scratch from public.freight_requests where id=(v_created->>'id')::uuid;
    update public.freight_requests set
      cargo_category_id=v_scratch.cargo_category_id,
      origin_country=v_scratch.origin_country,origin_city=v_scratch.origin_city,
      origin_region=v_scratch.origin_region,origin_address=v_scratch.origin_address,origin_facility_id=v_scratch.origin_facility_id,
      destination_country=v_scratch.destination_country,destination_city=v_scratch.destination_city,
      destination_region=v_scratch.destination_region,destination_address=v_scratch.destination_address,destination_facility_id=v_scratch.destination_facility_id,
      cargo_weight_kg=v_scratch.cargo_weight_kg,cargo_volume_m3=v_scratch.cargo_volume_m3,package_count=v_scratch.package_count,
      service_type=v_scratch.service_type,transport_mode=v_scratch.transport_mode,required_pickup=v_scratch.required_pickup,
      pickup_window_start=v_scratch.pickup_window_start,pickup_window_end=v_scratch.pickup_window_end,
      delivery_deadline=v_scratch.delivery_deadline,delivery_window_start=v_scratch.delivery_window_start,delivery_window_end=v_scratch.delivery_window_end,
      budget_max=v_scratch.budget_max,budget_currency=v_scratch.budget_currency,cargo_description=v_scratch.cargo_description,
      cargo_specifications=v_scratch.cargo_specifications,pickup_contact_name=v_scratch.pickup_contact_name,
      pickup_contact_phone=v_scratch.pickup_contact_phone,pickup_contact_email=v_scratch.pickup_contact_email,
      receiver_name=v_scratch.receiver_name,receiver_phone=v_scratch.receiver_phone,recipient_contact_email=v_scratch.recipient_contact_email,
      preferred_equipment_code=v_scratch.preferred_equipment_code,selection_objective=v_scratch.selection_objective,
      available_documents=v_scratch.available_documents,receiver_company=v_scratch.receiver_company,
      required_equipment_code=v_scratch.required_equipment_code,v2_snapshot=v_scratch.v2_snapshot,
      draft_version=v_request.draft_version+1,updated_at=clock_timestamp()
    where id=p_request_id returning * into v_request;
    delete from public.freight_requests where id=v_scratch.id;
  else
    perform private.validate_v2_freight_payload(v_request.v2_snapshot);
    update public.freight_requests set status='PENDING',draft_version=draft_version+1,updated_at=clock_timestamp()
      where id=p_request_id returning * into v_request;
  end if;
  v_snapshot := v_request.v2_snapshot;
  v_result := jsonb_build_object('replay',false,'payloadHash',v_request.creation_payload_hash,'data',
    jsonb_build_object('id',v_request.id,'referenceCode',v_request.code,'organizationId',v_request.organization_id,
      'status',v_request.status,'draftVersion',v_request.draft_version,
      'origin',v_snapshot->'origin','destination',v_snapshot->'destination',
      'pickupWindow',v_snapshot->'pickupWindow','deliveryWindow',v_snapshot->'deliveryWindow',
      'serviceType',coalesce(v_snapshot->'serviceType','"FTL"'::jsonb),
      'preferredEquipment',coalesce(v_snapshot->'preferredEquipment','null'::jsonb),
      'selectionObjective',coalesce(v_snapshot->'selectionObjective','null'::jsonb),
      'acceptedModes',v_snapshot->'acceptedModes','requiredEquipment',coalesce(v_snapshot->'requiredEquipment','null'::jsonb),
      'cargoSpecification',v_snapshot->'cargoSpecification','contacts',v_snapshot->'contacts',
      'budget',coalesce(v_snapshot->'budget','null'::jsonb),'createdAt',v_request.created_at,'updatedAt',v_request.updated_at));
  insert into private.v2_request_command_receipts(organization_id,member_id,idempotency_key,request_id,payload_hash,result)
    values(p_organization_id,p_member_id,p_idempotency_key,p_request_id,v_hash,v_result);
  return v_result;
end;
$$;
commit;
