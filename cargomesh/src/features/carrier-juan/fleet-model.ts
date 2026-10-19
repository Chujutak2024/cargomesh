import { additionalLocalFleet } from "@/features/carrier-portal/fleet-local-additions";
import { FleetOutputsV2 } from "@/shared/schemas/v2/fleet";
import { recordData, type PortalRecord } from "./records";
import type { TruckVisualType } from "@/features/logistics-3d/truck-model";
import { regularFleetDriver, type FleetDriver } from "./fleet-drivers";

export type FleetStatus = "AVAILABLE" | "IN_SERVICE" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type EngineDay = { date: string; driving: number; idle: number };
export type FleetZone = { id: string; name: string; cities: string[]; countryCode: string };
export type FleetJourney = { origin: string; destination: string; facility: string; departureAt: string; arrivalAt: string };
export type FleetMaintenanceEvent = { id: string; kind: string; startsAt: string; endsAt: string; status: string };
export type FleetVehicle = {
  visual?: import("@/features/logistics-3d/asset-visual").AssetVisualReference | null;
  regularDriverId?:string|null;regularDriverProfile?:FleetDriver|null;
  driverId?:string|null;carrierId?:string;siteId?:string;modelYear?:number;photoDataUrl?:string|null;volumeM3?:number;insuranceUntil?:string;inspectionUntil?:string;
  id: string; code: string; source: "EXAMPLE" | "SERVICE"; status: FleetStatus;
  variant: TruckVisualType; model: string | null; plate: string | null; body: string;
  odometerKm: number | null; capacityKg: number; updatedAt: string;
  driver: string | null; depot: string | null; location: string | null;
  driverProfile?: FleetDriver | null; driverProfileRole?: "assigned" | "regular" | null;
  coordinates: { lat: number; lng: number } | null;
  // Circulation cannot be inferred from IN_SERVICE, assignments or a last-known position.
  speedKmh: number | null; fuelPercent: number | null; conditionScore: number | null;
  utilizationPercent: number | null; costPerKm: number | null;
  maintenance: { kind: string; startsAt: string; endsAt: string; status: string } | null;
  engineDays: EngineDay[];
  createdAt: string | null; registeredAt: string | null; description: string | null;
  statusReason: string | null; statusChangedAt: string | null;
  tankLiters: number | null; consumptionLitersPer100Km: number | null;
  workingZones: FleetZone[] | null; journey: FleetJourney | null;
  maintenanceHistory: FleetMaintenanceEvent[] | null;
};
export type FleetFilter = "all" | "service" | "maintenance" | "due" | "fuel" | "reefer";
export type FleetSort = "attention" | "code" | "fuel";
export const EXAMPLE_AS_OF = "2026-10-08T15:00:00Z";
const visualType = (body: string): TruckVisualType => {
  const text = body.toLowerCase();
  if (/refriger|reefer|cold/.test(text)) return "refrigerated";
  if (/tanker|cisterna/.test(text)) return "tanker";
  if (/mixer|mezclador/.test(text)) return "mixer";
  if (/curtain|lona/.test(text)) return "curtainsider";
  if (/lowloader|low.loader|cama baja/.test(text)) return "lowloader";
  if (/logging|maderero/.test(text)) return "logging";
  if (/tipper|dump|volquete/.test(text)) return "tipper";
  if (/flat|platform|plataforma/.test(text)) return "flatbed";
  if (/rigid|rígido|box/.test(text)) return "rigid";
  return "articulated";
};
export function maintenanceDue(vehicle: FleetVehicle, now: number) {
  const maintenance = vehicle.maintenance;
  return !!maintenance && maintenance.status !== "COMPLETED" && maintenance.status !== "CANCELLED"
    && Date.parse(maintenance.endsAt) >= now && Date.parse(maintenance.startsAt) <= now + 7 * 86400000;
}
export function matchesFleetFilter(vehicle: FleetVehicle, filter: FleetFilter, now: number) {
  return filter === "all" || filter === "service" && vehicle.status === "IN_SERVICE"
    || filter === "maintenance" && vehicle.status === "MAINTENANCE"
    || filter === "due" && maintenanceDue(vehicle, now)
    || filter === "fuel" && vehicle.fuelPercent !== null && vehicle.fuelPercent < 25
    || filter === "reefer" && vehicle.variant === "refrigerated";
}
export function attentionRank(vehicle: FleetVehicle, now: number) {
  return vehicle.status === "OUT_OF_SERVICE" ? 0 : vehicle.status === "MAINTENANCE" ? 1
    : vehicle.fuelPercent !== null && vehicle.fuelPercent < 25 ? 2 : maintenanceDue(vehicle, now) ? 3
    : vehicle.conditionScore !== null && vehicle.conditionScore < 70 ? 4 : 5;
}
export function filterFleet(vehicles: FleetVehicle[], filter: FleetFilter, search: string, sort: FleetSort, now: number) {
  const query = search.trim().toLocaleLowerCase();
  return vehicles.filter(vehicle => matchesFleetFilter(vehicle, filter, now)
    && [vehicle.code, vehicle.model, vehicle.plate, vehicle.driver, vehicle.driverProfile?.name, vehicle.location, vehicle.body].filter(Boolean).join(" ").toLocaleLowerCase().includes(query))
    .sort((a, b) => (sort === "attention" ? attentionRank(a, now) - attentionRank(b, now)
      : sort === "fuel" ? (a.fuelPercent ?? Infinity) - (b.fuelPercent ?? Infinity) : 0) || a.code.localeCompare(b.code));
}
type FleetRecords = { assets: PortalRecord[]; drivers: PortalRecord[]; vehicleAssignments: PortalRecord[];
  driverAssignments: PortalRecord[]; executions: PortalRecord[]; depots: PortalRecord[]; maintenances: PortalRecord[] };
