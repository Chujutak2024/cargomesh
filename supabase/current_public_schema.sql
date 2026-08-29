


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."booking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "provider_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "provider_booking_status" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_events_provider_status_check" CHECK ((("provider_booking_status" IS NULL) OR ("provider_booking_status" = ANY (ARRAY['PENDING_PROVIDER_CONFIRMATION'::"text", 'CONFIRMED'::"text", 'REJECTED'::"text", 'EXPIRED'::"text", 'IN_TRANSIT'::"text", 'DELIVERED'::"text", 'CANCELLED'::"text"]))))
);


ALTER TABLE "public"."booking_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "freight_request_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "provider_reference" "text",
    "status" "text" DEFAULT 'PENDING_PROVIDER_CONFIRMATION'::"text" NOT NULL,
    "booked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "freight_decision_id" "uuid" NOT NULL,
    "provider_booking_status" "text" DEFAULT 'PENDING_PROVIDER_CONFIRMATION'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "provider_response_deadline" timestamp with time zone NOT NULL,
    "authorization_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "selection_mode" "text" DEFAULT 'ASSISTED'::"text" NOT NULL,
    "selected_by_member_id" "uuid",
    "replaces_booking_id" "uuid",
    "payment_mode" "text" DEFAULT 'INVOICE'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'NOT_REQUIRED'::"text" NOT NULL,
    "payment_provider_reference" "text",
    "payment_url" "text",
    "confirmed_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookings_payment_mode_check" CHECK (("payment_mode" = ANY (ARRAY['CORPORATE_ACCOUNT'::"text", 'INVOICE'::"text", 'EXTERNAL_CHECKOUT'::"text", 'TOKENIZED_PAYMENT_METHOD'::"text"]))),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['NOT_REQUIRED'::"text", 'PENDING'::"text", 'PAID'::"text", 'FAILED'::"text", 'REFUNDED'::"text"]))),
    CONSTRAINT "bookings_provider_status_check" CHECK (("provider_booking_status" = ANY (ARRAY['PENDING_PROVIDER_CONFIRMATION'::"text", 'CONFIRMED'::"text", 'REJECTED'::"text", 'EXPIRED'::"text", 'IN_TRANSIT'::"text", 'DELIVERED'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "bookings_selection_mode_check" CHECK (("selection_mode" = ANY (ARRAY['ASSISTED'::"text", 'SMART_AUTO'::"text"]))),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['PENDING_PROVIDER_CONFIRMATION'::"text", 'CONFIRMED'::"text", 'REJECTED'::"text", 'EXPIRED'::"text", 'IN_TRANSIT'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text", 'DISRUPTED'::"text", 'REBOOKED'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargo_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true NOT NULL,
    "recommended_entry_methods" "jsonb" DEFAULT '["TOTAL_WEIGHT"]'::"jsonb" NOT NULL,
    "intake_specification_schema" "jsonb" DEFAULT '{"fields": []}'::"jsonb" NOT NULL,
    "suggested_requirements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recommended_vehicle_classes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cargo_categories_entry_methods_array" CHECK (("jsonb_typeof"("recommended_entry_methods") = 'array'::"text")),
    CONSTRAINT "cargo_categories_intake_schema_object" CHECK (("jsonb_typeof"("intake_specification_schema") = 'object'::"text")),
    CONSTRAINT "cargo_categories_requirements_object" CHECK (("jsonb_typeof"("suggested_requirements") = 'object'::"text")),
    CONSTRAINT "cargo_categories_vehicle_classes_array" CHECK (("jsonb_typeof"("recommended_vehicle_classes") = 'array'::"text"))
);


ALTER TABLE "public"."cargo_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "cargo_category_id" "uuid",
    "transport_mode" "text" DEFAULT 'ROAD'::"text" NOT NULL,
    "origin_country" "text" NOT NULL,
    "origin_city" "text" NOT NULL,
    "destination_country" "text" NOT NULL,
    "destination_city" "text" NOT NULL,
    "completed_freight_requests" integer DEFAULT 0 NOT NULL,
    "successful_freight_requests" integer DEFAULT 0 NOT NULL,
    "success_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "avg_cost" numeric(14,2),
    "avg_delay_hours" numeric(10,2),
    "cancellation_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid",
    "route_completed_freight_requests" integer DEFAULT 0 NOT NULL,
    "average_route_cost" numeric(12,2),
    "organization_completed_freight_requests" integer DEFAULT 0 NOT NULL,
    "organization_successful_freight_requests" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "carrier_metrics_counts_nonnegative" CHECK ((("completed_freight_requests" >= 0) AND ("successful_freight_requests" >= 0) AND ("route_completed_freight_requests" >= 0) AND ("organization_completed_freight_requests" >= 0) AND ("organization_successful_freight_requests" >= 0))),
    CONSTRAINT "carrier_metrics_success_rate_range" CHECK ((("success_rate" >= (0)::numeric) AND ("success_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."carrier_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "freight_request_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "vehicle_id" "uuid",
    "offer_reference" "text",
    "transport_mode" "text" DEFAULT 'ROAD'::"text" NOT NULL,
    "service_type" "text" DEFAULT 'FTL'::"text" NOT NULL,
    "price" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "estimated_pickup" timestamp with time zone NOT NULL,
    "estimated_delivery" timestamp with time zone NOT NULL,
    "available_capacity_kg" numeric(14,2) NOT NULL,
    "available_volume_m3" numeric(14,3),
    "valid_until" timestamp with time zone NOT NULL,
    "compatibility_status" "text" DEFAULT 'ELIGIBLE'::"text" NOT NULL,
    "compatibility_notes" "jsonb",
    "status" "text" DEFAULT 'RECEIVED'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "orchestration_run_id" "uuid" NOT NULL,
    "tool_call_id" "text" NOT NULL,
    "provider_offer_reference" "text" NOT NULL,
    "quote_breakdown" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transit_hours" numeric(10,2) NOT NULL,
    "availability_class" "text" NOT NULL,
    "availability_score" numeric(5,2) NOT NULL,
    "reliability_score" numeric(5,2) NOT NULL,
    "route_operations" integer DEFAULT 0 NOT NULL,
    "organization_history_score" numeric(5,2) DEFAULT 50 NOT NULL,
    "final_score" numeric(8,4),
    "supersedes_offer_id" "uuid",
    CONSTRAINT "carrier_offers_compatibility_status_check" CHECK (("compatibility_status" = ANY (ARRAY['ELIGIBLE'::"text", 'INELIGIBLE'::"text"]))),
    CONSTRAINT "carrier_offers_route_operations_nonnegative" CHECK (("route_operations" >= 0)),
    CONSTRAINT "carrier_offers_scores_range" CHECK (((("availability_score" IS NULL) OR (("availability_score" >= (0)::numeric) AND ("availability_score" <= (100)::numeric))) AND (("reliability_score" IS NULL) OR (("reliability_score" >= (0)::numeric) AND ("reliability_score" <= (100)::numeric))) AND (("organization_history_score" >= (0)::numeric) AND ("organization_history_score" <= (100)::numeric)) AND (("final_score" IS NULL) OR (("final_score" >= (0)::numeric) AND ("final_score" <= (100)::numeric))))),
    CONSTRAINT "carrier_offers_status_check" CHECK (("status" = ANY (ARRAY['RECEIVED'::"text", 'ELIGIBLE'::"text", 'INELIGIBLE'::"text", 'SELECTED'::"text", 'EXPIRED'::"text", 'SUPERSEDED'::"text"]))),
    CONSTRAINT "carrier_offers_transit_positive" CHECK ((("transit_hours" IS NULL) OR ("transit_hours" > (0)::numeric)))
);


ALTER TABLE "public"."carrier_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_service_cargo_categories" (
    "carrier_service_id" "uuid" NOT NULL,
    "cargo_category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."carrier_service_cargo_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrier_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "transport_mode" "text" DEFAULT 'ROAD'::"text" NOT NULL,
    "service_type" "text" DEFAULT 'FTL'::"text" NOT NULL,
    "origin_country" "text" NOT NULL,
    "origin_region" "text",
    "destination_country" "text" NOT NULL,
    "destination_region" "text",
    "max_capacity_kg" numeric(14,2) NOT NULL,
    "max_volume_m3" numeric(14,3),
    "supports_refrigerated" boolean DEFAULT false NOT NULL,
    "temperature_min_c" numeric(6,2),
    "temperature_max_c" numeric(6,2),
    "supports_hazardous" boolean DEFAULT false NOT NULL,
    "supports_fragile" boolean DEFAULT false NOT NULL,
    "supports_oversized" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "supports_cross_border" boolean DEFAULT false NOT NULL,
    "customs_coordination_included" boolean DEFAULT false NOT NULL,
    "provider_service_code" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carrier_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carriers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "provider_type" "text" DEFAULT 'CARRIER'::"text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_url" "text",
    "supports_webmcp" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "carriers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['OWNER_OPERATOR'::"text", 'SMALL_FLEET'::"text", 'CARRIER'::"text", 'ENTERPRISE_CARRIER'::"text"]))),
    CONSTRAINT "carriers_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text"])))
);


ALTER TABLE "public"."carriers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."freight_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "freight_request_id" "uuid" NOT NULL,
    "selected_offer_id" "uuid",
    "optimization_strategy" "text" NOT NULL,
    "heuristic_score" numeric(6,2),
    "confidence_score" numeric(6,2),
    "decision_reason" "text",
    "candidate_snapshot" "jsonb",
    "requires_review" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "orchestration_run_id" "uuid" NOT NULL,
    "previous_decision_id" "uuid",
    "decision_version" integer DEFAULT 1 NOT NULL,
    "decision_type" "text" DEFAULT 'INITIAL'::"text" NOT NULL,
    "recommended_offer_id" "uuid",
    "ranking_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subscores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence_components" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "anomaly_evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "selection_mode" "text",
    "selected_by_member_id" "uuid",
    "selected_at" timestamp with time zone,
    CONSTRAINT "freight_decisions_confidence_range" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (100)::numeric)))),
    CONSTRAINT "freight_decisions_selection_mode_check" CHECK ((("selection_mode" IS NULL) OR ("selection_mode" = ANY (ARRAY['ASSISTED'::"text", 'SMART_AUTO'::"text"])))),
    CONSTRAINT "freight_decisions_type_check" CHECK (("decision_type" = ANY (ARRAY['INITIAL'::"text", 'RECOVERY'::"text"]))),
    CONSTRAINT "freight_decisions_version_positive" CHECK (("decision_version" > 0))
);


