import assert from "node:assert/strict";
import test from "node:test";
import { explicitCargoFacts, groundedCargoSuggestions } from "./explicit-cargo-facts";
import { getIntakeOptionsFixture } from "./intake-options";
import { EMPTY_PROTOTYPE_DRAFT, buildPrototypeExample, applyChatFieldsToDraft, mapDraftToCreateFreightRequestV2Input, validatePrototypeReview } from "./prototype-model";
import { parseConversationField } from "./conversation-fields";
import { proposeDraftReview, canApproveDraftReview } from "./draft-review";
import { assistantNextField } from "./assistant-form-guide";
import { conversationContext } from "./conversation-context";
import { spokenCaptureClarification } from "./spoken-capture-clarification";
import { CreateFreightRequestV2InputSchema } from "@/shared/schemas/v2/freight-request";
const fixture=getIntakeOptionsFixture().data;
const options={...fixture,equipmentOptions:[...fixture.equipmentOptions,{code:'BOX_TRUCK',labelEs:'Camión furgón',labelEn:'Box truck'}]};
const zone="America/Lima",now=Date.parse("2026-10-23T12:00:00Z");
const blank=()=>structuredClone(EMPTY_PROTOTYPE_DRAFT);

test("simple Spanish prompts build one valid form, with optional emails and unchanged review semantics",()=>{
  let draft=blank();
  for(const text of [
    "Necesito enviar 10 pallets de artículos del hogar de Lima a Arequipa.",
    "Cada pallet pesa 100 kg, es urgente.",
    "Cada pallet tiene largo 100 cm, ancho 100 cm y alto 100 cm.",
    "Se puede dividir la carga, cada pallet es indivisible, se pueden apilar, sin requisitos especiales.",
    "El remitente es Elena Vargas con teléfono +51900000101, sin correo. El destinatario es Pablo Ríos con teléfono +51900000102, sin correo.",
    "BOX_TRUCK",
  ]) draft=applyChatFieldsToDraft(draft,groundedCargoSuggestions(text,draft,options,text==='BOX_TRUCK'?'requiredEquipment':null,text==='BOX_TRUCK'?[{field:'requiredEquipment',value:'BOX_TRUCK'}]:[]));
  for(const text of ["Recojo el 26 de octubre de 2026 de 08:00 a 10:00","Entrega el 27 de octubre de 2026 de 14:00 a 18:00"]) {
    const result=spokenCaptureClarification(text,{date:null,classification:false},options,zone,now);
    assert.equal(result.dateResolved,true);draft=applyChatFieldsToDraft(draft,result.fields);
  }
  assert.equal(draft.cargoDescription,'artículos del hogar');
  assert.equal(draft.totalWeightKg,'1000');assert.equal(draft.totalVolumeM3,'10');
  assert.equal(draft.divisible,true);assert.equal(typeof draft.unitIndivisible,'boolean');
  assert.equal(draft.pickupContactName,'Elena Vargas');assert.equal(draft.recipientContactName,'Pablo Ríos');
  assert.equal(draft.pickupContactPhoneE164,'+51900000101');assert.equal(draft.recipientContactPhoneE164,'+51900000102');
  assert.deepEqual(validatePrototypeReview(draft).issues,[]);
  const review=proposeDraftReview(draft,now);
  draft=applyChatFieldsToDraft(draft,explicitCargoFacts('Son 12 pallets, no 10',draft,options,null));
  assert.equal(draft.totalWeightKg,'1200');assert.equal(canApproveDraftReview(review,draft,now),false);
  const payload=mapDraftToCreateFreightRequestV2Input(draft,options);
  assert.equal(payload.contacts.pickup.email,null);assert.equal(payload.contacts.recipient.email,null);
  assert.equal(CreateFreightRequestV2InputSchema.safeParse(payload).success,true);
  assert.equal('reviewedConversationFields' in payload,false);
});

test("mixed measurements keep contacts, route, contents and split facts instead of dropping them",()=>{
  const draft=applyChatFieldsToDraft(blank(),explicitCargoFacts('10 pallets de artículos del hogar de Lima a Arequipa, 100 kg cada uno, cada pallet de largo 100 cm, ancho 80 cm y alto 120 cm; el remitente es Elena con teléfono 900000101, se puede dividir la carga',blank(),options,null));
  assert.equal(draft.unitQuantity,'10');assert.equal(draft.unitWeightPerUnitKg,'100');
  assert.equal(draft.unitVolumePerUnitM3,'0.96');assert.equal(draft.pickupContactPhoneE164,'+51900000101');
  assert.equal(draft.divisible,true);assert.equal(draft.categoryCode,'GENERAL');
});

test("English prompt preserves the cargo, explicit per-unit weight and catalog route",()=>{
  const draft=applyChatFieldsToDraft(blank(),explicitCargoFacts('I need to ship 10 pallets of household goods from Lima to Arequipa, each pallet weighs 100 kg.',blank(),options,null));
  assert.equal(draft.unitQuantity,'10');assert.equal(draft.unitWeightPerUnitKg,'100');
  assert.equal(draft.originFacilityId,options.facilities[0].facilityId);
  assert.equal(draft.destinationFacilityId,options.facilities[1].facilityId);
  assert.equal(draft.categoryCode,'GENERAL');
  assert.equal(draft.cargoDescription,'household goods');
});