const activeWindow = (value: Record<string, unknown>, now: number) => {
  const window = value.window as { startsAt?: string; endsAt?: string } | undefined;
  return value.status === "CONFIRMED" && !!window?.startsAt && !!window.endsAt
    && Date.parse(window.startsAt) <= now && Date.parse(window.endsAt) > now;
};
/** Inputs have already passed canonical schema and carrier-scope checks at the read boundary. */
export function serviceFleet(records: FleetRecords, now: number): FleetVehicle[] {
  return records.assets.flatMap(record => {
    const asset = FleetOutputsV2.assets.parse(recordData(record));
    if (asset.mode !== "ROAD" || !asset.roadVehicle) return [];
    const road = asset.roadVehicle;
    const assignments = records.vehicleAssignments.map(recordData).filter(value => value.assetId === record.id
      && value.serviceId === asset.serviceId && activeWindow(value, now));
    const assignment = assignments.length === 1 ? assignments[0] : null;
    const execution = assignment ? records.executions.find(value => value.id === assignment.executionId
      && recordData(value).serviceId === asset.serviceId && value.status === "IN_PROGRESS") : null;
    const drivers = execution ? records.driverAssignments.map(recordData).filter(value => value.executionId === execution.id
      && value.serviceId === asset.serviceId && value.role === "PRIMARY" && activeWindow(value, now)) : [];
    const driver = drivers.length === 1 ? records.drivers.find(value => value.id === drivers[0].driverId
      && recordData(value).serviceId === asset.serviceId) : null;
    const depot = records.depots.find(value => value.id === asset.homeDepotId);
    const position = execution ? recordData(execution).lastKnownPosition as { city?: string; countryCode?: string; lat?: number | null; lng?: number | null } | null : null;
    const maintenances = records.maintenances.map(recordData).filter(value => value.assetId === record.id
      && value.serviceId === asset.serviceId && (value.status === "SCHEDULED" || value.status === "IN_PROGRESS"))
      .filter(value => Date.parse((value.blockedWindow as { endsAt: string }).endsAt) >= now)
      .sort((a, b) => Date.parse((a.blockedWindow as { startsAt: string }).startsAt) - Date.parse((b.blockedWindow as { startsAt: string }).startsAt));
    const maintenance = maintenances[0];
    return [{ id: record.id, code: asset.code, source: "SERVICE" as const, status: asset.operatingStatus,
      variant: visualType(road.bodyType + " " + asset.equipmentType), model: [road.brand, road.model, road.variant].filter(Boolean).join(" ") || null,
      plate: road.plate, body: road.bodyType, odometerKm: road.odometerKm, capacityKg: asset.usefulCapacityKg,
      updatedAt: record.updatedAt, driver: driver ? String(recordData(driver).fullName) : null,
      createdAt: "createdAt" in record && typeof record.createdAt === "string" ? record.createdAt : null,
      registeredAt: road.registeredAt, description: null, statusReason: road.conditionReason,
      statusChangedAt: null, tankLiters: null, consumptionLitersPer100Km: null, workingZones: null, journey: null, maintenanceHistory: null,
      depot: depot ? String(recordData(depot).name) : null, location: position?.city ? [position.city, position.countryCode].filter(Boolean).join(", ") : null,
      coordinates: position && typeof position.lat === "number" && typeof position.lng === "number"
        && Number.isFinite(position.lat) && Number.isFinite(position.lng) && Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180
        ? { lat: position.lat, lng: position.lng } : null,
      speedKmh: null, fuelPercent: null, conditionScore: null, utilizationPercent: null, costPerKm: null, engineDays: [],
      maintenance: maintenance ? { kind: String(maintenance.kind), status: String(maintenance.status),
        ...(maintenance.blockedWindow as { startsAt: string; endsAt: string }) } : null }];
  });
}

