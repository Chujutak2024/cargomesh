import assert from 'node:assert/strict';
import test from 'node:test';
import {carrierEstimateBasis,carrierPriceEstimate,acceptsSuggestedPrice} from './carrier-price-estimate';
import {opportunity,assignment,id} from './commercial-test-fixtures';

test('carrier estimate uses persisted ROAD leg once and recorded equipment, never synthetic defaults',()=>{
 const o=opportunity();
 assert.equal(carrierEstimateBasis(o,[assignment]),null);
 o.data.assignmentSnapshots=[{id:assignment,serviceId:id(5),resource:{equipment:'BOX_TRUCK'},routeLeg:{sequence:1,mode:'ROAD',estimatedDistanceKm:101.25}}];
 assert.deepEqual(carrierEstimateBasis(o,[assignment]),{distanceKm:101.25,equipmentType:'BOX_TRUCK',legSequences:[1]});
 assert.equal(carrierPriceEstimate(101.25,2.5),253.13);
 o.data.assignmentSnapshots.push({id:id(40),serviceId:id(5),legAssignmentId:assignment,resource:{equipment:'BOX_TRUCK'},routeLeg:{sequence:1,mode:'ROAD',estimatedDistanceKm:101.25}});
 assert.equal(carrierEstimateBasis(o,[assignment])?.distanceKm,101.25);
 o.data.assignmentSnapshots[1].resource={equipment:'REEFER_TRUCK'};
 assert.equal(carrierEstimateBasis(o,[assignment]),null);
});

test('unknown distance, non-road leg, and invalid carrier rates cannot produce a numeric recommendation',()=>{
 const o=opportunity();
 o.data.assignmentSnapshots=[{id:assignment,serviceId:id(5),resource:{equipment:'BOX_TRUCK'},routeLeg:{sequence:1,mode:'ROAD',estimatedDistanceKm:null}}];
 assert.equal(carrierEstimateBasis(o,[assignment]),null);
 o.data.assignmentSnapshots[0].routeLeg={sequence:1,mode:'SEA',estimatedDistanceKm:10};
 assert.equal(carrierEstimateBasis(o,[assignment]),null);
 assert.equal(carrierPriceEstimate(100,0),null);
 assert.equal(carrierPriceEstimate(100,Number.NaN),null);
});

test('spoken acceptance only marks an estimate for review',()=>{
 assert.equal(acceptsSuggestedPrice('Use the suggested price'),true);
 assert.equal(acceptsSuggestedPrice('Dale ese precio'),true);
 assert.equal(acceptsSuggestedPrice('No, change that price'),false);
});
