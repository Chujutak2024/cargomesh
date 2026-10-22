import { truckDesign, truckDesigns, compatibleTruckDesign, type TruckBody } from './visual-catalog';
import type { TruckVisualType } from './truck-model';

export type AssetVisualReference = {
  family: TruckVisualType;
  body: TruckBody;
  designId: string;
  name: string;
  poster: string;
  source: 'RECORDED_DESIGN' | 'EQUIPMENT_REFERENCE';
};

/** A presentation association; never changes equipment, capacity or availability. */
export function associateAssetVisual(input: {
  equipmentType: string; bodyType: string; modelName?: string | null; designHint?: string | null; referenceKey?: string;
}): AssetVisualReference | null {
  // Explicit body/equipment fields are authoritative; commercial names are not.
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[ -]+/g, '_');
  const equipment = normalize(input.equipmentType), body = bodies[normalize(input.bodyType)];
  if (!body) return null;
  const candidate = truckDesigns.find(design => {
    if (!allowedEquipment[design.family].includes(equipment)) return false;
    if (body === 'box' && equipment === 'TRACTOR_TRAILER' && design.family !== 'articulated') return false;
    if (body === 'box' && equipment === 'BOX_TRUCK' && design.family !== 'rigid') return false;
    return compatibleTruckDesign(design, design.family, body);
  });
  if (!candidate) return null;
  const family = candidate.family;
  const hint = truckDesign(input.designHint);
  const recorded = hint && compatibleTruckDesign(hint, family, body) ? hint : null;
  const references = truckDesigns.filter(design => compatibleTruckDesign(design, family, body));
  const referenceIndex = Array.from(input.referenceKey ?? '').reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0);
  const design = recorded ?? (input.referenceKey ? references[referenceIndex % references.length] : candidate);
  return { family, body, designId: design.id, name: design.name,
    poster: design.appearance.bodyStyle ? '/v2-workspace/trucks/reference.svg' : `/v2-workspace/trucks/${family}-3d.png`,
    source: recorded ? 'RECORDED_DESIGN' : 'EQUIPMENT_REFERENCE' };
}

const bodies: Record<string, TruckBody> = {
  BOX: 'box', BOX_BODY: 'box', DRY_BOX: 'box', CAJA_SECA: 'box', FURGON: 'box',
  REEFER: 'refrigerated', REFRIGERATED: 'refrigerated', REFRIGERADO: 'refrigerated',
  CURTAINSIDER: 'curtainsider', CURTAIN: 'curtainsider', LONA_LATERAL: 'curtainsider',
  PLATFORM: 'flatbed', FLATBED: 'flatbed', PLATAFORMA: 'flatbed',
  LOWLOADER: 'lowloader', LOW_BED: 'lowloader', CAMA_BAJA: 'lowloader',
  TANKER: 'tanker', CISTERNA: 'tanker', MIXER: 'mixer', MEZCLADOR: 'mixer',
  LOGGING: 'logging', TIMBER: 'logging', MADERERO: 'logging', TIPPER: 'tipper', VOLQUETE: 'tipper',
  CAR_CARRIER: 'car-carrier', PORTAVEHICULOS: 'car-carrier', LIVESTOCK: 'livestock', GANADERO: 'livestock',
  CRANE: 'crane', GRUA: 'crane', REFUSE: 'refuse', RECOLECTOR: 'refuse', BULK_SILO: 'bulk-silo', SILO: 'bulk-silo',
};
const allowedEquipment: Record<TruckVisualType, readonly string[]> = {
  rigid: ['BOX_TRUCK', 'OTHER'], articulated: ['TRACTOR_TRAILER', 'OTHER'],
  refrigerated: ['REEFER_TRUCK', 'TRACTOR_TRAILER', 'OTHER'], curtainsider: ['TRACTOR_TRAILER', 'OTHER'],
  flatbed: ['FLATBED', 'FLATBED_TRUCK', 'OTHER'], lowloader: ['TRACTOR_TRAILER', 'OTHER'],
  tanker: ['TANKER_TRUCK', 'OTHER'], mixer: ['OTHER'], logging: ['FLATBED', 'OTHER'], tipper: ['OTHER'],
};
