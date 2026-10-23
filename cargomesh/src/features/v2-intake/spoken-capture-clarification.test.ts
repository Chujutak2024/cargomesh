import assert from "node:assert/strict";
import test from "node:test";
import {spokenCaptureClarification} from "./spoken-capture-clarification";
import {dateClarification} from "./capture-clarification";
import {getIntakeOptionsFixture} from "./intake-options";
import {spokenReviewCommand} from "./spoken-request-review";
import {lastSpokenQuestionField,checkedSpokenField} from "./spoken-field-guard";
const options=getIntakeOptionsFixture().data,zone="America/Lima",now=Date.parse("2026-10-21T12:00:00Z");
test("numeric dates retain pickup range and delivery deadline without inventing clocks",()=>{
 const first=spokenCaptureClarification('Recojo del 26/10/2026 hasta el 27/10/2026, entrega máxima hasta el 30/10/2026',{date:null,classification:false},options,zone,now);
 assert.deepEqual(first.fields,[]);
 assert.deepEqual(first.pendingDate?.windows,{pickup:{startsOn:'2026-10-26',endsOn:'2026-10-27'},delivery:{endsOn:'2026-10-30'}});
 const pickup=spokenCaptureClarification('Recojo de 08:00 a 10:00',{date:first.pendingDate,classification:false},options,zone,now);
 assert.deepEqual(pickup.fields,[{field:'pickupWindowStartsAt',value:'2026-10-26T08:00'},{field:'pickupWindowEndsAt',value:'2026-10-27T10:00'}]);
 assert.deepEqual(pickup.pendingDate?.windows,{delivery:{endsOn:'2026-10-30'}});
 const deadline=spokenCaptureClarification('Entrega de 14:00 a 18:00',{date:pickup.pendingDate,classification:false},options,zone,now);
 assert.deepEqual(deadline.fields,[],'a deadline alone does not establish the earliest receiving date');
 const delivery=spokenCaptureClarification('Entrega el 29/10/2026 de 14:00 a 18:00',{date:deadline.pendingDate,classification:false},options,zone,now);
 assert.equal(delivery.fields[0]?.value,'2026-10-29T14:00');assert.equal(delivery.fields[1]?.value,'2026-10-30T18:00');
 assert.equal(delivery.pendingDate,null);
});

test("a date alone and an impossible numeric date never become midnight windows",()=>{
 for(const text of ['Recojo el 26/10/2026','Recojo el 31/02/2026 de 08:00 a 10:00'])assert.deepEqual(spokenCaptureClarification(text,{date:null,classification:false},options,zone,now).fields,[]);
 assert.deepEqual(spokenCaptureClarification('Recojo el 26/10/2026 o 27/10/2026 de 08:00 a 10:00',{date:null,classification:false},options,zone,now).fields,[]);
});
test("a voiced date clarification needs role, exact day and an unambiguous clock",()=>{
 const pending={date:dateClarification("mañana",zone,now),classification:false};
 const accepted=spokenCaptureClarification("Recojo de nueve a once de la mañana",pending,options,zone,now);
 assert.equal(accepted.dateResolved,true);assert.deepEqual(accepted.fields,[{field:"pickupWindowStartsAt",value:"2026-10-22T09:00"},{field:"pickupWindowEndsAt",value:"2026-10-22T11:00"}]);
 for(const text of ["de nueve a once de la mañana","Recojo de 9 a 11","Recojo el 30 de febrero de 2026 de 09:00 a 11:00"]){assert.equal(spokenCaptureClarification(text,pending,options,zone,now).dateResolved,false);}
});
test("voice can choose an explicit date from alternatives and never chooses one silently",()=>{
 const pending={date:dateClarification("2026-10-24 o 2026-10-25",zone,now),classification:false};
 assert.equal(spokenCaptureClarification("Entrega de 14:00 a 16:00",pending,options,zone,now).dateResolved,false);
 assert.equal(spokenCaptureClarification("Entrega el 25 de octubre de 2026 de 14:00 a 16:00",pending,options,zone,now).dateResolved,true);
});
test("cargo classification needs an explicit reviewed category and product, using the real catalog",()=>{
 const pending={date:null,classification:true};
 for(const text of ["creo que químicos","no confirmo categoría químicos, producto pinturas","confirmo categoría químicos","producto pinturas, categoría químicos"]){assert.equal(spokenCaptureClarification(text,pending,options,zone,now).classificationResolved,false);}
 const category=options.cargoCategories.find(c=>c.code==='CHEMICAL')!;
 const result=spokenCaptureClarification(`Producto pinturas, confirmo categoría ${category.labelEs}`,pending,options,zone,now);
 assert.equal(result.classificationResolved,true);assert.equal(result.fields.find(f=>f.field==='categoryCode')?.value,'CHEMICAL');
});
test("Spanish review and correction commands are distinct from explicit consent",()=>{
 assert.equal(spokenReviewCommand("CargoMesh, revisa el resumen."),'review');
 assert.equal(spokenReviewCommand("quiero corregir"),'continue');
 assert.equal(spokenReviewCommand("confirmo guardar el borrador"),'confirm');
 assert.equal(spokenReviewCommand("sí"),null);assert.equal(spokenReviewCommand("no confirmo guardar el borrador"),null);
});
test("Spanish short answers bind to Nova's actual last question",()=>{
 const turns=[{speaker:'assistant' as const,text:'¿Cuál es el nombre del contacto de recojo?'}];
 assert.equal(lastSpokenQuestionField(turns),'pickupContactName');
 assert.equal(checkedSpokenField('pickupContactName','María Pérez','María Pérez',turns),'María Pérez');
 assert.equal(checkedSpokenField('recipientContactName','María Pérez','María Pérez',turns),null);
 const cargo=[{speaker:'assistant' as const,text:'¿Qué contienen los pallets?'}];
 assert.equal(checkedSpokenField('cargoDescription','alimentos secos','alimentos secos',cargo),'alimentos secos');
 assert.equal(checkedSpokenField('unitWeightPerUnitKg','100','100 kg por unidad',[]),'100');
 assert.equal(checkedSpokenField('unitQuantity','10','10 pallets de 100 kg cada uno',[]),'10');
});

