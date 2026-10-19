import {test} from 'node:test';
import assert from 'node:assert/strict';
import {juanHref,juanHash} from './juan-route-model';
test('existing canonical roots remain the public destinations',()=>{
 for(const [hash,path] of [['dashboard','/carriers'],['shipments','/carriers/requests'],['desk','/carriers/offers'],['tracking','/carriers/orders'],['pipeline','/carriers/pipeline'],['fleet','/carriers/fleet'],['fleet/carriers','/carriers/sites'],['help','/carriers/help'],['tower','/carriers/control-tower'],['route-lab','/carriers/route-lab']])assert.equal(juanHref('#/'+hash),path);
});
test('original wizard steps retain their own screen after URL normalization',()=>{
 for(const step of ['origin','route','cargo','dates','review']){
  const path=juanHref('#/request/'+step);assert.equal(path,'/carriers/offers/'+step);assert.equal(juanHash(path),'#/desk/'+step);
 }
});
test('request details keep identity when normalized and restored',()=>{
 const path=juanHref('#/shipments/details/example-2');assert.equal(path,'/carriers/requests/details/example-2');assert.equal(juanHash(path),'#/shipments/details/example-2');
});
test('fleet subviews, registered vehicles and explicit service scope survive',()=>{
 for(const part of ['vehicles','drivers','coverage','assignment','register','vehicle/cm-267','service/vehicles','service/drivers','service/assignment']){
  const path=juanHref('#/fleet/'+part);assert.equal(path,'/carriers/fleet/'+part);assert.equal(juanHash(path),'#/fleet/'+part);
 }
 assert.equal(juanHref('#/fleet/demo/register'),'/carriers/fleet/register');
 assert.equal(juanHash('/carriers/sites'),'#/fleet/carriers');
});
test('Orders retains its legacy internal alias while Pipeline remains independent',()=>{
 assert.equal(juanHash('/carriers/orders'),'#/tracking');assert.equal(juanHash('/carriers/pipeline'),'#/pipeline');
});

test('Orders incidents has a canonical deep link without replacing Sites',()=>{
 assert.equal(juanHref('#/tracking/incidents'),'/carriers/orders/incidents');
 assert.equal(juanHash('/carriers/orders/incidents'),'#/tracking/incidents');
 assert.equal(juanHref('#/fleet/carriers'),'/carriers/sites');
});
