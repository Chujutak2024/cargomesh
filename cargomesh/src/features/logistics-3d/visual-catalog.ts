import type { TruckVisualType } from './truck-model';

export type TruckAppearance = {
  cab: string; body: string; accent: string;
  fittings?: readonly ('high-roof' | 'aero' | 'side-guards' | 'tail-lift' | 'headboard' | 'beacons' | 'cab-guard')[];
};
export type TruckDesign = {
  id: string; name: string; family: TruckVisualType; description: string; appearance: TruckAppearance;
};
/** Original visual assemblies, not assets, capacities or availability records. */
export const truckDesigns: readonly TruckDesign[] = [
  { id: 'rigid-city', name: 'City box', family: 'rigid', description: 'Compact cab, closed box and amber roof markers.', appearance: { cab: '#b23838', body: '#e9e2d4', accent: '#edb851', fittings: ['beacons'] } },
  { id: 'rigid-distribution', name: 'Distribution box', family: 'rigid', description: 'Raised cab roof with protective side rails.', appearance: { cab: '#285e88', body: '#e7edf1', accent: '#7ebacb', fittings: ['high-roof', 'side-guards'] } },
  { id: 'rigid-tail-lift', name: 'Box with tail lift', family: 'rigid', description: 'Folded rear lift platform and side rails.', appearance: { cab: '#d0982a', body: '#f0e7cc', accent: '#344d59', fittings: ['tail-lift', 'side-guards'] } },
  { id: 'articulated-box', name: 'Linehaul box', family: 'articulated', description: 'Long box trailer with a raised sleeper roof.', appearance: { cab: '#214b65', body: '#dce8e9', accent: '#39bac0', fittings: ['high-roof'] } },
  { id: 'articulated-aero', name: 'Aero box', family: 'articulated', description: 'Roof deflector, trailer skirts and sleeper cab.', appearance: { cab: '#9e3440', body: '#ede5dd', accent: '#d6ae67', fittings: ['high-roof', 'aero', 'side-guards'] } },
  { id: 'refrigerated-linehaul', name: 'Refrigerated box', family: 'refrigerated', description: 'Existing refrigeration unit with a raised cab roof.', appearance: { cab: '#f2eee2', body: '#e9f0ee', accent: '#26899e', fittings: ['high-roof'] } },
  { id: 'refrigerated-guard', name: 'Refrigerated guarded', family: 'refrigerated', description: 'Front cab guard, side protection and amber beacons.', appearance: { cab: '#327a73', body: '#e1edeb', accent: '#c9ba7f', fittings: ['cab-guard', 'side-guards', 'beacons'] } },
  { id: 'flatbed-deck', name: 'Open platform', family: 'flatbed', description: 'Open deck, anchor rings and protective side rails.', appearance: { cab: '#c15331', body: '#a7a999', accent: '#e5c482', fittings: ['side-guards'] } },
  { id: 'flatbed-headboard', name: 'Platform with rack', family: 'flatbed', description: 'Raised headboard rack and amber beacons.', appearance: { cab: '#24665b', body: '#6d9783', accent: '#d2bb77', fittings: ['headboard', 'beacons'] } },
  { id: 'logging-standard', name: 'Timber carrier', family: 'logging', description: 'Existing timber load, side stakes and cab guard.', appearance: { cab: '#4d7342', body: '#a67749', accent: '#d5bd7c', fittings: ['cab-guard'] } },
  { id: 'logging-forest', name: 'Timber reinforced', family: 'logging', description: 'Headboard rack, protective cab guard and beacons.', appearance: { cab: '#a04730', body: '#a67749', accent: '#d8b76d', fittings: ['headboard', 'cab-guard', 'beacons'] } },
  { id: 'curtainsider-standard', name: 'Curtain trailer', family: 'curtainsider', description: 'Tensioned curtain, buckles and a raised sleeper roof.', appearance: { cab: '#4d427c', body: '#7061a1', accent: '#ddc17b', fittings: ['high-roof'] } },
  { id: 'curtainsider-aero', name: 'Aero curtain trailer', family: 'curtainsider', description: 'Roof deflector, side skirts and protective rails.', appearance: { cab: '#306a86', body: '#3d7b94', accent: '#c9dce2', fittings: ['aero', 'side-guards'] } },
  { id: 'tipper-site', name: 'Site tipper', family: 'tipper', description: 'Lowered tipping body and amber roof beacons.', appearance: { cab: '#d1a42c', body: '#dfb246', accent: '#4a5350', fittings: ['beacons'] } },
  { id: 'tipper-guard', name: 'Guarded tipper', family: 'tipper', description: 'Front cab protection and high headboard rack.', appearance: { cab: '#345c66', body: '#d48b36', accent: '#e4c488', fittings: ['cab-guard', 'headboard', 'beacons'] } },
  { id: 'tanker-road', name: 'Road tanker', family: 'tanker', description: 'Existing cylindrical tank, walkways and side guards.', appearance: { cab: '#88394a', body: '#b9c7cc', accent: '#ddbd87', fittings: ['side-guards'] } },
  { id: 'mixer-drum', name: 'Concrete mixer', family: 'mixer', description: 'Existing drum, discharge chute and roof beacons.', appearance: { cab: '#e5d7ba', body: '#bd6139', accent: '#db9b50', fittings: ['beacons'] } },
  { id: 'lowloader-heavy', name: 'Low deck trailer', family: 'lowloader', description: 'Existing low bed and ramps with a protected tractor.', appearance: { cab: '#c69b36', body: '#c7a34d', accent: '#344a56', fittings: ['cab-guard', 'beacons'] } },
];
export function truckDesign(id: string | null | undefined) { return truckDesigns.find(design => design.id === id); }
export function familyDesign(family: TruckVisualType) { return truckDesigns.find(design => design.family === family)!; }
