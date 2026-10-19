import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Use an existing Playwright installation; this script installs no packages.
const require = createRequire(import.meta.url);
const packagePath = process.env.CARGOMESH_PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = packagePath === 'playwright' ? require(packagePath) : await import(pathToFileURL(packagePath).href);
const base = new URL(process.env.CARGOMESH_PREVIEW_URL || 'http://127.0.0.1:8091');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Run this fixture check against localhost only');
const out = path.resolve(process.env.CARGOMESH_EVIDENCE_DIR || '../.planning/depot-browser-evidence');
await fs.mkdir(out, { recursive: true });
const record = process.argv.includes('--record');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CARGOMESH_CHROMIUM_EXECUTABLE || undefined });
const report = { source: 'SIMULATED', fixture: 'depot-five-trucks-v1', viewport: { width: 1440, height: 1100 }, browser: browser.version(), recorded: record, checks: [], errors: [], unexpectedRequests: [] };
let context, capture, failure;
async function startCapture(page) {
  assert.ok(process.env.CARGOMESH_FFMPEG_EXECUTABLE, 'Set CARGOMESH_FFMPEG_EXECUTABLE to an existing FFmpeg with libvpx-vp9 for --record');
  const output = path.join(out, 'five-trucks.webm'), fps = 15;
  const encoder = spawn(process.env.CARGOMESH_FFMPEG_EXECUTABLE, ['-loglevel','error','-f','image2pipe','-r',String(fps),'-c:v','mjpeg','-i','pipe:0','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-b:v','1200k','-threads','2','-y',output], { windowsHide: true });
  let stderr = '', latest = null, frames = 0;
  encoder.stderr.on('data', data => { stderr = (stderr + data).slice(-4096); });
  encoder.stdin.on('error', () => {});
  const done = new Promise(resolve => { encoder.on('error', error => resolve({code:-1,message:error.message})); encoder.on('exit', code => resolve({code,message:stderr})); });
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', frame => {
    latest = Buffer.from(frame.data,'base64');
    void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format:'jpeg',quality:85,maxWidth:1440,maxHeight:1100,everyNthFrame:1 });
  const timer = setInterval(() => { if (latest && !encoder.stdin.destroyed && encoder.stdin.writableLength < 2000000) { encoder.stdin.write(latest); frames++; } }, 1000/fps);
  return async () => {
    clearInterval(timer); await cdp.send('Page.stopScreencast').catch(() => {}); encoder.stdin.end();
    const result = await done; assert.equal(result.code,0,'Video encoder: '+result.message);
    report.videoBytes = (await fs.stat(output)).size; report.videoFrames = frames; report.videoFps = fps;
    assert.ok(report.videoBytes > 100000 && frames > 150, 'Video must contain the captured scenario');
  };
}
try {
  // Warm development chunks before recording; this context has no user cookies.
  const warm = await browser.newContext({ viewport: report.viewport, reducedMotion: 'reduce' });
  const warmPage = await warm.newPage();
  await warmPage.goto(new URL('/depot-preview', base).href);
  await warmPage.waitForFunction(() => document.querySelector('canvas')?.dataset.depotVehicles === '5', null, { timeout: 45000 });
  await warm.close();
  context = await browser.newContext({ viewport: report.viewport, reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/') || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
      report.unexpectedRequests.push({ host: url.hostname, path: url.pathname });
      await route.abort();
    } else await route.continue();
  });
  const page = await context.newPage();
  if (record) capture = await startCapture(page);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(new URL('/depot-preview', base).href);
  const yard = scope => scope.getByRole('region', { name: 'Depot visual simulation' });
  const ready = async scope => {
    const root = yard(scope); await root.locator('canvas[data-depot-vehicles]').waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.motion === 'paused' || canvas.dataset.motion === 'running'));
    return root;
  };
  const state = root => root.locator('canvas').evaluate(canvas => ({ clock: Number(canvas.dataset.depotTime), selected: canvas.dataset.depotSelected, paused: canvas.dataset.motion === 'paused', scenario: canvas.closest('[data-scenario-id]')?.getAttribute('data-scenario-id') }));
  const pause = async root => {
    await root.getByRole('button', { name: 'Pause visualization', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(canvas => canvas.dataset.motion === 'paused'));
  };
  const assertRetained = async (root, before, label) => {
    await root.getByRole('button', { name: 'Resume visualization', exact: true }).waitFor({ state: 'visible' });
    const after = await state(root); assert.deepEqual(after, before, label);
    assert.equal(await root.getByRole('button', { name: /^Truck C/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await root.getByRole('button', { name: 'Resume visualization', exact: true }).getAttribute('aria-pressed'), 'false');
    report.checks.push({ label, before, after });
  };
  let root = await ready(page);
  assert.equal(await root.locator('aside button').count(), 5);
  assert.equal((await state(root)).clock, 0, 'Reduced motion must start paused');
  await page.screenshot({ path: path.join(out, 'five-trucks.png'), fullPage: true });
  await root.getByRole('button', { name: 'Resume visualization', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.depotTime) >= 700);
  await root.getByRole('button', { name: /^Truck C/ }).click(); await pause(root);
  const before = await state(root); assert.equal(before.selected, 'visual-truck-c'); assert.equal(before.paused, true);
  for (const view of ['Scenario summary', 'Truck designs', 'Scenic trip']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    if (view === 'Scenario summary') assert.equal(parseFloat(await page.locator('[data-retained-time]').textContent()), before.clock);
    else if (view === 'Scenic trip') await page.getByRole('heading', { name: 'No trip to preview' }).waitFor();
    else await page.getByRole('heading', { name: 'Truck designs', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Yard', exact: true }).click(); root = await ready(page);
    await assertRetained(root, before, 'Yard → ' + view + ' → Yard retains clock, selection and pause');
  }
  await root.getByRole('button', { name: 'Resume visualization', exact: true }).click();
  await page.waitForFunction(time => Number(document.querySelector('canvas')?.dataset.depotTime) > time + 500, before.clock);
  await pause(root); const resumed = await state(root); assert.ok(resumed.clock > before.clock); assert.equal(resumed.selected, before.selected);
  report.checks.push({ label: 'Explicit resume advances the retained clock', before, after: resumed });

  // The real shared dialog owns its coordinator above Summary/Depot as well.
  await page.getByRole('button', { name: 'Open inspection dialog', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Ver sede 3D', exact: false }).click();
  let dialogRoot = await ready(dialog);
  await dialogRoot.getByRole('button', { name: 'Resume visualization', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('dialog canvas')?.dataset.depotTime) >= 700);
  await dialogRoot.getByRole('button', { name: /^Truck C/ }).click(); await pause(dialogRoot);
  const dialogBefore = await state(dialogRoot);
  for (let round = 0; round < 2; round++) {
    await dialog.getByRole('button', { name: 'Volver al resumen', exact: true }).click();
    await dialog.getByRole('button', { name: 'Ver sede 3D', exact: false }).click(); dialogRoot = await ready(dialog);
    await assertRetained(dialogRoot, dialogBefore, `Inspection Summary/Depot round ${round + 1} retains clock, selection and pause`);
  }
  await page.screenshot({ path: path.join(out, 'inspection-retained.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cerrar resumen del camión', exact: true }).click();
  root = await ready(page); await assertRetained(root, resumed, 'Closing a separate inspection preserves the studio state');
  if (record) {
    await root.getByRole('button', { name: 'Site overview', exact: true }).click();
    await root.getByRole('button', { name: 'Resume visualization', exact: true }).click();
    // Observe natural elapsed time, without injecting controller state or speed.
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.depotTime) >= 23500, null, { timeout: 45000 });
    await pause(root); await page.screenshot({ path: path.join(out, 'loading-to-departure.png'), fullPage: true });
    report.checks.push({ label: 'Recorded natural loading/departure; parked and maintenance remain in the roster', state: await state(root), roster: await root.locator('aside').innerText() });
  }
  const canvas = root.locator('canvas');
  report.renderer = await canvas.evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), info = gl?.getExtension('WEBGL_debug_renderer_info');
    return { ...canvas.dataset, renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
  });
  assert.deepEqual(report.unexpectedRequests, [], 'The simulation must make no business API or third-party requests');
  assert.deepEqual(report.errors, [], 'No uncaught browser errors');
  report.pass = true;
} catch (error) {
  failure = error; report.pass = false; report.failure = error.message;
} finally {
  if (capture) {
    try { await capture(); }
    catch (error) { report.videoFailure = error.message; report.pass = false; failure ??= error; }
  }
  if (context) await context.close();
  await browser.close();
  await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
}
if (failure) throw failure;
console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, videoBytes: report.videoBytes, evidence: out }));
