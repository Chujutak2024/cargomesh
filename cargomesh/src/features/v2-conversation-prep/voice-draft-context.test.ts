import assert from "node:assert/strict";
import test from "node:test";
import { voiceDraftContext, VoiceDraftContextSchema } from "./voice-draft-context";
import { conversationLanguage } from "./conversation-language";
import { EMPTY_PROTOTYPE_DRAFT, applyChatFieldsToDraft } from "@/features/v2-intake/prototype-model";

test("language survives numeric turns and changes only on clear language evidence", () => {
  assert.equal(conversationLanguage("Necesito enviar diez pallets", "en"), "es");
  assert.equal(conversationLanguage("100", "es"), "es");
  assert.equal(conversationLanguage("in English please", "es"), "en");
});

test("renewal context reflects latest draft without contact values or mutation authority", () => {
  const initial = {...EMPTY_PROTOTYPE_DRAFT, unitQuantity:"10", unitWeightPerUnitKg:"100", pickupContactEmail:"private@example.test"};
  const changed = applyChatFieldsToDraft(initial,[{field:"unitWeightPerUnitKg",value:"120"}]);
  const context = voiceDraftContext(changed, 3);
  assert.equal(context.savedVersion,3);
  assert.deepEqual(context.knownFields.find(f=>f.field==='unitQuantity'),{field:'unitQuantity',value:'10'});
  assert.deepEqual(context.knownFields.find(f=>f.field==='unitWeightPerUnitKg'),{field:'unitWeightPerUnitKg',value:'120'});
  assert.equal(JSON.stringify(context).includes('private@example.test'),false);
  assert.equal(VoiceDraftContextSchema.safeParse({...context,organizationId:'forged',consent:true}).success,false);
  assert.equal(VoiceDraftContextSchema.safeParse({...context,knownFields:[{field:'pickupContactEmail',value:'secret'}]}).success,false);
});

test("renewal retains unresolved dimensions and cannot crash on an out-of-range proposal",()=>{
 const pending={values:[5,1.5,2] as [number,number,number],unit:"m" as const,scope:null};
 const context=voiceDraftContext(EMPTY_PROTOTYPE_DRAFT,null,["MEASUREMENT_SCOPE_PENDING"],pending);
 assert.deepEqual(context.pendingMeasurement,pending);
 const invalid=voiceDraftContext(EMPTY_PROTOTYPE_DRAFT,null,["MEASUREMENT_SCOPE_PENDING"],{...pending,values:[1e20,1,2]});
 assert.equal(invalid.pendingMeasurement,null);
 assert.deepEqual(invalid.ambiguities,["MEASUREMENT_SCOPE_PENDING"]);
});
