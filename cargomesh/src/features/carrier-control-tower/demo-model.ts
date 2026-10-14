/** Explicit visual scenario. No persisted assignments, live positions or road routing. */
export type Coordinate = { lat: number; lng: number };
export type Shipment = { id: string; vehicle: string; driver: string; origin: string; destination: string; cargo: string; equipment: string; status: 'In transit' | 'Scheduled' | 'Delivered'; position: Coordinate; route: Coordinate[]; progress: number; eta: string; lastReport: string };
export type Exception = { id: string; shipmentId: string; severity: 'Critical' | 'Warning' | 'Info'; title: string; detail: string; reportedAt: string };
const lima={lat:-12.0464,lng:-77.0428},callao={lat:-12.0566,lng:-77.1181},trujillo={lat:-8.1116,lng:-79.0287},piura={lat:-5.1945,lng:-80.6328},arequipa={lat:-16.409,lng:-71.5375},chiclayo={lat:-6.7714,lng:-79.8409},huancayo={lat:-12.0651,lng:-75.2049};
export const shipments:Shipment[]=[
 {id:'DEMO-1041',vehicle:'CM-256',driver:'Demo driver A',origin:'Callao',destination:'Piura',cargo:'Industrial equipment · 8,000 kg',equipment:'Box trailer',status:'In transit',position:trujillo,route:[callao,{lat:-10.75,lng:-77.75},{lat:-9.08,lng:-78.59},trujillo,chiclayo,piura],progress:68,eta:'Today, 18:40',lastReport:'Oct 13, 2026 · 14:10 PET'},
 {id:'DEMO-1042',vehicle:'CM-304',driver:'Demo driver B',origin:'Lima',destination:'Arequipa',cargo:'Chilled produce · 5,400 kg',equipment:'Refrigerated trailer',status:'In transit',position:{lat:-14.0678,lng:-75.7286},route:[lima,{lat:-13.42,lng:-76.13},{lat:-14.0678,lng:-75.7286},{lat:-14.83,lng:-74.94},{lat:-16.62,lng:-72.71},arequipa],progress:35,eta:'Tomorrow, 06:20',lastReport:'Oct 13, 2026 · 14:08 PET'},
 {id:'DEMO-1043',vehicle:'CM-289',driver:'Demo driver C',origin:'Chiclayo',destination:'Trujillo',cargo:'Palletized goods · 4,200 kg',equipment:'Curtainsider',status:'Delivered',position:trujillo,route:[chiclayo,{lat:-7.4,lng:-79.57},trujillo],progress:100,eta:'Delivered, 13:45',lastReport:'Oct 13, 2026 · 13:45 PET'},
 {id:'DEMO-1044',vehicle:'CM-267',driver:'Demo driver D',origin:'Lima',destination:'Huancayo',cargo:'Timber · 6,000 kg',equipment:'Logging trailer',status:'Scheduled',position:{lat:-12.01,lng:-76.96},route:[lima,{lat:-11.94,lng:-76.7},{lat:-11.65,lng:-76.12},huancayo],progress:0,eta:'Tomorrow, 11:30',lastReport:'Oct 13, 2026 · 13:50 PET'},
];
export const exceptions:Exception[]=[
 {id:'EX-001',shipmentId:'DEMO-1042',severity:'Critical',title:'Temperature threshold exceeded',detail:'Sample sensor report: 9°C against a 2–8°C target. Review cargo conditions before continuing.',reportedAt:'14:08 PET'},
 {id:'EX-002',shipmentId:'DEMO-1041',severity:'Warning',title:'Arrival window at risk',detail:'This simulated journey is 31 minutes behind its sample schedule. Check the next checkpoint.',reportedAt:'14:10 PET'},
 {id:'EX-003',shipmentId:'DEMO-1044',severity:'Info',title:'Dispatch documents pending',detail:'The sample dispatch checklist still needs a delivery document before the scheduled departure.',reportedAt:'13:50 PET'},
];
export const depots=[{id:'DEPOT-CALLAO',name:'Callao demo hub',position:callao},{id:'DEPOT-AREQUIPA',name:'Arequipa demo hub',position:arequipa}];
export const fleet=[...shipments.map(s=>({id:s.vehicle,status:s.status==='Delivered'?'Available':'Assigned'})),{id:'CM-311',status:'Available'},{id:'CM-312',status:'Available'},{id:'CM-313',status:'Maintenance'}];
export function filterShipments(query:string,status:string){const needle=query.trim().toLowerCase();return shipments.filter(s=>(status==='All'||s.status===status)&&`${s.id} ${s.vehicle} ${s.origin} ${s.destination} ${s.cargo}`.toLowerCase().includes(needle));}
