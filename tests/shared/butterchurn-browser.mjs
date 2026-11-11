import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.DANCEMOVES_TEST_CHROMIUM || undefined,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({viewport: {width: 720, height: 420}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const wordpress = process.argv.includes('--wordpress');
  const bundle = wordpress ? 'wordpress.js' : 'dancemoves.min.js';
  const asset = 'assets/butterchurn-2.6.7.js';
  const fixture = 'https://dancemoves.test/';
  const requests = [];
  await page.route(fixture + '**', async route => {
    const name = route.request().url().slice(fixture.length);
    if (!name) return route.fulfill({contentType:'text/html', body:'<main class="entry-content"><canvas width="640" height="360" style="display:block;width:640px;height:360px"></canvas></main>'});
    requests.push(name);
    assert.ok([bundle,asset].includes(name), name);
    return route.fulfill({contentType:'text/javascript', body:await fs.readFile(path.join('lib',name))});
  });
  await page.goto(fixture);
  await page.addScriptTag({url: fixture + bundle});
  assert.deepEqual(requests,[bundle]);
  const result = await page.evaluate(async () => {
    const root = document.querySelector('main');
    const target = root.querySelector('canvas');
    const runtime = window.DanceMoves || DanceMovesLibrary.createDanceMoves({root, bpm: 120});
    await runtime.ready;
    const preset = {
      baseVals: {gammaadj: 1, decay: .98, zoom: 1, rot: .026, warp: 0, wave_a: 0, mv_a: 0, wrap: 0},
      init_eqs: v => v, frame_eqs: v => v, pixel_eqs: v => v,
      shapes: [], waves: [], warp: '', comp: '',
    };
    let malformedRejected = false;
    try { await runtime.butterchurn.create({id:'bad', target, preset:{...preset, init_eqs: 'return 1;'}}); }
    catch { malformedRejected = true; }

    const options = {id: 'demo:feedback', target, preset, maxDimension: 320};
    const view = await runtime.butterchurn.create(options);
    let duplicateRejected = false;
    try { await runtime.butterchurn.create({...options,id:'demo:duplicate'}); }
    catch { duplicateRejected = true; }
    const source = document.createElement('canvas');
    source.width = 320;
    source.height = 180;
    const pen = source.getContext('2d');
    const ctx = target.getContext('2d');
    const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    const redPixels = () => {
      const data = ctx.getImageData(0, 0, target.width, target.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 40 && data[i] > data[i+1] * 2) count++;
      return count;
    };
    view.render({time:0});
    const black = redPixels();
    pen.fillStyle = '#fa426a';
    pen.fillRect(42, 24, 46, 28);
    view.render({time:1/60, source});
    const oriented = pixel(62, 38);
    const opposite = pixel(62, 142);
    const injected = redPixels();
    pen.clearRect(0, 0, source.width, source.height);
    view.render({time:2/60, source});
    const feedback = redPixels();
    view.reset();
    view.render({time:30});
    const reset = redPixels();
    for (let i=0; i<150; i++) {
      pen.clearRect(0, 0, source.width, source.height);
      pen.fillStyle = i % 2 ? '#fa426a' : '#78baff';
      pen.beginPath();
      pen.arc(160 + 84*Math.sin(i*.08), 90 + 49*Math.cos(i*.08), 9, 0, 2*Math.PI);
      pen.fill();
      view.render({time:30+i/60,source});
    }
    const snapshot = view.snapshot();
    window.drawFixture = () => view.render({time: 32.5, source});
    window.disposeFixture = async () => {
      view.destroy();
      const restored = [target.width, target.height];
      const remount = await runtime.butterchurn.create(options);
      remount.render({time:1});
      runtime.destroy();
      return {restored, remount:remount.snapshot(), disposed:runtime.resources().disposed};
    };
    return {black,oriented,opposite,injected,feedback,reset,snapshot,duplicateRejected,malformedRejected};
  });

  assert.deepEqual(requests,[bundle,asset]);
  assert.equal(result.black, 0);
  assert.ok(result.oriented[0] > 100 && result.opposite[0] < 40, JSON.stringify(result));
  assert.ok(result.injected > 700 && result.feedback > 600, JSON.stringify(result));
  assert.equal(result.reset, 0);
  assert.ok(result.duplicateRejected && result.malformedRejected);
  assert.deepEqual([result.snapshot.width,result.snapshot.height], [320,180]);
  assert.equal(result.snapshot.frames,154);
  assert.ok(Math.abs(result.snapshot.sourceSeconds - (30 + 149/60)) < 1e-8);

  if (process.env.DANCEMOVES_BUTTERCHURN_EVIDENCE) {
    await fs.mkdir(process.env.DANCEMOVES_BUTTERCHURN_EVIDENCE, {recursive:true});
    await page.locator('canvas').screenshot({path: path.join(process.env.DANCEMOVES_BUTTERCHURN_EVIDENCE, 'butterchurn-feedback.png')});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(() => window.drawFixture()),false);
  await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});
  assert.equal(await page.evaluate(() => window.drawFixture()),false);
  await page.emulateMedia({forcedColors:'none'});
  assert.equal(await page.evaluate(() => window.drawFixture()),true);
  const teardown = await page.evaluate(() => window.disposeFixture());
  assert.deepEqual(teardown.restored,[640,360]);
  assert.equal(teardown.remount.status,'destroyed');
  assert.equal(teardown.disposed,true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result,teardown}));
} finally {
  await browser.close();
}
