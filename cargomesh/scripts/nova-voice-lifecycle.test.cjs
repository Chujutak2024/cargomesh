const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
// Component lifecycle test with inert media/socket adapters. No browser, audio or AWS is used.
function setup({deferGrant=false}={}) {
 const source=process.env.NOVA_VOICE_COMPONENT_SOURCE??path.resolve(__dirname,'../src/features/v2-conversation-prep/nova-voice-preview.tsx');
 const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const slots=[],effects=[],sockets=[];let index=0,nonce=0;let resolveGrant;
 const depsEqual=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hooks={useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useState(value){const i=index++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(run,deps){const i=index++;if(!depsEqual(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}};
 class Socket{static OPEN=1;constructor(){this.readyState=1;this.closed=0;this.messages=[];sockets.push(this);}send(v){this.messages.push(v);}close(){this.closed++;this.readyState=3;}}
 const track={stopped:0,stop(){this.stopped++;}};
 const media={getTracks:()=>[track]};
 class Context{constructor(){this.closed=0;}close(){this.closed++;return Promise.resolve();}}
 const exports={};const response={ok:true,json:async()=>({wsUrl:'wss://voice.test/voice',token:'test-not-a-real-grant'})};
 const globals={exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name.includes('locale-provider')?{useLocale:()=>({locale:'es'})}:name.includes('voice-session-renewal')?{shouldRenewVoiceSession:()=>false}:name.endsWith('.css')?{__esModule:true,default:{}}:(()=>{throw new Error('Unexpected import '+name);})(),navigator:{mediaDevices:{getUserMedia:async()=>media}},window:{AudioWorkletNode:function(){},setTimeout,clearTimeout},AudioContext:Context,WebSocket:Socket,crypto:{randomUUID:()=>String(++nonce)},fetch:()=>deferGrant?new Promise(resolve=>{resolveGrant=()=>resolve(response);}):Promise.resolve(response),setTimeout,clearTimeout,console};
 vm.runInNewContext(code,globals,{filename:source});
 let props={language:'es',draftContext:{knownFields:[],missingFields:['unitQuantity'],savedVersion:null},onTurn:()=>{}};
 function render(next={}){props={...props,...next};index=0;const tree=exports.NovaVoicePreview(props);while(effects.length)effects.shift()();return tree;}
 return {render,sockets,track,grant:()=>resolveGrant(),start:()=>render().props.children[0].props.onClick()};
}
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
test('recognized fields and pending clarifications update the draft without closing voice',async()=>{
 const app=setup();app.start();await settle();assert.equal(app.sockets.length,1);
 app.render();app.render({draftContext:{knownFields:[{field:'unitQuantity',value:'10'}],missingFields:['categoryCode'],savedVersion:null}});
 assert.equal(app.sockets[0].closed,0,'capturing a fact must not stop Nova');assert.equal(app.track.stopped,0);
 app.render({language:'en',draftContext:{knownFields:[{field:'unitQuantity',value:'10'}],missingFields:[],ambiguities:['MEASUREMENT_SCOPE_PENDING'],savedVersion:null}});
 assert.equal(app.sockets[0].closed,0,'clarification/language must not tear down transport');
});
test('draft updates while obtaining a grant still allow the connection to open',async()=>{
 const app=setup({deferGrant:true});app.start();await settle();app.render({draftContext:{knownFields:[{field:'unitQuantity',value:'10'}],missingFields:[],savedVersion:null}});app.grant();await settle();assert.equal(app.sockets.length,1);assert.equal(app.sockets[0].closed,0);
});
test('changing authorized request scope still closes the old voice connection',async()=>{
 const app=setup();app.start();await settle();app.render();app.render({offerRequestId:'new-authorized-request'});assert.equal(app.sockets[0].closed,1);
});
