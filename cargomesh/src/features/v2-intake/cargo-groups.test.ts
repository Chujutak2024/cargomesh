import test from 'node:test';import assert from 'node:assert/strict';
import {cargoGroups,replaceCargoGroups,appendCargoGroup,groupTotals} from './cargo-groups';
import {buildPrototypeExample,mapDraftToCreateFreightRequestV2Input,requestToPrototypeDraft,mapDraftToRevisionInput,applyChatFieldsToDraft,validatePrototypeReview} from './prototype-model';
import {getIntakeOptionsFixture} from './intake-options';
import {ROAD_REQUEST_FIXTURE} from './fixtures/contract-flow.fixture';
test('boxes and pallets preserve distinct measurements and derive one total through creation',()=>{const options=getIntakeOptionsFixture().data,draft=buildPrototypeExample(options),first=cargoGroups(draft)[0],second={...first,id:'group-1',unitPackageType:options.packagingOptions[0].code,unitQuantity:'2',unitWeightPerUnitKg:'100',unitVolumePerUnitM3:'1'};const d=replaceCargoGroups(draft,[first,second]);const result=mapDraftToCreateFreightRequestV2Input(d,options);assert.equal(result.cargoSpecification.units.length,2);assert.equal(result.cargoSpecification.totalWeightKg,Number(draft.totalWeightKg)+200);assert.equal(result.cargoSpecification.units[1].weightPerUnitKg,100);});
test('form and chat corrections preserve extra groups and recalculate their contribution',()=>{const draft=buildPrototypeExample(getIntakeOptionsFixture().data),groups=cargoGroups(draft),d=replaceCargoGroups(draft,[...groups,{...groups[0],id:'extra',unitQuantity:'2',unitWeightPerUnitKg:'100',unitVolumePerUnitM3:'1'}]);const corrected=applyChatFieldsToDraft(d,[{field:'unitQuantity',value:'3'}]);assert.equal(corrected.additionalUnits?.length,1);assert.equal(Number(corrected.totalWeightKg),3*Number(d.unitWeightPerUnitKg)+200);});
test('removing/reordering groups preserves the original package metadata on revision',()=>{const options=getIntakeOptionsFixture().data,request=structuredClone(ROAD_REQUEST_FIXTURE);request.cargoSpecification.units=[{...request.cargoSpecification.units[0],unitsPerPackage:3},{...request.cargoSpecification.units[0],unitsPerPackage:7}];request.cargoSpecification.totalWeightKg*=2;request.cargoSpecification.totalVolumeM3*=2;const draft=requestToPrototypeDraft(request)!;const kept=replaceCargoGroups(draft,[cargoGroups(draft)[1]]);const result=mapDraftToRevisionInput(kept,options,request);assert.equal(result.cargoSpecification.units.length,1);assert.equal(result.cargoSpecification.units[0].unitsPerPackage,7);assert.equal(result.cargoSpecification.totalWeightKg,request.cargoSpecification.totalWeightKg/2);});
test('a newly appended incomplete group prevents request creation and retains other fields',()=>{const d=buildPrototypeExample(getIntakeOptionsFixture().data),next=replaceCargoGroups(d,appendCargoGroup(d));assert.equal(validatePrototypeReview(next).valid,false);assert.equal(next.originFacilityId,d.originFacilityId);assert.throws(()=>replaceCargoGroups(d,[]));});

test('known weight remains visible before volume is provided, and vice versa',()=>{
 const group=cargoGroups(buildPrototypeExample(getIntakeOptionsFixture().data))[0];
 assert.deepEqual(groupTotals([{...group,unitQuantity:'10',unitWeightPerUnitKg:'100',unitVolumePerUnitM3:''}]),{totalWeightKg:'1000',totalVolumeM3:''});
 assert.deepEqual(groupTotals([{...group,unitQuantity:'10',unitWeightPerUnitKg:'',unitVolumePerUnitM3:'1'}]),{totalWeightKg:'',totalVolumeM3:'10'});
});
test('an incomplete second group never exposes a partial shipment total or invents zero',()=>{
 const group=cargoGroups(buildPrototypeExample(getIntakeOptionsFixture().data))[0];
 assert.equal(groupTotals([group,{...group,id:'other',unitWeightPerUnitKg:''}]).totalWeightKg,'');
 assert.deepEqual(groupTotals([{...group,unitQuantity:''}]),{totalWeightKg:'',totalVolumeM3:''});
 assert.deepEqual(groupTotals([]),{totalWeightKg:'',totalVolumeM3:''});
});
