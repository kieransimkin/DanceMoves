/** Real Canvas/media/compiled-runtime checks using original synthetic fixtures. */
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

const ROOT=path.resolve(import.meta.dirname,'../..');
const evidence=path.join(ROOT,'.build/browser-evidence/spectrum');
await fs.mkdir(evidence,{recursive:true});
const recording=createSpectrumRecording(),second=structuredClone(recording),invalid=structuredClone(recording);
second.name='synthetic_second_page_fixture';
invalid.provenance.axes[0].clipped_windows=1;
const requests={},checks=[],errors=[];
let browser,context,page,slowStarted,slowClosed;
const slowRequested=new Promise(resolve=>{slowStarted=resolve;});
const slowAborted=new Promise(resolve=>{slowClosed=resolve;});
const waiting=new Set();

// Independent transport fixture: known mono PCM. These regression calibration
// values are synthetic; the test does not claim model/DSP analysis of this audio.
const rate=8000,count=rate*8,wav=Buffer.alloc(44+count*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);
wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40);
for(let i=0;i<count;i++)wav.writeInt16LE(Math.round(4000*Math.sin(i*2*Math.PI*180/rate)),44+i*2);

const html=[
 '<!doctype html><html lang="en"><meta charset="utf-8"><title>DanceMoves spectrum browser regression</title>',
 '<style>body{margin:0;padding:24px;background:#111827;color:#edf5ff;font:14px system-ui}h1{font-size:22px}main{max-width:1050px;margin:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0;border:1px solid #405067;padding:10px}canvas{display:block;width:100%;height:170px}figcaption{font-size:12px;color:#bccce0}audio{width:100%;margin:12px 0}@media(max-width:600px){body{padding:12px}.grid{grid-template-columns:1fr}}</style>',
 '<main id="main"><h1>Ten saved-spectrum views</h1><p>Synthetic calibration and native source-time transport.</p><audio id="audio" controls muted preload="auto" src="/fixture.wav"></audio><section class="grid" id="grid"></section></main>',
 '<script type="module">',
 'import {createDanceMoves,SPECTRUM_RENDERERS} from "/lib/index.mjs";',
 'window.createDanceMoves=createDanceMoves;window.renderers=SPECTRUM_RENDERERS;',
 'window.addCanvas=(root,name)=>{const f=document.createElement("figure");f.setAttribute("data-dance-moves-spectrum-figure","");const c=document.createElement("canvas");c.width=420;c.height=170;const label=document.createElement("figcaption");label.textContent=name;const status=document.createElement("p");status.textContent="Page-owned fallback";status.setAttribute("data-dance-moves-spectrum-status","");f.append(label,c,status);root.append(f);return c;};',
 'window.canvases=SPECTRUM_RENDERERS.map(name=>window.addCanvas(document.querySelector("#grid"),name));',
 'window.runtime=createDanceMoves({root:document.querySelector("#main"),bpm:150});',
 'window.seek=async seconds=>{const audio=document.querySelector("#audio");audio.pause();if(Math.abs(audio.currentTime-seconds)>1e-8){const done=new Promise(resolve=>audio.addEventListener("seeked",resolve,{once:true}));audio.currentTime=seconds;await done;}window.handles?.forEach(h=>h.refresh());};',
 'await window.runtime.ready;window.importReady=true;',
 '</script></html>'
].join('\n');
function send(response,type,body,status=200,headers={}) {
 response.writeHead(status,{'Content-Type':type,'Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store',...headers});
 response.end(body);
}
const server=createServer(async(request,response)=>{
 try {
  const name=new URL(request.url,'http://fixture.invalid').pathname;
  if(name.endsWith('.json'))requests[name]=(requests[name]||0)+1;
  if(name==='/')return send(response,'text/html; charset=utf-8',html);
  if(name==='/lib/index.mjs')return send(response,'text/javascript; charset=utf-8',await fs.readFile(path.join(ROOT,'lib/index.mjs')));
  if(name==='/fixture.json')return send(response,'application/json',JSON.stringify(recording));
  if(name==='/second.json')return send(response,'application/json',JSON.stringify(second));
  if(name==='/invalid.json')return send(response,'application/json',JSON.stringify(invalid));
  if(name==='/slow.json'){
   waiting.add(response);slowStarted();
   response.on('close',()=>{waiting.delete(response);if(!response.writableEnded)slowClosed();});
   return;
  }
  if(name==='/fixture.wav'){
   const range=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range||'');
   if(range){
    const start=Number(range[1]),end=Math.min(wav.length-1,range[2]?Number(range[2]):wav.length-1);
    if(start>end)return send(response,'text/plain','',416,{'Content-Range':'bytes */'+wav.length});
    return send(response,'audio/wav',wav.subarray(start,end+1),206,
     {'Accept-Ranges':'bytes','Content-Range':'bytes '+start+'-'+end+'/'+wav.length});
   }
   return send(response,'audio/wav',wav,200,{'Accept-Ranges':'bytes'});
  }
  send(response,'text/plain','Not found',404);
 }catch(error){errors.push(String(error));if(!response.headersSent)send(response,'text/plain','Fixture server error',500);else response.destroy();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
function deadline(promise,label) {
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),5000);})]).finally(()=>clearTimeout(timer));
}
try {
 const executable=process.env.DANCEMOVES_BROWSER_EXECUTABLE;
 browser=await chromium.launch({headless:true,
  ...(executable?{executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']}:
   process.env.DANCEMOVES_BROWSER_CHANNEL?{channel:process.env.DANCEMOVES_BROWSER_CHANNEL}:{})});
 context=await browser.newContext({viewport:{width:1100,height:1400},deviceScaleFactor:1});
 page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/');
 await page.waitForFunction(()=>window.importReady);
 assert.deepEqual(requests,{});
 await page.evaluate(async()=>{
  const root=document.createElement('div');document.body.append(root);
  const empty=createDanceMoves({root,bpm:150,spectrumRecordingUrl:'/never.json'});
  await empty.ready;empty.destroy();root.remove();
 });
 assert.deepEqual(requests,{});
 checks.push('Package import, ordinary page mount and configured URL without spectrum canvases issue zero recording requests');

 await page.waitForFunction(()=>document.querySelector('#audio').readyState>=2);
 await page.evaluate(async()=>{
  window.handles=canvases.map((target,index)=>runtime.spectrum.animate({
   id:'view-'+index,target,audio:document.querySelector('#audio'),recordingUrl:'/fixture.json',
   renderer:renderers[index],offscreen:false,pixelRatio:1
  }));
  await Promise.all(handles.map(handle=>handle.ready));
 });
 assert.equal(requests['/fixture.json'],1);
 const rendered=await page.evaluate(()=>handles.map((handle,index)=>{
  const canvas=canvases[index],data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let painted=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)painted++;
  return {renderer:handle.snapshot().renderer,painted,report:handle.snapshot().report,png:canvas.toDataURL()};
 }));
 assert.equal(rendered.length,10);
 for(const view of rendered){
  assert.ok(view.painted>100,view.renderer+' paints a real Canvas');
  assert.equal(view.report.bands.length,4);
  assert.ok(Math.abs(view.report.bands[0].rms-.1)<1e-12);
 }
 assert.equal(new Set(rendered.map(view=>createHash('sha256').update(view.png).digest('hex'))).size,10,'Each renderer produces distinct geometry');
 checks.push('All ten real Canvas views render calibrated native samples with one shared page request');
 await page.screenshot({path:path.join(evidence,'all-views.png'),fullPage:true});

 await page.evaluate(()=>window.seek(1));
 const reference=await page.evaluate(()=>handles[0].snapshot());
 assert.equal(reference.pip,128,'Capture BPM120 controls positions despite page BPM150');
 await page.evaluate(async()=>{document.querySelector('#audio').playbackRate=2;await window.seek(.0625);await window.seek(1);});
 assert.deepEqual(await page.evaluate(()=>handles[0].snapshot().report),reference.report);
 await page.locator('#audio').evaluate(audio=>audio.play());
 await page.waitForFunction(()=>document.querySelector('#audio').currentTime>1.15);
 await page.locator('#audio').evaluate(audio=>audio.pause());
 const paused=await page.evaluate(()=>handles[0].snapshot());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>handles[0].snapshot().pip),paused.pip);
 const waitingFrames=await page.evaluate(()=>handles.map(handle=>runtime.rudiments.get(handle.id).snapshot().framePending));
 assert.ok(waitingFrames.every(value=>!value),'Paused spectra own no running animation frame');
 await page.evaluate(async()=>{document.querySelector('#audio').playbackRate=.5;await window.seek(1);});
 assert.deepEqual(await page.evaluate(()=>handles[0].snapshot().report),reference.report);
 checks.push('Actual decoded audio, pause, seek and playback-rate changes retain deterministic captured source time and peak history');

 for(const mode of ['reducedMotion','forcedColors']){
  await page.emulateMedia(mode==='reducedMotion'?{reducedMotion:'reduce'}:{forcedColors:'active'});
  const reason=mode==='reducedMotion'?'reduced-motion':'forced-colors';
  await page.waitForFunction(reason=>handles.every(handle=>handle.snapshot().status===reason),reason);
  const state=await page.evaluate(()=>handles.map((handle,index)=>{
   const canvas=canvases[index],data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return {report:handle.snapshot().report,clear:!data.some((value,i)=>i%4===3&&value!==0)};
  }));
  assert.ok(state.every(item=>item.report===null&&item.clear),'Preference clears, without interpreting zero as calibrated energy');
  await page.emulateMedia(mode==='reducedMotion'?{reducedMotion:'no-preference'}:{forcedColors:'none'});
  await page.waitForFunction(()=>handles[0].snapshot().report!==null);
 }
 await page.evaluate(()=>handles.forEach(handle=>handle.setEnabled(false)));
 assert.ok((await page.evaluate(()=>handles.map(handle=>handle.snapshot().report))).every(value=>value===null));
 await page.evaluate(()=>handles.forEach(handle=>handle.setEnabled(true)));
 await page.evaluate(()=>window.seek(6));
 assert.equal(await page.evaluate(()=>handles[0].snapshot().status),'outside-recording');
 assert.equal(await page.evaluate(()=>handles[0].snapshot().report),null);
 await page.evaluate(()=>window.seek(1));
 assert.deepEqual(await page.evaluate(()=>handles[0].snapshot().report),reference.report);
 checks.push('Reduced motion, forced colours, explicit disable and out-of-recording positions paint no fabricated spectrum energy');

 await page.setViewportSize({width:360,height:1000});
 await page.waitForFunction(()=>canvases[0].getBoundingClientRect().width<360);
 assert.ok(await page.evaluate(()=>handles.every(handle=>{const s=handle.snapshot();return s.canvasWidth>0&&s.canvasHeight>0&&s.canvasWidth*s.canvasHeight<=4194304;})));
 await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
 await page.evaluate(()=>{canvases[0].style.width='10000px';canvases[0].style.height='10000px';});
 await page.waitForFunction(()=>handles[0].snapshot().canvasWidth===2048);
 assert.ok(await page.evaluate(()=>{const s=handles[0].snapshot();return s.canvasWidth*s.canvasHeight<=4194304;}));
 await page.evaluate(()=>{canvases[0].style.width='';canvases[0].style.height='';});
 await page.setViewportSize({width:1100,height:1400});
 checks.push('Real ResizeObserver responds at phone width and enforces the Canvas backing-pixel limit');

 const failure=await page.evaluate(async()=>{
  const target=addCanvas(document.querySelector('#main'),'Invalid calibration');
  const h=runtime.spectrum.animate({id:'invalid',target,audio:document.querySelector('#audio'),recordingUrl:'/invalid.json',offscreen:false});
  let rejected=false;try{await h.ready;}catch{rejected=true;}
  const result={rejected,state:h.snapshot(),message:target.closest('figure').querySelector('[data-dance-moves-spectrum-status]').textContent};
  h.destroy();target.closest('figure').remove();return result;
 });
 assert.equal(failure.rejected,true);assert.equal(failure.state.status,'error');
 assert.match(failure.state.error,/Clipped Fourier axes/);assert.match(failure.message,/Spectrum unavailable/);
 checks.push('Invalid Fourier calibration fails visibly and does not install a misleading view');

 const remount=await page.evaluate(async()=>{
  const root=document.createElement('section');document.body.append(root);
  const audio=document.createElement('audio');audio.src='/fixture.wav';audio.preload='none';root.append(audio);
  const target=addCanvas(root,'Second song');target.setAttribute('data-dance-moves-spectrum','spectrum-line');
  const second=createDanceMoves({root,bpm:120,spectrumRecordingUrl:'/second.json'});
  await second.ready;const active=second.spectrum.snapshot();second.destroy();const destroyed=second.resources();
  const third=createDanceMoves({root,bpm:120,spectrumRecordingUrl:'/fixture.json'});
  await third.ready;const next=third.spectrum.snapshot();third.destroy();root.remove();
  return {active,destroyed,next,previous:runtime.spectrum.snapshot()};
 });
 assert.equal(requests['/second.json'],1);
 assert.equal(requests['/fixture.json'],2,'A separate page mount has no retained global recording cache');
 assert.equal(remount.active.sources,1);assert.equal(remount.next.sources,1);
 assert.equal(remount.previous.instances.length,10,'Independent song mounts do not replace other page owners');
 for(const key of ['listeners','frames','timers','observers'])assert.equal(remount.destroyed[key],0,key);
 checks.push('Declarative song/page mounts request only their chosen source and release data before a new song mount');

 await page.evaluate(()=>{
  const root=document.createElement('section');document.body.append(root);
  const audio=document.createElement('audio');audio.src='/fixture.wav';root.append(audio);
  const target=addCanvas(root,'Pending song');
  window.pendingRuntime=createDanceMoves({root,bpm:120});
  window.pendingView=pendingRuntime.spectrum.animate({id:'pending',target,audio,recordingUrl:'/slow.json'});
 });
 await deadline(slowRequested,'Pending recording request');
 await page.evaluate(async()=>{pendingRuntime.destroy();await pendingView.ready;});
 await deadline(slowAborted,'Pending recording abort');
 const stopped=await page.evaluate(()=>({view:pendingView.snapshot(),spectrum:pendingRuntime.spectrum.snapshot(),resources:pendingRuntime.resources()}));
 assert.equal(stopped.view.destroyed,true);assert.equal(stopped.spectrum.sources,0);
 assert.deepEqual(stopped.spectrum.instances,[]);
 for(const key of ['listeners','frames','timers','observers'])assert.equal(stopped.resources[key],0,key);
 checks.push('Destroy aborts a real pending HTTP fetch and prevents a late spectrum mount');

 const cleanup=await page.evaluate(()=>{
  runtime.destroy();
  return {resources:runtime.resources(),spectrum:runtime.spectrum.snapshot(),
   restored:canvases.every(canvas=>canvas.width===420&&canvas.height===170&&!canvas.hasAttribute('data-dance-moves-spectrum-state'))};
 });
 assert.equal(cleanup.restored,true);
 assert.equal(cleanup.spectrum.sources,0);assert.deepEqual(cleanup.spectrum.instances,[]);
 for(const key of ['listeners','frames','timers','observers'])assert.equal(cleanup.resources[key],0,key);
 assert.deepEqual(errors,[]);
 checks.push('Runtime disposal restores page Canvas attributes and clears all tracked owners and resources');
 await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({status:'PASS',browser:browser.version(),
  browserSource:executable?'DANCEMOVES_BROWSER_EXECUTABLE':process.env.DANCEMOVES_BROWSER_CHANNEL||'pinned Playwright Chromium',
  checks,requests,errors,cleanup,
  limits:'Synthetic calibration and original PCM fixture, real compiled runtime/Canvas/HTTP/media tests. No production WordPress deployment, full-song inference, listening or physical-device performance claim.'},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks:checks.length,requests,browser:browser.version()},null,2));
} catch(error) {
 await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify({status:'FAIL',checks,requests,errors,error:String(error),stack:error.stack},null,2)+'\n');
 if(page)await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});
 throw error;
} finally {
 await context?.close();await browser?.close();
 for(const response of waiting)response.destroy();
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
