import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {associateAssetVisual} from './asset-visual';
import {truckDesigns,truckBody} from './visual-catalog';

test('equipment and body distinguish a rigid box, articulated closed box, curtain and reefer',()=>{
  for(const [equipmentType,bodyType,modelName,family] of [
    ['BOX_TRUCK','BOX','Rigid','rigid'],
    ['TRACTOR_TRAILER','BOX','Articulated','articulated'],
    ['TRACTOR_TRAILER','CURTAINSIDER','Curtainsider','curtainsider'],
    ['REEFER_TRUCK','REEFER','Refrigerated','refrigerated'],
    ['FLATBED_TRUCK','PLATFORM',null,'flatbed'],
    ['OTHER','LOWLOADER',null,'lowloader'],
    ['OTHER','TANKER',null,'tanker'],
    ['OTHER','MIXER',null,'mixer'],
    ['OTHER','LOGGING',null,'logging'],
    ['OTHER','TIPPER',null,'tipper'],
  ]) assert.equal(associateAssetVisual({equipmentType:equipmentType!,bodyType:bodyType!,modelName})?.family,family);
});
test('an explicit recorded design is respected only within the compatible equipment family',()=>{
  const base={equipmentType:'BOX_TRUCK',bodyType:'BOX'};
  assert.equal(associateAssetVisual({...base,designHint:'rigid-tail-lift'})?.designId,'rigid-tail-lift');
  assert.equal(associateAssetVisual({...base,designHint:'rigid-tail-lift'})?.source,'RECORDED_DESIGN');
  assert.equal(associateAssetVisual({...base,designHint:'refrigerated-guard'})?.designId,'rigid-city');
  assert.equal(associateAssetVisual({...base,designHint:'new-unimplemented-design'})?.source,'EQUIPMENT_REFERENCE');
  assert.equal(associateAssetVisual({...base,designHint:'refuse'})?.designId,'rigid-city');
  for(const designHint of ['car-carrier','livestock']) assert.equal(associateAssetVisual({equipmentType:'TRACTOR_TRAILER',bodyType:'BOX',designHint})?.designId,'articulated-box');
  assert.equal(associateAssetVisual({...base,modelName:'Refuse livestock curtainsider'})?.designId,'rigid-city');
  assert.equal(associateAssetVisual({equipmentType:'NEW_MODE',bodyType:'UNKNOWN'}),null);
});
test('all 23 designs require matching explicit body and chassis; specialist bodies resolve without a hint',()=>{
  const equipment:Record<string,string>={rigid:'BOX_TRUCK',articulated:'TRACTOR_TRAILER',refrigerated:'REEFER_TRUCK',curtainsider:'TRACTOR_TRAILER',flatbed:'FLATBED',lowloader:'TRACTOR_TRAILER',tanker:'TANKER_TRUCK',mixer:'OTHER',logging:'FLATBED',tipper:'OTHER'};
  for(const design of truckDesigns){
    const input={equipmentType:equipment[design.family],bodyType:truckBody(design),designHint:design.id};
    assert.equal(associateAssetVisual(input)?.designId,design.id);
    if(design.appearance.bodyStyle) assert.equal(associateAssetVisual({...input,designHint:null})?.designId,design.id);
    const before=JSON.stringify(input);associateAssetVisual(input);assert.equal(JSON.stringify(input),before);
  }
  for(const [equipmentType,bodyType] of [['BOX_TRUCK','LIVESTOCK'],['REEFER_TRUCK','REFUSE'],['BOX_TRUCK','CRANE'],['TRACTOR_TRAILER','BULK_SILO'],['BOX_TRUCK','UNKNOWN']]) assert.equal(associateAssetVisual({equipmentType,bodyType}),null);
});
test('all eighty persisted scenario rows associate to the published families without changing identity or operational facts',()=>{
  const dir=path.resolve(process.cwd(),'../supabase/scenarios/v2-carrier-fleet-80');
  const manifest=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8')) as {visuals:{assetId:string;family:string;poster:string}[]};
  const rows=JSON.parse(readFileSync(path.join(dir,'records.json'),'utf8')) as {table:string;value:{id:string;equipment_code:string;body_type:string;model:string;variant:string}}[];
  const assets=rows.filter(row=>row.table==='public.transport_assets');
  assert.equal(assets.length,80);
  const before=JSON.stringify(assets);const ids=new Set<string>();const families=new Set<string>();let corrected=0;
  for(const {value} of assets){
    const visual=associateAssetVisual({equipmentType:value.equipment_code,bodyType:value.body_type,modelName:value.model,designHint:value.variant});
    assert.ok(visual,value.id);
    const expected=manifest.visuals.find(v=>v.assetId===value.id);
    if(value.body_type==='BOX'&&value.model==='Curtainsider'){assert.equal(visual.family,'rigid');assert.equal(visual.body,'box');corrected++;}
    else {assert.equal(visual.family,expected?.family,value.id);assert.equal(visual.poster,expected?.poster);}
    assert.ok(existsSync(path.join(process.cwd(),'public',visual.poster)));
    ids.add(value.id);families.add(visual.family);
  }
  assert.equal(ids.size,80);assert.equal(corrected,assets.filter(row=>row.value.body_type==='BOX'&&row.value.model==='Curtainsider').length);assert.ok(corrected>0);assert.deepEqual([...families].sort(),['articulated','refrigerated','rigid']);
  assert.equal(JSON.stringify(assets),before);
});
