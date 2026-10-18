/** Real compiled-runtime/Canvas/media coverage for all 164 FrameRudiments views. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createGalleryServer} from '../../examples/visualisers/serve.mjs';

const evidence = path.resolve(import.meta.dirname,'../../.build/browser-evidence/visualisers');
await fs.mkdir(evidence,{recursive:true});
const requests = [], checks = [], errors = [];
const server = createGalleryServer({onRequest: name => requests.push(name)});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser, context, page;
async function seek(seconds) {
  await page.evaluate(async seconds => {
    const {audio,views} = window.rudimentGallery;audio.pause();
    if (Math.abs(audio.currentTime-seconds) > 1e-8) {
      const done = new Promise(resolve => audio.addEventListener('seeked',resolve,{once:true}));
      audio.currentTime=seconds;await done;
    }
    for (const {handle} of views.values()) handle.refresh();
  },seconds);
}
async function pixels() {
  return page.evaluate(() => [...window.rudimentGallery.views.values()].map(({handle,figure}) => {
    const canvas=figure.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let painted=0,opaque=0,hash=2166136261;
    for (let i=0;i<data.length;i++) hash=Math.imul(hash^data[i],16777619)>>>0;
    for (let i=0;i<data.length;i+=4) if (data[i+3]) {
      opaque++;
      if (data[i]!==16||data[i+1]!==27||data[i+2]!==46) painted++;
    }
    return {name:handle.snapshot().renderer,status:handle.snapshot().status,painted,opaque,hash,width:canvas.width,height:canvas.height};
  }));
}
try {
  const executable=process.env.DANCEMOVES_BROWSER_EXECUTABLE;
  browser=await chromium.launch({headless:true,
    ...(executable?{executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']}:
      process.env.DANCEMOVES_BROWSER_CHANNEL?{channel:process.env.DANCEMOVES_BROWSER_CHANNEL}:{})});
  context=await browser.newContext({viewport:{width:1180,height:1100},deviceScaleFactor:1});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>window.rudimentGallery?.ready);
  assert.equal(requests.filter(name=>name.endsWith('.json')).length,0);
  const initial=await pixels();assert.equal(initial.length,4);
  for (const view of initial) assert.ok(view.painted>0,view.name);
  checks.push('The runnable gallery starts with native movement views and no recording requests');
  await page.waitForFunction(()=>window.rudimentGallery.audio.readyState>=2);
  await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();
    window.recordingTableCount=0;
    const original=WebAssembly.instantiate;
    WebAssembly.instantiate=async(...args)=>{
      const result=await Reflect.apply(original,WebAssembly,args);
      if(typeof (result.instance||result).exports.sample_recording==='function')window.recordingTableCount++;
      return result;
    };
    for (const view of gallery.catalogue) await gallery.add(view.name,{offscreen:false,limit:false});
  });
  await seek(3);
  const all=await pixels();assert.equal(all.length,164);
  for (const view of all) {
    assert.ok(view.painted>0,`${view.name} must draw real Canvas pixels`);
    assert.notEqual(view.status,'error',view.name);
    assert.ok(view.width*view.height<=4194304,view.name);
  }
  assert.equal(requests.filter(name=>name==='/fixture.json').length,1);
  assert.equal(await page.evaluate(()=>window.recordingTableCount),1);
  assert.equal(await page.evaluate(()=>window.rudimentGallery.runtime.visualisers.snapshot().sources),1);
  checks.push('All 164 renderer IDs draw nonempty real Canvas output; 106 spectral views share one request and one native table');
  await seek(4);await seek(3);
  assert.deepEqual((await pixels()).map(row=>[row.name,row.hash]),all.map(row=>[row.name,row.hash]));
  await page.evaluate(()=>{window.rudimentGallery.audio.playbackRate=2;for(const {handle} of window.rudimentGallery.views.values())handle.refresh();});
  assert.deepEqual((await pixels()).map(row=>[row.name,row.hash]),all.map(row=>[row.name,row.hash]));
  checks.push('Backward seeking reconstructs identical pixels for every renderer; playback rate does not double source time');

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({handle})=>handle.snapshot().status==='reduced-motion'));
  assert.ok((await pixels()).every(view=>view.opaque===0));
  await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({handle})=>handle.snapshot().status==='forced-colors'));
  assert.ok((await pixels()).every(view=>view.opaque===0));
  await page.emulateMedia({forcedColors:'none'});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({handle})=>handle.snapshot().values!==null));
  assert.deepEqual((await pixels()).map(row=>[row.name,row.hash]),all.map(row=>[row.name,row.hash]));
  checks.push('Reduced motion and forced colours clear every view; restoring preferences recovers the same recorded/native pose');

  const beforePlay=await page.evaluate(()=>[...window.rudimentGallery.views.values()][0].handle.snapshot().pip);
  await page.evaluate(async()=>{const audio=window.rudimentGallery.audio;audio.muted=true;audio.playbackRate=1;await audio.play();});
  await page.waitForFunction(pip=>[...window.rudimentGallery.views.values()][0].handle.snapshot().pip!==pip,beforePlay);
  await page.evaluate(()=>window.rudimentGallery.audio.pause());
  await seek(3);
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({handle})=>handle.snapshot().status==='hidden'));
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({handle})=>handle.snapshot().status==='audio-paused'));
  checks.push('Native scheduling advances during playback, pauses with media and resumes across a persisted page lifecycle');

  const declarative=await page.evaluate(async()=>{
    const {createDanceMoves}=await import('/lib/index.mjs');
    const root=document.createElement('section');
    root.innerHTML='<figure data-dance-moves-visualiser-figure><canvas data-dance-moves-visualiser="path"></canvas><p data-dance-moves-visualiser-status>Fallback</p></figure><figure data-dance-moves-visualiser-figure><canvas data-dance-moves-visualiser="bars"></canvas><p data-dance-moves-visualiser-status>Fallback</p></figure>';
    document.body.append(root);
    const runtime=createDanceMoves({root,bpm:120,visualiserRudiment:'bounce'});
    let rejected=false;try{await runtime.ready;}catch{rejected=true;}
    await Promise.all(runtime.visualisers.snapshot().instances.map(view=>runtime.visualisers.get(view.id).ready.catch(()=>{})));
    const state=runtime.visualisers.snapshot(),destroyed=runtime.destroyed;
    const visibleError=root.querySelector('[data-dance-moves-visualiser-status]').textContent;
    runtime.destroy();root.remove();
    const emptyRoot=document.createElement('section');document.body.append(emptyRoot);
    const empty=createDanceMoves({root:emptyRoot,visualiserRecordingUrl:'/unused.json'});await empty.ready;empty.destroy();emptyRoot.remove();
    return {rejected,destroyed,visibleError,states:state.instances.map(view=>view.status)};
  });
  assert.equal(declarative.rejected,true);assert.equal(declarative.destroyed,false);
  assert.match(declarative.visibleError,/unavailable/);
  assert.equal(declarative.states.filter(state=>state==='error').length,1);
  assert.equal(declarative.states.length,2);
  assert.ok(declarative.states.some(state=>['running','frame','offscreen'].includes(state)));
  assert.ok(!requests.includes('/unused.json'));
  checks.push('A malformed declarative canvas reports an error without destroying the player/root or a valid neighbouring view; unused URLs stay unloaded');

  const compatibility=await page.evaluate(async()=>{
    const {runtime,audio}=window.rudimentGallery;
    const canvas=document.createElement('canvas');canvas.style.cssText='width:300px;height:160px';runtime.root.append(canvas);
    const legacy=runtime.spectrum.animate({id:'legacy-shared',target:canvas,audio,recordingUrl:'/fixture.json',renderer:'spectrum',offscreen:false});
    await legacy.ready;
    window.rudimentGallery.clear();
    const held=runtime.spectrum.snapshot().sources,report=!!legacy.snapshot().report;
    legacy.destroy();canvas.remove();
    const released=runtime.visualisers.snapshot().sources;
    await window.rudimentGallery.add('spectrogram-annular-heatmap',{offscreen:false});
    return {held,report,released,sources:runtime.visualisers.snapshot().sources,tables:window.recordingTableCount};
  });
  assert.deepEqual(compatibility,{held:1,report:true,released:0,sources:1,tables:2});
  assert.equal(requests.filter(name=>name==='/fixture.json').length,2);
  checks.push('The old spectrum API shares the same table with new views; the last owner releases it and a later view loads it afresh');

  await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();
    for(const name of ['spectrum-annular-led','spectrogram-annular-heatmap','waveform-annular-ribbon','spatial-torus'])await gallery.add(name,{offscreen:false});
  });
  await seek(3);
  await page.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>[...window.rudimentGallery.views.values()].every(({figure})=>{
    const canvas=figure.querySelector('canvas');return canvas.width<400&&Math.abs(canvas.width-canvas.getBoundingClientRect().width)<2;
  }));
  const mobile=await pixels();assert.ok(mobile.every(view=>view.painted>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
  const cleanup=await page.evaluate(()=>{
    const {runtime}=window.rudimentGallery;runtime.destroy();
    return {visualisers:runtime.visualisers.snapshot(),native:runtime.rudiments.snapshot(),resources:runtime.resources()};
  });
  assert.equal(cleanup.visualisers.sources,0);assert.equal(cleanup.visualisers.patterns,0);assert.deepEqual(cleanup.visualisers.instances,[]);
  assert.deepEqual(cleanup.native.instances,[]);assert.equal(cleanup.native.framePending,false);
  for(const key of ['listeners','timers','frames','observers'])assert.equal(cleanup.resources[key],0,key);
  checks.push('Desktop/mobile layouts retain visible bounded canvases without overflow; full teardown releases native drivers, data, listeners and observers');
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(evidence,'checks.json'),JSON.stringify({checks,renderers:all.map(({name,painted,hash})=>({name,painted,hash})),requests,errors},null,2)+'\n');
  for(const check of checks)console.log('PASS '+check);
} finally {
  await context?.close();await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
