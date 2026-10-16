export type Point = { lat: number; lng: number };
export type RouteObjective = "FASTEST" | "SHORTEST_RETURNED";
export type TrafficPreference = "TRAFFIC_UNAWARE" | "TRAFFIC_AWARE_OPTIMAL";
export type RouteQuery = {
  originId: string;
  destinationId: string;
  objective: RouteObjective;
  traffic: TrafficPreference;
};
export type RoadAlternative = {
  id: string;
  providerIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  points: Point[];
  warnings: string[];
};
export type RouteFailure = "SERVER_KEY_MISSING" | "PROVIDER_DENIED" | "PROVIDER_UNAVAILABLE"
  | "NO_ROUTE" | "NO_VALID_ROAD_ROUTE" | "DISCONNECTED_NETWORKS" | "INVALID_ROUTE" | "RATE_LIMITED";
export type RoadCalculation = {
  status: "estimated";
  source: "GOOGLE_ROUTES_API";
  calculatedAt: string;
  policyVersion: "returned-road-alternatives/v1";
  scope: "RETURNED_ALTERNATIVES_ONLY";
  truckAccess: "UNVERIFIED";
  objective: RouteObjective;
  traffic: TrafficPreference;
  selectedId: string;
  alternatives: RoadAlternative[];
  rejected: { providerIndex: number; reason: string }[];
} | { status: "unavailable" | "blocked"; reason: RouteFailure; alternatives: [] };
