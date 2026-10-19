import test from 'node:test';
import assert from 'node:assert/strict';
import {fleetEntry} from './fleet-entry';
test('scenario starts with the first authorized Carrier and scoped service',()=>{
 assert.deepEqual(fleetEntry({scenario:true,requestedCarrier:null,requestedService:null,carriers:['c1','c2'],services:['s1','s2']}),{carrier:'c1',service:'s1'});
});
test('direct entry uses only authorized identities and loaded service IDs',()=>{
 assert.deepEqual(fleetEntry({scenario:true,requestedCarrier:'c2',requestedService:'s2',carriers:['c1','c2'],services:['s1','s2']}),{carrier:'c2',service:'s2'});
 assert.deepEqual(fleetEntry({scenario:false,requestedCarrier:'other',requestedService:'other',carriers:['c1'],services:['s1']}),{carrier:'',service:''});
});
test('ordinary profiles keep manual selection and empty reads stay empty',()=>{
 assert.deepEqual(fleetEntry({scenario:false,requestedCarrier:null,requestedService:null,carriers:['c1'],services:['s1']}),{carrier:'',service:''});
 assert.deepEqual(fleetEntry({scenario:true,requestedCarrier:'c1',requestedService:'s1',carriers:[],services:[]}),{carrier:'',service:''});
});
