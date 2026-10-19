import { truckDesign, familyDesign } from './visual-catalog';
import type { TruckVisualType } from './truck-model';

export type AssetVisualReference = {
  family: TruckVisualType;
  designId: string;
  name: string;
  poster: string;
  source: 'RECORDED_DESIGN' | 'EQUIPMENT_REFERENCE';
};

/** A presentation association; never changes equipment, capacity or availability. */
export function associateAssetVisual(input: {
  equipmentType: string; bodyType: string; modelName?: string | null; designHint?: string | null;
}): AssetVisualReference | null {
  const text = `${input.bodyType} ${input.equipmentType} ${input.modelName ?? ''}`.toLowerCase();
  let family: TruckVisualType | null = null;
  if (/reefer|refriger|cold/.test(text)) family = 'refrigerated';
  else if (/curtain|lona/.test(text)) family = 'curtainsider';
  else if (/low.?loader|low.?bed|cama baja/.test(text)) family = 'lowloader';
  else if (/tank|cisterna/.test(text)) family = 'tanker';
  else if (/mixer|mezclador/.test(text)) family = 'mixer';
  else if (/logging|maderero|timber/.test(text)) family = 'logging';
  else if (/tipper|dump|volquete/.test(text)) family = 'tipper';
  else if (/flat|platform|plataforma/.test(text)) family = 'flatbed';
  else if (/tractor|articul|semi|trailer/.test(text)) family = 'articulated';
  else if (/rigid|rígido|box/.test(text)) family = 'rigid';
  if (!family) return null;
  const hint = truckDesign(input.designHint);
  const recorded = hint?.family === family ? hint : null;
  const design = recorded ?? familyDesign(family);
  return { family, designId: design.id, name: design.name,
    poster: `/v2-workspace/trucks/${family}-3d.png`,
    source: recorded ? 'RECORDED_DESIGN' : 'EQUIPMENT_REFERENCE' };
}
