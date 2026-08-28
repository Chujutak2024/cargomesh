export type ProviderType = 'CARRIER' | 'BROKER' | 'FORWARDER' | 'ENTERPRISE_CARRIER' | 'SMALL_FLEET';
export type TransportMode = 'ROAD' | 'AIR' | 'SEA' | 'RAIL';
export type ServiceType = 'FTL' | 'LTL' | 'AIR_CARGO' | 'OCEAN_FCL' | 'OCEAN_LCL';
export type OptimizationStrategy = 'BALANCED' | 'LOWEST_COST' | 'MOST_RELIABLE' | 'FASTEST' | 'CUSTOM';
export type FreightRequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'DISPATCHED'
  | 'QUOTED'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'EXCEPTION_HOLD'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EVALUATING'
  | 'REVIEW_REQUIRED'
  | 'DISRUPTED'
  | 'REBOOKED';
export type CarrierOfferStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'RESCUE_PROPOSED';
export type DecisionOutcome = 'AUTO_BOOKED' | 'EXCEPTION_PRICE_ANOMALY' | 'EXCEPTION_LOW_CONFIDENCE' | 'EXCEPTION_NO_OFFERS' | 'MANUAL_DISPATCHED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
  organization_id: string;
  created_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  default_currency: string;
  created_at: string;
}

export interface OrganizationPreferences {
  id: string;
  organization_id: string;
  default_strategy?: OptimizationStrategy;
  default_optimization_strategy?: OptimizationStrategy;
  max_pickup_wait_hours: number;
  preferred_carrier_id?: string | null;
  preferred_vehicle_brand?: string | null;
  budget_default?: number | null;
  usual_budget_min?: number;
  usual_budget_max?: number;
  frequent_routes?: string[];
  allow_auto_booking: boolean;
  confidence_threshold: number; // e.g. 85.0
}

export interface CargoCategory {
  id: string;
  code: string; // "GENERAL", "FOOD", "MACHINERY", "CONSTRUCTION", "CHEMICALS"
  name: string;
  description: string;
  active: boolean;
}

export interface FreightRequest {
  id: string;
  organization_id: string;
  requested_by_user_id?: string;
  cargo_category_id: string;
  code: string; // "FR-1042"

  origin_country: string;
  origin_city: string;
  origin_address?: string;

  destination_country: string;
  destination_city: string;
  destination_address?: string;

  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  package_count?: number;

  service_type: ServiceType;
  transport_mode: TransportMode;

  requires_refrigeration: boolean;
  temperature_min_c?: number;
  temperature_max_c?: number;

  is_hazardous: boolean;
  hazard_class?: string;

  is_fragile: boolean;
  is_oversized: boolean;
  is_high_value?: boolean;
  is_stackable?: boolean;

  special_instructions?: string;

  required_pickup: string; // ISO string
  delivery_deadline?: string; // ISO string
  max_pickup_wait_hours?: number;

  budget_max?: number;
  optimization_strategy: OptimizationStrategy;
  preferred_carrier_id?: string;
  preferred_vehicle_brand?: string;

  status: FreightRequestStatus;
  created_at: string;
}

export interface Carrier {
  id: string;
  name: string;
  code: string; // "ANDES", "PACIFIC", "INCA"
  provider_type: ProviderType;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
  avatar_url?: string;
  fleet_size?: number;
  created_at: string;
}

export interface CarrierService {
  id: string;
  carrier_id: string;
  transport_mode: TransportMode;
  service_type: ServiceType;

  origin_country: string;
  origin_region: string;
  destination_country: string;
  destination_region: string;

  max_capacity_kg: number;
  max_volume_m3: number;

  supports_refrigerated: boolean;
  temperature_min_c?: number;
  temperature_max_c?: number;

  supports_hazardous: boolean;
  supports_fragile: boolean;
  supports_oversized: boolean;

  active: boolean;
  supported_cargo_categories: string[]; // array of category codes
}

export interface Vehicle {
  id: string;
  carrier_id: string;
  code: string;
  brand: string; // "Volvo", "Scania", "Freightliner", "Mercedes"
  vehicle_type: string; // "Heavy Truck 20t", "Semi-Trailer 12t"
  capacity_kg: number;
  volume_m3: number;

  supports_refrigerated: boolean;
  supports_hazardous: boolean;
  supports_oversized: boolean;

  location: string;
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE';
}

