const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(storage=new Map()){
 const code=ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname,'../src/features/v2-intake/nova-help-hint.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const slots=[],effects=[],timers=new Map();let cursor=0,sequence=0,talks=0;
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}};
 const exports={};vm.runInNewContext(code,{exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='lucide-react'?{Mic:'Mic',X:'X'}:name.endsWith('.css')?{default:{}}:(()=>{throw Error(name);})(),sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 let props={pathname:'/clients/freight-request/new',visible:true,language:'en',question:'Where should the cargo be picked up?',onTalk:()=>talks++};
 function render(next={}){props={...props,...next};cursor=0;const tree=exports.NovaHelpHint(props);while(effects.length)effects.shift()();return tree;}
 return{render,storage,timers,talks:()=>talks,tick:()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}};
}
test('request help appears after a short delay without requesting a microphone or taking action',()=>{
 const app=setup();assert.equal(app.render(),null);assert.equal(app.talks(),0);app.tick();const tree=app.render();
 assert.equal(tree.type,'aside');assert.equal(tree.props.children[1].props.children.props.children,'Where should the cargo be picked up?');assert.equal(app.talks(),0);
 tree.props.children[1].props.children.props.onClick();assert.equal(app.talks(),1);assert.equal(app.render(),null);
});
test('dismissal is retained for the browser session and never begins talking',()=>{
 const app=setup();app.render();app.tick();app.render().props.children[0].props.onClick();assert.equal(app.render(),null);assert.equal(app.talks(),0);
 const reopened=setup(app.storage);assert.equal(reopened.render(),null);assert.equal(reopened.timers.size,0);
});
test('open chat and other routes never show an unsolicited help bubble',()=>{
 const app=setup();assert.equal(app.render({visible:false}),null);assert.equal(app.timers.size,0);
 assert.equal(app.render({visible:true,pathname:'/clients/tracking'}),null);assert.equal(app.timers.size,0);
});
test('navigation before the delay cancels the invitation; Spanish keeps the same explicit CTA',()=>{
 const app=setup();app.render();app.render({pathname:'/clients'});assert.equal(app.timers.size,0);
 app.render({pathname:'/clients/freight-request/new',language:'es',question:'¿Dónde se recogerá la carga?'});app.tick();const tree=app.render();
 assert.equal(tree.props.children[1].props.children.props.children,'¿Dónde se recogerá la carga?');assert.equal(app.talks(),0);
});
