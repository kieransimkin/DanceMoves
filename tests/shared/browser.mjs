/** Real React/Chromium integration. No skipped substitute for a missing renderer or song. */
import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const port=4187,base=`http://127.0.0.1:${port}`,evidence='.build/browser-evidence';fs.mkdirSync(evidence,{recursive:true});
for(const f of ['lib/index.mjs','examples/wordpress/media/arcadians.mp3'])if(!fs.existsSync(f))throw new Error(`Missing ${f}. Run npm run build and npm run demo:prepare first.`);
const child=spawn(process.execPath,['examples/react/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let serverLog='';child.stdout.on('data',b=>serverLog+=b);child.stderr.on('data',b=>serverLog+=b);
let browser;const checks=[],errors=[];
try{
 let ready=false;for(let i=0;i<150;i++){if(child.exitCode!==null)throw new Error(serverLog);try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw new Error('React server did not become ready: '+serverLog);
 const channel=process.env.DANCEMOVES_BROWSER_CHANNEL||undefined;
 browser=await chromium.launch(channel?{headless:true,channel}:{headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__danceMovesReadyEvents=[];document.addEventListener('dance-moves-ready',event=>window.__danceMovesReadyEvents.push({bubbles:event.bubbles,version:event.detail?.version}));});
 await page.goto(base);await page.waitForFunction(()=>window.__reactDanceMoves && !window.__reactDanceMoves.destroyed);
 // A mounted handle precedes asynchronous runtime readiness. Wait for the
 // actual event before asserting its complete payload; retain a bounded gate.
 await page.waitForFunction(()=>window.__danceMovesReadyEvents.length > 0, undefined, {timeout:15000});
 const expectedVersion=JSON.parse(fs.readFileSync('package.json','utf8')).version;
 assert.deepEqual(await page.evaluate(()=>window.__danceMovesReadyEvents),[{bubbles:true,version:expectedVersion}]);checks.push('generic dance-moves-ready event bubbles after runtime readiness');
 await page.waitForSelector('.motion-tile');assert.equal(await page.locator('.motion-tile').count(),15);checks.push('15 actual native rudiments rendered by React');
 await page.locator('audio').evaluate(a=>{a.muted=true;return a.play();});await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.1);checks.push('canonical Arcadians media decodes and plays');
 await page.getByRole('button',{name:'Drop 1',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>=104);checks.push('React chapter seek');
 await page.getByRole('button',{name:'Unmount runtime',exact:true}).click();await page.waitForSelector('[data-testid=unmounted]');await page.waitForFunction(()=>!window.__reactDanceMoves);assert.equal(await page.locator('[data-dancemoves-scope]').count(),0);checks.push('StrictMode mount/unmount removes scoped state');
 await page.getByRole('button',{name:'Remount runtime',exact:true}).click();await page.waitForFunction(()=>window.__reactDanceMoves && !window.__reactDanceMoves.destroyed);
 for(const feature of ['pointer','pulse','cues','timeline','quality','orientation','clay','planes','metadata','capture']){
  await page.getByRole('button',{name:feature,exact:true}).click();await page.waitForFunction(()=>window.__reactDanceMoves && !window.__reactDanceMoves.destroyed);assert.equal(await page.locator('[data-dancemoves-scope]').count(),1);checks.push('React demo mounts: '+feature);
  if(feature==='cues'){await page.getByRole('button',{name:'Fire named cue',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.demo-runtime').classList.contains('accent'));}
  if(feature==='planes')await page.waitForSelector('.paper-dreams-flight');
 }
 // The same native audio scheduler drives bounded N-D recordings; source values
 // below are synthetic and have no relationship to the song fixture's analysis.
 await page.getByRole('button',{name:'rudiments',exact:true}).click();await page.waitForSelector('.motion-tile');
 await page.evaluate(async()=>{
  const r=window.__reactDanceMoves,a=document.querySelector('audio');a.pause();a.currentTime=.25;
  const recording={format:'dancerudiments.recording',schema_version:1,pips_per_beat:64,sample_dtype:'float64',name:'browser_synthetic',dimensions:['x','y'],samples:Array.from({length:192},()=>[.75,-.25]),clock:{bpm:r.bpm,bpm_source:'synthetic browser test',bpm_status:'confirmed',beat_zero_seconds:0,phase_status:'unverified',start_pip:0},provenance:{}};
  window.__recordingController=r.recordings.animate({id:'browser:recording',root:r.root,target:r.root,audio:a,recording,offscreen:false,render:f=>{r.root.style.setProperty('--recording-x',String(f.values[0]));r.root.dataset.recordingReason=f.reason;}});await window.__recordingController.ready;
 });
 await page.waitForFunction(()=>getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')==='.75'||getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')==='0.75');checks.push('recording uses real audio cursor and native WASM values');
 await page.evaluate(()=>{window.__recordingController.setEnabled(false);});assert.equal(await page.evaluate(()=>getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')),'0');
 await page.evaluate(()=>{window.__recordingController.setEnabled(true);document.querySelector('audio').currentTime=4;});await page.waitForFunction(()=>window.__reactDanceMoves.root.dataset.recordingReason==='outside-recording');assert.equal(await page.evaluate(()=>getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')),'0');checks.push('recording neutralises capture bounds without wrapping');
 await page.evaluate(()=>{document.querySelector('audio').currentTime=.25;});await page.waitForFunction(()=>window.__reactDanceMoves.root.dataset.recordingReason==='audio-paused');
 for(const preference of [{reducedMotion:'reduce'},{reducedMotion:'no-preference',forcedColors:'active'}]){await page.emulateMedia(preference);await page.waitForFunction(()=>getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')==='0');}
 await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});await page.waitForFunction(()=>getComputedStyle(window.__reactDanceMoves.root).getPropertyValue('--recording-x')==='0.75');
 await page.getByRole('button',{name:'Unmount runtime',exact:true}).click();assert.equal(await page.evaluate(()=>window.__recordingController.snapshot().destroyed),true);checks.push('recording preferences restore and runtime unmount destroys its owner');
 await page.getByRole('button',{name:'Remount runtime',exact:true}).click();await page.waitForFunction(()=>window.__reactDanceMoves && !window.__reactDanceMoves.destroyed);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'rudiments',exact:true}).click();await page.waitForSelector('.motion-tile');const snapshot=await page.evaluate(()=>window.__reactDanceMoves.rudiments.snapshot());checks.push('reduced-motion preference applied; snapshot captured');
 await page.screenshot({path:evidence+'/react-reduced-motion.png',fullPage:true});assert.deepEqual(errors,[]);
 fs.writeFileSync(evidence+'/react.json',JSON.stringify({status:'PASS',checks,errors,snapshot,browserChannel:channel||'bundled-chromium',limits:'Desktop browser simulation; not physical sensor/performance evidence'},null,2));
}catch(error){fs.writeFileSync(evidence+'/react.json',JSON.stringify({status:'FAIL',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();child.kill();fs.writeFileSync(evidence+'/react-server.log',serverLog);}
