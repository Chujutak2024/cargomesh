const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const repo=process.argv[2];if(!repo||!process.argv[3]||!process.argv[4])throw new Error('Usage: validate-manifest.cjs REPO_ROOT MANIFEST OUTPUT_JSON');
const root=path.join(repo,'cargomesh');
const crypto=require('node:crypto');const placeholder=name=>{const h=crypto.createHash('sha256').update('validation-only:'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const resolveRefs=v=>Array.isArray(v)?v.map(resolveRefs):v&&typeof v==='object'?(Object.keys(v).length===1&&v.$ref?placeholder(v.$ref):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolveRefs(x)]))):v;
(async()=>{
 const [{CatalogInputsV2},{WorkflowInputsV2},{FacilityInputV2Schema},{QuotePolicyValueSchema},{CreateFreightRequestV2InputSchema}]=await Promise.all([
  'catalog','workflow','facilities','quote-automation','freight-request'
 ].map(x=>import(pathToFileURL(path.join(root,'src/shared/schemas/v2',x+'.ts')).href)));
 const manifest=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 for(const op of manifest.operations){const v=resolveRefs(op.value);const schema=op.api==='catalog'?CatalogInputsV2[op.scope.kind]:op.api==='workflow'?WorkflowInputsV2[op.scope.action]:op.api==='facility'?FacilityInputV2Schema:QuotePolicyValueSchema;schema.parse(v);}
 for(const op of manifest.postBookingAssignments.operations)CatalogInputsV2[op.kind].parse(resolveRefs(op.value));
 CreateFreightRequestV2InputSchema.parse(resolveRefs(manifest.requestTemplate));
 const result={result:'PASS',operations:manifest.operations.length,postBookingAssignmentTemplates:manifest.postBookingAssignments.operations.length,requestSchema:'PASS',referenceIdsForSchemaValidationOnly:true};
 fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
