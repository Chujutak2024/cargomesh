import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {CargoSpecificationV2Schema,TimeWindowV2Schema} from '../src/shared/schemas/v2/freight-request';
const root=new URL('../../',import.meta.url);
const text=fs.readFileSync(new URL('supabase/scenarios/v2-client-carrier-flow-cases/seed.sql',root),'utf8');
const body=text.match(/\$scenario\$([\s\S]+?)\$scenario\$/);assert.ok(body,'Recipe missing');
const recipe=z.object({schemaVersion:z.literal('2.0'),scope:z.literal('LOCAL_ONLY'),provenanceStatus:z.literal('SIMULATED'),activation:z.literal('RECIPE_ONLY'),pickupWindow:TimeWindowV2Schema,deliveryWindow:TimeWindowV2Schema,validUntil:z.string().datetime(),routes:z.array(z.object({key:z.string(),cities:z.array(z.string()).min(2),source:z.literal('SIMULATED'),realRoadDistance:z.literal(false)}).passthrough()),cases:z.array(z.object({code:z.string(),phase:z.number().int().min(1).max(4),expected:z.string(),route:z.string(),cargo:CargoSpecificationV2Schema,automatedQuote:z.boolean(),evidenceFile:z.string()}).passthrough()).length(9),deferred:z.array(z.string())}).parse(JSON.parse(body[1]));
assert.equal(new Set(recipe.cases.map(c=>c.code)).size,recipe.cases.length);
assert.ok(Date.parse(recipe.pickupWindow.endsAt)<Date.parse(recipe.deliveryWindow.startsAt));
assert.ok(Date.parse(recipe.deliveryWindow.endsAt)<=Date.parse(recipe.validUntil));
for(const [i,c] of recipe.cases.entries()){
 assert.ok(i===0||recipe.cases[i-1].phase<=c.phase,'Case order is contractual');
 assert.ok(recipe.routes.some(r=>r.key===c.route));
 assert.ok(c.evidenceFile.startsWith('supabase/tests/')&&!c.evidenceFile.includes('..'));
 assert.ok(fs.existsSync(new URL(c.evidenceFile,root)));
}
const multi=recipe.cases.find(c=>c.code==='04_TWO_TRUCKS')!;
const allocations=z.array(z.object({unitIndex:z.number().int(),quantity:z.number().int().positive(),truckIndex:z.number().int()})).parse(multi.allocations);
const trucks=z.array(z.object({usefulCapacityKg:z.number().positive(),volumeM3:z.number().positive()})).parse(multi.trucks);
for(const [index,unit] of multi.cargo.units.entries())assert.equal(allocations.filter(a=>a.unitIndex===index).reduce((n,a)=>n+a.quantity,0),unit.quantity);
for(const [index,truck] of trucks.entries()){
 const assigned=allocations.filter(a=>a.truckIndex===index);
 assert.ok(assigned.reduce((n,a)=>n+a.quantity*multi.cargo.units[a.unitIndex].weightPerUnitKg,0)<=truck.usefulCapacityKg);
 assert.ok(assigned.reduce((n,a)=>n+a.quantity*multi.cargo.units[a.unitIndex].volumePerUnitM3,0)<=truck.volumeM3);
}
assert.equal(multi.automatedQuote,false,'Do not claim automatic multi-truck generation');
assert.equal(recipe.cases.find(c=>c.code==='06_ROUTE_TOTAL_LIMIT')?.expected,'KNOWN_LIMITATION');
console.log('PASS: nine ordered, typed LOCAL_ONLY recipes; whole-package allocations fit each truck. No data activated.');
