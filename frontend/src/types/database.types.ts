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
          suggested_requirements: Json
          updated_at: string
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
          suggested_requirements?: Json
          updated_at?: string
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
          suggested_requirements?: Json
          updated_at?: string
        }
        Relationships: []
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
          destination_country: string
          destination_region: string | null
          id: string
          max_capacity_kg: number
          max_volume_m3: number | null
          origin_country: string
          origin_region: string | null
          provider_service_code: string | null
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
        }
        Insert: {
          active?: boolean
          carrier_id: string
          created_at?: string
          customs_coordination_included?: boolean
          destination_country: string
          destination_region?: string | null
          id?: string
          max_capacity_kg: number
          max_volume_m3?: number | null
          origin_country: string
          origin_region?: string | null
          provider_service_code?: string | null
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
        }
        Update: {
          active?: boolean
          carrier_id?: string
          created_at?: string
          customs_coordination_included?: boolean
          destination_country?: string
          destination_region?: string | null
          id?: string
          max_capacity_kg?: number
          max_volume_m3?: number | null
          origin_country?: string
          origin_region?: string | null
          provider_service_code?: string | null
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
          code: string
          created_at: string
          id: string
          name: string
          provider_type: string
          provider_url: string | null
          status: string
          supports_webmcp: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          provider_type?: string
          provider_url?: string | null
          status?: string
          supports_webmcp?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          provider_type?: string
          provider_url?: string | null
          status?: string
          supports_webmcp?: boolean
          updated_at?: string
        }
        Relationships: []
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
          cross_border: boolean
          delivery_deadline: string | null
          destination_address: string | null
          destination_city: string
          destination_country: string
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
          package_count: number | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_mode: string
          pickup_window_end: string | null
          pickup_window_start: string | null
          receiver_company: string | null
          receiver_name: string | null
          receiver_phone: string | null
          requested_by_member_id: string | null
          required_pickup: string
          requires_refrigeration: boolean
          service_type: string
          special_instructions: string | null
          status: string
          temperature_max_c: number | null
          temperature_min_c: number | null
          transport_mode: string
          units_per_entry: number | null
          updated_at: string
        }
        Insert: {
          available_documents?: Json
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
          cross_border?: boolean
          delivery_deadline?: string | null
          destination_address?: string | null
          destination_city: string
          destination_country: string
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
          package_count?: number | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_mode?: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          receiver_company?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          requested_by_member_id?: string | null
          required_pickup: string
          requires_refrigeration?: boolean
          service_type?: string
          special_instructions?: string | null
          status?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          units_per_entry?: number | null
          updated_at?: string
        }
        Update: {
          available_documents?: Json
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
          cross_border?: boolean
          delivery_deadline?: string | null
          destination_address?: string | null
          destination_city?: string
          destination_country?: string
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
          package_count?: number | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_mode?: string
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          receiver_company?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          requested_by_member_id?: string | null
          required_pickup?: string
          requires_refrigeration?: boolean
          service_type?: string
          special_instructions?: string | null
          status?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_mode?: string
          units_per_entry?: number | null
          updated_at?: string
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
            foreignKeyName: "freight_requests_requested_by_member_id_fkey"
            columns: ["requested_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
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
          execution_status: string | null
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
          execution_status?: string | null
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
          execution_status?: string | null
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
          preferred_vehicle_classes: Json
          priority: number
          profile_name: string
          typical_entry_quantity: number | null
          typical_height_cm: number | null
          typical_length_cm: number | null
          typical_unit_weight_kg: number | null
          typical_units_per_entry: number
          typical_width_cm: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cargo_category_id: string
          created_at?: string
          default_entry_method: string
          default_requirements?: Json
          id?: string
          organization_id: string
          preferred_vehicle_classes?: Json
          priority?: number
          profile_name: string
          typical_entry_quantity?: number | null
          typical_height_cm?: number | null
          typical_length_cm?: number | null
          typical_unit_weight_kg?: number | null
          typical_units_per_entry?: number
          typical_width_cm?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cargo_category_id?: string
          created_at?: string
          default_entry_method?: string
          default_requirements?: Json
          id?: string
          organization_id?: string
          preferred_vehicle_classes?: Json
          priority?: number
          profile_name?: string
          typical_entry_quantity?: number | null
          typical_height_cm?: number | null
          typical_length_cm?: number | null
          typical_unit_weight_kg?: number | null
          typical_units_per_entry?: number
          typical_width_cm?: number | null
          updated_at?: string
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
          organization_id: string
          preferred_carrier_id: string | null
          preferred_vehicle_brand: string | null
          selection_mode: string
          updated_at: string
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
          organization_id: string
          preferred_carrier_id?: string | null
          preferred_vehicle_brand?: string | null
          selection_mode?: string
          updated_at?: string
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
          organization_id?: string
          preferred_carrier_id?: string | null
          preferred_vehicle_brand?: string | null
          selection_mode?: string
          updated_at?: string
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
          corporate_phone: string | null
          country_code: string | null
          created_at: string
          default_currency: string
          id: string
          legal_name: string | null
          name: string
          status: string
          updated_at: string
          verified_corporate_email: string | null
        }
        Insert: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code: string
          corporate_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          legal_name?: string | null
          name: string
          status?: string
          updated_at?: string
          verified_corporate_email?: string | null
        }
        Update: {
          business_identifier_type?: string | null
          business_identifier_value?: string | null
          code?: string
          corporate_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string
          id?: string
          legal_name?: string | null
          name?: string
          status?: string
          updated_at?: string
          verified_corporate_email?: string | null
        }
        Relationships: []
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
      record_provider_result: {
        Args: {
          p_attempt_number: number
          p_carrier_id: string
          p_carrier_service_id: string
          p_cargomesh_origin: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
