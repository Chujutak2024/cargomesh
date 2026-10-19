import { z } from "zod";
import { exampleFleet, EXAMPLE_AS_OF, type FleetVehicle } from "./fleet-model";
import { fleetDrivers, fleetDriverById, regularFleetDriver } from "./fleet-drivers";

export const FLEET_DEMO_STORAGE_KEY = "cargomesh-fleet-demo-v1";
export const demoStages = ["UNASSIGNED", "ASSIGNED", "EN_ROUTE", "COMPLETED"] as const;
export type DemoStage = typeof demoStages[number];
export const demoDrivers = fleetDrivers.map(({id,name,enabled})=>({id,name,enabled}));
const TripSchema = z.object({ id: z.string(), vehicleId: z.string(), stage: z.enum(demoStages),
  driverId: z.string().nullable(), updatedAt: z.string().datetime(), statusChangedAt: z.string().datetime() }).strict();
const StateSchema = z.object({ version: z.literal(1), source: z.literal("EXAMPLE"), trips: z.array(TripSchema).min(6).max(200) }).strict();
export type FleetDemoState = z.infer<typeof StateSchema>;
export function createFleetDemo(vehicles=exampleFleet()): FleetDemoState {
  return { version: 1, source: "EXAMPLE", trips: vehicles.map(vehicle => ({ id: "trip-" + vehicle.code, vehicleId: vehicle.id,
    stage: ["CM-077", "CM-231", "CM-162", "CM-245", "CM-256", "CM-267"].includes(vehicle.code) ? "EN_ROUTE" : vehicle.code === "CM-212" ? "ASSIGNED" : "UNASSIGNED",
    driverId: ({ "CM-077": "lm", "CM-231": "ar", "CM-162": "sv", "CM-212": "cl", "CM-245":"eq", "CM-256":"rv", "CM-267":"pc" } as Record<string, string>)[vehicle.code] ?? null,
    updatedAt: vehicle.carrierId?vehicle.updatedAt:EXAMPLE_AS_OF, statusChangedAt: vehicle.carrierId?(vehicle.statusChangedAt??vehicle.updatedAt):EXAMPLE_AS_OF })) };
}
const active = (stage: DemoStage) => stage === "ASSIGNED" || stage === "EN_ROUTE";
export function driverBusy(state: FleetDemoState, driverId: string, exceptTripId?: string) {
  return state.trips.some(trip => trip.id !== exceptTripId && trip.driverId === driverId && active(trip.stage));
}
function operatingStatus(vehicle: FleetVehicle, stage: DemoStage) {
  return ["MAINTENANCE", "OUT_OF_SERVICE"].includes(vehicle.status) ? vehicle.status : active(stage) ? "IN_SERVICE" : "AVAILABLE";
}
export function demoFleetVehicles(state: FleetDemoState, vehicles = exampleFleet()) {
  return vehicles.map(vehicle => {
    const trip = state.trips.find(trip => trip.vehicleId === vehicle.id);
    if (vehicle.source !== "EXAMPLE" || !trip) return vehicle;
    const reasons = { UNASSIGNED: "Pendiente de asignar conductor.", ASSIGNED: "Conductor asignado; salida pendiente.",
      EN_ROUTE: "Viaje en curso.", COMPLETED: "Viaje finalizado; pendiente de una nueva asignación." };
    return { ...vehicle, status: operatingStatus(vehicle, trip.stage), updatedAt: vehicle.carrierId&&vehicle.updatedAt>trip.updatedAt?vehicle.updatedAt:trip.updatedAt, statusChangedAt: vehicle.carrierId&&vehicle.statusChangedAt&&vehicle.statusChangedAt>trip.statusChangedAt?vehicle.statusChangedAt:trip.statusChangedAt,
      driver: active(trip.stage) ? demoDrivers.find(driver => driver.id === trip.driverId)?.name ?? null : null,
      driverProfile: active(trip.stage)?fleetDriverById(trip.driverId):regularFleetDriver(vehicle.code),
      driverProfileRole: active(trip.stage)?"assigned" as const:"regular" as const,
      statusReason: ["MAINTENANCE", "OUT_OF_SERVICE"].includes(vehicle.status)||vehicle.carrierId&&trip.stage==="UNASSIGNED"&&trip.updatedAt<=(vehicle.createdAt??vehicle.updatedAt) ? vehicle.statusReason : reasons[trip.stage],
      speedKmh: vehicle.carrierId?null:trip.stage === "EN_ROUTE" ? vehicle.speedKmh || 38 : 0 };
  });
}
export type DemoCommand = { type: "assign"; tripId: string; driverId: string } | { type: "start" | "finish" | "release"; tripId: string };
export type DemoError = "INVALID_TRIP" | "VEHICLE_BLOCKED" | "INVALID_DRIVER" | "DRIVER_BUSY" | "INVALID_TRANSITION";
export function applyDemoCommand(state: FleetDemoState, command: DemoCommand, at = new Date().toISOString(), vehicles=exampleFleet()):
  { state: FleetDemoState; error: DemoError | null } {
  const trip = state.trips.find(trip => trip.id === command.tripId);
  const vehicle = trip ? vehicles.find(vehicle => vehicle.id === trip.vehicleId) : null;
  const reject = (error: DemoError) => ({ state, error });
  if (!trip || !vehicle) return reject("INVALID_TRIP");
  if (["MAINTENANCE", "OUT_OF_SERVICE"].includes(vehicle.status)) return reject("VEHICLE_BLOCKED");
  let stage: DemoStage, driverId = trip.driverId;
  if (command.type === "assign") {
    if (trip.stage !== "UNASSIGNED") return reject("INVALID_TRANSITION");
    if (!demoDrivers.some(driver => driver.id === command.driverId && driver.enabled)) return reject("INVALID_DRIVER");
    if (driverBusy(state, command.driverId, trip.id)) return reject("DRIVER_BUSY");
    stage = "ASSIGNED"; driverId = command.driverId;
  } else if (command.type === "start" && trip.stage === "ASSIGNED" && driverId) stage = "EN_ROUTE";
  else if (command.type === "finish" && trip.stage === "EN_ROUTE" && driverId) stage = "COMPLETED";
  else if (command.type === "release" && trip.stage === "ASSIGNED") { stage = "UNASSIGNED"; driverId = null; }
  else return reject("INVALID_TRANSITION");
  const statusChangedAt = operatingStatus(vehicle, trip.stage) !== operatingStatus(vehicle, stage) ? at : trip.statusChangedAt;
  return { error: null, state: { ...state, trips: state.trips.map(value => value.id === trip.id
    ? { ...value, stage, driverId, updatedAt: at, statusChangedAt } : value) } };
}
export function decodeFleetDemo(value: string | null, vehicles=exampleFleet()): FleetDemoState | null {
  try {
    const parsed = StateSchema.parse(JSON.parse(value ?? "null")), seed = createFleetDemo(vehicles);
    const ids = new Set<string>(), busy = new Set<string>();
    for (const trip of parsed.trips) {
      if (ids.has(trip.id) || !seed.trips.some(value => value.id === trip.id && value.vehicleId === trip.vehicleId)) return null;
      ids.add(trip.id);
      if (trip.driverId && !demoDrivers.some(driver => driver.id === trip.driverId && driver.enabled)) return null;
      if (trip.stage === "UNASSIGNED" && trip.driverId || trip.stage !== "UNASSIGNED" && !trip.driverId) return null;
      if (vehicles.find(value => value.id === trip.vehicleId)?.status === "MAINTENANCE" && trip.stage !== "UNASSIGNED") return null;
      if (trip.driverId && active(trip.stage)) { if (busy.has(trip.driverId)) return null; busy.add(trip.driverId); }
    }
    // Original six trips must remain intact. Append only new catalog entries, preserving all saved changes.
    const originalCodes=["CM-077","CM-231","CM-311","CM-204","CM-162","CM-212"];
    if(originalCodes.some(code=>!ids.has("trip-"+code)))return null;
    const additions=seed.trips.filter(trip=>!ids.has(trip.id)).map(trip=>{
      if(trip.driverId&&busy.has(trip.driverId))return {...trip,stage:"UNASSIGNED" as const,driverId:null};
      if(trip.driverId&&active(trip.stage))busy.add(trip.driverId);
      return trip;
    });
    return {...parsed,trips:[...parsed.trips,...additions]};
  } catch { return null; }
}