ALTER TABLE "public"."freight_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."freight_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "cargo_category_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "origin_country" "text" NOT NULL,
    "origin_city" "text" NOT NULL,
    "destination_country" "text" NOT NULL,
    "destination_city" "text" NOT NULL,
    "cargo_weight_kg" numeric(14,2) NOT NULL,
    "cargo_volume_m3" numeric(14,3),
    "package_count" integer,
    "service_type" "text" DEFAULT 'FTL'::"text" NOT NULL,
    "transport_mode" "text" DEFAULT 'ROAD'::"text" NOT NULL,
    "requires_refrigeration" boolean DEFAULT false NOT NULL,
    "temperature_min_c" numeric(6,2),
    "temperature_max_c" numeric(6,2),
    "is_hazardous" boolean DEFAULT false NOT NULL,
    "is_fragile" boolean DEFAULT false NOT NULL,
    "is_oversized" boolean DEFAULT false NOT NULL,
    "is_high_value" boolean DEFAULT false NOT NULL,
    "is_stackable" boolean DEFAULT true NOT NULL,
    "special_instructions" "text",
    "required_pickup" timestamp with time zone NOT NULL,
    "delivery_deadline" timestamp with time zone,
    "budget_max" numeric(14,2),
    "optimization_strategy" "text" DEFAULT 'BALANCED'::"text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requested_by_member_id" "uuid",
    "origin_address" "text",
    "pickup_contact_name" "text",
    "pickup_contact_phone" "text",
    "destination_address" "text",
    "receiver_name" "text",
    "receiver_company" "text",
    "receiver_phone" "text",
    "cargo_description" "text",
    "cargo_entry_method" "text" DEFAULT 'TOTAL_WEIGHT'::"text" NOT NULL,
    "pickup_mode" "text" DEFAULT 'SCHEDULED'::"text" NOT NULL,
    "pickup_window_start" timestamp with time zone,
    "pickup_window_end" timestamp with time zone,
    "available_documents" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cross_border" boolean DEFAULT false NOT NULL,
    "confirmed_at" timestamp with time zone,
    "confirmed_by_member_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cargo_profile_id" "uuid",
    "entry_quantity" numeric(12,2),
    "entry_unit_weight_kg" numeric(12,2),
    "units_per_entry" integer,
    "entry_length_cm" numeric(10,2),
    "entry_width_cm" numeric(10,2),
    "entry_height_cm" numeric(10,2),
    "cargo_specifications" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "freight_requests_budget_positive" CHECK ((("budget_max" IS NULL) OR ("budget_max" > (0)::numeric))),
    CONSTRAINT "freight_requests_cargo_entry_method_check" CHECK (("cargo_entry_method" = ANY (ARRAY['TOTAL_WEIGHT'::"text", 'UNITS'::"text", 'PACKAGES'::"text", 'PALLETS'::"text", 'LOTS'::"text", 'SACKS'::"text"]))),
    CONSTRAINT "freight_requests_cargo_specifications_object" CHECK (("jsonb_typeof"("cargo_specifications") = 'object'::"text")),
    CONSTRAINT "freight_requests_entry_dimensions_positive" CHECK (((("entry_length_cm" IS NULL) OR ("entry_length_cm" > (0)::numeric)) AND (("entry_width_cm" IS NULL) OR ("entry_width_cm" > (0)::numeric)) AND (("entry_height_cm" IS NULL) OR ("entry_height_cm" > (0)::numeric)))),
    CONSTRAINT "freight_requests_entry_quantity_positive" CHECK ((("entry_quantity" IS NULL) OR ("entry_quantity" > (0)::numeric))),
    CONSTRAINT "freight_requests_entry_unit_weight_positive" CHECK ((("entry_unit_weight_kg" IS NULL) OR ("entry_unit_weight_kg" > (0)::numeric))),
    CONSTRAINT "freight_requests_pickup_mode_check" CHECK (("pickup_mode" = ANY (ARRAY['ASAP'::"text", 'SCHEDULED'::"text"]))),
    CONSTRAINT "freight_requests_pickup_window_check" CHECK ((("pickup_window_end" IS NULL) OR ("pickup_window_start" IS NULL) OR ("pickup_window_end" > "pickup_window_start"))),
    CONSTRAINT "freight_requests_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING'::"text", 'ORCHESTRATING'::"text", 'AWAITING_SELECTION'::"text", 'BOOKING'::"text", 'BOOKED'::"text", 'FAILED'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "freight_requests_unitized_intake_complete" CHECK ((("status" = 'DRAFT'::"text") OR ("cargo_entry_method" = 'TOTAL_WEIGHT'::"text") OR (("entry_quantity" IS NOT NULL) AND ("entry_unit_weight_kg" IS NOT NULL) AND ("units_per_entry" IS NOT NULL)))),
    CONSTRAINT "freight_requests_unitized_volume_matches_total" CHECK ((("cargo_volume_m3" IS NULL) OR ("entry_quantity" IS NULL) OR ("units_per_entry" IS NULL) OR ("entry_length_cm" IS NULL) OR ("entry_width_cm" IS NULL) OR ("entry_height_cm" IS NULL) OR ("abs"(("cargo_volume_m3" - ((((("entry_quantity" * ("units_per_entry")::numeric) * "entry_length_cm") * "entry_width_cm") * "entry_height_cm") / (1000000)::numeric))) <= 0.01))),
    CONSTRAINT "freight_requests_unitized_weight_matches_total" CHECK ((("cargo_entry_method" = 'TOTAL_WEIGHT'::"text") OR ("entry_quantity" IS NULL) OR ("entry_unit_weight_kg" IS NULL) OR ("units_per_entry" IS NULL) OR ("abs"(("cargo_weight_kg" - (("entry_quantity" * "entry_unit_weight_kg") * ("units_per_entry")::numeric))) <= 0.01))),
    CONSTRAINT "freight_requests_units_per_entry_positive" CHECK ((("units_per_entry" IS NULL) OR ("units_per_entry" > 0))),
    CONSTRAINT "freight_requests_weight_positive" CHECK (("cargo_weight_kg" > (0)::numeric))
);


