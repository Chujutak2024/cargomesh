import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {parseIntakeOptionsResponse} from "../src/features/v2-intake/intake-options";
import {EMPTY_PROTOTYPE_DRAFT,applyChatFieldsToDraft} from "../src/features/v2-intake/prototype-model";
import {groundedCargoSuggestions} from "../src/features/v2-intake/explicit-cargo-facts";
import {InterpretationResponseSchema} from "../src/features/v2-conversation-prep/interpretation";
import {conversationContext} from "../src/features/v2-intake/conversation-context";
async function main(){
 const origin='http://127.0.0.1:8090';
 const session=await fetch(origin+'/api/auth/workspace-session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({workspace:'client'}),signal:AbortSignal.timeout(60000)});
 assert.equal(session.status,200,'local authorized workspace session');
 const cookie=session.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 const headers={origin,cookie,'content-type':'application/json'};
 const response=await fetch(origin+'/api/v2/intake/options',{headers,signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200);const parsedOptions=parseIntakeOptionsResponse(await response.json());assert.ok(parsedOptions);const options=parsedOptions.data;
 let draft=structuredClone(EMPTY_PROTOTYPE_DRAFT);const results=[];
 const currentField='originFacilityId' as const;
 for(const text of ['Necesito enviar 10 pallets de artículos del hogar de Lima a Arequipa.','Cada pallet pesa 100 kg.','Son 12 pallets, no 10.','No se puede dividir la carga, no se pueden apilar.','Sin requisitos especiales.']){
  const started=performance.now();
  const interpreted=await fetch(origin+'/api/v2/conversation/interpret',{method:'POST',headers,body:JSON.stringify({schemaVersion:'2.0',text,currentField,language:'es',context:conversationContext(draft,currentField,0)}),signal:AbortSignal.timeout(60000)});
  assert.equal(interpreted.status,200);const payload=InterpretationResponseSchema.parse(await interpreted.json());
  const fields=groundedCargoSuggestions(text,draft,options,currentField,payload.interpretation.fields);
  draft=applyChatFieldsToDraft(draft,fields);
  results.push({text,status:interpreted.status,mode:payload.mode,latencyMs:Math.round(performance.now()-started),appliedFields:fields.map(f=>f.field)});
 }
 assert.equal(draft.unitQuantity,'12');assert.equal(draft.unitWeightPerUnitKg,'100');assert.equal(draft.totalWeightKg,'1200');
 assert.equal(draft.divisible,false);assert.equal(draft.unitStackable,false);assert.deepEqual(draft.requirements,[]);
 assert.ok(draft.reviewedConversationFields?.includes('divisible'));assert.ok(draft.reviewedConversationFields?.includes('unitStackable'));
 const page=await fetch(origin+'/clients/freight-request/new',{headers,signal:AbortSignal.timeout(60000)});
 assert.equal(page.status,200);const html=await page.text();assert(!html.includes('Cannot find module'));
 const result={checkedAt:new Date().toISOString(),results,formStatus:page.status,totalWeightKg:draft.totalWeightKg,commercialWrites:0,cookiesLogged:false,audioValidated:false,browserVisualValidated:false};
 writeFileSync('C:/Users/HP/Documents/cargomesh/salida/nova-form-hardening-20261023/HTTP.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local smoke failed');process.exitCode=1;});
