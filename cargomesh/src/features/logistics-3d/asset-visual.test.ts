import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {associateAssetVisual} from './asset-visual';

test('equipment and body distinguish a rigid box, articulated closed box, curtain and reefer',()=>{
  for(const [equipmentType,bodyType,modelName,family] of [
    ['BOX_TRUCK','BOX','Rigid','rigid'],
    ['TRACTOR_TRAILER','BOX','Articulated','articulated'],
    ['TRACTOR_TRAILER','BOX','Curtainsider','curtainsider'],
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
  assert.equal(associateAssetVisual({equipmentType:'NEW_MODE',bodyType:'UNKNOWN'}),null);
});
test('all eighty persisted scenario rows associate to the published families without changing identity or operational facts',()=>{
  const dir=path.resolve(process.cwd(),'../supabase/scenarios/v2-carrier-fleet-80');
  const manifest=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8')) as {visuals:{assetId:string;family:string;poster:string}[]};
  const rows=JSON.parse(readFileSync(path.join(dir,'records.json'),'utf8')) as {table:string;value:{id:string;equipment_code:string;body_type:string;model:string;variant:string}}[];
  const assets=rows.filter(row=>row.table==='public.transport_assets');
  assert.equal(assets.length,80);
  const before=JSON.stringify(assets);const ids=new Set<string>();const families=new Set<string>();
  for(const {value} of assets){
    const visual=associateAssetVisual({equipmentType:value.equipment_code,bodyType:value.body_type,modelName:value.model,designHint:value.variant});
    assert.ok(visual,value.id);
    const expected=manifest.visuals.find(v=>v.assetId===value.id);
    assert.equal(visual.family,expected?.family,value.id);assert.equal(visual.poster,expected?.poster);
    assert.ok(existsSync(path.join(process.cwd(),'public',visual.poster)));
    ids.add(value.id);families.add(visual.family);
  }
  assert.equal(ids.size,80);assert.deepEqual([...families].sort(),['articulated','curtainsider','refrigerated','rigid']);
  assert.equal(JSON.stringify(assets),before);
});
