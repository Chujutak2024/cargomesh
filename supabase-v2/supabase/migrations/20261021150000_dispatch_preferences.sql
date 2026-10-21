-- Customer availability is not a resource reservation. Optional for legacy receipts.
begin;
create function private.validate_dispatch_preferences(v jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare field text;w jsonb;previous_end timestamptz;lo timestamptz;hi timestamptz;canonical text;begin
 if not v ? 'planningPreferences' then return;end if;
 if not exists(select 1 from pg_timezone_names where name=v#>>'{planningPreferences,timeZone}') then raise exception 'INVALID_TIME_ZONE' using errcode='PT400';end if;
 foreach field in array array['pickupWindows','deliveryWindows'] loop
  canonical:=case when field='pickupWindows' then 'pickupWindow' else 'deliveryWindow' end;previous_end:=null;
  for w in select value from jsonb_array_elements(v#>array['planningPreferences',field]) order by (value->>'startsAt')::timestamptz loop
   if (w->>'startsAt')::timestamptz >= (w->>'endsAt')::timestamptz or previous_end>(w->>'startsAt')::timestamptz then raise exception 'INVALID_ACCEPTED_WINDOWS' using errcode='PT400';end if;
   previous_end:=(w->>'endsAt')::timestamptz;
  end loop;
  select min((value->>'startsAt')::timestamptz),max((value->>'endsAt')::timestamptz) into lo,hi from jsonb_array_elements(v#>array['planningPreferences',field]);
  if lo is distinct from (v#>>array[canonical,'startsAt'])::timestamptz or hi is distinct from (v#>>array[canonical,'endsAt'])::timestamptz then raise exception 'ACCEPTED_WINDOW_ENVELOPE_MISMATCH' using errcode='PT400';end if;
 end loop;
end;$$;
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
          "type": "string",
          "pattern": "^[A-Z][A-Z0-9_]{0,99}$"
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
    },
    "planningPreferences": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "urgency",
        "loadSize",
        "timeZone",
        "pickupWindows",
        "deliveryWindows"
      ],
      "properties": {
        "urgency": {
          "enum": [
            "URGENT",
            "SCHEDULED"
          ]
        },
        "loadSize": {
          "enum": [
            "LIGHT",
            "MEDIUM",
            "HEAVY",
            null
          ]
        },
        "timeZone": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "pickupWindows": {
          "type": "array",
          "minItems": 1,
          "maxItems": 14,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "startsAt",
              "endsAt"
            ],
            "properties": {
              "startsAt": {
                "type": "string",
                "format": "date-time"
              },
              "endsAt": {
                "type": "string",
                "format": "date-time"
              }
            }
          }
        },
        "deliveryWindows": {
          "type": "array",
          "minItems": 1,
          "maxItems": 14,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "startsAt",
              "endsAt"
            ],
            "properties": {
              "startsAt": {
                "type": "string",
                "format": "date-time"
              },
              "endsAt": {
                "type": "string",
                "format": "date-time"
              }
            }
          }
        }
      }
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
  perform private.validate_dispatch_preferences(p_payload);
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
revoke all on function private.validate_dispatch_preferences(jsonb) from public,anon,service_role;
grant execute on function private.validate_dispatch_preferences(jsonb) to authenticated;
commit;
