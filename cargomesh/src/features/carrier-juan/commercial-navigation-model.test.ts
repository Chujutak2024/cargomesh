import test from 'node:test';
import assert from 'node:assert/strict';
import {id,offer,opportunity} from '@/features/carrier-portal/commercial-test-fixtures';
import {commercialRoots,commercialTab,rememberCommercialRoute,offerDestination,requestOfferHistory} from './commercial-navigation-model';

test('legacy deep links select Commercial views; Orders stays independent',()=>{
 for(const [hash,tab] of [['#/shipments/details/'+id(10),'list'],['#/pipeline','board'],['#/desk/details/'+id(11),'offers']])assert.equal(commercialTab(hash),tab);
 for(const hash of ['#/tracking','#/orders','#/fleet','#/desk-other'])assert.equal(commercialTab(hash),null);
});
test('view destinations retain independent selections without contaminating another view',()=>{
 const a=rememberCommercialRoute({...commercialRoots},'#/shipments/details/'+id(10));
 const b=rememberCommercialRoute(a,'#/desk/details/'+id(11));
 const c=rememberCommercialRoute(b,'#/pipeline');
 assert.equal(c.list,a.list);assert.equal(c.offers,b.offers);assert.equal(c.board,'#/pipeline');
 assert.equal(rememberCommercialRoute(c,'#/tracking/details/'+id(12)),c);
 assert.equal(rememberCommercialRoute(c,c.list),c);
 assert.deepEqual(commercialRoots,{list:'#/shipments',board:'#/pipeline',offers:'#/desk'});
});
test('offer destinations distinguish preparation, history and issued versions; malformed IDs are rejected',()=>{
 assert.deepEqual(offerDestination('#/desk/prepare/'+id(10)),{selection:{kind:'opportunities',id:id(10)},prepare:true,invalid:false});
 assert.equal(offerDestination('#/desk/opportunity/'+id(10)).prepare,false);
 assert.equal(offerDestination('#/desk/details/'+id(11)).selection?.kind,'offers');
 assert.equal(offerDestination('#/desk').selection,null);
 for(const hash of ['#/desk/details/local-example','#/desk/prepare/%ZZ','#/desk/details/'+id(11)+'/extra','#/desk/opportunity/'])assert.equal(offerDestination(hash).invalid,true);
});
test('Request history includes exact Carrier, organization, request, opportunity and plan relations only, newest version first',()=>{
 const o=opportunity(),a=offer(),b={...offer(12),data:{...offer(12).data,offerVersion:2,supersedesOfferId:a.id}};
 const wrong=[{...a,id:id(30),carrierId:id(70)},{...a,id:id(31),organizationId:id(70)},{...a,id:id(32),requestId:id(70)},{...a,id:id(33),data:{...a.data,opportunityId:id(70)}},{...a,id:id(34),data:{...a.data,planCandidateId:id(70)}}];
 assert.deepEqual(requestOfferHistory(o,[a,...wrong,b]).map(row=>row.id),[b.id,a.id]);
 assert.deepEqual(requestOfferHistory(o,[]),[]);
});