export interface CarrierMetrics {
  id: string;
  carrier_id: string;
  cargo_category_id?: string;
  transport_mode: TransportMode;

  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;

  completed_freight_requests: number;
  successful_freight_requests: number;
  success_rate: number; // e.g. 0.96 for 96%

  avg_cost: number;
  avg_delay_hours: number;
  cancellation_rate: number;

  available_units_count: number;
  route_jobs_count: number;
  client_history_trips?: number;
  client_history_ontime?: number;

  updated_at: string;
}

export interface CarrierOffer {
  id: string;
  freight_request_id: string;
  carrier_id: string;
  carrier_name: string;
  vehicle_id?: string | null;
  vehicle_brand?: string;
  vehicle_type?: string;

  offer_reference: string;
  transport_mode: TransportMode;
  service_type: ServiceType;

  price: number;
  currency: string;

  estimated_pickup: string;
  estimated_delivery: string;
  estimated_duration_hours: number;

  available_capacity_kg: number;
  available_volume_m3: number;
  valid_until: string;

  compatibility_status: 'COMPATIBLE' | 'INCOMPATIBLE';
  compatibility_notes?: string;

  scores?: {
    total: number;
    total_score: number;
    cost_score: number;
    reliability_score: number;
    eta_score: number;
    availability_score: number;
    route_experience_score: number;
    preference_fit_score?: number;
    preference_score?: number;
    client_history_score: number;
    penalties: number;
  };

  status: CarrierOfferStatus;
  created_at: string;
}

export interface FreightDecision {
  id: string;
  freight_request_id: string;
  winning_carrier_id?: string | null;
  winner_carrier_id?: string;
  winning_carrier_name?: string | null;
  winner_carrier_name?: string | null;
  winning_offer_id?: string | null;
  selected_offer_id?: string;

  heuristic_score: number;
  confidence_score: number;
  outcome?: DecisionOutcome;
  auto_booked?: boolean;
  requires_review?: boolean;
  review_reason?: string | null;
  decision_reason?: string;
  explanation_bullets?: string[];
  candidate_snapshot?: any;

  applied_strategy?: OptimizationStrategy;
  optimization_strategy?: OptimizationStrategy;
  second_score?: number;
  score_delta?: number;
  decision_explanation?: Record<string, any>;
  counterfactual_analysis?: Record<string, any>;

  exception_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;

  created_at: string;
}

export interface Booking {
  id: string;
  freight_request_id: string;
  carrier_id: string;
  carrier_name?: string;
  offer_id: string;
  provider_reference: string;

  vehicle_id?: string | null;
  vehicle_brand?: string;

  price?: number;
  confirmed_price?: number;
  currency: string;

  pickup_window_start?: string;
  pickup_window_end?: string;
  delivery_window_start?: string;
  delivery_window_end?: string;
  estimated_delivery?: string;

  status: 'CONFIRMED' | 'IN_PROGRESS' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'RESCUED' | 'DISRUPTED';
  booked_at: string;
}

export interface DisruptionEvent {
  id: string;
  booking_id: string;
  freight_request_id: string;
  event_type?: 'MECHANICAL_BREAKDOWN' | 'ACCIDENT' | 'ROAD_BLOCK' | 'SEVERE_DELAY';
  incident_type?: 'BREAKDOWN' | 'ACCIDENT' | 'DELAY' | 'MECHANICAL_BREAKDOWN' | 'ROAD_BLOCK' | 'SEVERE_DELAY' | string;
  description: string;
  location: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'REPORTED' | 'DISCOVERY_IN_PROGRESS' | 'RESCUE_PROPOSED' | 'RESOLVED' | 'REBOOKED' | 'PENDING_REVIEW';
  original_carrier_id?: string;
  original_price?: number;
  replacement_carrier_id?: string;
  replacement_price?: number;
  rescue_offer_id?: string | null;
  detected_at?: string;
  price_delta?: number;
  eta_delta_hours?: number;
  auto_rebooked?: boolean;
  created_at: string;
}

export interface OrchestrationStep {
  id: string;
  timestamp: string;
  phase:
    | 'VALIDATING'
    | 'VALIDATE'
    | 'CONTEXT'
    | 'DISCOVERY'
    | 'QUOTES'
    | 'METRICS'
    | 'EVALUATION'
    | 'EVALUATE'
    | 'DECISION'
    | 'BOOKING'
    | 'BOOK'
    | 'EXCEPTION'
    | string;
  title: string;
  detail: string;
  tool_called?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'WARNING';
}
