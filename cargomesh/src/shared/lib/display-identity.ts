import { displayDemoText } from "@/shared/lib/demo-presentation";
/** UI labels only. Never use these aliases as API IDs, permissions or storage keys. */
const demoCodes:Record<string,string>={
 '46f90b3df18b45abab7070220b10605f':'004',
 '8db5fc2ca98248ad8681246e5e90e87a':'003',
 '9cdfca302ebf4adebdbba1298c177916':'003',
 '763b0bf1e4494b198d031cc36c63af57':'004',
 'acc56f8936c24b45bee90929694e3c91':'004',
 'f64cb322d4a74b39b60c0a77c81687e0':'005',
 '423ac5ef15fa430a86e612753eb2a1ff':'005',
 '995a49fade7a4f3d8f8c1d0dd6f355b2':'006',
 'b3495c5b4baa4db28440bf8250bdaf10':'006',
 'a434860beedf49eaa105e840b77519c8':'001',
 'f2b5351ca4cd437d9a7df6379ddf7ef4':'002',
 '1b1010cf31d7498bb618f54d62306fb0':'003',
 'e956d42a274c4ffa82a2c1b46c348ca3':'004',
 'ce28474dcb6a4918913e9b2cf3b808c6':'005',
 '488e8ca117b64de5a041729d193c8d49':'006',
 '590b139c429a4075b12ea307905fc007':'006',

 '625cabc8461a4468854474c28f117fc9':'001',
 '219dfc89e74548179a58de64847484c4':'002',
 '01f64c8764834c51880967b93589a252':'001',
 '86c986026639454bbd268ba622af9d15':'001',
 '0ec293ecbccf4577a40b6821c932f4b9':'001',
 '245ce7bd78ab42acb56f5981ab981bd9':'002',
 'f1502f6316f4453582e925652362c733':'001',
 '5e6535f3f3574b46a82be821418d82af':'002',
 '4c32c26725b1464fb2d5df7aeb4eec3b':'003',
 'd12561e3fa0b45b0b25ac82667b1a6d8':'004',
 'a5adaa9fe5bb4d708e6b310be0d63cdc':'005',
 '1cef81675e9a4f20a279db1fee96bb46':'002',
 '81b8ef09c6404d16a9a175197610604d':'003',
 '46f90b3df18b45abab7060220b10605f':'004',
 '77f9d63a8124423eb212b862d17191a5':'005',
};
const demoDrivers:Record<string,string>={
 '17d0325e-8e8b-4721-9756-bf00e60e55a2':'Roberto Salazar',
 '93192799-6ad7-46a8-882a-d92b0a197e38':'Diego Vargas',
 '4b23aba5-e319-407d-b037-5f8f9d325933':'Ana Rojas',
 '984407b0-cb4a-4969-9f58-d6ca60f1cc53':'Jorge Castillo',
 'fb9cf63a-d75b-45f9-bb7d-965f38d4727c':'Lucía Paredes',
 'ad89876d-af4f-41d2-a0a1-be6689bfa0e1':'Carlos Medina',
 'c90f9675-6229-4ec7-868b-003da77dba6a':'Mariana Torres',
};
const demoVehicles:Record<string,string>={
 'fbc945f6-52f4-4165-8383-4454f8f45a18':'CAM-001',
 'ac095705-e8d1-4966-8213-87dd20e3fa43':'CAM-002',
 'db387c12-dd81-42cc-9e11-060dca589031':'CAM-003',
 '3dae46b9-925d-4678-a5f8-7b081068570f':'CAM-004',
 '11134912-5bae-40c4-91df-cc3743d58567':'CAM-005',
 '57ca661f-d94a-4565-a4e4-d95a19b1d2ed':'CAM-006',
 'b6f55177-d8d6-498e-ac94-f7c95336ed86':'CAM-007',
 'b63b1772-5317-4eea-9de4-030c8d5dda37':'CAM-008',
 'd8d2e9b3-03f1-43c7-bf1d-6cc174f5605e':'C01-T1',
 'add626e5-07d5-4bce-bf69-3c7dd109fd3c':'C01-T2',
};
const canonical=(value:string)=>value.replace(/^V2-/i,'').replace(/-/g,'').toLowerCase();
const technical=(value:string)=>/^(?:V2-)?[0-9a-f-]{32,36}$/i.test(value)||/^[0-9a-f]{8,}$/i.test(value)||/^(?:HAC\d|C\d+_SIM_|AUTO[_-]|DEMO[_-]|SYN[_-]|SIM[_-])/i.test(value)||value.length>30;