ALTER TABLE "public"."freight_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orchestration_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orchestration_run_id" "uuid" NOT NULL,
    "carrier_id" "uuid",
    "provider_url" "text",
    "event_type" "text" NOT NULL,
    "tool_name" "text",
    "tool_call_id" "text",
    "input_payload" "jsonb",
    "output_payload" "jsonb",
    "status" "text" DEFAULT 'SUCCEEDED'::"text" NOT NULL,
    "duration_ms" integer,
    "persisted_entity_type" "text",
    "persisted_entity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orchestration_events_duration_check" CHECK ((("duration_ms" IS NULL) OR ("duration_ms" >= 0))),
    CONSTRAINT "orchestration_events_status_check" CHECK (("status" = ANY (ARRAY['STARTED'::"text", 'SUCCEEDED'::"text", 'FAILED'::"text", 'SKIPPED'::"text"])))
);


ALTER TABLE "public"."orchestration_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orchestration_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "freight_request_id" "uuid" NOT NULL,
    "run_type" "text" NOT NULL,
    "status" "text" DEFAULT 'RUNNING'::"text" NOT NULL,
    "previous_run_id" "uuid",
    "created_by_member_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error_code" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orchestration_runs_completion_check" CHECK ((("completed_at" IS NULL) OR ("completed_at" >= "started_at"))),
    CONSTRAINT "orchestration_runs_status_check" CHECK (("status" = ANY (ARRAY['RUNNING'::"text", 'OPTIONS_READY'::"text", 'FAILED'::"text", 'CANCELLED'::"text", 'NO_MATCH'::"text"]))),
    CONSTRAINT "orchestration_runs_type_check" CHECK (("run_type" = ANY (ARRAY['INITIAL'::"text", 'RECOVERY'::"text"])))
);


