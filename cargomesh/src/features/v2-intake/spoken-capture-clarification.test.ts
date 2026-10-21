import assert from "node:assert/strict";
import test from "node:test";
import {spokenCaptureClarification} from "./spoken-capture-clarification";
import {dateClarification} from "./capture-clarification";
import {getIntakeOptionsFixture} from "./intake-options";
import {spokenReviewCommand} from "./spoken-request-review";
import {lastSpokenQuestionField,checkedSpokenField} from "./spoken-field-guard";
const options=getIntakeOptionsFixture().data,zone="America/Lima",now=Date.parse("2026-10-21T12:00:00Z");
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
