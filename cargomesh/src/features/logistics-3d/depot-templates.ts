export const depotTemplates = [
  { id: 'compact', name: 'Compact base', description: 'Short warehouse, three dock fronts and a small office.', depth: 5.6, bays: 3, roof: '#49646a', wall: '#e1d8c5', feature: 'compact' },
  { id: 'distribution', name: 'Distribution centre', description: 'Three docks, storage racks, packing benches and solar roof.', depth: 8, bays: 3, roof: '#344c61', wall: '#d8d2c6', feature: 'solar' },
  { id: 'cold', name: 'Cold storage', description: 'Insulated facade, rooftop cooling units and pipework.', depth: 8, bays: 3, roof: '#637e88', wall: '#e2edef', feature: 'cooling' },
  { id: 'workshop', name: 'Yard and workshop', description: 'Service awning, maintenance benches and parts storage.', depth: 7, bays: 3, roof: '#505b65', wall: '#d0d5d1', feature: 'workshop' },
  { id: 'transfer', name: 'Transfer terminal', description: 'Four dock fronts, extended hall and covered staging lanes.', depth: 8, bays: 4, roof: '#48596d', wall: '#ddd5c7', feature: 'transfer' },
] as const;
export type DepotTemplateId = typeof depotTemplates[number]['id'];
export function depotTemplate(id: DepotTemplateId) { return depotTemplates.find(template => template.id === id)!; }