/** Design-only local fixtures. Never submitted to any catalog, workflow or draft. */
export function exampleFleet(): FleetVehicle[] {
  const rows = [
    ["CM-077", "refrigerated", "IN_SERVICE", "Tracto refrigerado", "L. Martínez", "Trujillo, PE", 41, 118760, 64, 76, 3.4, 58, "2026-10-08"],
    ["CM-231", "articulated", "IN_SERVICE", "Tracto con remolque", "A. Rojas", "Arequipa, PE", 22, 91330, 72, 83, 3.8, 64, "2026-10-20"],
    ["CM-311", "rigid", "MAINTENANCE", "Camión rígido", "M. Torres", "Taller · Callao, PE", 90, 102215, 81, 62, 2.8, 0, "2026-10-08"],
    ["CM-204", "flatbed", "IN_SERVICE", "Camión plataforma", "D. Castro", "Chiclayo, PE", 64, 82420, 86, 83, 3.1, 38, "2026-10-20"],
    ["CM-162", "tipper", "IN_SERVICE", "Volquete", "S. Vega", "Piura, PE", 78, 64105, 95, 88, 4.2, 45, "2026-11-08"],
    ["CM-212", "articulated", "AVAILABLE", "Tracto con semirremolque", "C. López", "Depósito · Callao, PE", 71, 58940, 93, 79, 3.6, 0, "2026-11-22"],
    ["CM-245", "tanker", "IN_SERVICE", "Camión cisterna", "E. Quispe", "Ica, PE", 68, 76980, 91, 86, 3.9, 52, "2026-10-28"],
    ["CM-328", "mixer", "MAINTENANCE", "Camión mezclador", "J. Paredes", "Taller · Lurín, PE", 86, 43620, 82, 68, 4.1, 0, "2026-10-09"],
    ["CM-256", "curtainsider", "IN_SERVICE", "Tracto con lona lateral", "R. Vargas", "Huancayo, PE", 57, 88210, 89, 84, 3.5, 48, "2026-11-03"],
    ["CM-289", "lowloader", "AVAILABLE", "Tracto con cama baja", "A. Valverde", "Lima, PE", 74, 94670, 94, 78, 4.6, 0, "2026-11-14"],
    ["CM-267", "logging", "IN_SERVICE", "Camión maderero", "P. Cárdenas", "Pucallpa, PE", 62, 113450, 88, 81, 4.0, 41, "2026-11-06"],
    ["CM-304", "refrigerated", "AVAILABLE", "Tracto refrigerado", "V. Ramírez", "Cusco, PE", 83, 39280, 96, 74, 3.7, 0, "2026-11-26"],
  ] as const;
  const models = ["Scania R 450", "Volvo FH 460", "DAF LF 230", "MAN TGX 26.440", "Scania R 470", "Freightliner Cascadia", "Volvo FM 420", "Scania P 410", "Scania R 520", "MAN TGX 33.480", "Scania R 620", "Mercedes-Benz Actros 1845"];
  const descriptions = ["Semirremolque refrigerado para carga con temperatura controlada.", "Tracto para transporte de carga general y mercancía paletizada.", "Furgón rígido para distribución y reparto entre centros logísticos.", "Plataforma abierta para maquinaria y materiales de gran tamaño.", "Volquete para agregados y materiales de construcción.", "Tracto con semirremolque cerrado para distribución de carga seca."];
  const zones: FleetZone[] = [
    { id: "north", name: "Costa norte", cities: ["Trujillo", "Chiclayo", "Piura"], countryCode: "PE" },
    { id: "south", name: "Corredor sur", cities: ["Lima", "Ica", "Arequipa"], countryCode: "PE" },
    { id: "central", name: "Lima y Callao", cities: ["Callao", "Lima", "Lurín"], countryCode: "PE" },
    { id: "highlands", name: "Corredor central", cities: ["Huancayo", "Huánuco", "Pucallpa"], countryCode: "PE" },
  ];
  const routeCities = [["Trujillo, Perú", "Piura, Perú"], ["Arequipa, Perú", "Lima, Perú"], ["Callao, Perú", "Lima, Perú"],
    ["Chiclayo, Perú", "Trujillo, Perú"], ["Piura, Perú", "Chiclayo, Perú"], ["Callao, Perú", "Arequipa, Perú"],
    ["Ica, Perú","Lima, Perú"],["Lurín, Perú","Lima, Perú"],["Huancayo, Perú","Lima, Perú"],["Lima, Perú","Ica, Perú"],["Pucallpa, Perú","Huánuco, Perú"],["Cusco, Perú","Arequipa, Perú"]];
  const additionalDescriptions=["Cisterna de líquidos con escotillas y barandas de seguridad.","Mezclador de concreto para abastecimiento de obra.","Semirremolque de lona lateral para carga paletizada.","Cama baja para maquinaria y equipos de gran tamaño.","Unidad maderera con soportes de sujeción para troncos.","Semirremolque refrigerado para distribución en el corredor sur."];
  const original: FleetVehicle[] = rows.map((row, index) => ({
    id: "example-" + row[0], code: row[0], variant: row[1], source: "EXAMPLE", status: row[2], model: models[index], body: row[3],
    driver: row[4], location: row[5], fuelPercent: row[6], odometerKm: row[7], conditionScore: row[8],
    driverProfile: regularFleetDriver(row[0]), driverProfileRole:"regular",
    utilizationPercent: row[9], costPerKm: row[10], speedKmh: row[11], plate: "SIM-" + String(index + 1).padStart(3, "0"), depot: "Centro logístico · Callao",
    capacityKg: row[1] === "rigid" ? 8000 : row[1] === "mixer" ? 16000 : row[1] === "lowloader" ? 32000 : 24000, coordinates: null, updatedAt: EXAMPLE_AS_OF,
    createdAt: `2025-${String(index + 1).padStart(2,"0")}-12T15:00:00Z`, registeredAt: `2024-${String(index + 1).padStart(2,"0")}-15`, description: descriptions[index]??additionalDescriptions[index-6],
    statusReason: index === 2 ? "Revisión de frenos; vehículo temporalmente en taller." : index===7?"Ajuste del sistema hidráulico del tambor.":"Sin incidencias registradas.",
    statusChangedAt: EXAMPLE_AS_OF, tankLiters: row[1] === "rigid" ? 200 : 600, consumptionLitersPer100Km: row[1] === "rigid" ? 22 : 32,
    workingZones: index===8||index===10?[zones[3]]:index===6||index===9||index===11?[zones[1],zones[2]]:index===7?[zones[2]]:index === 1 || index === 5 ? [zones[1], zones[2]] : index === 2 ? [zones[2]] : [zones[0], zones[2]],
    journey: { origin: routeCities[index][0], destination: routeCities[index][1], facility: "Centro logístico de destino",
      departureAt: "2026-10-08T13:00:00Z", arrivalAt: "2026-10-09T00:00:00Z" },
    maintenanceHistory: [0, 1, 2, 4].includes(index) ? [{ id: `history-${index}`, kind: "Mantenimiento preventivo",
      startsAt: `2026-0${index + 1}-10T14:00:00Z`, endsAt: `2026-0${index + 1}-10T22:00:00Z`, status: "COMPLETED" }] : [],
    maintenance: { kind: index === 2 ? "Revisión de frenos" : index===7?"Sistema hidráulico":"Mantenimiento preventivo", startsAt: row[12] + "T14:00:00Z",
      endsAt: row[12] + "T22:00:00Z", status: index === 2||index===7 ? "IN_PROGRESS" : "SCHEDULED" },
    engineDays: Array.from({ length: 14 }, (_, day) => ({ date: new Date(Date.UTC(2026, 8, 25 + day)).toISOString().slice(0, 10),
      driving: [8.2, 8.5, 6.4, 4.8, 0, 0, 7.3, 8.1, 9.1, 5.9, 8.6, 0, 6.2, 7.8][(day + index) % 14],
      idle: [0.6, 0.4, 0.8, 0.2, 0, 0, 0.5][(day + index) % 7] })),
  }));
  return [...original, ...additionalLocalFleet(EXAMPLE_AS_OF)];
}

