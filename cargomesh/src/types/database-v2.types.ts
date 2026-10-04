export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      asset_cargo_capabilities: {
        Row: {
          active: boolean
          cargo_category_id: string
          carrier_id: string
          carrier_service_id: string | null
          certifications: Json
          created_at: string
          definition_id: string | null
          evidence: string | null
          fleet_managed: boolean
          id: string
          temperature_max_c: number | null
          temperature_min_c: number | null
          transport_asset_id: string
          updated_at: string
          valid_until: string | null
          verified_at: string | null
          version: number
        }
        Insert: {
          active?: boolean
          cargo_category_id: string
          carrier_id: string
          carrier_service_id?: string | null
          certifications?: Json
          created_at?: string
          definition_id?: string | null
          evidence?: string | null
          fleet_managed?: boolean
          id?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_asset_id: string
          updated_at?: string
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          cargo_category_id?: string
          carrier_id?: string
          carrier_service_id?: string | null
          certifications?: Json
          created_at?: string
          definition_id?: string | null
          evidence?: string | null
          fleet_managed?: boolean
          id?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_asset_id?: string
          updated_at?: string
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_cargo_capabilities_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cargo_capabilities_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cargo_capabilities_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cargo_capabilities_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "cargo_capability_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_cargo_capabilities_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "asset_cargo_capabilities_transport_asset_id_fkey"
            columns: ["transport_asset_id"]
            isOneToOne: false
            referencedRelation: "transport_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_definition_asset_scope"
            columns: ["definition_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "cargo_capability_definitions"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
        ]
      }
      booking_authorizations: {
        Row: {
          authorization_kind: string
          booking_idempotency_key: string
          carrier_id: string
          carrier_service_id: string
          consumed_booking_id: string | null
          created_at: string
          expires_at: string
          freight_decision_id: string
          freight_request_id: string
          id: string
          issued_at: string
          offer_id: string
          organization_id: string
          replaces_booking_id: string | null
          revoked_at: string | null
          selected_by_member_id: string
          selection_mode: string
          updated_at: string
        }
        Insert: {
          authorization_kind: string
          booking_idempotency_key: string
          carrier_id: string
          carrier_service_id: string
          consumed_booking_id?: string | null
          created_at?: string
          expires_at?: string
          freight_decision_id: string
          freight_request_id: string
          id?: string
          issued_at?: string
          offer_id: string
          organization_id: string
          replaces_booking_id?: string | null
          revoked_at?: string | null
          selected_by_member_id: string
          selection_mode: string
          updated_at?: string
        }
        Update: {
          authorization_kind?: string
          booking_idempotency_key?: string
          carrier_id?: string
          carrier_service_id?: string
          consumed_booking_id?: string | null
          created_at?: string
          expires_at?: string
          freight_decision_id?: string
          freight_request_id?: string
          id?: string
          issued_at?: string
          offer_id?: string
          organization_id?: string
          replaces_booking_id?: string | null
          revoked_at?: string | null
          selected_by_member_id?: string
          selection_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_authorizations_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_consumed_booking_id_fkey"
            columns: ["consumed_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_freight_decision_id_fkey"
            columns: ["freight_decision_id"]
            isOneToOne: false
            referencedRelation: "freight_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "carrier_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_replaces_booking_id_fkey"
            columns: ["replaces_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_authorizations_selected_by_member_id_fkey"
            columns: ["selected_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_bridge_calls: {
        Row: {
          authorization_id: string
          booking_id: string
          bridge_call_id: string
          canonical_payload: Json
          created_at: string
          tool_name: string
        }
        Insert: {
          authorization_id: string
          booking_id: string
          bridge_call_id: string
          canonical_payload: Json
          created_at?: string
          tool_name: string
        }
        Update: {
          authorization_id?: string
          booking_id?: string
          bridge_call_id?: string
          canonical_payload?: Json
          created_at?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_bridge_calls_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "booking_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_bridge_calls_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          booking_id: string
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          provider_booking_status: string | null
          provider_event_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          occurred_at: string
          payload?: Json
          provider_booking_status?: string | null
          provider_event_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          provider_booking_status?: string | null
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          authorization_context: Json
          booked_at: string
          cancelled_at: string | null
          carrier_id: string
          confirmed_at: string | null
          created_at: string
          expired_at: string | null
          freight_decision_id: string
          freight_request_id: string
          id: string
          idempotency_key: string
          offer_id: string
          payment_mode: string
          payment_provider_reference: string | null
          payment_status: string
          payment_url: string | null
          provider_booking_status: string
          provider_reference: string | null
          provider_response_deadline: string
          rejected_at: string | null
          replaces_booking_id: string | null
          selected_by_member_id: string | null
          selection_mode: string
          status: string
          updated_at: string
        }
        Insert: {
          authorization_context?: Json
          booked_at?: string
          cancelled_at?: string | null
          carrier_id: string
          confirmed_at?: string | null
          created_at?: string
          expired_at?: string | null
          freight_decision_id: string
          freight_request_id: string
          id?: string
          idempotency_key: string
          offer_id: string
          payment_mode?: string
          payment_provider_reference?: string | null
          payment_status?: string
          payment_url?: string | null
          provider_booking_status?: string
          provider_reference?: string | null
          provider_response_deadline: string
          rejected_at?: string | null
          replaces_booking_id?: string | null
          selected_by_member_id?: string | null
          selection_mode?: string
          status?: string
          updated_at?: string
        }
        Update: {
          authorization_context?: Json
          booked_at?: string
          cancelled_at?: string | null
          carrier_id?: string
          confirmed_at?: string | null
          created_at?: string
          expired_at?: string | null
          freight_decision_id?: string
          freight_request_id?: string
          id?: string
          idempotency_key?: string
          offer_id?: string
          payment_mode?: string
          payment_provider_reference?: string | null
          payment_status?: string
          payment_url?: string | null
          provider_booking_status?: string
          provider_reference?: string | null
          provider_response_deadline?: string
          rejected_at?: string | null
          replaces_booking_id?: string | null
          selected_by_member_id?: string | null
          selection_mode?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_freight_decision_id_fkey"
            columns: ["freight_decision_id"]
            isOneToOne: false
            referencedRelation: "freight_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "carrier_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_replaces_booking_id_fkey"
            columns: ["replaces_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_selected_by_member_id_fkey"
            columns: ["selected_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_calendars: {
        Row: {
          available_windows: Json
          capacity_pool_id: string | null
          carrier_id: string
          carrier_service_id: string
          complete: boolean
          created_at: string
          fleet_managed: boolean
          freshness: string | null
          horizon_ends_at: string | null
          horizon_starts_at: string | null
          id: string
          last_verified_at: string | null
          observed_at: string | null
          provenance_status: string
          ready_pickup_area_id: string | null
          source: string | null
          source_reference: string
          timezone: string | null
          transport_asset_id: string | null
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          available_windows?: Json
          capacity_pool_id?: string | null
          carrier_id: string
          carrier_service_id: string
          complete?: boolean
          created_at?: string
          fleet_managed?: boolean
          freshness?: string | null
          horizon_ends_at?: string | null
          horizon_starts_at?: string | null
          id?: string
          last_verified_at?: string | null
          observed_at?: string | null
          provenance_status?: string
          ready_pickup_area_id?: string | null
          source?: string | null
          source_reference: string
          timezone?: string | null
          transport_asset_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          available_windows?: Json
          capacity_pool_id?: string | null
          carrier_id?: string
          carrier_service_id?: string
          complete?: boolean
          created_at?: string
          fleet_managed?: boolean
          freshness?: string | null
          horizon_ends_at?: string | null
          horizon_starts_at?: string | null
          id?: string
          last_verified_at?: string | null
          observed_at?: string | null
          provenance_status?: string
          ready_pickup_area_id?: string | null
          source?: string | null
          source_reference?: string
          timezone?: string | null
          transport_asset_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "capacity_calendars_capacity_pool_id_carrier_service_id_fkey"
            columns: ["capacity_pool_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "capacity_pools"
            referencedColumns: ["id", "carrier_service_id"]
          },
          {
            foreignKeyName: "capacity_calendars_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_calendars_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_calendars_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "capacity_calendars_ready_pickup_same_service"
            columns: ["ready_pickup_area_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id", "carrier_service_id"]
          },
          {
            foreignKeyName: "capacity_calendars_transport_asset_id_carrier_service_id_fkey"
            columns: ["transport_asset_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "transport_assets"
            referencedColumns: ["id", "carrier_service_id"]
          },
        ]
      }
      capacity_pools: {
        Row: {
          active: boolean
          carrier_id: string
          carrier_service_id: string
          code: string
          created_at: string
          ends_at: string | null
          equipment_code: string | null
          evidence: string | null
          fleet_managed: boolean
          fulfilment_partner_id: string | null
          fulfilment_source: string | null
          id: string
          max_volume_m3: number | null
          max_weight_kg: number | null
          mode: string | null
          starts_at: string | null
          supported_cargo_category_ids: string[]
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          carrier_id: string
          carrier_service_id: string
          code: string
          created_at?: string
          ends_at?: string | null
          equipment_code?: string | null
          evidence?: string | null
          fleet_managed?: boolean
          fulfilment_partner_id?: string | null
          fulfilment_source?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          mode?: string | null
          starts_at?: string | null
          supported_cargo_category_ids?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          carrier_id?: string
          carrier_service_id?: string
          code?: string
          created_at?: string
          ends_at?: string | null
          equipment_code?: string | null
          evidence?: string | null
          fleet_managed?: boolean
          fulfilment_partner_id?: string | null
          fulfilment_source?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          mode?: string | null
          starts_at?: string | null
          supported_cargo_category_ids?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "capacity_pools_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_pools_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "capacity_pools_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "capacity_pools_fulfilment_partner_id_fkey"
            columns: ["fulfilment_partner_id"]
            isOneToOne: false
            referencedRelation: "fulfilment_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_reservations: {
        Row: {
          capacity_calendar_id: string
          committed_capacity: Json | null
          created_at: string
          ends_at: string
          evidence: Json | null
          execution_id: string | null
          freight_request_id: string | null
          id: string
          reference: string | null
          source: string | null
          starts_at: string
          status: string
        }
        Insert: {
          capacity_calendar_id: string
          committed_capacity?: Json | null
          created_at?: string
          ends_at: string
          evidence?: Json | null
          execution_id?: string | null
          freight_request_id?: string | null
          id?: string
          reference?: string | null
          source?: string | null
          starts_at: string
          status: string
        }
        Update: {
          capacity_calendar_id?: string
          committed_capacity?: Json | null
          created_at?: string
          ends_at?: string
          evidence?: Json | null
          execution_id?: string | null
          freight_request_id?: string | null
          id?: string
          reference?: string | null
          source?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_reservations_capacity_calendar_id_fkey"
            columns: ["capacity_calendar_id"]
            isOneToOne: false
            referencedRelation: "capacity_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_reservations_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "transport_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_reservations_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_capability_definitions: {
        Row: {
          active: boolean
          cargo_category_id: string
          carrier_id: string
          carrier_service_id: string
          certifications: Json
          created_at: string
          evidence: string | null
          fleet_managed: boolean
          id: string
          max_weight_kg: number | null
          requirements: Json
          temperature_range: Json | null
          updated_at: string
          valid_until: string | null
          verified_at: string | null
          version: number
        }
        Insert: {
          active: boolean
          cargo_category_id: string
          carrier_id: string
          carrier_service_id: string
          certifications: Json
          created_at?: string
          evidence?: string | null
          fleet_managed?: boolean
          id?: string
          max_weight_kg?: number | null
          requirements: Json
          temperature_range?: Json | null
          updated_at?: string
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          cargo_category_id?: string
          carrier_id?: string
          carrier_service_id?: string
          certifications?: Json
          created_at?: string
          evidence?: string | null
          fleet_managed?: boolean
          id?: string
          max_weight_kg?: number | null
          requirements?: Json
          temperature_range?: Json | null
          updated_at?: string
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargo_capability_definitions_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_capability_definitions_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_capability_definitions_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_capability_definitions_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
        ]
      }
      cargo_categories: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          intake_specification_schema: Json
          name: string
          recommended_entry_methods: Json
          recommended_vehicle_classes: Json
          suggested_equipment: string | null
          suggested_requirements: Json
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          intake_specification_schema?: Json
          name: string
          recommended_entry_methods?: Json
          recommended_vehicle_classes?: Json
          suggested_equipment?: string | null
          suggested_requirements?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          intake_specification_schema?: Json
          name?: string
          recommended_entry_methods?: Json
          recommended_vehicle_classes?: Json
          suggested_equipment?: string | null
          suggested_requirements?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      carrier_depots: {
        Row: {
          active: boolean
          address_line: string | null
          carrier_id: string
          city: string
          code: string
          country_code: string
          created_at: string
          handling: Json
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          postal_code: string | null
          region_code: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          address_line?: string | null
          carrier_id: string
          city: string
          code: string
          country_code: string
          created_at?: string
          handling?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          address_line?: string | null
          carrier_id?: string
          city?: string
          code?: string
          country_code?: string
          created_at?: string
          handling?: Json
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "carrier_depots_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_metrics: {
        Row: {
          average_route_cost: number | null
          avg_cost: number | null
          avg_delay_hours: number | null
          cancellation_rate: number
          cargo_category_id: string | null
          carrier_id: string
          completed_freight_requests: number
          created_at: string
          destination_city: string
          destination_country: string
          id: string
          organization_completed_freight_requests: number
          organization_id: string | null
          organization_successful_freight_requests: number
          origin_city: string
          origin_country: string
          route_completed_freight_requests: number
          success_rate: number
          successful_freight_requests: number
          transport_mode: string
          updated_at: string
        }
        Insert: {
          average_route_cost?: number | null
          avg_cost?: number | null
          avg_delay_hours?: number | null
          cancellation_rate?: number
          cargo_category_id?: string | null
          carrier_id: string
          completed_freight_requests?: number
          created_at?: string
          destination_city: string
          destination_country: string
          id?: string
          organization_completed_freight_requests?: number
          organization_id?: string | null
          organization_successful_freight_requests?: number
          origin_city: string
          origin_country: string
          route_completed_freight_requests?: number
          success_rate?: number
          successful_freight_requests?: number
          transport_mode?: string
          updated_at?: string
        }
        Update: {
          average_route_cost?: number | null
          avg_cost?: number | null
          avg_delay_hours?: number | null
          cancellation_rate?: number
          cargo_category_id?: string | null
          carrier_id?: string
          completed_freight_requests?: number
          created_at?: string
          destination_city?: string
          destination_country?: string
          id?: string
          organization_completed_freight_requests?: number
          organization_id?: string | null
          organization_successful_freight_requests?: number
          origin_city?: string
          origin_country?: string
          route_completed_freight_requests?: number
          success_rate?: number
          successful_freight_requests?: number
          transport_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_metrics_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_metrics_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_offers: {
        Row: {
          availability_class: string
          availability_score: number
          available_capacity_kg: number
          available_volume_m3: number | null
          carrier_id: string
          carrier_service_id: string | null
          compatibility_notes: Json | null
          compatibility_status: string
          created_at: string
          currency: string
          estimated_delivery: string
          estimated_pickup: string
          final_score: number | null
          freight_request_id: string
          id: string
          offer_reference: string | null
          orchestration_run_id: string
          organization_history_score: number
          price: number
          provider_offer_reference: string
          quote_breakdown: Json
          reliability_score: number
          route_operations: number
          service_type: string
          status: string
          supersedes_offer_id: string | null
          tool_call_id: string
          transit_hours: number
          transport_mode: string
          valid_until: string
          vehicle_id: string | null
        }
        Insert: {
          availability_class: string
          availability_score: number
          available_capacity_kg: number
          available_volume_m3?: number | null
          carrier_id: string
          carrier_service_id?: string | null
          compatibility_notes?: Json | null
          compatibility_status?: string
          created_at?: string
          currency?: string
          estimated_delivery: string
          estimated_pickup: string
          final_score?: number | null
          freight_request_id: string
          id?: string
          offer_reference?: string | null
          orchestration_run_id: string
          organization_history_score?: number
          price: number
          provider_offer_reference: string
          quote_breakdown?: Json
          reliability_score: number
          route_operations?: number
          service_type?: string
          status?: string
          supersedes_offer_id?: string | null
          tool_call_id: string
          transit_hours: number
          transport_mode?: string
          valid_until: string
          vehicle_id?: string | null
        }
        Update: {
          availability_class?: string
          availability_score?: number
          available_capacity_kg?: number
          available_volume_m3?: number | null
          carrier_id?: string
          carrier_service_id?: string | null
          compatibility_notes?: Json | null
          compatibility_status?: string
          created_at?: string
          currency?: string
          estimated_delivery?: string
          estimated_pickup?: string
          final_score?: number | null
          freight_request_id?: string
          id?: string
          offer_reference?: string | null
          orchestration_run_id?: string
          organization_history_score?: number
          price?: number
          provider_offer_reference?: string
          quote_breakdown?: Json
          reliability_score?: number
          route_operations?: number
          service_type?: string
          status?: string
          supersedes_offer_id?: string | null
          tool_call_id?: string
          transit_hours?: number
          transport_mode?: string
          valid_until?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_offers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_offers_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_offers_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_offers_orchestration_run_id_fkey"
            columns: ["orchestration_run_id"]
            isOneToOne: false
            referencedRelation: "orchestration_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_offers_supersedes_offer_id_fkey"
            columns: ["supersedes_offer_id"]
            isOneToOne: false
            referencedRelation: "carrier_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_offers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_operators: {
        Row: {
          auth_user_id: string | null
          carrier_id: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          phone: string | null
          role: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          carrier_id: string
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          phone?: string | null
          role: string
          status: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          carrier_id?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_operators_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_service_cargo_categories: {
        Row: {
          cargo_category_id: string
          carrier_service_id: string
        }
        Insert: {
          cargo_category_id: string
          carrier_service_id: string
        }
        Update: {
          cargo_category_id?: string
          carrier_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_service_cargo_categories_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_service_cargo_categories_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_services: {
        Row: {
          active: boolean
          carrier_id: string
          created_at: string
          customs_coordination_included: boolean
          destination_country: string | null
          destination_region: string | null
          id: string
          max_capacity_kg: number | null
          max_volume_m3: number | null
          origin_country: string | null
          origin_region: string | null
          provider_service_code: string | null
          required_certifications: Json
          response_channels: Json
          service_type: string
          supports_cross_border: boolean
          supports_fragile: boolean
          supports_hazardous: boolean
          supports_oversized: boolean
          supports_refrigerated: boolean
          temperature_max_c: number | null
          temperature_min_c: number | null
          transport_mode: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          carrier_id: string
          created_at?: string
          customs_coordination_included?: boolean
          destination_country?: string | null
          destination_region?: string | null
          id?: string
          max_capacity_kg?: number | null
          max_volume_m3?: number | null
          origin_country?: string | null
          origin_region?: string | null
          provider_service_code?: string | null
          required_certifications?: Json
          response_channels?: Json
          service_type?: string
          supports_cross_border?: boolean
          supports_fragile?: boolean
          supports_hazardous?: boolean
          supports_oversized?: boolean
          supports_refrigerated?: boolean
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          carrier_id?: string
          created_at?: string
          customs_coordination_included?: boolean
          destination_country?: string | null
          destination_region?: string | null
          id?: string
          max_capacity_kg?: number | null
          max_volume_m3?: number | null
          origin_country?: string | null
          origin_region?: string | null
          provider_service_code?: string | null
          required_certifications?: Json
          response_channels?: Json
          service_type?: string
          supports_cross_border?: boolean
          supports_fragile?: boolean
          supports_hazardous?: boolean
          supports_oversized?: boolean
          supports_refrigerated?: boolean
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "carrier_services_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          business_identifier_type: string | null
          business_identifier_value: string | null
          code: string
          created_at: string
          id: string
          legal_name: string | null
          name: string
          operational_phone: string | null
          provider_type: string
          provider_url: string | null
          registered_country: string | null
          status: string
          supports_webmcp: boolean
          updated_at: string
          verified_contact: Json | null
          version: number
        }
        Insert: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code: string
          created_at?: string
          id?: string
          legal_name?: string | null
          name: string
          operational_phone?: string | null
          provider_type?: string
          provider_url?: string | null
          registered_country?: string | null
          status?: string
          supports_webmcp?: boolean
          updated_at?: string
          verified_contact?: Json | null
          version?: number
        }
        Update: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code?: string
          created_at?: string
          id?: string
          legal_name?: string | null
          name?: string
          operational_phone?: string | null
          provider_type?: string
          provider_url?: string | null
          registered_country?: string | null
          status?: string
          supports_webmcp?: boolean
          updated_at?: string
          verified_contact?: Json | null
          version?: number
        }
        Relationships: []
      }
      driver_assignments: {
        Row: {
          accepted_license_classes: Json
          carrier_id: string
          carrier_service_id: string
          created_at: string
          driver_id: string
          ends_at: string
          evidence: Json | null
          execution_id: string
          id: string
          policy_evidence: Json | null
          required_qualifications: Json
          role: string
          starts_at: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          accepted_license_classes: Json
          carrier_id: string
          carrier_service_id: string
          created_at?: string
          driver_id: string
          ends_at: string
          evidence?: Json | null
          execution_id: string
          id?: string
          policy_evidence?: Json | null
          required_qualifications: Json
          role: string
          starts_at: string
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_license_classes?: Json
          carrier_id?: string
          carrier_service_id?: string
          created_at?: string
          driver_id?: string
          ends_at?: string
          evidence?: Json | null
          execution_id?: string
          id?: string
          policy_evidence?: Json | null
          required_qualifications?: Json
          role?: string
          starts_at?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "driver_assignments_driver_id_carrier_id_carrier_service_id_fkey"
            columns: ["driver_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
          {
            foreignKeyName: "driver_assignments_execution_id_carrier_id_carrier_service_fkey"
            columns: ["execution_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "transport_executions"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
        ]
      }
      drivers: {
        Row: {
          available_windows: Json
          carrier_id: string
          carrier_operator_id: string | null
          carrier_service_id: string
          created_at: string
          duty_ends_at: string | null
          duty_starts_at: string | null
          duty_status: string
          evidence: Json | null
          experience_years: number | null
          full_name: string
          id: string
          license_class: string
          license_timezone: string
          license_valid_until: string
          maximum_duty_seconds: number | null
          qualifications: Json
          updated_at: string
          used_duty_seconds: number
          version: number
        }
        Insert: {
          available_windows: Json
          carrier_id: string
          carrier_operator_id?: string | null
          carrier_service_id: string
          created_at?: string
          duty_ends_at?: string | null
          duty_starts_at?: string | null
          duty_status: string
          evidence?: Json | null
          experience_years?: number | null
          full_name: string
          id?: string
          license_class: string
          license_timezone: string
          license_valid_until: string
          maximum_duty_seconds?: number | null
          qualifications: Json
          updated_at?: string
          used_duty_seconds: number
          version?: number
        }
        Update: {
          available_windows?: Json
          carrier_id?: string
          carrier_operator_id?: string | null
          carrier_service_id?: string
          created_at?: string
          duty_ends_at?: string | null
          duty_starts_at?: string | null
          duty_status?: string
          evidence?: Json | null
          experience_years?: number | null
          full_name?: string
          id?: string
          license_class?: string
          license_timezone?: string
          license_valid_until?: string
          maximum_duty_seconds?: number | null
          qualifications?: Json
          updated_at?: string
          used_duty_seconds?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "drivers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_carrier_operator_id_carrier_id_fkey"
            columns: ["carrier_operator_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_operators"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "drivers_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
        ]
      }
      facilities: {
        Row: {
          access_notes: string | null
          access_restrictions: Json
          active: boolean
          address_line: string
          city: string
          code: string
          country_code: string
          created_at: string
          facility_type: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          operating_hours: Json | null
          organization_id: string
          postal_code: string | null
          region_code: string | null
          updated_at: string
          v2_command_managed: boolean
          version: number
        }
        Insert: {
          access_notes?: string | null
          access_restrictions?: Json
          active?: boolean
          address_line: string
          city: string
          code: string
          country_code: string
          created_at?: string
          facility_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          operating_hours?: Json | null
          organization_id: string
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          v2_command_managed?: boolean
          version?: number
        }
        Update: {
          access_notes?: string | null
          access_restrictions?: Json
          active?: boolean
          address_line?: string
          city?: string
          code?: string
          country_code?: string
          created_at?: string
          facility_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          operating_hours?: Json | null
          organization_id?: string
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          v2_command_managed?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_decisions: {
        Row: {
          anomaly_evidence: Json
          candidate_snapshot: Json | null
          confidence_components: Json
          confidence_score: number | null
          created_at: string
          decision_reason: string | null
          decision_type: string
          decision_version: number
          freight_request_id: string
          heuristic_score: number | null
          id: string
          optimization_strategy: string
          orchestration_run_id: string
          previous_decision_id: string | null
          ranking_snapshot: Json
          recommended_offer_id: string | null
          requires_review: boolean
          selected_at: string | null
          selected_by_member_id: string | null
          selected_offer_id: string | null
          selection_mode: string | null
          subscores: Json
        }
        Insert: {
          anomaly_evidence?: Json
          candidate_snapshot?: Json | null
          confidence_components?: Json
          confidence_score?: number | null
          created_at?: string
          decision_reason?: string | null
          decision_type?: string
          decision_version?: number
          freight_request_id: string
          heuristic_score?: number | null
          id?: string
          optimization_strategy?: string
          orchestration_run_id: string
          previous_decision_id?: string | null
          ranking_snapshot?: Json
          recommended_offer_id?: string | null
          requires_review?: boolean
          selected_at?: string | null
          selected_by_member_id?: string | null
          selected_offer_id?: string | null
          selection_mode?: string | null
          subscores?: Json
        }
        Update: {
          anomaly_evidence?: Json
          candidate_snapshot?: Json | null
          confidence_components?: Json
          confidence_score?: number | null
          created_at?: string
          decision_reason?: string | null
          decision_type?: string
          decision_version?: number
          freight_request_id?: string
          heuristic_score?: number | null
          id?: string
          optimization_strategy?: string
          orchestration_run_id?: string
          previous_decision_id?: string | null
          ranking_snapshot?: Json
          recommended_offer_id?: string | null
          requires_review?: boolean
          selected_at?: string | null
          selected_by_member_id?: string | null
          selected_offer_id?: string | null
          selection_mode?: string | null
          subscores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "freight_decisions_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_decisions_orchestration_run_id_fkey"
            columns: ["orchestration_run_id"]
            isOneToOne: true
            referencedRelation: "orchestration_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_decisions_previous_decision_id_fkey"
            columns: ["previous_decision_id"]
            isOneToOne: false
            referencedRelation: "freight_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_decisions_recommended_offer_id_fkey"
            columns: ["recommended_offer_id"]
            isOneToOne: false
            referencedRelation: "carrier_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_decisions_selected_by_member_id_fkey"
            columns: ["selected_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_decisions_selected_offer_id_fkey"
            columns: ["selected_offer_id"]
            isOneToOne: false
            referencedRelation: "carrier_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_requests: {
        Row: {
          available_documents: Json
          budget_currency: string | null
          budget_max: number | null
          cargo_category_id: string
          cargo_description: string | null
          cargo_entry_method: string
          cargo_profile_id: string | null
          cargo_specifications: Json
          cargo_volume_m3: number | null
          cargo_weight_kg: number
          code: string
          confirmed_at: string | null
          confirmed_by_member_id: string | null
          created_at: string
          creation_idempotency_key: string | null
          creation_payload_hash: string | null
          cross_border: boolean
          delivery_deadline: string | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          destination_address: string | null
          destination_city: string
          destination_country: string
          destination_facility_id: string | null
          destination_region: string | null
          draft_version: number
          entry_height_cm: number | null
          entry_length_cm: number | null
          entry_quantity: number | null
          entry_unit_weight_kg: number | null
          entry_width_cm: number | null
          id: string
          is_fragile: boolean
          is_hazardous: boolean
          is_high_value: boolean
          is_oversized: boolean
          is_stackable: boolean
          optimization_strategy: string
          organization_id: string
          origin_address: string | null
          origin_city: string
          origin_country: string
          origin_facility_id: string | null
          origin_region: string | null
          package_count: number | null
          pickup_contact_email: string | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_mode: string
          pickup_window_end: string | null
          pickup_window_start: string | null
          preferred_equipment_code: string | null
          receiver_company: string | null
          receiver_name: string | null
          receiver_phone: string | null
          recipient_contact_email: string | null
          requested_by_member_id: string | null
          required_equipment_code: string | null
          required_pickup: string
          requires_refrigeration: boolean
          selection_objective: string | null
          service_type: string
          special_instructions: string | null
          status: string
          temperature_max_c: number | null
          temperature_min_c: number | null
          transport_mode: string
          units_per_entry: number | null
          updated_at: string
          v2_contract_version: string | null
          v2_creation_payload: Json | null
          v2_snapshot: Json | null
        }
        Insert: {
          available_documents?: Json
          budget_currency?: string | null
          budget_max?: number | null
          cargo_category_id: string
          cargo_description?: string | null
          cargo_entry_method?: string
          cargo_profile_id?: string | null
          cargo_specifications?: Json
          cargo_volume_m3?: number | null
          cargo_weight_kg: number
          code: string
          confirmed_at?: string | null
          confirmed_by_member_id?: string | null
          created_at?: string
          creation_idempotency_key?: string | null
          creation_payload_hash?: string | null
          cross_border?: boolean
          delivery_deadline?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string | null
          destination_city: string
          destination_country: string
          destination_facility_id?: string | null
          destination_region?: string | null
          draft_version?: number
          entry_height_cm?: number | null
          entry_length_cm?: number | null
          entry_quantity?: number | null
          entry_unit_weight_kg?: number | null
          entry_width_cm?: number | null
          id?: string
          is_fragile?: boolean
          is_hazardous?: boolean
          is_high_value?: boolean
          is_oversized?: boolean
          is_stackable?: boolean
          optimization_strategy?: string
          organization_id: string
          origin_address?: string | null
          origin_city: string
          origin_country: string
          origin_facility_id?: string | null
          origin_region?: string | null
          package_count?: number | null
          pickup_contact_email?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_mode?: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          preferred_equipment_code?: string | null
          receiver_company?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          recipient_contact_email?: string | null
          requested_by_member_id?: string | null
          required_equipment_code?: string | null
          required_pickup: string
          requires_refrigeration?: boolean
          selection_objective?: string | null
          service_type?: string
          special_instructions?: string | null
          status?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          units_per_entry?: number | null
          updated_at?: string
          v2_contract_version?: string | null
          v2_creation_payload?: Json | null
          v2_snapshot?: Json | null
        }
        Update: {
          available_documents?: Json
          budget_currency?: string | null
          budget_max?: number | null
          cargo_category_id?: string
          cargo_description?: string | null
          cargo_entry_method?: string
          cargo_profile_id?: string | null
          cargo_specifications?: Json
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number
          code?: string
          confirmed_at?: string | null
          confirmed_by_member_id?: string | null
          created_at?: string
          creation_idempotency_key?: string | null
          creation_payload_hash?: string | null
          cross_border?: boolean
          delivery_deadline?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string | null
          destination_city?: string
          destination_country?: string
          destination_facility_id?: string | null
          destination_region?: string | null
          draft_version?: number
          entry_height_cm?: number | null
          entry_length_cm?: number | null
          entry_quantity?: number | null
          entry_unit_weight_kg?: number | null
          entry_width_cm?: number | null
          id?: string
          is_fragile?: boolean
          is_hazardous?: boolean
          is_high_value?: boolean
          is_oversized?: boolean
          is_stackable?: boolean
          optimization_strategy?: string
          organization_id?: string
          origin_address?: string | null
          origin_city?: string
          origin_country?: string
          origin_facility_id?: string | null
          origin_region?: string | null
          package_count?: number | null
          pickup_contact_email?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_mode?: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          preferred_equipment_code?: string | null
          receiver_company?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          recipient_contact_email?: string | null
          requested_by_member_id?: string | null
          required_equipment_code?: string | null
          required_pickup?: string
          requires_refrigeration?: boolean
          selection_objective?: string | null
          service_type?: string
          special_instructions?: string | null
          status?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          units_per_entry?: number | null
          updated_at?: string
          v2_contract_version?: string | null
          v2_creation_payload?: Json | null
          v2_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_requests_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_confirmed_by_member_id_fkey"
            columns: ["confirmed_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_destination_facility_same_org"
            columns: ["destination_facility_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "freight_requests_organization_cargo_profile_fkey"
            columns: ["organization_id", "cargo_profile_id"]
            isOneToOne: false
            referencedRelation: "organization_cargo_profiles"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "freight_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_origin_facility_same_org"
            columns: ["origin_facility_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "freight_requests_requested_by_member_id_fkey"
            columns: ["requested_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfilment_partners: {
        Row: {
          agreement_valid_from: string
          agreement_valid_until: string
          carrier_id: string
          coverage_evidence: string
          created_at: string
          id: string
          partner_carrier_ref: string | null
          registered_name: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          agreement_valid_from: string
          agreement_valid_until: string
          carrier_id: string
          coverage_evidence: string
          created_at?: string
          id?: string
          partner_carrier_ref?: string | null
          registered_name: string
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          agreement_valid_from?: string
          agreement_valid_until?: string
          carrier_id?: string
          coverage_evidence?: string
          created_at?: string
          id?: string
          partner_carrier_ref?: string | null
          registered_name?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fulfilment_partners_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfilment_partners_partner_carrier_ref_fkey"
            columns: ["partner_carrier_ref"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_account_links: {
        Row: {
          auth_user_id: string
          created_at: string
          expires_at: string
          id: string
          linked_at: string
          linked_by_user_id: string
          oauth_client_id: string
          organization_id: string
          organization_member_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          linked_at?: string
          linked_by_user_id: string
          oauth_client_id: string
          organization_id: string
          organization_member_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scopes: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          linked_at?: string
          linked_by_user_id?: string
          oauth_client_id?: string
          organization_id?: string
          organization_member_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_account_links_member_identity_fk"
            columns: [
              "organization_member_id",
              "organization_id",
              "auth_user_id",
            ]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id", "organization_id", "auth_user_id"]
          },
          {
            foreignKeyName: "mcp_account_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_events: {
        Row: {
          attempt_number: number | null
          carrier_id: string | null
          carrier_service_id: string | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          event_type: string
          execution_status: string | null
          id: string
          idempotency_payload: Json | null
          input_payload: Json | null
          navigation_url: string | null
          orchestration_run_id: string
          output_payload: Json | null
          persisted_entity_id: string | null
          persisted_entity_type: string | null
          provider_url: string | null
          schema_version: string | null
          started_at: string | null
          status: string
          technical_error: Json | null
          tool_call_id: string | null
          tool_name: string | null
        }
        Insert: {
          attempt_number?: number | null
          carrier_id?: string | null
          carrier_service_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type: string
          execution_status?: string | null
          id?: string
          idempotency_payload?: Json | null
          input_payload?: Json | null
          navigation_url?: string | null
          orchestration_run_id: string
          output_payload?: Json | null
          persisted_entity_id?: string | null
          persisted_entity_type?: string | null
          provider_url?: string | null
          schema_version?: string | null
          started_at?: string | null
          status?: string
          technical_error?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
        }
        Update: {
          attempt_number?: number | null
          carrier_id?: string | null
          carrier_service_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          execution_status?: string | null
          id?: string
          idempotency_payload?: Json | null
          input_payload?: Json | null
          navigation_url?: string | null
          orchestration_run_id?: string
          output_payload?: Json | null
          persisted_entity_id?: string | null
          persisted_entity_type?: string | null
          provider_url?: string | null
          schema_version?: string | null
          started_at?: string | null
          status?: string
          technical_error?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_events_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_events_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_events_orchestration_run_id_fkey"
            columns: ["orchestration_run_id"]
            isOneToOne: false
            referencedRelation: "orchestration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_runs: {
        Row: {
          candidate_snapshot: Json
          completed_at: string | null
          created_at: string
          created_by_member_id: string | null
          error_code: string | null
          error_message: string | null
          freight_request_id: string
          id: string
          idempotency_key: string | null
          previous_run_id: string | null
          result_snapshot: Json | null
          run_type: string
          started_at: string
          status: string
        }
        Insert: {
          candidate_snapshot?: Json
          completed_at?: string | null
          created_at?: string
          created_by_member_id?: string | null
          error_code?: string | null
          error_message?: string | null
          freight_request_id: string
          id?: string
          idempotency_key?: string | null
          previous_run_id?: string | null
          result_snapshot?: Json | null
          run_type: string
          started_at?: string
          status?: string
        }
        Update: {
          candidate_snapshot?: Json
          completed_at?: string | null
          created_at?: string
          created_by_member_id?: string | null
          error_code?: string | null
          error_message?: string | null
          freight_request_id?: string
          id?: string
          idempotency_key?: string | null
          previous_run_id?: string | null
          result_snapshot?: Json | null
          run_type?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestration_runs_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_runs_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_runs_previous_run_id_fkey"
            columns: ["previous_run_id"]
            isOneToOne: false
            referencedRelation: "orchestration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_cargo_profiles: {
        Row: {
          active: boolean
          cargo_category_id: string
          created_at: string
          default_entry_method: string
          default_requirements: Json
          id: string
          organization_id: string
          preferred_equipment: string | null
          preferred_vehicle_classes: Json
          priority: number
          profile_name: string
          requirements: Json
          typical_entry_quantity: number | null
          typical_height_cm: number | null
          typical_length_cm: number | null
          typical_unit_weight_kg: number | null
          typical_units: Json
          typical_units_per_entry: number
          typical_width_cm: number | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          cargo_category_id: string
          created_at?: string
          default_entry_method: string
          default_requirements?: Json
          id?: string
          organization_id: string
          preferred_equipment?: string | null
          preferred_vehicle_classes?: Json
          priority?: number
          profile_name: string
          requirements?: Json
          typical_entry_quantity?: number | null
          typical_height_cm?: number | null
          typical_length_cm?: number | null
          typical_unit_weight_kg?: number | null
          typical_units?: Json
          typical_units_per_entry?: number
          typical_width_cm?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          cargo_category_id?: string
          created_at?: string
          default_entry_method?: string
          default_requirements?: Json
          id?: string
          organization_id?: string
          preferred_equipment?: string | null
          preferred_vehicle_classes?: Json
          priority?: number
          profile_name?: string
          requirements?: Json
          typical_entry_quantity?: number | null
          typical_height_cm?: number | null
          typical_length_cm?: number | null
          typical_unit_weight_kg?: number | null
          typical_units?: Json
          typical_units_per_entry?: number
          typical_width_cm?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_cargo_profiles_cargo_category_id_fkey"
            columns: ["cargo_category_id"]
            isOneToOne: false
            referencedRelation: "cargo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_cargo_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          auth_user_id: string
          corporate_email: string
          created_at: string
          display_name: string
          id: string
          organization_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          corporate_email: string
          created_at?: string
          display_name: string
          id?: string
          organization_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          corporate_email?: string
          created_at?: string
          display_name?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_preferences: {
        Row: {
          allow_auto_booking: boolean
          allow_auto_recovery: boolean
          anomaly_threshold_pct: number
          billing_mode: string
          budget_default: number | null
          confidence_threshold: number
          created_at: string
          default_strategy: string
          id: string
          max_pickup_wait_hours: number
          maximum_wait_minutes: number | null
          objective: string | null
          organization_id: string
          preferred_carrier_id: string | null
          preferred_equipment: string | null
          preferred_mode: string | null
          preferred_vehicle_brand: string | null
          selection_mode: string
          updated_at: string
          usual_budget: Json | null
          valid_until: string | null
          version: number
        }
        Insert: {
          allow_auto_booking?: boolean
          allow_auto_recovery?: boolean
          anomaly_threshold_pct?: number
          billing_mode?: string
          budget_default?: number | null
          confidence_threshold?: number
          created_at?: string
          default_strategy?: string
          id?: string
          max_pickup_wait_hours?: number
          maximum_wait_minutes?: number | null
          objective?: string | null
          organization_id: string
          preferred_carrier_id?: string | null
          preferred_equipment?: string | null
          preferred_mode?: string | null
          preferred_vehicle_brand?: string | null
          selection_mode?: string
          updated_at?: string
          usual_budget?: Json | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          allow_auto_booking?: boolean
          allow_auto_recovery?: boolean
          anomaly_threshold_pct?: number
          billing_mode?: string
          budget_default?: number | null
          confidence_threshold?: number
          created_at?: string
          default_strategy?: string
          id?: string
          max_pickup_wait_hours?: number
          maximum_wait_minutes?: number | null
          objective?: string | null
          organization_id?: string
          preferred_carrier_id?: string | null
          preferred_equipment?: string | null
          preferred_mode?: string | null
          preferred_vehicle_brand?: string | null
          selection_mode?: string
          updated_at?: string
          usual_budget?: Json | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_preferences_preferred_carrier_id_fkey"
            columns: ["preferred_carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_identifier_type: string | null
          business_identifier_value: string | null
          code: string
          corporate_email: string | null
          corporate_phone: string | null
          country_code: string | null
          created_at: string
          default_currency: string
          id: string
          legal_name: string | null
          name: string
          status: string
          updated_at: string
          v2_command_managed: boolean
          verified_corporate_email: string | null
          version: number
        }
        Insert: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code: string
          corporate_email?: string | null
          corporate_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          legal_name?: string | null
          name: string
          status?: string
          updated_at?: string
          v2_command_managed?: boolean
          verified_corporate_email?: string | null
          version?: number
        }
        Update: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code?: string
          corporate_email?: string | null
          corporate_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          legal_name?: string | null
          name?: string
          status?: string
          updated_at?: string
          v2_command_managed?: boolean
          verified_corporate_email?: string | null
          version?: number
        }
        Relationships: []
      }
      repositioning_blocks: {
        Row: {
          capacity_calendar_id: string
          carrier_id: string
          carrier_service_id: string | null
          created_at: string
          ends_at: string
          estimated_travel_seconds: number | null
          fleet_managed: boolean
          id: string
          next_pickup: Json | null
          origin: Json | null
          reason: string
          source: string | null
          starts_at: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          capacity_calendar_id: string
          carrier_id: string
          carrier_service_id?: string | null
          created_at?: string
          ends_at: string
          estimated_travel_seconds?: number | null
          fleet_managed?: boolean
          id?: string
          next_pickup?: Json | null
          origin?: Json | null
          reason: string
          source?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          capacity_calendar_id?: string
          carrier_id?: string
          carrier_service_id?: string | null
          created_at?: string
          ends_at?: string
          estimated_travel_seconds?: number | null
          fleet_managed?: boolean
          id?: string
          next_pickup?: Json | null
          origin?: Json | null
          reason?: string
          source?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "repositioning_blocks_capacity_calendar_id_fkey"
            columns: ["capacity_calendar_id"]
            isOneToOne: false
            referencedRelation: "capacity_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositioning_blocks_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositioning_blocks_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositioning_blocks_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
        ]
      }
      scheduled_maintenances: {
        Row: {
          carrier_id: string
          carrier_service_id: string | null
          created_at: string
          ends_at: string
          fleet_managed: boolean
          id: string
          kind: string | null
          reason: string
          source: string | null
          starts_at: string
          status: string
          transport_asset_id: string
          updated_at: string
          version: number
        }
        Insert: {
          carrier_id: string
          carrier_service_id?: string | null
          created_at?: string
          ends_at: string
          fleet_managed?: boolean
          id?: string
          kind?: string | null
          reason: string
          source?: string | null
          starts_at: string
          status?: string
          transport_asset_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          carrier_id?: string
          carrier_service_id?: string | null
          created_at?: string
          ends_at?: string
          fleet_managed?: boolean
          id?: string
          kind?: string | null
          reason?: string
          source?: string | null
          starts_at?: string
          status?: string
          transport_asset_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_maintenances_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_maintenances_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_maintenances_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "scheduled_maintenances_transport_asset_id_fkey"
            columns: ["transport_asset_id"]
            isOneToOne: false
            referencedRelation: "transport_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          active: boolean
          area_role: string
          carrier_service_id: string
          city: string | null
          country_code: string
          coverage: string
          created_at: string
          evidence_reference: string | null
          fulfilment_partner_id: string | null
          fulfilment_source: string
          geometry: Json | null
          granularity: string
          id: string
          partner_reference: string | null
          postal_code: string | null
          region_code: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          verified_at: string | null
          version: number
        }
        Insert: {
          active?: boolean
          area_role: string
          carrier_service_id: string
          city?: string | null
          country_code: string
          coverage: string
          created_at?: string
          evidence_reference?: string | null
          fulfilment_partner_id?: string | null
          fulfilment_source: string
          geometry?: Json | null
          granularity: string
          id?: string
          partner_reference?: string | null
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          area_role?: string
          carrier_service_id?: string
          city?: string | null
          country_code?: string
          coverage?: string
          created_at?: string
          evidence_reference?: string | null
          fulfilment_partner_id?: string | null
          fulfilment_source?: string
          geometry?: Json | null
          granularity?: string
          id?: string
          partner_reference?: string | null
          postal_code?: string | null
          region_code?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_areas_fulfilment_partner_id_fkey"
            columns: ["fulfilment_partner_id"]
            isOneToOne: false
            referencedRelation: "fulfilment_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      service_lanes: {
        Row: {
          active: boolean
          carrier_service_id: string
          created_at: string
          cross_border_prohibited: boolean
          cross_border_prohibition_reference: string | null
          cross_border_review_required: boolean
          delivery_area_id: string
          evidence_reference: string | null
          id: string
          lane_kind: string
          pickup_area_id: string
          planned_transit_minutes: number | null
          transit_provenance_status: string
          transport_mode: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          verified_at: string | null
          version: number
        }
        Insert: {
          active?: boolean
          carrier_service_id: string
          created_at?: string
          cross_border_prohibited?: boolean
          cross_border_prohibition_reference?: string | null
          cross_border_review_required?: boolean
          delivery_area_id: string
          evidence_reference?: string | null
          id?: string
          lane_kind?: string
          pickup_area_id: string
          planned_transit_minutes?: number | null
          transit_provenance_status?: string
          transport_mode?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          carrier_service_id?: string
          created_at?: string
          cross_border_prohibited?: boolean
          cross_border_prohibition_reference?: string | null
          cross_border_review_required?: boolean
          delivery_area_id?: string
          evidence_reference?: string | null
          id?: string
          lane_kind?: string
          pickup_area_id?: string
          planned_transit_minutes?: number | null
          transit_provenance_status?: string
          transport_mode?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_lanes_carrier_service_id_fkey"
            columns: ["carrier_service_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_lanes_delivery_same_service"
            columns: ["delivery_area_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id", "carrier_service_id"]
          },
          {
            foreignKeyName: "service_lanes_pickup_same_service"
            columns: ["pickup_area_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "service_areas"
            referencedColumns: ["id", "carrier_service_id"]
          },
        ]
      }
      transport_assets: {
        Row: {
          active: boolean
          asset_role: string
          axle_config: string | null
          body_type: string | null
          brand: string | null
          carrier_id: string
          carrier_service_id: string
          code: string
          condition_reason: string | null
          created_at: string
          equipment_code: string
          evidence: string | null
          fleet_managed: boolean
          fulfilment_partner_id: string | null
          fulfilment_source: string
          gross_weight_limit_kg: number | null
          home_depot_id: string | null
          id: string
          max_volume_m3: number | null
          max_weight_kg: number | null
          mode: string
          model: string | null
          odometer_km: number | null
          operating_status: string
          plate: string | null
          registered_at: string | null
          registration_code: string | null
          updated_at: string
          usable_dimensions: Json | null
          variant: string | null
          version: number
        }
        Insert: {
          active?: boolean
          asset_role?: string
          axle_config?: string | null
          body_type?: string | null
          brand?: string | null
          carrier_id: string
          carrier_service_id: string
          code: string
          condition_reason?: string | null
          created_at?: string
          equipment_code: string
          evidence?: string | null
          fleet_managed?: boolean
          fulfilment_partner_id?: string | null
          fulfilment_source?: string
          gross_weight_limit_kg?: number | null
          home_depot_id?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          mode?: string
          model?: string | null
          odometer_km?: number | null
          operating_status?: string
          plate?: string | null
          registered_at?: string | null
          registration_code?: string | null
          updated_at?: string
          usable_dimensions?: Json | null
          variant?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          asset_role?: string
          axle_config?: string | null
          body_type?: string | null
          brand?: string | null
          carrier_id?: string
          carrier_service_id?: string
          code?: string
          condition_reason?: string | null
          created_at?: string
          equipment_code?: string
          evidence?: string | null
          fleet_managed?: boolean
          fulfilment_partner_id?: string | null
          fulfilment_source?: string
          gross_weight_limit_kg?: number | null
          home_depot_id?: string | null
          id?: string
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          mode?: string
          model?: string | null
          odometer_km?: number | null
          operating_status?: string
          plate?: string | null
          registered_at?: string | null
          registration_code?: string | null
          updated_at?: string
          usable_dimensions?: Json | null
          variant?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fleet_home_depot"
            columns: ["home_depot_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_depots"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "transport_assets_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_assets_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "transport_assets_fleet_service"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "transport_assets_fulfilment_partner_id_fkey"
            columns: ["fulfilment_partner_id"]
            isOneToOne: false
            referencedRelation: "fulfilment_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_executions: {
        Row: {
          actual_completed_at: string | null
          actual_started_at: string | null
          carrier_id: string
          carrier_service_id: string
          created_at: string
          freight_request_id: string
          id: string
          last_known_position: Json | null
          organization_id: string
          planned_ends_at: string
          planned_starts_at: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          actual_completed_at?: string | null
          actual_started_at?: string | null
          carrier_id: string
          carrier_service_id: string
          created_at?: string
          freight_request_id: string
          id?: string
          last_known_position?: Json | null
          organization_id: string
          planned_ends_at: string
          planned_starts_at: string
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          actual_completed_at?: string | null
          actual_started_at?: string | null
          carrier_id?: string
          carrier_service_id?: string
          created_at?: string
          freight_request_id?: string
          id?: string
          last_known_position?: Json | null
          organization_id?: string
          planned_ends_at?: string
          planned_starts_at?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transport_executions_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_executions_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "transport_executions_freight_request_id_fkey"
            columns: ["freight_request_id"]
            isOneToOne: false
            referencedRelation: "freight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          capacity_committed: Json
          capacity_reservation_id: string | null
          carrier_id: string
          carrier_service_id: string
          created_at: string
          ends_at: string
          evidence: Json | null
          execution_id: string
          id: string
          starts_at: string
          status: string
          transport_asset_id: string
          updated_at: string
          vehicle_combination_id: string | null
          version: number
        }
        Insert: {
          capacity_committed: Json
          capacity_reservation_id?: string | null
          carrier_id: string
          carrier_service_id: string
          created_at?: string
          ends_at: string
          evidence?: Json | null
          execution_id: string
          id?: string
          starts_at: string
          status: string
          transport_asset_id: string
          updated_at?: string
          vehicle_combination_id?: string | null
          version?: number
        }
        Update: {
          capacity_committed?: Json
          capacity_reservation_id?: string | null
          carrier_id?: string
          carrier_service_id?: string
          created_at?: string
          ends_at?: string
          evidence?: Json | null
          execution_id?: string
          id?: string
          starts_at?: string
          status?: string
          transport_asset_id?: string
          updated_at?: string
          vehicle_combination_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_capacity_reservation_id_fkey"
            columns: ["capacity_reservation_id"]
            isOneToOne: false
            referencedRelation: "capacity_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
          {
            foreignKeyName: "vehicle_assignments_execution_id_carrier_id_carrier_servic_fkey"
            columns: ["execution_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "transport_executions"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
          {
            foreignKeyName: "vehicle_assignments_transport_asset_id_carrier_id_carrier__fkey"
            columns: ["transport_asset_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "transport_assets"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_combination_id_carrier_id_carr_fkey"
            columns: [
              "vehicle_combination_id",
              "carrier_id",
              "carrier_service_id",
            ]
            isOneToOne: false
            referencedRelation: "vehicle_combinations"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
        ]
      }
      vehicle_combination_assets: {
        Row: {
          active: boolean
          carrier_id: string
          carrier_service_id: string
          combination_id: string
          ends_at: string | null
          starts_at: string | null
          transport_asset_id: string
        }
        Insert: {
          active: boolean
          carrier_id: string
          carrier_service_id: string
          combination_id: string
          ends_at?: string | null
          starts_at?: string | null
          transport_asset_id: string
        }
        Update: {
          active?: boolean
          carrier_id?: string
          carrier_service_id?: string
          combination_id?: string
          ends_at?: string | null
          starts_at?: string | null
          transport_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_combination_assets_combination_id_carrier_id_carri_fkey"
            columns: ["combination_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "vehicle_combinations"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
          {
            foreignKeyName: "vehicle_combination_assets_transport_asset_id_carrier_id_c_fkey"
            columns: ["transport_asset_id", "carrier_id", "carrier_service_id"]
            isOneToOne: false
            referencedRelation: "transport_assets"
            referencedColumns: ["id", "carrier_id", "carrier_service_id"]
          },
        ]
      }
      vehicle_combinations: {
        Row: {
          carrier_id: string
          carrier_service_id: string
          combined_tare_kg: number | null
          compatibility_evidence: Json | null
          configuration: string
          created_at: string
          ends_at: string | null
          evidence: Json
          gross_weight_limit_kg: number | null
          id: string
          kind: string
          starts_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          carrier_id: string
          carrier_service_id: string
          combined_tare_kg?: number | null
          compatibility_evidence?: Json | null
          configuration: string
          created_at?: string
          ends_at?: string | null
          evidence: Json
          gross_weight_limit_kg?: number | null
          id?: string
          kind: string
          starts_at?: string | null
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          carrier_id?: string
          carrier_service_id?: string
          combined_tare_kg?: number | null
          compatibility_evidence?: Json | null
          configuration?: string
          created_at?: string
          ends_at?: string | null
          evidence?: Json
          gross_weight_limit_kg?: number | null
          id?: string
          kind?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_combinations_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_combinations_carrier_service_id_carrier_id_fkey"
            columns: ["carrier_service_id", "carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_services"
            referencedColumns: ["id", "carrier_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          capacity_kg: number
          carrier_id: string
          code: string
          created_at: string
          id: string
          license_plate: string | null
          location: string | null
          model: string | null
          status: string
          supports_hazardous: boolean
          supports_oversized: boolean
          supports_refrigerated: boolean
          updated_at: string
          vehicle_type: string | null
          volume_m3: number | null
        }
        Insert: {
          brand?: string | null
          capacity_kg: number
          carrier_id: string
          code: string
          created_at?: string
          id?: string
          license_plate?: string | null
          location?: string | null
          model?: string | null
          status?: string
          supports_hazardous?: boolean
          supports_oversized?: boolean
          supports_refrigerated?: boolean
          updated_at?: string
          vehicle_type?: string | null
          volume_m3?: number | null
        }
        Update: {
          brand?: string | null
          capacity_kg?: number
          carrier_id?: string
          code?: string
          created_at?: string
          id?: string
          license_plate?: string | null
          location?: string | null
          model?: string | null
          status?: string
          supports_hazardous?: boolean
          supports_oversized?: boolean
          supports_refrigerated?: boolean
          updated_at?: string
          vehicle_type?: string | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_booking_bridge_identity: {
        Args: {
          p_authorization: Database["public"]["Tables"]["booking_authorizations"]["Row"]
          p_canonical_payload: Json
          p_tool_name: string
        }
        Returns: undefined
      }
      command_v2_catalog: {
        Args: {
          p_carrier_id: string | null
          p_expected_version: number | null
          p_id: string | null
          p_idempotency_key: string
          p_kind: string
          p_member_id: string
          p_organization_id: string
          p_service_id: string | null
          p_value: Json
        }
        Returns: Json
      }
      command_v2_facility: {
        Args: {
          p_expected_version: number | null
          p_facility_id: string | null
          p_idempotency_key: string
          p_member_id: string
          p_organization_id: string
          p_value: Json
        }
        Returns: Json
      }
      command_v2_freight_request: {
        Args: {
          p_action: string
          p_expected_version: number
          p_idempotency_key: string
          p_member_id: string
          p_organization_id: string
          p_request_id: string
          p_value: Json
        }
        Returns: Json
      }
      command_v2_organization: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_member_id: string
          p_organization_id: string
          p_value: Json
        }
        Returns: Json
      }
      create_v2_freight_request: {
        Args: {
          p_idempotency_key: string
          p_member_id: string
          p_organization_id: string
          p_payload: Json
          p_payload_hash: string
        }
        Returns: Json
      }
      persist_balanced_decision: {
        Args: {
          p_anomaly_evidence: Json
          p_candidate_snapshot: Json
          p_confidence_components: Json
          p_confidence_score: number
          p_freight_request_id: string
          p_orchestration_run_id: string
          p_ranking: Json
          p_recommended_offer_id: string
          p_requires_review: boolean
          p_subscores: Json
        }
        Returns: {
          decision_id: string
          run_status: string
        }[]
      }
      prepare_booking_authorization: {
        Args: {
          p_booking_idempotency_key: string
          p_freight_request_id: string
          p_offer_id: string
          p_selected_by_member_id: string
          p_selection_mode: string
        }
        Returns: {
          authorization_kind: string
          authorization_reference: string
          booking_idempotency_key: string
          carrier_id: string
          deduplicated: boolean
          expires_at: string
          freight_decision_id: string
          freight_request_id: string
          matching_service_id: string
          offer_id: string
          provider_offer_reference: string
          selection_mode: string
        }[]
      }
      prepare_booking_recovery: {
        Args: {
          p_booking_idempotency_key: string
          p_replacement_offer_id: string
          p_replaces_booking_id: string
          p_selected_by_member_id: string
          p_selection_mode: string
        }
        Returns: {
          authorization_kind: string
          authorization_reference: string
          booking_idempotency_key: string
          carrier_id: string
          deduplicated: boolean
          expires_at: string
          freight_decision_id: string
          freight_request_id: string
          matching_service_id: string
          offer_id: string
          provider_offer_reference: string
          selection_mode: string
        }[]
      }
      read_v2_catalog: {
        Args: {
          p_carrier_id: string | null
          p_id: string | null
          p_kind: string
          p_limit: number
          p_member_id: string
          p_offset: number
          p_organization_id: string
          p_service_id: string | null
        }
        Returns: Json
      }
      record_provider_booking_result: {
        Args: {
          p_authorization_reference: string
          p_bridge_call_id: string
          p_canonical_payload: Json
          p_payment_required: boolean
          p_payment_url: string
          p_provider_booking_status: string
          p_provider_idempotent_replay: boolean
          p_provider_reference: string
          p_provider_response_deadline: string
        }
        Returns: {
          booking_id: string
          deduplicated: boolean
          result_status: string
        }[]
      }
      record_provider_booking_status: {
        Args: {
          p_authorization_reference: string
          p_booking_id: string
          p_bridge_call_id: string
          p_canonical_payload: Json
          p_events: Json
          p_payment_status: string
          p_provider_booking_status: string
          p_provider_reference: string
        }
        Returns: {
          booking_id: string
          deduplicated: boolean
          result_status: string
        }[]
      }
      record_provider_result:
        | {
            Args: {
              p_attempt_number: number
              p_cargomesh_origin: string
              p_carrier_id: string
              p_carrier_service_id: string
              p_completed_at: string
              p_duration_ms: number
              p_execution_status: string
              p_freight_request_id: string
              p_navigation_url: string
              p_orchestration_run_id: string
              p_provider_url: string
              p_schema_version: string
              p_started_at: string
              p_technical_error: Json
              p_tool_call_id: string
              p_tool_input: Json
              p_tool_name: string
              p_tool_output: Json
            }
            Returns: {
              deduplicated: boolean
              event_id: string
              record_id: string
              record_type: string
              result_status: string
            }[]
          }
        | {
            Args: {
              p_carrier_id: string
              p_completed_at: string
              p_freight_request_id: string
              p_orchestration_run_id: string
              p_provider_url: string
              p_schema_version: string
              p_started_at: string
              p_tool_call_id: string
              p_tool_input: Json
              p_tool_name: string
              p_tool_output: Json
            }
            Returns: {
              deduplicated: boolean
              event_id: string
              record_id: string
              record_type: string
              result_status: string
            }[]
          }
      reset_demo_booking_runtime: {
        Args: { p_freight_request_id: string }
        Returns: {
          deleted_authorizations: number
          deleted_bookings: number
          freight_request_id: string
        }[]
      }
      start_orchestration_run: {
        Args: {
          p_candidate_snapshot: Json
          p_created_by_member_id: string
          p_freight_request_id: string
          p_idempotency_key: string
        }
        Returns: {
          candidate_snapshot: Json
          deduplicated: boolean
          freight_request_id: string
          orchestration_run_id: string
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

