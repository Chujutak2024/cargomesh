import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url), modulePath = process.env.CARGOMESH_PLAYWRIGHT_MODULE;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : require('playwright');
const base = new URL(process.env.CARGOMESH_PREVIEW_URL || 'http://127.0.0.1:8091');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname), 'Local fixture checks only');
const out = path.resolve(process.env.CARGOMESH_EVIDENCE_DIR || '../.planning/facility-designs-evidence');
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.CARGOMESH_CHROMIUM_EXECUTABLE || undefined});
const context = await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',timezoneId:'America/Lima'});
const report = {source:'SIMULATED',browser:browser.version(),checks:[],errors:[],unexpectedRequests:[]};
let delayed = false;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if(url.pathname.startsWith('/api/') || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)){report.unexpectedRequests.push(url.pathname);return route.abort();}
  if(!delayed && url.pathname.includes('depot-yard-scene')){delayed=true;await new Promise(resolve=>setTimeout(resolve,1000));}
  return route.continue();
});
const page = await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
await page.clock.setFixedTime(new Date('2026-10-19T12:00:00-05:00'));
const newIds=['industrial-plant','agricultural-hub','retail-store','pharmaceutical-centre','fulfilment-centre'];
const oldIds=['compact','distribution','cold','workshop','transfer','cross-dock','service-yard','cold-campus','silo-terminal','urban-courtyard'];
const root=page.getByRole('region',{name:'Depot visual simulation'}),stage=root.locator('[data-depot-state]');
const ready=async id=>{await stage.scrollIntoViewIfNeeded();await page.waitForFunction(id=>document.querySelector('[data-depot-state="ready"] canvas')?.dataset.depotTemplate===id,id,{timeout:45000});};
const metrics=()=>root.locator('canvas').evaluate(canvas=>({...canvas.dataset}));
const state=()=>root.locator('canvas').evaluate(canvas=>({time:canvas.dataset.depotTime,selected:canvas.dataset.depotSelected,motion:canvas.dataset.motion,template:canvas.dataset.depotTemplate,
  camera:['cameraX','cameraY','cameraZ','targetX','targetY','targetZ','cameraZoom'].map(key=>Number(Number(canvas.dataset[key]).toFixed(5)))}));