test("the PR163 robot-in-each-box case retains the product instead of replacing it with a packaging phrase",()=>{
 const fields=groundedCargoSuggestions('2 boxes with one robot inside of each one, it weighs 500kg each',blank(),options,'unitQuantity',[{field:'cargoDescription',value:'robot'}]);
 const draft=applyChatFieldsToDraft(blank(),fields);
 assert.equal(draft.cargoDescription,'robot');assert.equal(draft.unitQuantity,'2');assert.equal(draft.unitWeightPerUnitKg,'500');
});

test("false booleans remain false and explicit requirement corrections remove previous choices",()=>{
  const draft=applyChatFieldsToDraft({...blank(),divisible:true,unitStackable:true,requirements:['TEMP_CONTROLLED','FRAGILE']},[
    {field:'divisible',value:'false'},{field:'unitStackable',value:'false'},{field:'requirements',value:'!TEMP_CONTROLLED'},
  ]);
  assert.equal(draft.divisible,false);assert.equal(draft.unitStackable,false);
  assert.deepEqual(draft.requirements,['FRAGILE']);
  assert.equal(applyChatFieldsToDraft(draft,[{field:'divisible',value:'maybe'}]).divisible,false);
  const negatives=explicitCargoFacts('No se puede dividir la carga, no se pueden apilar.',{...blank(),divisible:true,unitStackable:true},options,null);
  const corrected=applyChatFieldsToDraft({...blank(),divisible:true,unitStackable:true},negatives);
  assert.equal(corrected.divisible,false);assert.equal(corrected.unitStackable,false);
  assert.ok(corrected.reviewedConversationFields?.includes('divisible'));
  assert.equal(groundedCargoSuggestions('Sin requisitos especiales.',blank(),options,'originFacilityId',[{field:'originFacilityId',value:'Sin requisitos especiales'}]).some(f=>f.field==='originFacilityId'),false);
});

test("equipment, per-unit values and contact roles cannot be invented by a model",()=>{
  const result=groundedCargoSuggestions('10 pallets weighing 1000 kg total',blank(),options,null,[
    {field:'unitWeightPerUnitKg',value:'1000'},{field:'requiredEquipment',value:'TRACTOR_TRAILER'},
    {field:'recipientContactName',value:'Invented'},{field:'categoryCode',value:'FOOD'},
    {field:'pickupWindowStartsAt',value:'2026-10-26T00:00'},
  ]);
  assert.equal(result.some(f=>/Weight|Contact|Equipment|category|Window/.test(f.field)),false);
});

test("short scalar answers only fill the field actually asked and preserve decimal commas",()=>{
  assert.equal(groundedCargoSuggestions('120,5',blank(),options,'unitWeightPerUnitKg',[{field:'unitWeightPerUnitKg',value:'120.5'},{field:'unitQuantity',value:'120'}]).find(f=>f.field==='unitWeightPerUnitKg')?.value,'120.5');
  assert.equal(parseConversationField('divisible','no',options),'false');
  assert.equal(parseConversationField('requirements','invented',options),null);
  const draft=applyChatFieldsToDraft(blank(),explicitCargoFacts('Son diez palets. Cada palet pesa 100,5 kilos.',blank(),options,null));
  assert.equal(draft.packaging,'PALLET');assert.equal(draft.unitWeightPerUnitKg,'100.5');assert.equal(draft.totalWeightKg,'1005');
});

test("questions and uncertainty do not create a shipment or select its requirements",()=>{
  for(const text of ['¿Puede ser un camión refrigerado?','Can 10 pallets fit in a truck?','¿Se puede dividir la carga?']) assert.deepEqual(explicitCargoFacts(text,blank(),options,null),[]);
  const fields=explicitCargoFacts('Tal vez se puede dividir la carga',blank(),options,null);
  assert.equal(fields.some(f=>f.field==='divisible'),false);
});

test("national phones are normalized only with a known Peruvian role facility; ambiguous cities stay unresolved",()=>{
  const text='El remitente es Elena con teléfono 900000101';
  assert.equal(explicitCargoFacts(text,blank(),options,null).some(f=>f.field==='pickupContactPhoneE164'),false);
  const ambiguous={...options,facilities:[...options.facilities,{...options.facilities[0],facilityId:'other-lima',code:'OTHER'}]};
  assert.equal(explicitCargoFacts('De Lima a Arequipa',blank(),ambiguous,null).some(f=>f.field==='originFacilityId'),false);
});

test("guided conversation asks split and handling instead of treating unchecked defaults as answers",()=>{
  let draft=buildPrototypeExample(options);
  assert.equal(assistantNextField(draft),'divisible');
  const context=conversationContext(draft,null,0);
  assert.equal(context.knownFields.some(f=>f.field==='divisible'),false);
  draft=applyChatFieldsToDraft(draft,[{field:'divisible',value:'false'}]);
  assert.equal(assistantNextField(draft),'unitIndivisible');
});
