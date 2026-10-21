import assert from "node:assert/strict";
import test from "node:test";
import {dateClarification,sessionDate,needsCargoClassification,validExplicitWindow} from "./capture-clarification";
import {chatSendGate} from "./chat-send-gate";
import {InterpretationRequestSchema} from "@/features/v2-conversation-prep/interpretation";
test("relative dates use the session date, including UTC/local midnight and year boundary",()=>{
 const now=Date.parse("2027-01-01T02:00:00Z");
 assert.equal(sessionDate(now,"America/Lima"),"2026-12-31");
 assert.deepEqual(dateClarification("mañana","America/Lima",now)?.alternatives,["2027-01-01"]);
 assert.deepEqual(dateClarification("pasado mañana","America/Lima",now)?.alternatives,["2027-01-02"]);
 assert.deepEqual(dateClarification("hoy","America/Lima",now)?.alternatives,["2026-12-31"]);
});
test("alternative dates remain proposals without inventing pickup/delivery roles or hours",()=>{
 const result=dateClarification("lunes o martes","America/Lima",Date.parse("2026-10-21T12:00:00Z"));
 assert.deepEqual(result,{alternatives:[],timeZone:"America/Lima",referenceDate:"2026-10-21"});
 assert.deepEqual(dateClarification("2026-10-26 o 2026-10-27","America/Lima")?.alternatives,["2026-10-26","2026-10-27"]);
 assert.equal(dateClarification("10 pallets","America/Lima"),null);
});
test("windows require explicit ordered and real calendar instants",()=>{
 assert.equal(validExplicitWindow("2026-10-22T09:00","2026-10-22T11:00"),true);
 for(const [start,end] of [["2026-10-22T11:00","2026-10-22T09:00"],["2026-02-30T09:00","2026-03-01T11:00"],["mañana","2026-10-22T11:00"],["2026-10-22T09:00","2026-10-22T09:00"]])assert.equal(validExplicitWindow(start,end),false);
});
test("hazard uncertainty requires product classification; packaging is not cargo classification",()=>{
 assert.equal(needsCargoClassification("creo que son materiales peligrosos"),true);
 assert.equal(needsCargoClassification("no sé la categoría de esta carga"),true);
 assert.equal(needsCargoClassification("10 pallets de alimentos"),false);
});
test("long messages pass intact up to 6000; larger input is rejected without slicing",()=>{
 const text="Necesito ayuda. "+"x".repeat(4500);
 assert.deepEqual(chatSendGate(text,false,false),{kind:"send",value:text});
 assert.equal(InterpretationRequestSchema.safeParse({schemaVersion:"2.0",text,currentField:null}).success,true);
 assert.equal(chatSendGate("x".repeat(6001),false,false).kind,"wait");
 assert.equal(InterpretationRequestSchema.safeParse({schemaVersion:"2.0",text:"x".repeat(6001),currentField:null}).success,false);
});
