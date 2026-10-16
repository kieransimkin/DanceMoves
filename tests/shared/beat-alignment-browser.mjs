/** Actual media, compiled shared clock, native movement and unchanged timed text. */
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory='.build/browser-evidence/beat-alignment';await fs.mkdir(directory,{recursive:true});
const port=8776,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['examples/playback-sources/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='',browser,context;server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const checks=[],errors=[];
try {
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/examples/beat-alignment/index.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'fixture server starts '+log);
  browser=await chromium.launch({headless:true,...(process.env.DANCEMOVES_BROWSER_CHANNEL?{channel:process.env.DANCEMOVES_BROWSER_CHANNEL}:{})});
  const recordVideo=process.env.DANCEMOVES_RECORD_VIDEO!=='0';
  context=await browser.newContext({viewport:{width:1100,height:1000},...(recordVideo?{recordVideo:{dir:directory,size:{width:1100,height:1000}}}:{})});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/examples/beat-alignment/index.html');
  await page.waitForFunction(()=>window.runtime && document.querySelector('#state').textContent.includes('"version"'));
  await page.getByRole('button',{name:'Seek first beat',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#aligned').textContent==='0.000 ticks');
  assert.equal(await page.locator('#source').textContent(),'0.125 seconds');
  const state=await page.evaluate(()=>window.runtime.beatAlignmentState(document.querySelector('audio')));
  assert.equal(state.applied,true);assert.equal(state.status,'synthetic');checks.push('exact first beat maps to zero in the compiled real runtime');
  await page.screenshot({path:directory+'/first-beat.png',fullPage:true});
  await page.locator('audio').evaluate(audio=>{audio.muted=true;return audio.play();});
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>1.2);
  const native=await page.evaluate(()=>window.runtime.rudiments.get('aligned-native-dot').snapshot());
  assert.equal(native.status,'running');checks.push('actual native rudiment follows playing synthetic audio');
  if(process.env.DANCEMOVES_CAPTURE_FRAMES==='1') {
    const frames=[];await fs.mkdir(directory+'/frames',{recursive:true});
    for(let i=0;i<16;i++) {
      const time=await page.locator('audio').evaluate(audio=>audio.currentTime);
      await page.screenshot({path:directory+`/frames/${String(i).padStart(4,'0')}.png`});
      frames.push({frame:i,wallMilliseconds:Date.now(),sourceSeconds:time});
      await page.waitForFunction(previous=>document.querySelector('audio').currentTime>previous+.1,time);
    }
    await fs.writeFile(directory+'/frame-ledger.json',JSON.stringify(frames,null,2));
  }
  await page.getByRole('button',{name:'Seek later lyric/cue',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#aligned').textContent==='64.000 ticks');
  assert.equal(await page.locator('#source').textContent(),'2.125 seconds');
  const pulse=await page.locator('main').evaluate(root=>root.style.getPropertyValue('--dance-moves-pulse-delay'));
  assert.ok(Math.abs(parseFloat(pulse))<1e-6,'pulse uses aligned rhythm '+pulse);
  checks.push('paused seek, unchanged source timestamp and shared pulse phase');
  await page.evaluate(async()=>{
    const runtime=window.runtime,audio=document.querySelector('audio');
    const recording={format:'dancerudiments.recording',schema_version:1,pips_per_beat:64,sample_dtype:'float64',
      name:'source_clock_fixture',dimensions:['x'],samples:Array.from({length:1024},(_,i)=>[i/1024]),
      clock:{bpm:120,bpm_source:'synthetic browser score',bpm_status:'confirmed',beat_zero_seconds:0,phase_status:'supplied',start_pip:0},provenance:{}};
    window.recording=runtime.recordings.animate({id:'unaltered-recording-clock',root:runtime.root,target:runtime.root,audio,
      recording,offscreen:false,render:frame=>{window.recordingFrame=frame;}});
    await window.recording.ready;
  });
  await page.waitForFunction(()=>window.recordingFrame?.pip===272);
  assert.equal(await page.evaluate(()=>window.recordingFrame.values[0]),272/1024);
  assert.equal(await page.evaluate(()=>window.runtime.sourceTick(document.querySelector('audio'))),64);
  checks.push('native captured recording retains source pip 272 while procedural rhythm is pip 256');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>window.runtime.rudiments.get('aligned-native-dot').snapshot().status==='reduced-motion');
  checks.push('reduced motion remains authoritative');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('audio').evaluate(audio=>audio.play());
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>3.5);
  await page.getByRole('button',{name:'Destroy runtime',exact:true}).click();
  const resources=await page.evaluate(()=>window.runtime.resources());
  for(const key of ['listeners','frames','timers','observers'])assert.equal(resources[key],0,key);
  assert.deepEqual(errors,[]);checks.push('teardown removes shared owners');
  const video=page.video();await context.close();context=null;
  if(video)await video.saveAs(directory+'/demonstration.webm');
  await browser.close();
  const cleanup={connected:browser.isConnected(),contexts:browser.contexts().length};assert.equal(cleanup.connected,false);assert.equal(cleanup.contexts,0);
  await fs.writeFile(directory+'/report.json',JSON.stringify({status:'PASS',checks,errors,cleanup,limits:'Original synthetic audio; local real shared-runtime screen capture is silent. No production WordPress or physical-device claim.'},null,2));
} finally {await context?.close();if(browser?.isConnected())await browser.close();server.kill();await fs.writeFile(directory+'/server.log',log);}