ALTER TABLE "public"."orchestration_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_cargo_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "cargo_category_id" "uuid" NOT NULL,
    "profile_name" "text" NOT NULL,
    "default_entry_method" "text" NOT NULL,
    "typical_entry_quantity" numeric(12,2),
    "typical_unit_weight_kg" numeric(12,2),
    "typical_units_per_entry" integer DEFAULT 1 NOT NULL,
    "typical_length_cm" numeric(10,2),
    "typical_width_cm" numeric(10,2),
    "typical_height_cm" numeric(10,2),
    "default_requirements" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preferred_vehicle_classes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "priority" smallint DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_cargo_profiles_dimensions_positive" CHECK (((("typical_length_cm" IS NULL) OR ("typical_length_cm" > (0)::numeric)) AND (("typical_width_cm" IS NULL) OR ("typical_width_cm" > (0)::numeric)) AND (("typical_height_cm" IS NULL) OR ("typical_height_cm" > (0)::numeric)))),
    CONSTRAINT "organization_cargo_profiles_entry_method_check" CHECK (("default_entry_method" = ANY (ARRAY['TOTAL_WEIGHT'::"text", 'UNITS'::"text", 'PACKAGES'::"text", 'PALLETS'::"text", 'LOTS'::"text", 'SACKS'::"text"]))),
    CONSTRAINT "organization_cargo_profiles_quantity_positive" CHECK ((("typical_entry_quantity" IS NULL) OR ("typical_entry_quantity" > (0)::numeric))),
    CONSTRAINT "organization_cargo_profiles_requirements_object" CHECK (("jsonb_typeof"("default_requirements") = 'object'::"text")),
    CONSTRAINT "organization_cargo_profiles_unit_weight_positive" CHECK ((("typical_unit_weight_kg" IS NULL) OR ("typical_unit_weight_kg" > (0)::numeric))),
    CONSTRAINT "organization_cargo_profiles_units_per_entry_positive" CHECK (("typical_units_per_entry" > 0)),
    CONSTRAINT "organization_cargo_profiles_vehicle_classes_array" CHECK (("jsonb_typeof"("preferred_vehicle_classes") = 'array'::"text"))
);


ALTER TABLE "public"."organization_cargo_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "corporate_email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['OWNER'::"text", 'REQUESTER'::"text", 'SUPERVISOR'::"text"]))),
    CONSTRAINT "organization_members_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'INVITED'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "default_strategy" "text" DEFAULT 'BALANCED'::"text" NOT NULL,
    "max_pickup_wait_hours" numeric(8,2) DEFAULT 2 NOT NULL,
    "preferred_carrier_id" "uuid",
    "preferred_vehicle_brand" "text",
    "budget_default" numeric(14,2),
    "allow_auto_booking" boolean DEFAULT true NOT NULL,
    "confidence_threshold" numeric(5,2) DEFAULT 85 NOT NULL,
    "allow_auto_recovery" boolean DEFAULT false NOT NULL,
    "anomaly_threshold_pct" numeric(5,2) DEFAULT 30 NOT NULL,
    "billing_mode" "text" DEFAULT 'INVOICE'::"text" NOT NULL,
    "selection_mode" "text" DEFAULT 'ASSISTED'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_preferences_anomaly_range" CHECK ((("anomaly_threshold_pct" >= (0)::numeric) AND ("anomaly_threshold_pct" <= (100)::numeric))),
    CONSTRAINT "organization_preferences_billing_mode_check" CHECK (("billing_mode" = ANY (ARRAY['CORPORATE_ACCOUNT'::"text", 'INVOICE'::"text", 'EXTERNAL_CHECKOUT'::"text", 'TOKENIZED_PAYMENT_METHOD'::"text"]))),
    CONSTRAINT "organization_preferences_confidence_range" CHECK ((("confidence_threshold" >= (0)::numeric) AND ("confidence_threshold" <= (100)::numeric))),
    CONSTRAINT "organization_preferences_selection_mode_check" CHECK (("selection_mode" = ANY (ARRAY['ASSISTED'::"text", 'SMART_AUTO'::"text"])))
);


