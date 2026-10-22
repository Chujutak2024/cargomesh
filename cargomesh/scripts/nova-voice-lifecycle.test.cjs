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
 const slots=[],effects=[],sockets=[],audio=[],contexts=[],worklets=[],playback=[],finished=[],turns=[],grantRequests=[];let mediaRequests=0;let index=0,nonce=0;let resolveGrant;
 const depsEqual=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hooks={useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useState(value){const i=index++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(run,deps){const i=index++;if(!depsEqual(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}};
 class Socket{static OPEN=1;constructor(){this.readyState=1;this.closed=0;this.messages=[];sockets.push(this);}send(v){this.messages.push(v);}close(){this.closed++;this.readyState=3;}}
 const track={stopped:0,stop(){this.stopped++;}};
 const media={getTracks:()=>[track]};
 class Context{
  constructor(){this.closed=0;this.currentTime=0;this.destination={};this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
  close(){this.closed++;return Promise.resolve();}resume(){return Promise.resolve();}
  createBuffer(_channels,size,rate){return {duration:size/rate,getChannelData:()=>new Float32Array(size)};}
  createBufferSource(){const node={stopped:0,connect(){},start(){},stop(){this.stopped++;}};audio.push(node);return node;}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createGain(){return {gain:{value:0},connect(){return {connect(){}};}};}
 }
 class Worklet{constructor(){this.port={};worklets.push(this);}connect(){return {connect(){}};}disconnect(){}}
 const exports={};const response={ok:true,json:async()=>({wsUrl:'wss://voice.test/voice',token:'test-not-a-real-grant'})};
 const globals={exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name.includes('locale-provider')?{useLocale:()=>({locale:'es'})}:name.includes('voice-session-renewal')?{shouldRenewVoiceSession:()=>false}:name.endsWith('.css')?{__esModule:true,default:{}}:(()=>{throw new Error('Unexpected import '+name);})(),navigator:{mediaDevices:{getUserMedia:async()=>{mediaRequests++;return media;}}},window:{AudioWorkletNode:Worklet,setTimeout,clearTimeout},AudioWorkletNode:Worklet,AudioContext:Context,atob,WebSocket:Socket,crypto:{randomUUID:()=>String(++nonce)},fetch:(_url,init)=>{grantRequests.push(JSON.parse(init.body));return deferGrant?new Promise(resolve=>{resolveGrant=()=>resolve(response);}):Promise.resolve(response);},setTimeout,clearTimeout,console};
 vm.runInNewContext(code,globals,{filename:source});
 const sender={current:null};
 let props={textInputRef:sender,language:'es',draftContext:{knownFields:[],missingFields:['unitQuantity'],savedVersion:null},onTurn:turn=>turns.push(turn),onPlaybackStateChange:value=>playback.push(value),onResponseFinished:()=>finished.push(true)};
 function render(next={}){props={...props,...next};index=0;const tree=exports.NovaVoicePreview(props);while(effects.length)effects.shift()();return tree;}
 return {render,sockets,track,audio,contexts,worklets,playback,finished,turns,grantRequests,mediaRequests:()=>mediaRequests,write:text=>{render();return sender.current(text);},event:event=>sockets.at(-1).onmessage({data:JSON.stringify(event)}),grant:()=>resolveGrant(),start:()=>render().props.children[0].props.onClick(),unmount:()=>{for(const slot of slots)slot?.cleanup?.();}};
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

test('unmounting live content releases the microphone and socket before the visual exit finishes',async()=>{
 const app=setup();app.start();await settle();app.render();app.unmount();
 assert.equal(app.sockets[0].closed,1);await settle();assert.equal(app.track.stopped,1);
});

test('connection close drains all received audio before closing context or notifying completion',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready'});await settle();
 app.event({type:'response_start'});
 for(let i=0;i<2;i++)app.event({type:'audio',audio:'AQACAA==',format:'pcm',sampleRate:24000,channels:1});
 assert.equal(app.audio.length,2);app.sockets[0].onclose();
 assert.equal(app.contexts[0].closed,0);assert.equal(app.finished.length,0);
 assert.ok(app.audio.every(node=>node.stopped===0));
 app.audio[0].onended();await settle();assert.equal(app.contexts[0].closed,0);
 app.audio[1].onended();await new Promise(resolve=>setTimeout(resolve,210));
 assert.equal(app.contexts[0].closed,1);assert.equal(app.finished.length,1);assert.equal(app.playback.at(-1),false);
});
test('summary completion waits for response boundary and playback, not the text transcript',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready'});await settle();
 app.event({type:'response_start'});app.event({type:'audio',audio:'AQACAA==',format:'pcm',sampleRate:24000,channels:1});
 app.event({type:'transcript',role:'assistant',contentId:'a',text:'Resumen completo'});
 app.audio[0].onended();await new Promise(resolve=>setTimeout(resolve,210));assert.equal(app.finished.length,0);
 app.event({type:'response_end'});await new Promise(resolve=>setTimeout(resolve,210));assert.equal(app.finished.length,1);
 app.unmount();
});
test('microphone sends silence while Nova speaks and resumes real PCM after playback',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready'});await settle();
 const pcm=new Uint8Array([1,2,3,4]).buffer;
 app.worklets[0].port.onmessage({data:pcm});assert.equal(app.sockets[0].messages.at(-1),pcm);
 app.event({type:'response_start'});app.worklets[0].port.onmessage({data:pcm});
 assert.deepEqual([...new Uint8Array(app.sockets[0].messages.at(-1))],[0,0,0,0]);
 app.event({type:'response_end'});await new Promise(resolve=>setTimeout(resolve,210));
 app.worklets[0].port.onmessage({data:pcm});assert.equal(app.sockets[0].messages.at(-1),pcm);app.unmount();
});
test('an unsolicited barge-in never discards already queued speech',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready'});await settle();
 app.event({type:'response_start'});app.event({type:'audio',audio:'AQACAA==',format:'pcm',sampleRate:24000,channels:1});
 app.event({type:'barge_in'});assert.equal(app.audio[0].stopped,0);app.unmount();
});

