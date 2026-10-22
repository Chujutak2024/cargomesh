import assert from "node:assert/strict";
import test from "node:test";
test('spoken axis labels resolve individual dimensions and retain scope ambiguity',()=>{
 const result=measurementTurn('each pallet is one meter long. one meter wide. and one meter high.',null,draft);
 assert.equal(result.question,'APPLIED');assert.equal(result.volumeM3,1);assert.deepEqual(result.fields.map(f=>f.value),['100','100','100','1']);
 const es=measurementTurn('cada pallet mide un metro de largo, un metro de ancho y un metro de alto',null,draft);
 assert.equal(es.question,'APPLIED');assert.equal(es.volumeM3,1);
 assert.equal(measurementTurn('one meter long, one meter wide, one meter high',null,draft).question,'SCOPE');
 assert.equal(measurementTurn('the whole shipment is one meter long, one meter wide, one meter high',null,draft).question,'PER_UNIT');
 assert.deepEqual(measurementTurn('each pallet is one meter long',null,draft).fields,[]);
});
import { measurementTurn, measurementReply } from "./measurement-clarification";
import { EMPTY_PROTOTYPE_DRAFT, applyChatFieldsToDraft } from "./prototype-model";

const draft = {...EMPTY_PROTOTYPE_DRAFT,unitQuantity:"10",unitWeightPerUnitKg:"100"};

test("ambiguous dimensions remain pending without altering the draft",()=>{
 const result=measurementTurn("Miden 5 × 1,5 × 2 m",null,draft);
 assert.equal(result.question,"SCOPE");assert.equal(result.volumeM3,15);
 assert.deepEqual(result.fields,[]);assert.ok(result.pending);
 assert.match(measurementReply(result,"es"),/cada unidad.*conjunto/);
});

test("explicit per-unit resolution computes 150 m3 for ten units and preserves weight",()=>{
 const pending=measurementTurn("5 x 1,5 x 2 m",null,draft).pending;
 const result=measurementTurn("por cada pallet",pending,draft);
 assert.equal(result.question,"APPLIED");assert.equal(result.pending,null);
 const next=applyChatFieldsToDraft(draft,result.fields);
 assert.equal(next.unitLengthCm,"500");assert.equal(next.unitHeightCm,"200");
 assert.equal(next.unitVolumePerUnitM3,"15");assert.equal(next.totalVolumeM3,"150");
 assert.equal(next.unitQuantity,"10");assert.equal(next.unitWeightPerUnitKg,"100");assert.equal(next.totalWeightKg,"1000");
});

test("group dimensions do not invent per-unit dimensions or divide volume",()=>{
 const pending=measurementTurn("5 x 1,5 x 2 m",null,draft).pending;
 const result=measurementTurn("son de todo el conjunto",pending,draft);
 assert.equal(result.question,"PER_UNIT");assert.equal(result.volumeM3,15);
 assert.equal(result.pending?.scope,"SHIPMENT");assert.deepEqual(result.fields,[]);
 const next=measurementTurn("cada pallet mide 120 x 80 x 90 cm",result.pending,draft);
 assert.equal(next.question,"APPLIED");assert.equal(next.volumeM3,0.864);
 assert.equal(applyChatFieldsToDraft(draft,next.fields).totalVolumeM3,"8.64");
});

test("missing measurement unit cannot be silently assumed",()=>{
 const first=measurementTurn("5 x 1,5 x 2 por unidad",null,draft);
 assert.equal(first.question,"UNIT");assert.deepEqual(first.fields,[]);
 const next=measurementTurn("metros",first.pending,draft);
 assert.equal(next.question,"APPLIED");assert.equal(next.volumeM3,15);
});

test("height correction recalculates volume while preserving all other fields",()=>{
 const initial=applyChatFieldsToDraft(draft,measurementTurn("5 x 1.5 x 2 meters per unit",null,draft).fields);
 const result=measurementTurn("corrige la altura a 1,2 metros",null,initial);
 const next=applyChatFieldsToDraft(initial,result.fields);
 assert.equal(result.question,"APPLIED");assert.equal(next.unitHeightCm,"120");
 assert.equal(next.unitLengthCm,"500");assert.equal(next.unitWidthCm,"150");
 assert.equal(next.totalVolumeM3,"90");assert.equal(next.totalWeightKg,"1000");
});

test("unrelated turns retain pending clarification and conflicting scopes do not resolve it",()=>{
 const pending=measurementTurn("5 x 1,5 x 2 m",null,draft).pending;
 const unrelated=measurementTurn("recoger en Lima",pending,draft);
 assert.equal(unrelated.handled,false);assert.deepEqual(unrelated.pending,pending);
 const conflict=measurementTurn("5 x 1,5 x 2 m por unidad y en total",null,draft);
 assert.equal(conflict.question,"SCOPE");assert.deepEqual(conflict.fields,[]);
});

test("zero dimensions cannot become a complete cargo measurement",()=>{
 const result=measurementTurn("0 x 1 x 2 m por unidad",null,draft);
 assert.equal(result.question,"INVALID");assert.ok(result.pending);assert.deepEqual(result.fields,[]);
});

test("negative dimensions are rejected rather than read as positive numbers",()=>{
 const result=measurementTurn("-5 x 1.5 x 2 m por unidad",null,draft);
 assert.equal(result.question,"INVALID");assert.deepEqual(result.fields,[]);
});
test("explicit cancellation discards only the pending proposal",()=>{
 const pending=measurementTurn("5 x 1.5 x 2 m",null,draft).pending;
 const result=measurementTurn("descarta estas medidas",pending,draft);
 assert.equal(result.question,"DISCARDED");assert.equal(result.pending,null);assert.deepEqual(result.fields,[]);
});
