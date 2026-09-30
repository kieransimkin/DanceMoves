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
 assert.deepEqual(await page.evaluate(()=>window.__danceMovesReadyEvents),[{bubbles:true,version:'3.1.1'}]);checks.push('generic dance-moves-ready event bubbles after runtime readiness');
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
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'rudiments',exact:true}).click();await page.waitForSelector('.motion-tile');const snapshot=await page.evaluate(()=>window.__reactDanceMoves.rudiments.snapshot());checks.push('reduced-motion preference applied; snapshot captured');
 await page.screenshot({path:evidence+'/react-reduced-motion.png',fullPage:true});assert.deepEqual(errors,[]);
 fs.writeFileSync(evidence+'/react.json',JSON.stringify({status:'PASS',checks,errors,snapshot,browserChannel:channel||'bundled-chromium',limits:'Desktop browser simulation; not physical sensor/performance evidence'},null,2));
}catch(error){fs.writeFileSync(evidence+'/react.json',JSON.stringify({status:'FAIL',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser?.close();child.kill();fs.writeFileSync(evidence+'/react-server.log',serverLog);}