test('a late final transcript cannot fire the previous response completion twice',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready'});await settle();
 app.event({type:'response_start'});app.event({type:'response_end'});await new Promise(resolve=>setTimeout(resolve,210));
 assert.equal(app.finished.length,1);
 app.event({type:'transcript',role:'assistant',contentId:'late-final',text:'Resumen ya escuchado'});
 await new Promise(resolve=>setTimeout(resolve,210));assert.equal(app.finished.length,1);app.unmount();
});

test('typed questions use the same Nova socket, PCM playback and history without microphone permission',async()=>{
 const app=setup();const sent=app.write('What is the difference between FTL and LTL?');await settle();
 assert.equal(app.sockets.length,1);assert.equal(app.mediaRequests(),0);
 app.event({type:'ready',textInput:true});await sent;await settle();
 assert.equal(JSON.parse(app.sockets[0].messages.at(-1)).text,'What is the difference between FTL and LTL?');
 assert.equal(app.turns.length,1);assert.equal(app.turns[0].role,'user');assert.ok(app.turns[0].contentId.startsWith('nova:text:'));
 app.event({type:'response_start'});app.event({type:'audio',audio:'AQACAA==',format:'pcm',sampleRate:24000,channels:1});
 assert.equal(app.audio.length,1);assert.equal(app.mediaRequests(),0);app.unmount();
});
test('an older gateway never receives text frames and permits the native text fallback',async()=>{
 const app=setup();const sent=app.write('How do I prepare a shipment?');const rejected=assert.rejects(sent,/unavailable/);await settle();
 app.event({type:'ready'});await rejected;
 assert.ok(app.sockets[0].messages.every(raw=>JSON.parse(raw).type==='auth'));assert.equal(app.turns.length,0);app.unmount();
});
test('typed turns wait for Nova to finish instead of cutting its speech',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready',textInput:true});await settle();
 app.event({type:'response_start'});await assert.rejects(app.write('Correction'),/Wait/);
 assert.equal(app.sockets[0].closed,0);app.unmount();
});
test('muting spoken replies preserves the transcript and response completion',async()=>{
 const app=setup();app.start();await settle();app.render({audioReplies:false});app.event({type:'ready',textInput:true});await settle();
 app.event({type:'response_start'});app.event({type:'audio',audio:'AQACAA==',format:'pcm',sampleRate:24000,channels:1});
 app.event({type:'transcript',role:'assistant',contentId:'answer',text:'A complete answer'});app.event({type:'response_end'});
 await new Promise(resolve=>setTimeout(resolve,210));assert.equal(app.audio.length,0);assert.equal(app.turns.at(-1).text,'A complete answer');assert.equal(app.finished.length,1);app.unmount();
});

test('native workflow speech does not echo into the Nova microphone',async()=>{
 const app=setup();app.start();await settle();app.event({type:'ready',textInput:true});await settle();
 app.render({externalSpeaking:true});app.worklets[0].port.onmessage({data:new Uint8Array([1,2]).buffer});
 assert.deepEqual([...new Uint8Array(app.sockets[0].messages.at(-1))],[0,0]);
 app.render({externalSpeaking:false});const pcm=new Uint8Array([3,4]).buffer;app.worklets[0].port.onmessage({data:pcm});assert.equal(app.sockets[0].messages.at(-1),pcm);app.unmount();
});

test('written reconnects use the current authorized request scope, not a stale mounted callback',async()=>{
 const app=setup();app.render();app.render({offerRequestId:'current-request'});
 const sent=app.write('Explain my offers');await settle();assert.equal(app.grantRequests.at(-1).offerRequestId,'current-request');
 app.event({type:'ready',textInput:true});await sent;app.unmount();
});