test("spoken contact values must match literal dictated data, without invented country or mailbox",()=>{
 const email=[{speaker:'assistant' as const,text:'¿Cuál es el correo del contacto de recojo?'}];
 assert.equal(checkedSpokenField('pickupContactEmail','maria@example.com','maria arroba example punto com',email),'maria@example.com');
 assert.equal(checkedSpokenField('pickupContactEmail','otra@example.com','maria arroba example punto com',email),null);
 const phone=[{speaker:'assistant' as const,text:'¿Cuál es el teléfono de recojo?'}];
 assert.equal(checkedSpokenField('pickupContactPhoneE164','+51999111222','más cinco uno nueve nueve nueve uno uno uno dos dos dos',phone),'+51999111222');
 assert.equal(checkedSpokenField('pickupContactPhoneE164','+51999111222','999111222',phone),null);
});

test("a short time-range answer uses the explicit pickup question, never a guessed role",()=>{
 const pending={date:dateClarification('mañana',zone,now),classification:false};
 assert.equal(spokenCaptureClarification('de 9 a 11 de la mañana',pending,options,zone,now,'pickup').dateResolved,true);
 assert.equal(spokenCaptureClarification('no recojo mañana de 9 a 11 de la mañana',pending,options,zone,now).dateResolved,false);
});

test("a contradictory or alternative day never inherits a previously proposed date",()=>{
 const pending={date:dateClarification('mañana',zone,now),classification:false};
 for(const text of ['Recojo el viernes de 9 a 11 de la mañana','Recojo mañana o pasado mañana de 9 a 11 de la mañana','Recojo el 25 de 9 a 11 de la mañana'])assert.equal(spokenCaptureClarification(text,pending,options,zone,now).dateResolved,false);
});

test("morning describes a clock period and is not tomorrow",()=>{assert.equal(dateClarification('Recojo de nueve a once de la mañana',zone,now),null);});


import {spokenCategoryAcceptance} from "./spoken-category-acceptance";
import {buildSpokenRequestReview} from "./spoken-request-review";
import {applyChatFieldsToDraft,EMPTY_PROTOTYPE_DRAFT} from "./prototype-model";
import {interpretDeterministically} from "@/features/v2-conversation-prep/interpretation";
import {parseConversationField} from "./conversation-fields";

test("English scheduling answers bind to the latest question rather than an earlier pickup recap",()=>{
 const assistant=(text:string)=>[{speaker:"assistant" as const,text}];
 assert.equal(lastSpokenQuestionField(assistant("When would you like the cargo to be picked up? Please give the date and time window.")),"pickupWindowStartsAt");
 assert.equal(lastSpokenQuestionField(assistant("Pickup is November 10. Now, when does the shipment need to be delivered in Arequipa?")),"deliveryWindowStartsAt");
 assert.equal(lastSpokenQuestionField(assistant("I have the start time as two pm. What time should the delivery window end?")),"deliveryWindowEndsAt");
 assert.equal(lastSpokenQuestionField(assistant("Since you are shipping robots, would you categorize this as Machinery and Heavy Industrial, or does another category fit better?")),"categoryCode");
 assert.equal(lastSpokenQuestionField(assistant("I recommend a flatbed or a tractor trailer. Which one would you prefer?")),"requiredEquipment");
});

