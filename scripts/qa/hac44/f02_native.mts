/** Call exported product rules directly; never duplicate their decisions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.HAC44_ROOT!,out=process.env.HAC44_EVIDENCE!,sha=process.env.HAC44_SOURCE_SHA;
const fleet=await import(pathToFileURL(root+'/cargomesh/src/server/modules/fleet/domain/assignment-policy.ts').href);
const cargo=await import(pathToFileURL(root+'/cargomesh/src/shared/schemas/v2/freight-request.ts').href);
const evidence:any[]=[];
const at='2027-01-01T00:00:00Z',window={startsAt:'2027-01-02T08:00:00Z',endsAt:'2027-01-02T12:00:00Z'};
const ev={reference:'fixture:f02-own-native-rule',verifiedAt:at,validUntil:'2027-02-01T00:00:00Z'};
const agenda=()=>({complete:true,evidence:ev,availableWindows:[window],occupiedWindows:[]});
function pair(id:string,symbol:string,positive:()=>any,negative:()=>any,valid:(x:any)=>boolean,frontier:(x:any)=>boolean,input:any){
 let p:any,n:any,pError:any,nError:any;try{p=positive();}catch(e:any){pError=e.code??e.name;}try{n=negative();}catch(e:any){nError=e.code??e.name;}
 const positiveValid=pError===undefined&&valid(p),negativeValid=nError===undefined&&frontier(n);
 evidence.push({sha,probe:'NATIVE_METHOD '+id,rowIds:[id],status:!positiveValid?'BLOQUEADO':negativeValid?'PASS':'DIFERENCIA',
   expected:{positiveValid:true,isolatedFrontier:true},observed:{positiveNative:{accepted:positiveValid,value:p,error:pError},negativeNative:{value:n,error:nError}},
   controlPositive:symbol+' called with a fully valid synthetic native input',symbol,input,frontierIsolation:true,representation:'Exported function used by product; no DB write or synthetic Auth claims'});
}
const units=[{packageType:'Synthetic package',quantity:2,weightPerUnitKg:3,volumePerUnitM3:4,dimensionsCm:{length:10,width:10,height:10},indivisible:false,stackable:true}];
pair('CargoUnit.totalWeightKg','cargoUnitTotalsV2',()=>cargo.cargoUnitTotalsV2(units),()=>cargo.cargoUnitTotalsV2([{...units[0],weightPerUnitKg:5}]),p=>p.weightKg===6,n=>n.weightKg===10&&n.volumeM3===8,{positive:units,frontier:'Only weightPerUnitKg 3 -> 5'});
pair('CargoUnit.totalVolumeM3','cargoUnitTotalsV2',()=>cargo.cargoUnitTotalsV2(units),()=>cargo.cargoUnitTotalsV2([{...units[0],volumePerUnitM3:5}]),p=>p.volumeM3===8,n=>n.volumeM3===10&&n.weightKg===6,{positive:units,frontier:'Only volumePerUnitM3 4 -> 5'});
// Separate availability guards, even when the adapter function is shared.
for(const [id,change,reason] of [
 ['CapacitySource.availabilityFor','occupation','RESOURCE_OCCUPIED'],
 ['TransportAsset.availabilityFor','window','NO_RESOURCE_WINDOW'],
 ['CapacityPool.availabilityFor','evidence','AGENDA_EVIDENCE_UNKNOWN'],
 ['CapacityCalendar.availableAt','window','NO_RESOURCE_WINDOW'],
 ['CapacityCalendar.blocks','occupation','RESOURCE_OCCUPIED']]){
 pair(id,'evaluateFleetAvailability',()=>fleet.evaluateFleetAvailability(agenda(),window,at),()=>{const a:any=agenda();if(change==='occupation')a.occupiedWindows=[window];if(change==='window')a.availableWindows=[];if(change==='evidence')a.evidence=null;return fleet.evaluateFleetAvailability(a,window,at);},p=>p.status==='eligible'&&p.reasons.length===0,n=>n.status===(change==='evidence'?'unknown':'ineligible')&&n.reasons.length===1&&n.reasons[0]===reason,{window,at,frontier:change});
}
const driver=()=>({id:'synthetic-driver',carrierId:'synthetic-carrier',fullName:'Synthetic driver',portalAccountId:null,licenseClass:'TEST_LICENSE',licenseValidUntil:'2027-01-31',qualifications:['TEST_HAZMAT'],experienceYears:null,dutyStatus:'TEST_READY',agenda:agenda()});
const dr=()=>({carrierId:'synthetic-carrier',acceptedLicenseClasses:['TEST_LICENSE'],requiredQualifications:['TEST_HAZMAT'],licenseExpiry:{localDate:'2027-01-31',exclusiveInstant:'2027-02-01T05:00:00Z',evidence:ev},duty:{allowedStatuses:['TEST_READY'],maximumDutySeconds:28800,previousDutySeconds:0,evidence:ev}});
for(const [id,guard,reason] of [['Driver.qualifiedFor','license','LICENSE_CLASS_MISMATCH'],['Driver.availableFor','agenda','RESOURCE_OCCUPIED']])pair(id,'evaluateDriverAssignment',()=>fleet.evaluateDriverAssignment(driver(),dr(),window,at),()=>{const d:any=driver();if(guard==='license')d.licenseClass='OTHER';else d.agenda.occupiedWindows=[window];return fleet.evaluateDriverAssignment(d,dr(),window,at);},p=>p.status==='eligible',n=>n.status==='ineligible'&&n.reasons.length===1&&n.reasons[0]===reason,{window,at,frontier:guard});
const combo=()=>({id:'synthetic-combination',carrierId:'synthetic-carrier',kind:'TEST_TRACTOR_TRAILER',configuration:'Synthetic pair',coupledWindow:window,evidence:ev,combinedTareKg:10000,grossWeightLimitKg:40000,status:'TEST_COUPLED',assets:['tractor','trailer'].map(id=>({id,carrierId:'synthetic-carrier',mode:'ROAD',operatingStatus:'AVAILABLE',agenda:agenda()}))});
const cr=()=>({carrierId:'synthetic-carrier',allowedStatuses:['TEST_COUPLED'],compatibility:{compatible:true,evidence:ev},manufacturerPayloadLimitKg:25000,routeGrossLimitKg:30000,servicePayloadLimitKg:22000,limitsEvidence:ev});
pair('VehicleCombination.validateCompatibility','evaluateVehicleCombination',()=>fleet.evaluateVehicleCombination(combo(),cr(),window,at),()=>{const r=cr();r.compatibility.compatible=false;return fleet.evaluateVehicleCombination(combo(),r,window,at);},p=>p.status==='eligible',n=>n.status==='ineligible'&&n.reasons.length===1&&n.reasons[0]==='COMBINATION_INCOMPATIBLE',{frontier:'Only compatibility.compatible true -> false'});
pair('VehicleCombination.effectiveCapacityOn','evaluateVehicleCombination',()=>fleet.evaluateVehicleCombination(combo(),cr(),window,at),()=>{const r=cr();r.routeGrossLimitKg=25000;return fleet.evaluateVehicleCombination(combo(),r,window,at);},p=>p.status==='eligible'&&p.effectivePayloadKg===20000,n=>n.status==='eligible'&&n.effectivePayloadKg===15000,{frontier:'Only routeGrossLimitKg 30000 -> 25000; min route payload changes'});
const capture=JSON.parse(fs.readFileSync(out+'/PROBES/RECETAS_MEDIDAS.json','utf8'));
const specification=capture.captured.requestPayload.cargoSpecification;
pair('CargoSpecification.validate','CargoSpecificationV2Schema.safeParse',()=>cargo.CargoSpecificationV2Schema.safeParse(specification),()=>cargo.CargoSpecificationV2Schema.safeParse({...specification,totalWeightKg:specification.totalWeightKg+1}),p=>p.success,n=>!n.success&&n.error.issues.some((i:any)=>i.path.includes('totalWeightKg')),{frontier:'Only totalWeightKg +1, unchanged units'});
const text=JSON.stringify({sha,evidence,complete:true},null,2)+'\n';fs.writeFileSync(out+'/PROBES/CP1B_NATIVE.json',text);assert.equal(fs.readFileSync(out+'/PROBES/CP1B_NATIVE.json','utf8'),text);
console.log(JSON.stringify({nativeCases:evidence.length,states:evidence.reduce((a:any,r:any)=>(a[r.status]=(a[r.status]??0)+1,a),{})}));