ALTER TABLE "public"."organization_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "default_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "legal_name" "text",
    "country_code" "text",
    "business_identifier_type" "text",
    "business_identifier_value" "text",
    "verified_corporate_email" "text",
    "corporate_phone" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organizations_default_currency_check" CHECK (("default_currency" = ANY (ARRAY['USD'::"text", 'PEN'::"text"]))),
    CONSTRAINT "organizations_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "brand" "text",
    "vehicle_type" "text",
    "capacity_kg" numeric(14,2) NOT NULL,
    "volume_m3" numeric(14,3),
    "supports_refrigerated" boolean DEFAULT false NOT NULL,
    "supports_hazardous" boolean DEFAULT false NOT NULL,
    "supports_oversized" boolean DEFAULT false NOT NULL,
    "location" "text",
    "status" "text" DEFAULT 'AVAILABLE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model" "text",
    "license_plate" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicles_status_check" CHECK (("status" = ANY (ARRAY['AVAILABLE'::"text", 'ASSIGNED'::"text", 'IN_TRANSIT'::"text", 'UNAVAILABLE'::"text", 'BREAKDOWN'::"text"])))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."booking_events"
    ADD CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_events"
    ADD CONSTRAINT "booking_events_provider_event_unique" UNIQUE ("booking_id", "provider_event_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_idempotency_unique" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargo_categories"
    ADD CONSTRAINT "cargo_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."cargo_categories"
    ADD CONSTRAINT "cargo_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_metrics"
    ADD CONSTRAINT "carrier_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_offer_reference_key" UNIQUE ("offer_reference");



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrier_service_cargo_categories"
    ADD CONSTRAINT "carrier_service_cargo_categories_pkey" PRIMARY KEY ("carrier_service_id", "cargo_category_id");



ALTER TABLE ONLY "public"."carrier_services"
    ADD CONSTRAINT "carrier_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carriers"
    ADD CONSTRAINT "carriers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."carriers"
    ADD CONSTRAINT "carriers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_request_version_unique" UNIQUE ("freight_request_id", "decision_version");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_run_unique" UNIQUE ("orchestration_run_id");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orchestration_events"
    ADD CONSTRAINT "orchestration_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orchestration_runs"
    ADD CONSTRAINT "orchestration_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_cargo_profiles"
    ADD CONSTRAINT "organization_cargo_profiles_org_id_id_unique" UNIQUE ("organization_id", "id");



ALTER TABLE ONLY "public"."organization_cargo_profiles"
    ADD CONSTRAINT "organization_cargo_profiles_org_name_unique" UNIQUE ("organization_id", "profile_name");



ALTER TABLE ONLY "public"."organization_cargo_profiles"
    ADD CONSTRAINT "organization_cargo_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_user_unique" UNIQUE ("organization_id", "auth_user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_preferences"
    ADD CONSTRAINT "organization_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE INDEX "booking_events_booking_occurred_idx" ON "public"."booking_events" USING "btree" ("booking_id", "occurred_at");



CREATE UNIQUE INDEX "bookings_active_request_unique" ON "public"."bookings" USING "btree" ("freight_request_id") WHERE ("status" = ANY (ARRAY['PENDING_PROVIDER_CONFIRMATION'::"text", 'CONFIRMED'::"text", 'IN_TRANSIT'::"text"]));



CREATE INDEX "bookings_carrier_idx" ON "public"."bookings" USING "btree" ("carrier_id");



CREATE INDEX "bookings_decision_idx" ON "public"."bookings" USING "btree" ("freight_decision_id");



CREATE INDEX "bookings_offer_idx" ON "public"."bookings" USING "btree" ("offer_id");



CREATE UNIQUE INDEX "bookings_provider_reference_unique" ON "public"."bookings" USING "btree" ("carrier_id", "provider_reference") WHERE ("provider_reference" IS NOT NULL);



CREATE INDEX "bookings_replaces_idx" ON "public"."bookings" USING "btree" ("replaces_booking_id") WHERE ("replaces_booking_id" IS NOT NULL);



CREATE INDEX "bookings_request_idx" ON "public"."bookings" USING "btree" ("freight_request_id");



CREATE INDEX "bookings_selected_by_idx" ON "public"."bookings" USING "btree" ("selected_by_member_id") WHERE ("selected_by_member_id" IS NOT NULL);



CREATE INDEX "carrier_metrics_carrier_idx" ON "public"."carrier_metrics" USING "btree" ("carrier_id");



CREATE INDEX "carrier_metrics_category_idx" ON "public"."carrier_metrics" USING "btree" ("cargo_category_id") WHERE ("cargo_category_id" IS NOT NULL);



CREATE INDEX "carrier_metrics_organization_idx" ON "public"."carrier_metrics" USING "btree" ("organization_id") WHERE ("organization_id" IS NOT NULL);



CREATE INDEX "carrier_offers_carrier_idx" ON "public"."carrier_offers" USING "btree" ("carrier_id");



CREATE INDEX "carrier_offers_request_carrier_idx" ON "public"."carrier_offers" USING "btree" ("freight_request_id", "carrier_id");



CREATE UNIQUE INDEX "carrier_offers_run_provider_reference_unique" ON "public"."carrier_offers" USING "btree" ("orchestration_run_id", "carrier_id", "provider_offer_reference") WHERE (("orchestration_run_id" IS NOT NULL) AND ("provider_offer_reference" IS NOT NULL));



CREATE INDEX "carrier_offers_run_status_idx" ON "public"."carrier_offers" USING "btree" ("orchestration_run_id", "status") WHERE ("orchestration_run_id" IS NOT NULL);



CREATE INDEX "carrier_offers_supersedes_idx" ON "public"."carrier_offers" USING "btree" ("supersedes_offer_id") WHERE ("supersedes_offer_id" IS NOT NULL);



CREATE UNIQUE INDEX "carrier_offers_tool_call_unique" ON "public"."carrier_offers" USING "btree" ("tool_call_id") WHERE ("tool_call_id" IS NOT NULL);



CREATE INDEX "carrier_offers_vehicle_idx" ON "public"."carrier_offers" USING "btree" ("vehicle_id") WHERE ("vehicle_id" IS NOT NULL);



CREATE INDEX "carrier_service_categories_category_idx" ON "public"."carrier_service_cargo_categories" USING "btree" ("cargo_category_id");



CREATE INDEX "carrier_services_carrier_idx" ON "public"."carrier_services" USING "btree" ("carrier_id");



CREATE UNIQUE INDEX "carriers_provider_url_unique" ON "public"."carriers" USING "btree" ("provider_url") WHERE ("provider_url" IS NOT NULL);



CREATE INDEX "freight_decisions_previous_idx" ON "public"."freight_decisions" USING "btree" ("previous_decision_id") WHERE ("previous_decision_id" IS NOT NULL);



CREATE INDEX "freight_decisions_recommended_offer_idx" ON "public"."freight_decisions" USING "btree" ("recommended_offer_id") WHERE ("recommended_offer_id" IS NOT NULL);



CREATE INDEX "freight_decisions_selected_by_idx" ON "public"."freight_decisions" USING "btree" ("selected_by_member_id") WHERE ("selected_by_member_id" IS NOT NULL);



CREATE INDEX "freight_decisions_selected_offer_idx" ON "public"."freight_decisions" USING "btree" ("selected_offer_id") WHERE ("selected_offer_id" IS NOT NULL);



CREATE INDEX "freight_requests_cargo_category_idx" ON "public"."freight_requests" USING "btree" ("cargo_category_id");



CREATE INDEX "freight_requests_cargo_profile_idx" ON "public"."freight_requests" USING "btree" ("cargo_profile_id") WHERE ("cargo_profile_id" IS NOT NULL);



CREATE INDEX "freight_requests_confirmed_by_idx" ON "public"."freight_requests" USING "btree" ("confirmed_by_member_id") WHERE ("confirmed_by_member_id" IS NOT NULL);



CREATE INDEX "freight_requests_org_cargo_profile_idx" ON "public"."freight_requests" USING "btree" ("organization_id", "cargo_profile_id") WHERE ("cargo_profile_id" IS NOT NULL);



CREATE INDEX "freight_requests_org_status_created_idx" ON "public"."freight_requests" USING "btree" ("organization_id", "status", "created_at" DESC);



CREATE INDEX "freight_requests_requester_idx" ON "public"."freight_requests" USING "btree" ("requested_by_member_id") WHERE ("requested_by_member_id" IS NOT NULL);



CREATE INDEX "orchestration_events_carrier_idx" ON "public"."orchestration_events" USING "btree" ("carrier_id") WHERE ("carrier_id" IS NOT NULL);



CREATE INDEX "orchestration_events_run_created_idx" ON "public"."orchestration_events" USING "btree" ("orchestration_run_id", "created_at");



CREATE UNIQUE INDEX "orchestration_events_tool_call_unique" ON "public"."orchestration_events" USING "btree" ("tool_call_id") WHERE ("tool_call_id" IS NOT NULL);



CREATE INDEX "orchestration_runs_created_by_idx" ON "public"."orchestration_runs" USING "btree" ("created_by_member_id") WHERE ("created_by_member_id" IS NOT NULL);



CREATE INDEX "orchestration_runs_previous_idx" ON "public"."orchestration_runs" USING "btree" ("previous_run_id") WHERE ("previous_run_id" IS NOT NULL);



CREATE INDEX "orchestration_runs_request_created_idx" ON "public"."orchestration_runs" USING "btree" ("freight_request_id", "created_at" DESC);



CREATE INDEX "organization_cargo_profiles_category_idx" ON "public"."organization_cargo_profiles" USING "btree" ("cargo_category_id");



CREATE INDEX "organization_cargo_profiles_org_active_idx" ON "public"."organization_cargo_profiles" USING "btree" ("organization_id", "priority", "profile_name") WHERE "active";



CREATE INDEX "organization_members_auth_user_idx" ON "public"."organization_members" USING "btree" ("auth_user_id");



CREATE INDEX "organization_members_org_status_idx" ON "public"."organization_members" USING "btree" ("organization_id", "status");



CREATE UNIQUE INDEX "organization_preferences_org_unique" ON "public"."organization_preferences" USING "btree" ("organization_id");



CREATE INDEX "organization_preferences_preferred_carrier_idx" ON "public"."organization_preferences" USING "btree" ("preferred_carrier_id") WHERE ("preferred_carrier_id" IS NOT NULL);



CREATE UNIQUE INDEX "organizations_business_identifier_unique" ON "public"."organizations" USING "btree" ("country_code", "business_identifier_type", "business_identifier_value") WHERE ("business_identifier_value" IS NOT NULL);



CREATE INDEX "vehicles_carrier_idx" ON "public"."vehicles" USING "btree" ("carrier_id");



CREATE UNIQUE INDEX "vehicles_license_plate_unique" ON "public"."vehicles" USING "btree" ("license_plate") WHERE ("license_plate" IS NOT NULL);



ALTER TABLE ONLY "public"."booking_events"
    ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_freight_decision_id_fkey" FOREIGN KEY ("freight_decision_id") REFERENCES "public"."freight_decisions"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_freight_request_id_fkey" FOREIGN KEY ("freight_request_id") REFERENCES "public"."freight_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."carrier_offers"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_replaces_booking_id_fkey" FOREIGN KEY ("replaces_booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_selected_by_member_id_fkey" FOREIGN KEY ("selected_by_member_id") REFERENCES "public"."organization_members"("id");



ALTER TABLE ONLY "public"."carrier_metrics"
    ADD CONSTRAINT "carrier_metrics_cargo_category_id_fkey" FOREIGN KEY ("cargo_category_id") REFERENCES "public"."cargo_categories"("id");



ALTER TABLE ONLY "public"."carrier_metrics"
    ADD CONSTRAINT "carrier_metrics_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_metrics"
    ADD CONSTRAINT "carrier_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_freight_request_id_fkey" FOREIGN KEY ("freight_request_id") REFERENCES "public"."freight_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_orchestration_run_id_fkey" FOREIGN KEY ("orchestration_run_id") REFERENCES "public"."orchestration_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_supersedes_offer_id_fkey" FOREIGN KEY ("supersedes_offer_id") REFERENCES "public"."carrier_offers"("id");



ALTER TABLE ONLY "public"."carrier_offers"
    ADD CONSTRAINT "carrier_offers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."carrier_service_cargo_categories"
    ADD CONSTRAINT "carrier_service_cargo_categories_cargo_category_id_fkey" FOREIGN KEY ("cargo_category_id") REFERENCES "public"."cargo_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_service_cargo_categories"
    ADD CONSTRAINT "carrier_service_cargo_categories_carrier_service_id_fkey" FOREIGN KEY ("carrier_service_id") REFERENCES "public"."carrier_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrier_services"
    ADD CONSTRAINT "carrier_services_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_preferences"
    ADD CONSTRAINT "fk_preferred_carrier" FOREIGN KEY ("preferred_carrier_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_freight_request_id_fkey" FOREIGN KEY ("freight_request_id") REFERENCES "public"."freight_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_orchestration_run_id_fkey" FOREIGN KEY ("orchestration_run_id") REFERENCES "public"."orchestration_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_previous_decision_id_fkey" FOREIGN KEY ("previous_decision_id") REFERENCES "public"."freight_decisions"("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_recommended_offer_id_fkey" FOREIGN KEY ("recommended_offer_id") REFERENCES "public"."carrier_offers"("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_selected_by_member_id_fkey" FOREIGN KEY ("selected_by_member_id") REFERENCES "public"."organization_members"("id");



ALTER TABLE ONLY "public"."freight_decisions"
    ADD CONSTRAINT "freight_decisions_selected_offer_id_fkey" FOREIGN KEY ("selected_offer_id") REFERENCES "public"."carrier_offers"("id");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_cargo_category_id_fkey" FOREIGN KEY ("cargo_category_id") REFERENCES "public"."cargo_categories"("id");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_confirmed_by_member_id_fkey" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."organization_members"("id");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_organization_cargo_profile_fkey" FOREIGN KEY ("organization_id", "cargo_profile_id") REFERENCES "public"."organization_cargo_profiles"("organization_id", "id");



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."freight_requests"
    ADD CONSTRAINT "freight_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."organization_members"("id");



ALTER TABLE ONLY "public"."orchestration_events"
    ADD CONSTRAINT "orchestration_events_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id");



ALTER TABLE ONLY "public"."orchestration_events"
    ADD CONSTRAINT "orchestration_events_orchestration_run_id_fkey" FOREIGN KEY ("orchestration_run_id") REFERENCES "public"."orchestration_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orchestration_runs"
    ADD CONSTRAINT "orchestration_runs_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id");



ALTER TABLE ONLY "public"."orchestration_runs"
    ADD CONSTRAINT "orchestration_runs_freight_request_id_fkey" FOREIGN KEY ("freight_request_id") REFERENCES "public"."freight_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orchestration_runs"
    ADD CONSTRAINT "orchestration_runs_previous_run_id_fkey" FOREIGN KEY ("previous_run_id") REFERENCES "public"."orchestration_runs"("id");



ALTER TABLE ONLY "public"."organization_cargo_profiles"
    ADD CONSTRAINT "organization_cargo_profiles_cargo_category_id_fkey" FOREIGN KEY ("cargo_category_id") REFERENCES "public"."cargo_categories"("id");



ALTER TABLE ONLY "public"."organization_cargo_profiles"
    ADD CONSTRAINT "organization_cargo_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_preferences"
    ADD CONSTRAINT "organization_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;



ALTER TABLE "public"."booking_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_events_member_select" ON "public"."booking_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."freight_requests" "fr" ON (("fr"."id" = "b"."freight_request_id")))
  WHERE (("b"."id" = "booking_events"."booking_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_member_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."freight_requests" "fr"
  WHERE (("fr"."id" = "bookings"."freight_request_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."cargo_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cargo_categories_member_select" ON "public"."cargo_categories" FOR SELECT TO "authenticated" USING (( SELECT "private"."has_any_organization"() AS "has_any_organization"));



ALTER TABLE "public"."carrier_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrier_metrics_member_select" ON "public"."carrier_metrics" FOR SELECT TO "authenticated" USING ((( SELECT "private"."has_any_organization"() AS "has_any_organization") AND (("organization_id" IS NULL) OR ( SELECT "private"."is_organization_member"("carrier_metrics"."organization_id") AS "is_organization_member"))));



ALTER TABLE "public"."carrier_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrier_offers_member_select" ON "public"."carrier_offers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."freight_requests" "fr"
  WHERE (("fr"."id" = "carrier_offers"."freight_request_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."carrier_service_cargo_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrier_service_categories_member_select" ON "public"."carrier_service_cargo_categories" FOR SELECT TO "authenticated" USING (( SELECT "private"."has_any_organization"() AS "has_any_organization"));



ALTER TABLE "public"."carrier_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrier_services_member_select" ON "public"."carrier_services" FOR SELECT TO "authenticated" USING (( SELECT "private"."has_any_organization"() AS "has_any_organization"));



ALTER TABLE "public"."carriers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carriers_member_select" ON "public"."carriers" FOR SELECT TO "authenticated" USING (( SELECT "private"."has_any_organization"() AS "has_any_organization"));



ALTER TABLE "public"."freight_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "freight_decisions_member_select" ON "public"."freight_decisions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."freight_requests" "fr"
  WHERE (("fr"."id" = "freight_decisions"."freight_request_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."freight_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "freight_requests_member_insert" ON "public"."freight_requests" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."has_organization_role"("freight_requests"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text", 'REQUESTER'::"text"]) AS "has_organization_role"));



CREATE POLICY "freight_requests_member_select" ON "public"."freight_requests" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_organization_member"("freight_requests"."organization_id") AS "is_organization_member"));



CREATE POLICY "freight_requests_member_update" ON "public"."freight_requests" FOR UPDATE TO "authenticated" USING (( SELECT "private"."has_organization_role"("freight_requests"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text", 'REQUESTER'::"text"]) AS "has_organization_role")) WITH CHECK (( SELECT "private"."has_organization_role"("freight_requests"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text", 'REQUESTER'::"text"]) AS "has_organization_role"));



ALTER TABLE "public"."orchestration_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orchestration_events_member_select" ON "public"."orchestration_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orchestration_runs" "r"
     JOIN "public"."freight_requests" "fr" ON (("fr"."id" = "r"."freight_request_id")))
  WHERE (("r"."id" = "orchestration_events"."orchestration_run_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."orchestration_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orchestration_runs_member_select" ON "public"."orchestration_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."freight_requests" "fr"
  WHERE (("fr"."id" = "orchestration_runs"."freight_request_id") AND ( SELECT "private"."is_organization_member"("fr"."organization_id") AS "is_organization_member")))));



ALTER TABLE "public"."organization_cargo_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_cargo_profiles_manager_insert" ON "public"."organization_cargo_profiles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."has_organization_role"("organization_cargo_profiles"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text"]) AS "has_organization_role"));



CREATE POLICY "organization_cargo_profiles_manager_update" ON "public"."organization_cargo_profiles" FOR UPDATE TO "authenticated" USING (( SELECT "private"."has_organization_role"("organization_cargo_profiles"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text"]) AS "has_organization_role")) WITH CHECK (( SELECT "private"."has_organization_role"("organization_cargo_profiles"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text"]) AS "has_organization_role"));



CREATE POLICY "organization_cargo_profiles_member_select" ON "public"."organization_cargo_profiles" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_organization_member"("organization_cargo_profiles"."organization_id") AS "is_organization_member"));



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_members_member_select" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_organization_member"("organization_members"."organization_id") AS "is_organization_member"));



ALTER TABLE "public"."organization_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_preferences_member_select" ON "public"."organization_preferences" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_organization_member"("organization_preferences"."organization_id") AS "is_organization_member"));



CREATE POLICY "organization_preferences_owner_update" ON "public"."organization_preferences" FOR UPDATE TO "authenticated" USING (( SELECT "private"."has_organization_role"("organization_preferences"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text"]) AS "has_organization_role")) WITH CHECK (( SELECT "private"."has_organization_role"("organization_preferences"."organization_id", ARRAY['OWNER'::"text", 'SUPERVISOR'::"text"]) AS "has_organization_role"));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_member_select" ON "public"."organizations" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_organization_member"("organizations"."id") AS "is_organization_member"));



ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicles_member_select" ON "public"."vehicles" FOR SELECT TO "authenticated" USING (( SELECT "private"."has_any_organization"() AS "has_any_organization"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."booking_events" TO "service_role";
GRANT SELECT ON TABLE "public"."booking_events" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "service_role";
GRANT SELECT ON TABLE "public"."bookings" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cargo_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."cargo_categories" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carrier_metrics" TO "service_role";
GRANT SELECT ON TABLE "public"."carrier_metrics" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carrier_offers" TO "service_role";
GRANT SELECT ON TABLE "public"."carrier_offers" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carrier_service_cargo_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."carrier_service_cargo_categories" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carrier_services" TO "service_role";
GRANT SELECT ON TABLE "public"."carrier_services" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."carriers" TO "service_role";
GRANT SELECT ON TABLE "public"."carriers" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."freight_decisions" TO "service_role";
GRANT SELECT ON TABLE "public"."freight_decisions" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."freight_requests" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."freight_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."orchestration_events" TO "service_role";
GRANT SELECT ON TABLE "public"."orchestration_events" TO "authenticated";



GRANT ALL ON TABLE "public"."orchestration_runs" TO "service_role";
GRANT SELECT ON TABLE "public"."orchestration_runs" TO "authenticated";



GRANT ALL ON TABLE "public"."organization_cargo_profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."organization_cargo_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."organization_members" TO "service_role";
GRANT SELECT ON TABLE "public"."organization_members" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_preferences" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "public"."organization_preferences" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "service_role";
GRANT SELECT ON TABLE "public"."organizations" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "service_role";
GRANT SELECT ON TABLE "public"."vehicles" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