/** A short public code is a label, not a new business identifier or sequence. */
export function displayReference(value:string|null|undefined,prefix:string,fallbackId?:string|null):string{
 const raw=value?.trim()??'',id=fallbackId?.trim()||raw;
 const known=demoCodes[canonical(id)]??demoCodes[canonical(raw)];
 if(known)return prefix+'-'+known;
 if(raw&&!technical(raw))return raw;
 if(!id)return '—';
 // Stable in SSR and the browser, independent of sorting, page size and filters.
 let hash=2166136261;for(const character of canonical(id))hash=Math.imul(hash^character.charCodeAt(0),16777619);
 return prefix+'-'+String(1000+(hash>>>0)%9000);
}
export function carrierDisplayName(name:string,id?:string|null):string{
 if((id==='e4440000-0000-4000-8000-000000000001'&&/HAC\s*-?44/i.test(name))||/^\[SYNTHETIC\]\s*HAC\s*-?44\s*ROAD$/i.test(name))return 'Transportes Costa Sur · Demo';
 return displayDemoText(name);
}
export function vehicleDisplayName(id:string,code:string,plate?:string|null):string{
 return demoVehicles[id]??displayReference(plate?.trim()||code,'CAM',id);
}
export function driverDisplayName(name:string,id:string):string{
 return /^\[(?:SYNTHETIC|SIMULATED)\]/i.test(name)?demoDrivers[id]??name:name;
}
export function recordDisplayName(id:string,value:Record<string,unknown>,kind?:string):string{
 if(typeof value.fullName==='string')return driverDisplayName(value.fullName,id);
 if(typeof value.commercialName==='string')return carrierDisplayName(value.commercialName,id);
 if(value.roadVehicle&&typeof value.roadVehicle==='object'){
  const road=value.roadVehicle as Record<string,unknown>;
  return vehicleDisplayName(id,String(value.code??id),typeof road.plate==='string'?road.plate:null);
 }
 const prefixes:Record<string,string>={executions:'OP',bookings:'BKG',offers:'OFE',holds:'RES',opportunities:'SOL','driver-assignments':'ASG','vehicle-assignments':'ASG'};
 const prefix=prefixes[kind??'']??(value.mode&&value.serviceClass?'SRV':'REG');
 const name=value.name??value.registeredName??value.displayName??value.referenceCode??value.code??value.carrierReference??value.description;
 return displayReference(typeof name==='string'?name:null,prefix,id);
}

/** Fixture license codes remain in the record, never masquerade as real credentials. */
export function driverLicenseLabel(value:string|null|undefined,t:(es:string,en:string)=>string):string{
 const license=value?.trim();
 if(!license)return t('Sin registro','Not recorded');
 return /^(?:QA|SIMULATED)(?:[_ -]|$)/i.test(license)?t('Licencia de demo','Demo license'):license;
}

/** Human labels for synthetic locations; never invent a real city or geometry. */
export function locationDisplayLabel(value:string|null|undefined):string{
 const aliases:Record<string,string>={C01_SIM_A:'Punto C01-A',C01_SIM_B:'Punto C01-B'};
 const clean=displayDemoText(value);return clean?aliases[clean]??clean:'—';
}
/** Preserve actual cargo content while removing fixture/test harness labels. */
export function cargoDisplayDescription(value:string|null|undefined,categoryCode?:string|null):string{
 const description=value?.trim()??'';
 const category=['GENERAL','GENERAL_CARGO','HAC50_SCENARIO_GENERAL'].includes(categoryCode??'')?'General cargo':'Cargo details not recorded';
 if(!description||/^\[(?:SYNTHETIC|SIMULATED)\]\s*(?:HAC\d+|Inbox)(?:\b|_)/i.test(description))return category;
 const clean=displayDemoText(description).replace(/^C-01-SIM\s+v\d+\s*/i,'').trim();
 return clean?clean[0].toUpperCase()+clean.slice(1):category;
}