test("reported November pickup and December delivery retain separate partial dates and clocks",()=>{
 let pending={date:null as ReturnType<typeof dateClarification>,classification:false};
 let draft={...EMPTY_PROTOTYPE_DRAFT,cargoDescription:"robot",categoryCode:"MACHINERY"};
 const turn=(text:string,role:"pickup"|"delivery")=>{
  const result=spokenCaptureClarification(text,pending,options,zone,now,role);
  pending={...pending,date:result.pendingDate};draft=applyChatFieldsToDraft(draft,result.fields);return result;
 };
 assert.equal(turn("November, any day is ok but between 9am to 5pm","pickup").dateResolved,false);
 assert.equal(turn("yes in lima time zone, november 10 will be ok","pickup").dateResolved,true);
 assert.equal(draft.pickupWindowStartsAt,"2026-11-10T09:00");assert.equal(draft.pickupWindowEndsAt,"2026-11-10T17:00");
 turn("December 10 afternoon","delivery");assert.equal(pending.date?.role,"delivery");
 // A mistaken model pickup question cannot relabel a pending delivery answer.
 turn("2pm","pickup");assert.equal(pending.date?.startTime,"14:00");
 assert.equal(turn("8pm","pickup").dateResolved,true);
 assert.equal(draft.deliveryWindowStartsAt,"2026-12-10T14:00");assert.equal(draft.deliveryWindowEndsAt,"2026-12-10T20:00");
 turn("i already told you december 10 from 2pm to 9pm","delivery");
 assert.equal(draft.deliveryWindowEndsAt,"2026-12-10T21:00");assert.equal(draft.pickupWindowStartsAt,"2026-11-10T09:00");
 const both=turn("it should arrive in arequipa in december 10 at 2pm to 9pm and it go out from lima at november 10 at 8am to 5pm","delivery");
 assert.equal(both.dateResolved,true);assert.equal(both.fields.length,4);
 assert.equal(draft.pickupWindowStartsAt,"2026-11-10T08:00");assert.equal(draft.pickupWindowEndsAt,"2026-11-10T17:00");
 assert.equal(draft.deliveryWindowStartsAt,"2026-12-10T14:00");assert.equal(draft.deliveryWindowEndsAt,"2026-12-10T21:00");
 assert.equal(draft.cargoDescription,"robot");assert.equal(draft.categoryCode,"MACHINERY");
});

test("a new day cannot inherit another day's clocks and unsupported dates never produce a window",()=>{
 const pending={date:{alternatives:["2026-11-10"],timeZone:zone,referenceDate:"2026-10-21",role:"delivery" as const,startTime:"14:00"},classification:false};
 const changed=spokenCaptureClarification("December 10 afternoon",pending,options,zone,now,"delivery");
 assert.equal(changed.pendingDate?.startTime,undefined);assert.equal(changed.dateResolved,false);
 for(const value of ["delivery February 30 2027 from 2pm to 9pm","delivery January 10 from 2pm to 9pm","pickup and delivery tomorrow from 9am to 5pm","delivery November 10 or December 10 from 2pm to 9pm","delivery November 10 or 11 from 2pm to 9pm"])assert.equal(spokenCaptureClarification(value,{date:null,classification:false},options,zone,now).dateResolved,false,value);
 assert.equal(spokenCaptureClarification("tractor",pending,options,zone,now,"delivery").pendingDate,pending.date);
});

test("robots in each box and weight each survive compound quantity answers",()=>{
 const text="2 boxes with one robot inside of each one, it weights 500kg each";
 const turns=[{speaker:"user" as const,text,contentId:"nova:test:robots",provisional:false}];
 const review=buildSpokenRequestReview(turns,options,EMPTY_PROTOTYPE_DRAFT);
 assert.ok(review.fields.some(f=>f.field==="cargoDescription"&&f.value==="robot"));
 const proposal=interpretDeterministically({schemaVersion:"2.0",text,currentField:"unitQuantity"});
 assert.ok(proposal.fields.some(f=>f.field==="unitQuantity"&&f.value==="2"));
 assert.equal(checkedSpokenField("unitWeightPerUnitKg","500",text,[{speaker:"assistant",text:"How many boxes are you shipping, and what do they contain?"}]),"500");
 assert.equal(checkedSpokenField("unitWeightPerUnitKg","500","500 kg total",[]),null);
});

test("short category acceptance selects only one named catalog category, never consent or hazardous clearance",()=>{
 const prompt=[{speaker:"assistant" as const,text:"Would you categorize this as Machinery and Heavy Industrial, or does another category fit better?"}];
 assert.deepEqual(spokenCategoryAcceptance("yes that one is good",prompt,options),[{field:"categoryCode",value:"MACHINERY"}]);
 assert.deepEqual(spokenCategoryAcceptance("no",prompt,options),[]);
 assert.deepEqual(spokenCategoryAcceptance("yes",[{speaker:"assistant",text:"Machinery or general cargo: which category?"}],options),[]);
 assert.deepEqual(spokenCategoryAcceptance("yes",[{speaker:"assistant",text:"Confirm Chemical category?"}],options),[]);
 assert.deepEqual(spokenCategoryAcceptance("yes",[{speaker:"assistant",text:"Confirm and save your draft?"}],options),[]);
 assert.equal(parseConversationField("requiredEquipment","tractor",options),null);
 const withTractor={...options,equipmentOptions:[...options.equipmentOptions,{code:"TRACTOR_TRAILER",labelEs:"Tractocamión",labelEn:"Tractor trailer",verification:"CAPTURE_ONLY" as const}]};
 assert.equal(parseConversationField("requiredEquipment","tractor",withTractor),"TRACTOR_TRAILER");
});