export function remainingRangeKm(vehicle: FleetVehicle) {
  const { fuelPercent, tankLiters, consumptionLitersPer100Km } = vehicle;
  return fuelPercent !== null && tankLiters !== null && consumptionLitersPer100Km !== null
    && Number.isFinite(fuelPercent) && fuelPercent >= 0 && fuelPercent <= 100
    && Number.isFinite(tankLiters) && tankLiters > 0 && Number.isFinite(consumptionLitersPer100Km) && consumptionLitersPer100Km > 0
    ? Math.round(fuelPercent / 100 * tankLiters / consumptionLitersPer100Km * 100) : null;
}

export function fleetSummary(vehicles: FleetVehicle[], now: number) {
  const start = new Date(now); start.setUTCFullYear(start.getUTCFullYear() - 1);
  const maintained = vehicles.filter(vehicle => vehicle.maintenanceHistory?.some(event => event.status === "COMPLETED"
    && Date.parse(event.endsAt) >= start.getTime() && Date.parse(event.endsAt) <= now)).length;
  return { total: vehicles.length, normal: vehicles.filter(vehicle => ["AVAILABLE", "IN_SERVICE"].includes(vehicle.status)).length,
    maintenance: vehicles.filter(vehicle => vehicle.status === "MAINTENANCE").length,
    maintained, annualPercent: vehicles.length && vehicles.every(vehicle => vehicle.maintenanceHistory !== null)
      ? maintained / vehicles.length * 100 : null, startsAt: start.toISOString(), endsAt: new Date(now).toISOString() };
}
