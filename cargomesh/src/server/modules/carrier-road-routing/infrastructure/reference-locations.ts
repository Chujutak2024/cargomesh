import { facilities, cityLabel, findRoadLocation as findExisting, type RoadLocation } from '@/features/v2-workspace/road-locations';

// Representative city reference, not a surveyed depot, customer facility or GPS fix.
// City-published downtown coordinates: https://www.sandiego.gov/sites/default/files/appendicies_f.pdf
const additional: readonly RoadLocation[] = [{ id: 'san-diego', city: 'San Diego', countryCode: 'US',
  region: 'north-america', landNetwork: 'north-america', lat: 32.7158, lng: -117.1649 }];

export const findCarrierRoadLocation = (id: string) => findExisting(id) ?? additional.find(location => location.id === id);

/** Public representative references, never a Carrier coverage claim. */
export const carrierRoadReferences=()=>[...facilities,...additional].map(location=>({id:location.id,city:cityLabel(location,"en"),countryCode:location.countryCode}));
