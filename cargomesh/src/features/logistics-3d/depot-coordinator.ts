import type { TruckVisualType } from './truck-model';
import { familyDesign, truckDesign } from './visual-catalog';
import { depotTemplates, type DepotTemplateId } from './depot-templates';
import type { DepotCameraState } from './depot-camera';

export type YardPhase = 'loading' | 'waiting' | 'parked' | 'departing' | 'departed' | 'maintenance' | 'manoeuvring' | 'docking' | 'ready' | 'unknown';
export type YardVehicle = {
  assetId: string; label: string; family: TruckVisualType; phase: YardPhase;
  resourceCode: string | null; reserved: boolean;
  motion: 'loader-a' | 'queue-b' | 'exit-d' | null;
  slot: [number, number, number];
  cargo: 'PALLETS' | null; tripId: string | null; designId?: string;
  visitor?: { visitId: string; authorized: true };
};
export type YardEvent = { eventId: string; atMs: number; assetId: string; phase: YardPhase; resourceCode: string | null; message: string };
export type YardScenario = {
  scenarioId: string; siteId: string; source: 'SIMULATED'; durationMs: number;
  vehicles: YardVehicle[]; events: YardEvent[];
};
export type YardSnapshot = {
  scenarioId: string; siteId: string; source: 'SIMULATED'; elapsedMs: number;
  vehicles: readonly YardVehicle[]; selectedAssetId: string | null;
  interior: boolean; requestedPlay: boolean | null; completed: boolean; focusInstant: boolean;
  lastEvent: string; eventIds: readonly string[];
  templateId: DepotTemplateId;
};

export const yardPhaseLabels: Record<YardPhase, string> = {
  loading: 'Loading', waiting: 'Waiting', parked: 'Parked', departing: 'Departing',
  departed: 'Departed', maintenance: 'Maintenance', manoeuvring: 'Entering yard',
  docking: 'Docking', ready: 'Load secured', unknown: 'Location unknown',
};

/** Explicit presentation fixture. Its IDs and clock never represent business records. */
export function createDepotScenario(): YardScenario {
  return {
    scenarioId: 'depot-five-trucks-v1', siteId: 'visual-depot-01', source: 'SIMULATED', durationMs: 90000,
    vehicles: [
      { assetId: 'visual-truck-a', label: 'Truck A', family: 'articulated', phase: 'loading', resourceCode: 'BAY_02', reserved: false, motion: 'loader-a', slot: [3, 3.7, Math.PI / 2], cargo: 'PALLETS', tripId: 'visual-trip-a' },
      { assetId: 'visual-truck-b', label: 'Truck B', family: 'refrigerated', phase: 'waiting', resourceCode: null, reserved: false, motion: 'queue-b', slot: [-10.8, 9, Math.PI], cargo: 'PALLETS', tripId: 'visual-trip-b' },
      { assetId: 'visual-truck-c', label: 'Truck C', family: 'rigid', phase: 'parked', resourceCode: null, reserved: true, motion: null, slot: [-10.2, -3.4, Math.PI / 2], cargo: null, tripId: null },
      { assetId: 'visual-truck-d', label: 'Truck D', family: 'flatbed', phase: 'departing', resourceCode: null, reserved: false, motion: 'exit-d', slot: [10.5, 9, Math.PI], cargo: 'PALLETS', tripId: 'visual-trip-d' },
      { assetId: 'visual-truck-e', label: 'Truck E', family: 'tipper', phase: 'maintenance', resourceCode: 'BAY_03', reserved: false, motion: null, slot: [7, 2.77, Math.PI / 2], cargo: null, tripId: null },
    ],
    events: [
      { eventId: 'd-clears-exit', atMs: 8000, assetId: 'visual-truck-d', phase: 'departed', resourceCode: null, message: 'Truck D has cleared the exit with its load secured.' },
      { eventId: 'a-load-secured', atMs: 18000, assetId: 'visual-truck-a', phase: 'ready', resourceCode: 'BAY_02', message: 'Truck A: loading complete. Bay 02 remains occupied during release checks.' },
      { eventId: 'a-leaves-bay', atMs: 22000, assetId: 'visual-truck-a', phase: 'departing', resourceCode: 'BAY_02', message: 'Truck A is leaving. Truck B waits until the manoeuvre is clear.' },
      { eventId: 'a-clears-yard', atMs: 40000, assetId: 'visual-truck-a', phase: 'departed', resourceCode: null, message: 'Truck A has departed. Bay 02 is now clear.' },
      { eventId: 'b-enters-yard', atMs: 44000, assetId: 'visual-truck-b', phase: 'manoeuvring', resourceCode: null, message: 'Truck B enters the yard after Truck A has cleared the lane.' },
      { eventId: 'b-claims-bay', atMs: 54000, assetId: 'visual-truck-b', phase: 'docking', resourceCode: 'BAY_02', message: 'Truck B is docking at Bay 02.' },
      { eventId: 'b-load-starts', atMs: 68000, assetId: 'visual-truck-b', phase: 'loading', resourceCode: 'BAY_02', message: 'Truck B is loading. Truck C stays parked and reserved; Truck E stays in maintenance.' },
      { eventId: 'b-load-secured', atMs: 89000, assetId: 'visual-truck-b', phase: 'ready', resourceCode: 'BAY_02', message: 'Truck B: load secured. The visual scenario is complete.' },
    ],
  };
}

