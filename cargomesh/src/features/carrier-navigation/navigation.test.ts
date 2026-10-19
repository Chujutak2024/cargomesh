import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierNavigation, carrierActiveItem } from './navigation-model';
import { CARRIER_WORKSPACE, CARRIER_TOWER, CARRIER_ROUTE_LAB, carrierPreviewFromHash } from './workspace-route';
import { createScrollLock } from "@/shared/browser/scroll-lock";
test('all menu destinations stay in the same workspace document',()=>{
 const groups=carrierNavigation({locale:'en',workspaceHref:CARRIER_WORKSPACE,towerHref:CARRIER_TOWER});
 for(const item of groups.flatMap(group=>group.items))assert.ok(new URL(item.href,'http://localhost').pathname===CARRIER_WORKSPACE||new URL(item.href,'http://localhost').pathname.startsWith(CARRIER_WORKSPACE+'/'));
 assert.equal(groups.flatMap(g=>g.items).some(i=>i.id==='demo'),false);
 assert.equal(CARRIER_ROUTE_LAB,'/carriers/route-lab');
});
test('previews require the explicit server demo flag',()=>{
 for(const hash of ['#/tower','#/route-lab']){assert.equal(carrierPreviewFromHash(hash,false),null);assert.notEqual(carrierPreviewFromHash(hash,true),null);}
 for(const hash of ['#/fleet','#tower-main','#/unknown','https://external.test'])assert.equal(carrierPreviewFromHash(hash,true),null);
 assert.equal(carrierNavigation({locale:'en',workspaceHref:CARRIER_WORKSPACE,towerHref:CARRIER_TOWER,previewEnabled:false}).flatMap(g=>g.items).some(i=>i.id==='tower'),false);
});
test('nested fleet entries and local review remain addressable',()=>{
 assert.equal(carrierActiveItem('fleet','#/fleet/service/carriers'),'sites');
 assert.equal(carrierActiveItem('fleet','#/fleet/register'),'register');
 assert.equal(carrierActiveItem('fleet','#/fleet/vehicle/CM-267'),'fleet');
 const groups=carrierNavigation({locale:'en',workspaceHref:CARRIER_WORKSPACE,towerHref:CARRIER_TOWER,editRequest:true,demoMode:true});
 assert.equal(groups.flatMap(g=>g.items).find(i=>i.id==='desk')?.href,'/carriers/offers/review');
});
function documentStub(){
 const attributes=new Map<string,string>();
 const doc={body:{style:{overflow:'auto'}},documentElement:{getAttribute:(k:string)=>attributes.get(k)??null,setAttribute:(k:string,v:string)=>{attributes.set(k,v);},removeAttribute:(k:string)=>{attributes.delete(k);}}} as unknown as Document;
 return doc;
}
test('overlapping overlays release scroll in either closing order',()=>{
 for(const reverse of [false,true]){
  const doc=documentStub(),lock=createScrollLock(),first=lock(doc),second=lock(doc);
  assert.equal(doc.body.style.overflow,'hidden');
  (reverse?second:first)();assert.equal(doc.body.style.overflow,'hidden');
  assert.equal(doc.documentElement.getAttribute('data-cm-scroll-locked'),'true');
  (reverse?first:second)();assert.equal(doc.body.style.overflow,'auto');assert.equal(doc.documentElement.getAttribute('data-cm-scroll-locked'),null);
 }
});
test('cleanup is idempotent and a later overlay starts a fresh lock',()=>{
 const doc=documentStub(),lock=createScrollLock(),release=lock(doc);
 release();release();const next=lock(doc);assert.equal(doc.body.style.overflow,'hidden');next();assert.equal(doc.body.style.overflow,'auto');
});
test('existing lock owner state is restored',()=>{
 const doc=documentStub();doc.body.style.overflow='hidden';doc.documentElement.setAttribute('data-cm-scroll-locked','external');
 createScrollLock()(doc)();assert.equal(doc.body.style.overflow,'hidden');assert.equal(doc.documentElement.getAttribute('data-cm-scroll-locked'),'external');
});

test('connected commercial navigation removes redundant entries and highlights every legacy alias',()=>{
 const items=carrierNavigation({locale:'en',workspaceHref:CARRIER_WORKSPACE,towerHref:CARRIER_TOWER}).flatMap(g=>g.items);
 assert.equal(items.find(i=>i.id==='commercial')?.href,'/carriers/requests');
 for(const id of ['shipments','pipeline','desk'])assert.equal(items.some(i=>i.id===id),false);
 assert.ok(items.some(i=>i.id==='orders'));
 for(const alias of ['shipments','desk','pipeline']){
  assert.equal(carrierActiveItem(alias,'#/'+alias),'commercial');
  assert.equal(carrierActiveItem(alias,'#/'+alias,true),alias);
 }
 assert.equal(carrierActiveItem('orders','#/orders'),'orders');
});
