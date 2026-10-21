import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CatalogInputsV2} from '../src/shared/schemas/v2/catalog';
import {WorkflowInputsV2} from '../src/shared/schemas/v2/workflow';
import {QuotePolicyValueSchema} from '../src/shared/schemas/v2/quote-automation';
const source=fs.readFileSync(fileURLToPath(new URL('../../supabase/scenarios/v2-client-carrier-quotes/seed.sql',import.meta.url)),'utf8');
const match=source.match(/\$scenario\$([\s\S]+?)\$scenario\$/);if(!match)throw Error('SCENARIO_MISSING');
const scenario=z.object({scenarioId:z.string(),targetProjectRef:z.literal('yhimeajpzicjbxpbzsyh'),provenanceStatus:z.literal('SIMULATED'),steps:z.array(z.object({key:z.string(),family:z.enum(['catalog','workflow']),kind:z.string().optional(),action:z.string().optional(),value:z.unknown()})),policy:z.unknown()}).passthrough().parse(JSON.parse(match[1]));
const refs:Record<string,string>={};
function resolve(v:unknown):unknown{if(typeof v==='string'&&v.startsWith('$')){if(!refs[v.slice(1)])throw Error('MISSING_REFERENCE:'+v);return refs[v.slice(1)];}if(Array.isArray(v))return v.map(resolve);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)]));return v;}
for(const step of scenario.steps){
 const schema=step.family==='catalog'?CatalogInputsV2[step.kind as keyof typeof CatalogInputsV2]:WorkflowInputsV2[step.action as keyof typeof WorkflowInputsV2];
 if(!schema)throw Error('UNKNOWN_SCENARIO_COMMAND');schema.parse(resolve(step.value));
 const h=createHash('sha256').update(step.key).digest('hex');refs[step.key]=`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
QuotePolicyValueSchema.parse(resolve(scenario.policy));
console.log(`Scenario valid: ${scenario.steps.length} native commands + explicit simulated tariff. No database writes.`);
