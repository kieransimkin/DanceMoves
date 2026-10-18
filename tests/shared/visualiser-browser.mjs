/** Real compiled-runtime/Canvas/media coverage for all 222 FrameRudiments views. */
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createGalleryServer} from '../../examples/visualisers/serve.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

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
    const state=handle.snapshot();
    return {name:state.renderer,status:state.status,pip:state.pip,sourceSeconds:state.sourceSeconds,
      renderReport:state.renderReport,historyLength:state.historyLength,painted,opaque,hash,width:canvas.width,height:canvas.height};
  }));
}
try {
  const executable=process.env.DANCEMOVES_BROWSER_EXECUTABLE;
  browser=await chromium.launch({headless:true,
    ...(executable?{executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']}:
      process.env.DANCEMOVES_BROWSER_CHANNEL?{channel:process.env.DANCEMOVES_BROWSER_CHANNEL}:{})});
  context=await browser.newContext({viewport:{width:1180,height:1100},deviceScaleFactor:1});
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(90000);
  await page.goto(base);await page.waitForFunction(()=>window.rudimentGallery?.ready);
  assert.equal(requests.filter(name=>name.endsWith('.json')).length,0);
  assert.equal(requests.filter(name=>name.endsWith('.png')).length,0);
  const initial=await pixels();assert.equal(initial.length,4);
  for (const view of initial) assert.ok(view.painted>0,view.name);
  checks.push('The runnable gallery starts with native movement views and no recording or atlas requests');
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
    window.atlasDecodes=0;window.atlasCloses=0;
    const decode=window.createImageBitmap.bind(window);
    window.createImageBitmap=async(...args)=>{
      const bitmap=await decode(...args),close=bitmap.close.bind(bitmap);window.atlasDecodes++;
      bitmap.close=()=>{window.atlasCloses++;close();};return bitmap;
    };
    for (const view of gallery.catalogue) await gallery.add(view.name,{offscreen:false,limit:false});
  });
  await seek(3);
  const all=await pixels();assert.equal(all.length,222);
  for (const view of all) {
    assert.ok(view.painted>0,`${view.name} must draw real Canvas pixels`);
    assert.notEqual(view.status,'error',view.name);
    assert.ok(view.width*view.height<=4194304,view.name);
  }
  assert.equal(requests.filter(name=>name==='/fixture.json').length,1);
  assert.equal(await page.evaluate(()=>window.recordingTableCount),1);
  assert.equal(await page.evaluate(()=>window.rudimentGallery.runtime.visualisers.snapshot().sources),1);
  const atlasPaths=requests.filter(name=>name.endsWith('.png'));
  assert.ok(atlasPaths.length>1);assert.equal(new Set(atlasPaths).size,atlasPaths.length,'one request per active atlas URL');
  assert.equal(await page.evaluate(()=>window.rudimentGallery.runtime.visualisers.snapshot().atlases),atlasPaths.length);
  assert.equal(await page.evaluate(()=>window.atlasDecodes),atlasPaths.length);
  const solids=all.filter(view=>/^spatial-(solid|music)-/.test(view.name));assert.equal(solids.length,6);
  for(const view of solids){
    assert.equal(view.renderReport.backend,'cpu');assert.ok(view.renderReport.triangles>0);assert.ok(view.renderReport.coveredPixels>0);
    assert.ok(view.renderReport.rasterWidth*view.renderReport.rasterHeight<=1048576);
    assert.ok(view.renderReport.rasterPixelTests<=8388608);assert.deepEqual(view.renderReport.sourcePips,[view.pip]);
    assert.equal(view.renderReport.sourceSha256,null);assert.equal(view.sourceSeconds,3);
  }
  assert.equal(all.filter(view=>view.name.startsWith('sprite-')).length,52);
  for(const view of all.filter(view=>view.name.startsWith('sprite-'))){
    assert.equal(view.renderReport.kind,'sprite-rudiment');assert.ok(view.renderReport.drawn_stamps>0);
    assert.equal(view.renderReport.animation_frame,180);assert.match(view.renderReport.atlas.sha256,/^[a-f0-9]{64}$/);
  }
  checks.push('All 222 renderer IDs draw real Canvas pixels; spectral views share one request/table and sprite views share their pinned decoded atlases');
  checks.push('All six filled spatial modes report genuine CPU depth rendering, bounded raster work and the actual native source clock');
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
    const released=runtime.visualisers.snapshot().sources,atlases=runtime.visualisers.snapshot().atlases;
    await window.rudimentGallery.add('spectrogram-annular-heatmap',{offscreen:false});
    return {held,report,released,atlases,sources:runtime.visualisers.snapshot().sources,tables:window.recordingTableCount,decodes:window.atlasDecodes,closes:window.atlasCloses};
  });
  assert.deepEqual(compatibility,{held:1,report:true,released:0,atlases:0,sources:1,tables:2,decodes:atlasPaths.length,closes:atlasPaths.length});
  assert.equal(requests.filter(name=>name==='/fixture.json').length,2);
  checks.push('The old spectrum API shares the same table with new views; the last owner releases it and a later view loads it afresh');

  const sharedPngBefore=requests.filter(name=>name.endsWith('/lcd.png')).length;
  const sharedAtlas=await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();const closed=window.atlasCloses;
    const first=await gallery.add('sprite-motion-orbit',{offscreen:false,style:{sprite_theme:'lcd'}});
    const second=await gallery.add('sprite-waveform-dots',{offscreen:false,style:{sprite_theme:'lcd'}});
    const loaded=gallery.runtime.visualisers.snapshot().atlases;
    first.destroy();const held=gallery.runtime.visualisers.snapshot().atlases,remaining=second.snapshot().renderReport;
    gallery.clear();return {loaded,held,remaining,released:gallery.runtime.visualisers.snapshot().atlases,closed:window.atlasCloses-closed};
  });
  assert.equal(sharedAtlas.loaded,1);assert.equal(sharedAtlas.held,1);assert.ok(sharedAtlas.remaining.drawn_stamps>0);
  assert.equal(sharedAtlas.released,0);assert.equal(sharedAtlas.closed,1);
  assert.equal(requests.filter(name=>name.endsWith('/lcd.png')).length-sharedPngBefore,1);
  checks.push('Two native sprite views share one fetched/decoded atlas; removing the last view closes its image and drops the atlas owner');

  // The custom PNG is generated solely in this test. Four flat-colour cells
  // provide observable crop/animation evidence without relying on atlas art.
  const custom=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');
    ['#ff0000','#00ff00','#0000ff','#ffff00'].forEach((colour,index)=>{ctx.fillStyle=colour;ctx.fillRect(index%2*16,Math.floor(index/2)*16,16,16);});
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),bytes=await blob.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return {base64:canvas.toDataURL('image/png').split(',')[1],sha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};
  });
  let customRequests=0;
  await page.route('**/custom-atlas.png',async route=>{customRequests++;await route.fulfill({status:200,contentType:'image/png',body:Buffer.from(custom.base64,'base64')});});
  await page.evaluate(async sha256=>{
    const gallery=window.rudimentGallery;
    window.customSpriteStyle={sprite_asset:{url:'/custom-atlas.png',sha256},sprite_columns:2,sprite_rows:2,
      sprite_index:0,animation_frames:4,animation_stride:1,sprite_colour:'original',sprite_size:16,
      sample_stride:16,background:'transparent',pixelated:true};
    await gallery.add('sprite-waveform-dots',{offscreen:false,style:window.customSpriteStyle});
    await gallery.add('sprite-motion-orbit',{offscreen:false,style:window.customSpriteStyle});
  },custom.sha256);
  async function customColours() {
    return page.evaluate(()=>[...window.rudimentGallery.views.values()].map(({figure,handle})=>{
      const canvas=figure.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let red=0,green=0,blue=0;
      for(let i=0;i<data.length;i+=4)if(data[i+3]>200){if(data[i]>200&&data[i+1]<30&&data[i+2]<30)red++;if(data[i+1]>200&&data[i]<30&&data[i+2]<30)green++;if(data[i+2]>200&&data[i]<30&&data[i+1]<30)blue++;}
      return {red,green,blue,report:handle.snapshot().renderReport};
    }));
  }
  await seek(3);const redCells=await customColours();
  for(const row of redCells){assert.ok(row.red>0);assert.equal(row.green,0);assert.equal(row.blue,0);assert.equal(row.report.atlas.custom,true);assert.equal(row.report.atlas.sha256,custom.sha256);}
  await seek(3.025);const greenCells=await customColours();
  for(const row of greenCells){assert.ok(row.green>0);assert.equal(row.red,0);assert.equal(row.report.animation_frame,181);}
  await seek(3);assert.deepEqual(await customColours(),redCells);assert.equal(customRequests,1);
  const hashFailure=await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();const decoded=window.atlasDecodes;
    const h=await gallery.add('sprite-waveform-dots',{offscreen:false,style:{...window.customSpriteStyle,sprite_asset:{url:'/custom-atlas.png',sha256:'00'.repeat(32)}}});
    const result={status:h.snapshot().status,error:h.snapshot().error,atlases:gallery.runtime.visualisers.snapshot().atlases,
      decoded:window.atlasDecodes-decoded,visible:[...gallery.views.values()][0].figure.querySelector('[data-dance-moves-visualiser-status]').textContent};
    gallery.clear();return result;
  });
  assert.equal(hashFailure.status,'error');assert.match(hashFailure.error,/SHA-256 mismatch/);assert.match(hashFailure.visible,/unavailable/);
  assert.equal(hashFailure.atlases,0);assert.equal(hashFailure.decoded,0);assert.equal(customRequests,2);
  checks.push('A pinned custom 2×2 PNG crops and animates actual coloured cells on source time; seeking is deterministic and a wrong digest fails visibly before image decoding');

  const musicRecordingsBefore=requests.filter(name=>name==='/fixture.json').length;
  await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();const create=document.createElement.bind(document),canvases=[];
    document.createElement=(name,...args)=>{const node=create(name,...args);if(name==='canvas')canvases.push(node);return node;};
    try{
      for(const geometry of ['torus','sphere','terrain'])await gallery.add('spatial-music-'+geometry,{offscreen:false,
        style:{...(geometry==='terrain'?{terrain_source:'fft'}:{spectral_deform:true}),fft_floor_db:-60,raster_size:128,fog:0,glow:0,backend:'auto'}});
      window.spatialScratch=canvases.filter(canvas=>!canvas.isConnected);
    }finally{document.createElement=create;}
  });
  await seek(.0625);const earlyMusic=await pixels();assert.equal(earlyMusic.length,3);
  for(const view of earlyMusic){
    assert.notEqual(view.status,'error');assert.equal(view.pip,8);assert.equal(view.renderReport.backend,'cpu');
    assert.match(view.renderReport.fallbackReason,/CPU/);assert.match(view.renderReport.sourceSha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(view.renderReport.sourcePips,view.name.endsWith('terrain')?[0,1,2,3,4,5,6,7,8]:[8]);
  }
  assert.equal(requests.filter(name=>name==='/fixture.json').length-musicRecordingsBefore,1);
  await seek(0);assert.deepEqual((await pixels()).find(view=>view.name.endsWith('terrain')).renderReport.sourcePips,[0]);
  await seek(3);const musicAtThree=await pixels();await seek(3.001);
  assert.ok((await pixels()).every(view=>view.pip===384&&view.sourceSeconds===3.001),'spatial time advances within the same captured pip');
  await seek(4);await seek(3);assert.deepEqual((await pixels()).map(row=>row.hash),musicAtThree.map(row=>row.hash));
  const uncalibrated=createSpectrumRecording({count:64});uncalibrated.provenance={producer:'DanceMoves synthetic movement fixture'};
  const musicFailures=await page.evaluate(async recording=>{
    const gallery=window.rudimentGallery,failures=[];
    for(const source of [{recordingUrl:'/fixture.json',axes:[0,1]},{recording}]){
      const target=document.createElement('canvas');target.style.cssText='width:240px;height:140px';gallery.runtime.root.append(target);
      const h=gallery.runtime.visualisers.animate({id:'invalid-music-'+failures.length,target,audio:gallery.audio,renderer:'spatial-music-torus',style:{spectral_deform:true},...source});
      try{await h.ready;}catch{}failures.push({status:h.snapshot().status,error:h.snapshot().error});h.destroy();target.remove();
    }
    const before=gallery.runtime.visualisers.snapshot().instances.length;let gpu;
    try{gallery.runtime.visualisers.animate({id:'unsupported-spatial-gpu',target:[...gallery.views.values()][0].figure.querySelector('canvas'),rudiment:'helix',renderer:'spatial-solid-sphere',style:{backend:'gpu'}});}catch(error){gpu=error.message;}
    return {failures,gpu,unchanged:gallery.runtime.visualisers.snapshot().instances.length===before};
  },uncalibrated);
  assert.ok(musicFailures.failures.every(row=>row.status==='error'));assert.match(musicFailures.failures[0].error,/at least 3/);
  assert.match(musicFailures.failures[1].error,/StemLab|Fourier/);assert.match(musicFailures.gpu,/GPU.*unsupported/);assert.equal(musicFailures.unchanged,true);
  const sourceSwitch=await page.evaluate(()=>{
    const gallery=window.rudimentGallery;window.originalMusicSource=gallery.audio.src;
    gallery.audio.src='/fixture.wav?changed-song=1';for(const {handle} of gallery.views.values())handle.refresh();
    return [...gallery.views.values()].map(({handle})=>handle.snapshot());
  });
  assert.ok(sourceSwitch.every(view=>view.status==='source-mismatch'&&view.values===null&&view.renderReport===null));
  assert.equal(requests.filter(name=>name==='/fixture.json').length-musicRecordingsBefore,1,'a different master does not silently fetch another recording');
  const spatialCleanup=await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();
    const shrunk=window.spatialScratch.map(canvas=>[canvas.width,canvas.height]);
    gallery.audio.src=window.originalMusicSource;gallery.audio.load();
    if(gallery.audio.readyState<2)await new Promise(resolve=>gallery.audio.addEventListener('loadeddata',resolve,{once:true}));
    return {shrunk,sources:gallery.runtime.visualisers.snapshot().sources,atlases:gallery.runtime.visualisers.snapshot().atlases};
  });
  assert.equal(spatialCleanup.shrunk.length,3);assert.ok(spatialCleanup.shrunk.every(([w,h])=>w===1&&h===1));
  assert.equal(spatialCleanup.sources,0);assert.equal(spatialCleanup.atlases,0);
  checks.push('Music deformation and FFT terrain use calibrated saved bands, preserve incomplete capture history, redraw within a pip, reject invalid calibration/GPU, and clear on master changes');
  checks.push('Destroying real music views shrinks every owned raster canvas and releases their page-owned recording');

  await page.evaluate(async()=>{
    const gallery=window.rudimentGallery;gallery.clear();
    for(const name of ['spectrum-annular-led','spectrogram-annular-heatmap','waveform-annular-ribbon','sprite-motion-orbit','spatial-solid-torus','spatial-music-terrain'])await gallery.add(name,{offscreen:false});
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
  assert.equal(cleanup.visualisers.sources,0);assert.equal(cleanup.visualisers.patterns,0);assert.equal(cleanup.visualisers.atlases,0);assert.deepEqual(cleanup.visualisers.instances,[]);
  assert.deepEqual(cleanup.native.instances,[]);assert.equal(cleanup.native.framePending,false);
  for(const key of ['listeners','timers','frames','observers'])assert.equal(cleanup.resources[key],0,key);
  checks.push('Desktop/mobile layouts retain visible bounded canvases without overflow; full teardown releases native drivers, data, listeners and observers');

  // Load the actual compiled WordPress adapter with the same localized shape
  // the plugin emits. The atlas base exists only on the collection host.
  const wordpress=await context.newPage(),wordpressRequests=[];
  wordpress.on('pageerror',error=>errors.push('WordPress: '+error.message));
  wordpress.on('request',request=>wordpressRequests.push(new URL(request.url()).pathname));
  const wordpressScript=await fs.readFile(path.resolve(import.meta.dirname,'../../lib/wordpress.js'));
  await wordpress.route('**/wordpress-regression.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:wordpressScript}));
  try{
    await wordpress.goto(base);await wordpress.waitForFunction(()=>window.rudimentGallery?.ready);
    await wordpress.evaluate(()=>{
      window.rudimentGallery.runtime.destroy();document.querySelector('#demo').remove();
      const root=document.createElement('section');root.setAttribute('data-dance-moves-song-collection','');
      const select=document.createElement('select');select.setAttribute('data-dance-moves-song-select','');root.append(select);
      for(const id of ['first','second']){
        select.add(new Option(id,id));const section=document.createElement('section');section.setAttribute('data-dance-moves-song',id);
        section.innerHTML=`<audio src="/fixture.wav?song=${id}" preload="metadata" data-dance-moves-master></audio><figure data-dance-moves-visualiser-figure><canvas style="width:280px;height:160px" data-dance-moves-visualiser="sprite-motion-orbit"></canvas><p data-dance-moves-visualiser-status>Authored fallback</p></figure>`;
        root.append(section);
      }
      document.body.append(root);
      window.danceMovesConfig={songCollectionEnabled:'1',pageId:'99',visualiserAssetBaseUrl:'/lib/assets/visualiser-sprites/',
        songs:['first','second'].map((id,index)=>({id,title:id,audioSrc:`/fixture.wav?song=${id}`,bpm:index?'137':'120',
          visualiserRudiment:'helix',visualiserRenderer:'sprite-motion-orbit',visualiserSpriteTheme:index?'fire':'lcd'}))};
    });
    await wordpress.addScriptTag({url:base+'/wordpress-regression.js'});
    await wordpress.waitForFunction(()=>window.__danceMovesMount?.runtime?.visualisers.snapshot().instances.some(view=>view.renderReport));
    const firstSong=await wordpress.evaluate(()=>{
      const collection=window.__danceMovesMount;window.firstSongRuntime=collection.runtime;
      return {current:collection.current,atlases:collection.runtime.visualisers.snapshot().atlases,
        states:collection.runtime.visualisers.snapshot().instances.map(view=>({status:view.status,report:view.renderReport}))};
    });
    assert.equal(firstSong.current,'first');assert.equal(firstSong.atlases,1);assert.ok(firstSong.states[0].report.drawn_stamps>0);
    assert.deepEqual(wordpressRequests.filter(name=>name.endsWith('.png')),['/lib/assets/visualiser-sprites/lcd.png']);
    await wordpress.evaluate(async()=>{const collection=window.__danceMovesMount;collection.select('second');await collection.ready;});
    await wordpress.waitForFunction(()=>window.__danceMovesMount?.runtime?.visualisers.snapshot().instances.some(view=>view.renderReport));
    const secondSong=await wordpress.evaluate(()=>{
      const collection=window.__danceMovesMount,current=collection.runtime,previous=window.firstSongRuntime;
      const state={current:collection.current,previousDestroyed:previous.destroyed,previousAtlases:previous.visualisers.snapshot().atlases,
        atlas:current.visualisers.snapshot().atlases,report:current.visualisers.snapshot().instances[0].renderReport,
        firstHidden:document.querySelector('[data-dance-moves-song="first"]').hidden};
      collection.destroy();return {...state,destroyed:collection.destroyed,remaining:current.visualisers.snapshot().atlases,resources:current.resources()};
    });
    assert.equal(secondSong.current,'second');assert.equal(secondSong.previousDestroyed,true);assert.equal(secondSong.previousAtlases,0);
    assert.equal(secondSong.atlas,1);assert.ok(secondSong.report.drawn_stamps>0);assert.equal(secondSong.firstHidden,true);
    assert.equal(secondSong.destroyed,true);assert.equal(secondSong.remaining,0);
    for(const key of ['listeners','timers','frames','observers'])assert.equal(secondSong.resources[key],0,'collection '+key);
    assert.deepEqual(wordpressRequests.filter(name=>name.endsWith('.png')),['/lib/assets/visualiser-sprites/lcd.png','/lib/assets/visualiser-sprites/fire.png']);
    assert.ok(!wordpressRequests.some(name=>name.endsWith('.json')));
    checks.push('The compiled WordPress collection adapter passes the host atlas base into each selected song, lazily loads its own theme and releases the previous song without recording requests');
  }finally{await wordpress.close();}
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(evidence,'checks.json'),JSON.stringify({checks,renderers:all.map(({name,painted,hash})=>({name,painted,hash})),requests,wordpressRequests,errors},null,2)+'\n');
  for(const check of checks)console.log('PASS '+check);
} finally {
  await context?.close();await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
