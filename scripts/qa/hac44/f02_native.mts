/** Call exported product rules directly; never duplicate their decisions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.HAC44_ROOT!,out=process.env.HAC44_EVIDENCE!,sha=process.env.HAC44_SOURCE_SHA;
// assignment-policy has no runtime consumers; its nine old measurements are excluded.
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
   controlPositive:symbol+' called with a fully valid synthetic native input',symbol,input,frontierIsolation:true,representation:'Native cargo schema/calculator consumed by request runtime; no DB write'});
}
const units=[{packageType:'Synthetic package',quantity:2,weightPerUnitKg:3,volumePerUnitM3:4,dimensionsCm:{length:10,width:10,height:10},indivisible:false,stackable:true}];
pair('CargoUnit.totalWeightKg','cargoUnitTotalsV2',()=>cargo.cargoUnitTotalsV2(units),()=>cargo.cargoUnitTotalsV2([{...units[0],weightPerUnitKg:5}]),p=>p.weightKg===6,n=>n.weightKg===10&&n.volumeM3===8,{positive:units,frontier:'Only weightPerUnitKg 3 -> 5'});
pair('CargoUnit.totalVolumeM3','cargoUnitTotalsV2',()=>cargo.cargoUnitTotalsV2(units),()=>cargo.cargoUnitTotalsV2([{...units[0],volumePerUnitM3:5}]),p=>p.volumeM3===8,n=>n.volumeM3===10&&n.weightKg===6,{positive:units,frontier:'Only volumePerUnitM3 4 -> 5'});
const capture=JSON.parse(fs.readFileSync(out+'/PROBES/RECETAS_MEDIDAS.json','utf8'));
const specification=capture.captured.requestPayload.cargoSpecification;
pair('CargoSpecification.validate','CargoSpecificationV2Schema.safeParse',()=>cargo.CargoSpecificationV2Schema.safeParse(specification),()=>cargo.CargoSpecificationV2Schema.safeParse({...specification,totalWeightKg:specification.totalWeightKg+1}),p=>p.success,n=>!n.success&&n.error.issues.some((i:any)=>i.path.includes('totalWeightKg')),{frontier:'Only totalWeightKg +1, unchanged units'});
const text=JSON.stringify({sha,evidence,complete:true},null,2)+'\n';fs.writeFileSync(out+'/PROBES/CP1B_NATIVE.json',text);assert.equal(fs.readFileSync(out+'/PROBES/CP1B_NATIVE.json','utf8'),text);
console.log(JSON.stringify({nativeCases:evidence.length,states:evidence.reduce((a:any,r:any)=>(a[r.status]=(a[r.status]??0)+1,a),{})}));