function project(scenario: YardScenario, elapsedMs: number) {
  const vehicles = scenario.vehicles.map(vehicle => ({ ...vehicle, slot: [...vehicle.slot] as YardVehicle['slot'] }));
  const ids: string[] = [];
  let message = vehicles.length ? 'Visual scenario ready. Select a vehicle to inspect its current activity.' : 'No vehicles in this visual scenario.';
  for (const event of scenario.events) {
    if (event.atMs > elapsedMs) break;
    const vehicle = vehicles.find(item => item.assetId === event.assetId)!;
    if (vehicle.phase === 'maintenance') throw new Error('MAINTENANCE_IS_BLOCKED');
    if (event.resourceCode && vehicles.some(item => item.assetId !== vehicle.assetId && item.resourceCode === event.resourceCode)) throw new Error('VISUAL_BAY_OCCUPIED');
    vehicle.phase = event.phase;
    vehicle.resourceCode = event.resourceCode;
    ids.push(event.eventId); message = event.message;
  }
  return { vehicles, eventIds: ids, lastEvent: message };
}

/** In-memory visual state owned above the views. No storage, network or reservations. */
export function createDepotCoordinator(input = createDepotScenario()) {
  if (input.source !== 'SIMULATED' || !Number.isFinite(input.durationMs) || input.durationMs <= 0) throw new Error('INVALID_VISUAL_SCENARIO');
  const scenario: YardScenario = { ...input, vehicles: input.vehicles.map(v => ({ ...v, designId: v.designId ?? familyDesign(v.family).id, slot: [...v.slot], visitor: v.visitor ? { ...v.visitor } : undefined })), events: [] };
  const vehicleIds = new Set<string>(), resources = new Set<string>(), events = new Map<string, YardEvent>();
  for (const vehicle of scenario.vehicles) {
    if (vehicleIds.has(vehicle.assetId)) throw new Error('DUPLICATE_VISUAL_ASSET');
    if (truckDesign(vehicle.designId)?.family !== vehicle.family) throw new Error('INVALID_VISUAL_DESIGN');
    if (vehicle.cargo && truckDesign(vehicle.designId)?.appearance.bodyStyle) throw new Error('INCOMPATIBLE_VISUAL_CARGO');
    if (vehicle.visitor && vehicle.visitor.authorized !== true) throw new Error('UNAUTHORIZED_VISITOR');
    if (vehicle.resourceCode && resources.has(vehicle.resourceCode)) throw new Error('VISUAL_BAY_OCCUPIED');
    if (vehicle.phase === 'unknown' && vehicle.resourceCode) throw new Error('UNKNOWN_LOCATION_HAS_NO_BAY');
    vehicleIds.add(vehicle.assetId); if (vehicle.resourceCode) resources.add(vehicle.resourceCode);
  }
  for (const event of input.events) {
    if (!vehicleIds.has(event.assetId) || !Number.isFinite(event.atMs) || event.atMs < 0 || event.atMs > input.durationMs) throw new Error('INVALID_VISUAL_EVENT');
    const duplicate = events.get(event.eventId);
    if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(event)) throw new Error('CONFLICTING_VISUAL_EVENT');
    events.set(event.eventId, { ...event });
  }
  scenario.events = [...events.values()].sort((a, b) => a.atMs - b.atMs || a.eventId.localeCompare(b.eventId));
  project(scenario, scenario.durationMs); // Validate every transition before a canvas can consume it.
  let time = 0;
  let camera: DepotCameraState | null = null;
  let snapshot: YardSnapshot = { scenarioId: scenario.scenarioId, siteId: scenario.siteId, source: 'SIMULATED', elapsedMs: 0, ...project(scenario, 0), selectedAssetId: null, interior: false, requestedPlay: null, completed: false, focusInstant: true, templateId: 'distribution' };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<YardSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => snapshot,
    getElapsedMs: () => time,
    getCamera: () => camera ? { ...camera, position: [...camera.position] as DepotCameraState['position'], target: [...camera.target] as DepotCameraState['target'] } : null,
    rememberCamera(value: DepotCameraState) {
      if (![...value.position, ...value.target, value.zoom].every(Number.isFinite) || value.zoom < 3 || value.zoom > 100) throw new Error('INVALID_DEPOT_CAMERA');
      camera = { ...value, position: [...value.position], target: [...value.target] };
    },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    advance(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('INVALID_VISUAL_DELTA');
      if (snapshot.requestedPlay === false || snapshot.completed) return;
      time = Math.min(scenario.durationMs, time + deltaMs);
      // React receives four clock snapshots/second, never per vehicle/frame.
      const published = Math.floor(time / 250) * 250;
      if (published !== snapshot.elapsedMs || time === scenario.durationMs) update({ elapsedMs: published, ...project(scenario, time), completed: time === scenario.durationMs });
    },
    select(assetId: string | null, instant = false) {
      if (assetId !== null && !vehicleIds.has(assetId)) throw new Error('UNKNOWN_VISUAL_ASSET');
      if (assetId !== snapshot.selectedAssetId || instant !== snapshot.focusInstant) update({ selectedAssetId: assetId, focusInstant: instant });
    },
    setPlaying(playing: boolean) { update({ requestedPlay: playing }); },
    setInterior(interior: boolean) { update({ interior }); },
    setTemplate(templateId: DepotTemplateId) {
      if (!depotTemplates.some(template => template.id === templateId)) throw new Error('UNKNOWN_DEPOT_TEMPLATE');
      if (snapshot.templateId !== templateId) update({ templateId });
    },
    setDesign(assetId: string, designId: string) {
      const vehicle = scenario.vehicles.find(item => item.assetId === assetId), design = truckDesign(designId);
      if (!vehicle || !design || design.family !== vehicle.family) throw new Error('INVALID_VISUAL_DESIGN');
      if (vehicle.cargo && design.appearance.bodyStyle) throw new Error('INCOMPATIBLE_VISUAL_CARGO');
      vehicle.designId = designId;
      update({ ...project(scenario, time) });
    },
  };
}
export type DepotCoordinator = ReturnType<typeof createDepotCoordinator>;
