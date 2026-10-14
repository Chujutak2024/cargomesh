
/** Local visual preview only; never installed in the active checkout or persisted. */


import { FreightRequestV2ResponseSchema } from '@/shared/schemas/v2/freight-request';
import { FacilityV2Schema } from '@/shared/schemas/v2/facilities';
import { WorkflowRecordV2Schema } from '@/shared/schemas/v2/workflow';
import { trackingQaItem } from '@/features/shipper-portal/tracking-qa-fixtures';
const base={
  id: "10000000-0000-4000-8000-000000000001", referenceCode: "FR-V2-1",
  organizationId: "10000000-0000-4000-8000-000000000002", status: "DRAFT", draftVersion: 3,
  origin: { facilityId: null, label: "Lima", countryCode: "PE", region: "Lima", city: "Lima", lat: -12, lng: -77 },
  destination: { facilityId: null, label: "Arequipa", countryCode: "PE", region: "Arequipa", city: "Arequipa", lat: -16, lng: -71 },
  pickupWindow: { startsAt: "2026-10-12T10:00:00.000Z", endsAt: "2026-10-12T12:00:00.000Z" },
  deliveryWindow: { startsAt: "2026-10-13T10:00:00.000Z", endsAt: "2026-10-13T12:00:00.000Z" },
  acceptedModes: ["ROAD"], serviceType: "FTL", selectionObjective: "WEIGHTED",
  preferredEquipment: null, requiredEquipment: "TRACTOR_SEMITRAILER", budget: null,
  cargoSpecification: { categoryCode: "GENERAL", description: "Carga", packaging: "PALLET", totalWeightKg: 1000,
    totalVolumeM3: 2, divisible: true, requirements: [], availableDocuments: [], units: [{ packageType: "PALLET", quantity: 1,
      weightPerUnitKg: 1000, volumePerUnitM3: 2, dimensionsCm: { length: 120, width: 100, height: 160 }, indivisible: false, stackable: true }] },
  contacts: { pickup: { name: "Ana", phoneE164: "+51999999999" }, recipient: { name: "Luis", phoneE164: "+51988888888" } },
  createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z",
};
const id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const cities=['Arequipa','Piura','Trujillo','Cusco','Chiclayo'];
export const demoRequests=cities.map((city,index)=>FreightRequestV2ResponseSchema.shape.data.parse({...structuredClone(base),id:id(400+index),referenceCode:'DEMO-'+String(index+1).padStart(4,'0'),status:index<3?'BOOKED':'DRAFT',requiredEquipment:null,destination:{...base.destination,label:'Sample destination · '+city,city,region:city,lat:null,lng:null},cargoSpecification:{...base.cargoSpecification,description:['Timber · visual scenario','Machinery · visual scenario','Pallets · visual scenario','Materials · visual scenario','Boxes · visual scenario'][index],totalWeightKg:(index+1)*1000,totalVolumeM3:(index+1)*2,units:[{...base.cargoSpecification.units[0],quantity:index+1}]}}));
export const demoFacilities=['Lima','Arequipa','Piura'].map((city,index)=>FacilityV2Schema.parse({id:id(600+index),organizationId:base.organizationId,version:1,createdAt:base.createdAt,updatedAt:base.updatedAt,value:{schemaVersion:'2.0',code:'DEMO-FACILITY-'+(index+1),name:'Sample facility · '+city,facilityType:'WAREHOUSE',active:true,location:{label:'Sample location',countryCode:'PE',region:city,city,lat:null,lng:null},accessRestrictions:[],operatingHours:{timezone:'America/Lima',weekly:[{dayOfWeek:1,opensAt:'08:00',closesAt:'18:00'}]}}}));
export const demoWorkflow=(['transit','incidents','delivered'] as const).flatMap((scenario,index)=>{
 const item=trackingQaItem(scenario),requestId=demoRequests[index].id,bookingId=id(700+index),executionId=id(800+index);
 const records=[{...item.execution,id:executionId,data:{...item.execution.data,bookingId}}, {...item.booking!,id:bookingId},...item.events.map((row,i)=>({...row,id:id(900+index*20+i)})),...item.incidents.map((row,i)=>({...row,id:id(910+index*20+i)}))];
 return records.map(row=>WorkflowRecordV2Schema.parse({...row,organizationId:base.organizationId,requestId}));
});
