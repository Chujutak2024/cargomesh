export const depotTemplates = [
  { id: 'compact', name: 'Compact base', description: 'Short warehouse, three dock fronts and a small office.', depth: 5.6, bays: 3, roof: '#49646a', wall: '#e1d8c5', feature: 'compact' },
  { id: 'distribution', name: 'Distribution centre', description: 'Three docks, storage racks, packing benches and solar roof.', depth: 8, bays: 3, roof: '#344c61', wall: '#d8d2c6', feature: 'solar' },
  { id: 'cold', name: 'Cold storage', description: 'Insulated facade, rooftop cooling units and pipework.', depth: 8, bays: 3, roof: '#637e88', wall: '#e2edef', feature: 'cooling' },
  { id: 'workshop', name: 'Yard and workshop', description: 'Service awning, maintenance benches and parts storage.', depth: 7, bays: 3, roof: '#505b65', wall: '#d0d5d1', feature: 'workshop' },
  { id: 'transfer', name: 'Transfer terminal', description: 'Four dock fronts, extended hall and covered staging lanes.', depth: 8, bays: 4, roof: '#48596d', wall: '#ddd5c7', feature: 'transfer' },
  { id: 'cross-dock', name: 'Multi-dock distribution hub', description: 'Opposing dock facades, sawtooth sorting hall and a two-storey control wing.', depth: 7, bays: 6, roof: '#31556b', wall: '#e4ded1', feature: 'cross-dock' },
  { id: 'service-yard', name: 'Transport yard and service campus', description: 'Open parking courts, separate administration and a workshop with inspection pits.', depth: 6, bays: 3, roof: '#435764', wall: '#d4d6cd', feature: 'service-yard' },
  { id: 'cold-campus', name: 'Refrigerated logistics campus', description: 'Three insulated chambers, enclosed dock shelters and a separate refrigeration plant.', depth: 8, bays: 3, roof: '#d5e3e7', wall: '#eef2ed', feature: 'cold-campus' },
  { id: 'silo-terminal', name: 'Bulk cargo silo terminal', description: 'Six elevated silos, discharge cones, a conveyor bridge and a covered bagging apron.', depth: 8, bays: 3, roof: '#637c82', wall: '#d7ded9', feature: 'silo-terminal' },
  { id: 'urban-courtyard', name: 'Compact urban distribution base', description: 'An L-shaped dispatch building, two-storey offices, roof terrace and courier courtyard.', depth: 4.5, bays: 3, roof: '#485d60', wall: '#e4d8c4', feature: 'urban-courtyard' },
  { id: 'industrial-plant', name: 'Industrial plant', description: 'Production hall with machinery, exhaust stacks, separate warehouse and loading apron.', depth: 8, bays: 3, roof: '#527080', wall: '#d5d8d0', feature: 'industrial-plant' },
  { id: 'agricultural-hub', name: 'Agricultural collection centre', description: 'Open crop sheds, reception hoppers, weighing deck and a produce sorting line.', depth: 7, bays: 3, roof: '#9b6547', wall: '#e4d5ac', feature: 'agricultural-hub' },
  { id: 'retail-store', name: 'Retail store and rear reception', description: 'Glazed shop entrance, sales aisles and a separate rear receiving warehouse.', depth: 6, bays: 3, roof: '#66766b', wall: '#e5dbc8', feature: 'retail-store' },
  { id: 'pharmaceutical-centre', name: 'Pharmaceutical centre', description: 'Controlled receiving vestibules, separated storage rooms and a glazed inspection corridor.', depth: 8, bays: 3, roof: '#6e909d', wall: '#e5eeeb', feature: 'pharmaceutical-centre' },
  { id: 'fulfilment-centre', name: 'Order fulfilment centre', description: 'Picking aisles, elevated packing stations, sorting conveyors and dispatch lanes.', depth: 8, bays: 3, roof: '#465c78', wall: '#dddcd5', feature: 'fulfilment-centre' },
] as const;
export type DepotTemplateId = typeof depotTemplates[number]['id'];
export function depotTemplate(id: DepotTemplateId) { return depotTemplates.find(template => template.id === id)!; }