const settle=()=>page.waitForTimeout(150);
const choose=async id=>{await root.getByRole('combobox',{name:'Depot design'}).selectOption(id);await ready(id);await root.getByRole('button',{name:'Site overview',exact:true}).click();await settle();};
async function loseAndRetry(id){
  const before=await state();await root.locator('canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await root.getByRole('alert').waitFor();await root.getByRole('button',{name:'Retry 3D view'}).click();await ready(id);await settle();
  assert.deepEqual(await state(),before);report.checks.push({label:'WebGL fallback/retry retains state',before,after:await state()});
}
try{
  await page.goto(new URL('/vehicle-designs',base).href,{timeout:60000});await page.getByRole('button',{name:'Depot designs',exact:true}).click();
  await root.getByText('Preparing the depot…',{exact:true}).waitFor();report.loadingObserved=true;await ready('cross-dock');
  assert.equal(await root.locator('select[aria-label="Depot design"] option').count(),15);
  assert.match(await page.locator('h1 + p').innerText(),/23 truck designs.*15 depot layouts/);
  for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const id of newIds){await choose(id);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,id);
      await stage.screenshot({path:path.join(out,`${id}-${viewport.width}.png`)});report.checks.push({label:'Architecture/framing',id,viewport,metrics:await metrics()});}
  }
  await page.setViewportSize({width:1440,height:1100});await choose('retail-store');
  await root.locator('canvas').focus();for(let i=0;i<26;i++)await page.keyboard.press('ArrowLeft');await settle();
  await stage.screenshot({path:path.join(out,'retail-public-front.png')});
  await root.getByRole('button',{name:'Interior',exact:true}).click();await settle();await stage.screenshot({path:path.join(out,'retail-interior.png')});
  await root.getByRole('button',{name:'Exterior',exact:true}).click();const resources=[];
  for(let round=0;round<2;round++){for(const id of [...oldIds,...newIds])await choose(id);await choose('industrial-plant');resources.push(await metrics());}
  assert.equal(resources[1].textures,resources[0].textures);assert.ok(Number(resources[1].geometries)<=Number(resources[0].geometries)+2);report.checks.push({label:'Two complete fifteen-design cycles',resources});
  await root.getByRole('button',{name:/^Truck C/}).click();await settle();
  assert.equal(await root.locator('select[aria-label="Vehicle design"] option[value="refuse"]').count(),0);
  await root.getByRole('button',{name:/^Truck A/}).click();await settle();assert.equal(await root.locator('option[value="livestock"]').count(),0);
  report.checks.push({label:'Box vehicles never offer refuse or livestock designs'});await loseAndRetry('industrial-plant');

  await page.getByRole('button',{name:'Facility endpoints',exact:true}).click();await ready('industrial-plant');
  assert.equal((await metrics()).depotVehicles,'0');assert.equal(await root.locator('aside').count(),0);
  assert.equal(await root.getByRole('button',{name:/visualization/}).count(),0);
  await root.getByRole('button',{name:'Zoom in',exact:true}).click();await root.locator('canvas').focus();await page.keyboard.press('ArrowLeft');await settle();const pickup=await state();
  await page.getByRole('button',{name:'Delivery facility',exact:true}).click();await ready('pharmaceutical-centre');
  await root.getByRole('button',{name:'Zoom in',exact:true}).click();await root.locator('canvas').focus();await page.keyboard.press('ArrowRight');await settle();const delivery=await state();
  await page.getByRole('button',{name:'Pickup facility',exact:true}).click();await ready('industrial-plant');await settle();assert.deepEqual(await state(),pickup);
  await page.getByRole('button',{name:'Delivery facility',exact:true}).click();await ready('pharmaceutical-centre');await settle();assert.deepEqual(await state(),delivery);
  await page.getByRole('button',{name:'Truck designs',exact:true}).click();await page.getByRole('heading',{name:'Truck designs',exact:true}).waitFor();
  await page.getByRole('button',{name:'Facility endpoints',exact:true}).click();await ready('pharmaceutical-centre');await settle();assert.deepEqual(await state(),delivery);
  assert.equal(await page.getByRole('button',{name:'Delivery facility',exact:true}).getAttribute('aria-pressed'),'true');
  report.checks.push({label:'Pickup, delivery and studio views retain separate cameras, selected endpoint and pause',pickup,delivery});
  await loseAndRetry('pharmaceutical-centre');
  for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
    await page.setViewportSize(viewport);await ready('pharmaceutical-centre');await settle();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,`facility-endpoints-${viewport.width}.png`),fullPage:true});
    report.checks.push({label:'Client preparation/reference-only scene',viewport,metrics:await metrics()});
  }
  await page.setViewportSize({width:1440,height:1100});await page.getByText('Existing facility directory integration',{exact:true}).click();
  await page.getByRole('button',{name:/Ver referencia 3D|View 3D reference/}).first().click();
  assert.equal(await page.getByRole('region',{name:'Facility reference',exact:true}).count(),1);report.checks.push({label:'Existing FacilityDirectory consumes explicit references'});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedRequests,[]);
  const sheet=await context.newPage(),labels=['Planta industrial','Acopio agrícola','Comercio con recepción posterior','Centro farmacéutico','Preparación de pedidos'];
  const panels=await Promise.all(newIds.map(async(id,i)=>`<figure><figcaption>${labels[i]}</figcaption><img src="data:image/png;base64,${(await fs.readFile(path.join(out,id+'-1440.png'))).toString('base64')}"/></figure>`));
  await sheet.setViewportSize({width:1500,height:1500});
  await sheet.setContent(`<style>body{margin:0;padding:20px;background:#e8f1f4;font-family:Arial;color:#163c4c}main{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;background:white;border-radius:12px;overflow:hidden}figcaption{padding:12px;font-size:17px;font-weight:600}img{width:100%;display:block}h1{font-size:23px;margin:0 0 14px}</style><h1>CargoMesh · cinco instalaciones adicionales · referencias visuales</h1><main>${panels.join('')}</main>`);
  await sheet.screenshot({path:path.join(out,'five-client-facilities.png'),fullPage:true});report.pass=true;
}catch(error){report.pass=false;report.failure=error.message;throw error;}
finally{await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,loading:report.loadingObserved}));
