const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
// Execute the actual component with inert SDK/DOM adapters; no browser or provider request.
function setup({deferLibrary=false,markerError=false,cleanupError=false}={}){
 const source=path.resolve(__dirname,'../src/features/carrier-control-tower/google-operation-map.tsx');
 const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const slots=[],effects=[],maps=[],markers=[],events=[],authListeners=new Set(),timers=new Map();let index=0,authFailed=false,resolveLibrary,timer=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={Component:class{},useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useState(value){const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},useEffect(run,deps){const i=index++;if(!same(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}};
 const event=(target,name,callback)=>{const entry={target,name,callback,removed:false};events.push(entry);return{remove(){entry.removed=true;}};};
 class MapAdapter{constructor(){maps.push(this);}addListener(name,cb){return event(this,name,cb);}getProjection(){return null;}getZoom(){return 2;}fitBounds(){}setZoom(){}setCenter(){}panTo(){}}
 class Marker{constructor(value){if(markerError)throw new TypeError("Cannot read properties of undefined (reading 'getRootNode')");this.position=value.position;markers.push(this);}set map(value){if(cleanupError&&value===null)throw Error('SDK cleanup failed');}}
 class Bounds{constructor(){this.points=[];}extend(point){this.points.push(point);}isEmpty(){return !this.points.length;}}
 const google={maps:{Map:MapAdapter,RenderingType:{VECTOR:'VECTOR'},marker:{AdvancedMarkerElement:Marker},LatLng:class{constructor(p){Object.assign(this,p);}},LatLngBounds:Bounds,
  importLibrary:()=>deferLibrary?new Promise(resolve=>resolveLibrary=resolve):Promise.resolve(),
  event:{addListenerOnce:event,clearInstanceListeners:target=>events.filter(e=>e.target===target).forEach(e=>e.removed=true),trigger(){}}}};
 const jsx=(type,props)=>({type,props});const exports={};
 vm.runInNewContext(code,{exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='lucide-react'?new Proxy({},{get:()=>()=>null}):name.includes('google-maps-loader')?{loadGoogleMaps:()=>Promise.resolve(),googleMapsAuthFailed:()=>authFailed,onGoogleMapsAuthFailure:cb=>{authListeners.add(cb);return()=>authListeners.delete(cb);}}:name.includes('road-plan-client')?{roadAlternatives:()=>[],selectedRoad:()=>null}:name.includes('tower-model')?{towerDate:v=>v??'Unknown'}:name.endsWith('.css')?{__esModule:true,default:{}}:(()=>{throw Error('Unexpected import '+name);})(),
  google,process:{env:{NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY:'inert-test-key'}},document:{createElement:()=>({style:{},setAttribute(){},appendChild(){}})},ResizeObserver:class{observe(){}disconnect(){}},window:{location:{reload(){}}},setTimeout:cb=>{const id=++timer;timers.set(id,cb);return id;},clearTimeout:id=>timers.delete(id),console},{filename:source});
 let props={items:[],sites:[{id:'site',position:{lat:-12,lng:-77},name:'Recorded site',active:true}],selected:null,onSelect(){},showSites:true};
 const walk=(node,fn)=>{if(!node||typeof node!=='object')return;if(node.props){fn(node);for(const child of [node.props.children].flat())walk(child,fn);}};
 function render(next={}){props={...props,...next};index=0;const tree=exports.OperationMap(props);walk(tree,node=>{if(node.props.ref)node.props.ref.current={};});while(effects.length)effects.shift()();return tree;}
 return{render,maps,markers,failAuth(){authFailed=true;for(const cb of authListeners)cb();},finishLibrary(){resolveLibrary();},tiles(){for(const e of events.filter(e=>e.name==='tilesloaded'&&!e.removed))e.callback();},timeout(){for(const cb of [...timers.values()])cb();},unmount(){for(const slot of slots)slot?.cleanup?.();},text(tree){let output='';walk(tree,node=>{for(const child of [node.props.children].flat())if(typeof child==='string')output+=child+' ';});return output;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('auth rejection while marker library loads cannot create a stale map',async()=>{
 const app=setup({deferLibrary:true});app.render();await settle();app.failAuth();app.finishLibrary();await settle();
 assert.equal(app.maps.length,0);assert.match(app.text(app.render()),/authorization failed/);app.unmount();
});
test('leaving the screen during loading never mounts a late map',async()=>{
 const app=setup({deferLibrary:true});app.render();await settle();app.unmount();app.finishLibrary();await settle();assert.equal(app.maps.length,0);
});
test('markers wait for loaded tiles; an authorized map still renders its recorded sites',async()=>{
 const app=setup();app.render();await settle();assert.equal(app.maps.length,1);app.render();assert.equal(app.markers.length,0);
 app.tiles();app.render();assert.equal(app.markers.length,1);app.unmount();
});
test('getRootNode SDK exception degrades only the map, keeping the operation list available',async()=>{
 const app=setup({markerError:true});app.render();await settle();app.tiles();assert.doesNotThrow(()=>app.render());
 assert.match(app.text(app.render()),/Use the operation list/);app.unmount();
});
test('timeout and failing provider cleanup cannot crash the workspace',async()=>{
 const app=setup({cleanupError:true});app.render();await settle();app.tiles();app.render();app.failAuth();
 assert.doesNotThrow(()=>app.render());assert.doesNotThrow(()=>app.unmount());
 const stalled=setup({deferLibrary:true});stalled.render();await settle();stalled.timeout();stalled.finishLibrary();await settle();
 assert.equal(stalled.maps.length,0);assert.match(stalled.text(stalled.render()),/Use the operation list/);stalled.unmount();
});
