import type { FleetVehicle } from './fleet-model';

/** Explicit additions to the local presentation. Never used by serviceFleet. */
export function additionalLocalFleet(asOf: string): FleetVehicle[] {
  const rows = [
    { code: 'CM-401', variant: 'rigid', model: 'City Box', body: 'Camión rígido', capacity: 8000, volume: 38, description: 'Furgón de distribución con plataforma elevadora posterior.' },
    { code: 'CM-402', variant: 'articulated', model: 'Aero Linehaul', body: 'Tracto con remolque', capacity: 24000, volume: 86, description: 'Tracto de caja cerrada con cabina alta y deflector.' },
    { code: 'CM-403', variant: 'refrigerated', model: 'Cold Guard', body: 'Refrigerado', capacity: 20000, volume: 78, description: 'Semirremolque refrigerado con protecciones laterales.' },
    { code: 'CM-404', variant: 'flatbed', model: 'Platform Rack', body: 'Plataforma', capacity: 24000, volume: 65, description: 'Plataforma abierta con bastidor frontal reforzado.' },
    { code: 'CM-405', variant: 'curtainsider', model: 'Aero Curtainsider', body: 'Lona lateral', capacity: 24000, volume: 90, description: 'Semirremolque de lona lateral con deflector aerodinámico.' },
    { code: 'CM-406', variant: 'logging', model: 'Timber Reinforced', body: 'Maderero', capacity: 24000, volume: 62, description: 'Unidad maderera con soportes y protección frontal.' },
  ] as const;
  return rows.map((row, index) => ({
    id: 'example-' + row.code, code: row.code, source: 'EXAMPLE', variant: row.variant, status: 'AVAILABLE',
    model: 'CargoMesh ' + row.model, modelYear: 2025, plate: 'SIM-' + String(index + 13).padStart(3, '0'), body: row.body,
    carrierId: 'tomate', siteId: 'tomate-callao', depot: 'Base Callao', location: null, coordinates: null,
    capacityKg: row.capacity, volumeM3: row.volume, description: 'Demo local: ' + row.description,
    updatedAt: asOf, createdAt: asOf, registeredAt: asOf.slice(0,10), statusChangedAt: asOf,
    statusReason: 'Demo local: sin tarea asignada; la base no confirma presencia ni disponibilidad.',
    driver: null, driverProfile: null, driverProfileRole: null, journey: null, speedKmh: null,
    odometerKm: null, fuelPercent: null, tankLiters: null, consumptionLitersPer100Km: null,
    conditionScore: null, utilizationPercent: null, costPerKm: null, engineDays: [],
    maintenance: null, maintenanceHistory: null, workingZones: null,
  }));
}

/** Saved user records win over new defaults; no storage mutation or ID rewrite. */
export function mergeLocalFleet(defaults: FleetVehicle[], saved: FleetVehicle[]): FleetVehicle[] {
  const normalize = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();
  const ids = new Set(saved.map(vehicle => vehicle.id)), codes = new Set(saved.map(vehicle => normalize(vehicle.code)));
  const plates = new Set(saved.flatMap(vehicle => vehicle.plate ? [normalize(vehicle.plate)] : []));
  return [...defaults.filter(vehicle => !ids.has(vehicle.id) && !codes.has(normalize(vehicle.code)) && !(vehicle.plate && plates.has(normalize(vehicle.plate)))), ...saved];
}
