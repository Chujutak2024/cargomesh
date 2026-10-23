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

test('voice receives accepted availability without collapsing alternatives or granting execution authority',()=>{
 const draft={...EMPTY_PROTOTYPE_DRAFT,urgency:'URGENT',loadSize:'MEDIUM',pickupWindowStartsAt:'2026-10-22T08:00',pickupWindowEndsAt:'2026-10-22T10:00',deliveryWindowStartsAt:'2026-10-23T08:00',deliveryWindowEndsAt:'2026-10-23T12:00',pickupAlternatives:[{startsAt:'2026-10-24T08:00',endsAt:'2026-10-24T10:00'}]};
 const context=voiceDraftContext(draft,null);assert.equal(context.planningPreferences?.pickupWindows.length,2);assert.equal(context.planningPreferences?.urgency,'URGENT');assert.equal('consent' in context,false);
 assert.equal(voiceDraftContext({...draft,pickupWindowStartsAt:''},null).planningPreferences,undefined);
});


test("renewal carries the product and pending delivery clock without leaking contact values",()=>{
 const draft={...EMPTY_PROTOTYPE_DRAFT,cargoDescription:"one robot in each box",pickupContactEmail:"private@example.test",pickupWindowStartsAt:"2026-11-10T09:00",pickupWindowEndsAt:"2026-11-10T17:00"};
 const context=voiceDraftContext(draft,null,["DATE_WINDOW_PENDING"],null,{timeZone:"America/Lima",pendingDates:["2026-12-10"],pendingWindow:{alternatives:["2026-12-10"],referenceDate:"2026-10-21",timeZone:"America/Lima",role:"delivery",startTime:"14:00"}});
 assert.equal(context.cargoDescription,"one robot in each box");assert.deepEqual(context.pendingWindow,{role:"delivery",startTime:"14:00",endTime:undefined});
 assert.match(context.referenceDate!,/^\d{4}-\d{2}-\d{2}$/);assert.equal(JSON.stringify(context).includes("private@example.test"),false);
 assert.equal(voiceDraftContext({...draft,cargoDescription:"Contact private@example.test"},null).cargoDescription,undefined);
 assert.equal(voiceDraftContext({...draft,cargoDescription:"call +51999111222"},null).cargoDescription,undefined);
});
