export const GET_FREIGHT_REQUEST_RECOMMENDATIONS_TOOL_NAME =
  "get_freight_request_recommendations";

export const RECOMMENDATION_PROPOSED_FIELD_NAMES = [
  "origin_country",
  "origin_city",
  "origin_address",
  "pickup_contact_name",
  "pickup_contact_phone",
  "destination_country",
  "destination_city",
  "destination_address",
  "receiver_name",
  "receiver_company",
  "receiver_phone",
  "cargo_category_id",
  "cargo_description",
  "cargo_entry_method",
  "entry_quantity",
  "entry_unit_weight_kg",
  "units_per_entry",
  "entry_length_cm",
  "entry_width_cm",
  "entry_height_cm",
  "package_count",
  "cargo_specifications",
  "requires_refrigeration",
  "temperature_min_c",
  "temperature_max_c",
  "is_hazardous",
  "is_fragile",
  "is_oversized",
  "is_high_value",
  "is_stackable",
  "special_instructions",
  "pickup_mode",
  "pickup_window_start",
  "pickup_window_end",
  "delivery_deadline",
  "budget_max",
  "optimization_strategy",
  "available_documents",
  "cross_border",
] as const;

export type RecommendationProposedFieldName =
  (typeof RECOMMENDATION_PROPOSED_FIELD_NAMES)[number];

export type RecommendationJsonValue =
  | string
  | number
  | boolean
  | null
  | RecommendationJsonValue[]
  | { [key: string]: RecommendationJsonValue };

export type RecommendationProposedFields = Partial<
  Record<RecommendationProposedFieldName, RecommendationJsonValue>
>;

export type FreightRecommendationInput = {
  freightRequestId: string;
  draftVersion: number;
};

export type FreightRecommendationSourceType =
  | "ORGANIZATION_HISTORY"
  | "SYNTHETIC_RECOMMENDATION_HISTORY"
  | "CARGO_PROFILE";

export type FreightRecommendationSuggestion = {
  suggestionId: string;
  sourceType: FreightRecommendationSourceType;
  sourceRequestId?: string;
  sourceProfileId?: string;
  reasonCodes: string[];
  explanation: string;
  proposedFields: RecommendationProposedFields;
};

export type FreightRecommendationEnvelope = {
  schemaVersion: "1.0";
  freightRequestId: string;
  draftVersion: number;
  suggestions: FreightRecommendationSuggestion[];
};

export type FreightRecommendationErrorCode =
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "REQUEST_NOT_FOUND"
  | "STALE_DRAFT"
  | "INVALID_RECOMMENDATION_RESPONSE"
  | "RECOMMENDATIONS_UNAVAILABLE";

export type FreightRecommendationToolEnvelope =
  | { ok: true; data: FreightRecommendationEnvelope }
  | {
      ok: false;
      error: {
        code: FreightRecommendationErrorCode;
        message: string;
        retryable: boolean;
      };
    };
