/** Actual painted consumers; permission and sensor delivery are explicitly simulated. */
import {chromium} from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=legacy=>`<!doctype html><meta name="viewport" content="width=device-width"><title>Phone input consumers</title><link rel="stylesheet" href="/lib/styles/dance-moves-core.css"><style>body{min-height:300vh}#card{padding:6rem;transform:perspective(900px) rotateY(calc(var(--dance-moves-x,0)*3deg))}button{min-height:44px}</style><main id="root" class="${legacy?'dmt-epk':''}"><h1>Phone input</h1><div id="card">A bounded card</div></main><script type="module">import {createDanceMoves} from '/lib/index.mjs';const root=document.querySelector('main');window.runtime=createDanceMoves({root,${legacy?"orientation:{adapter:'dmitri-my-talisman'},":''}bpm:120});await runtime.ready;runtime.effects.pointer({id:'cover',root,bounds:document.querySelector('#card'),target:document.querySelector('#card')});runtime.effects.quality({id:'budget',root,tiers:['full','light','static'],render:s=>root.dataset.quality=s.tier});window.connection=runtime.connectPhoneMotion({pointers:['cover'],enabled:()=>root.dataset.motion!=='off'&&root.dataset.quality!=='static',watchAttributes:['data-motion','data-quality','data-epk-adaptive-tier']});</script>`;
const server=http.createServer(async(req,res)=>{if(req.url==='/lib/styles/dance-moves-core.css'){res.setHeader('Content-Type','text/css');res.end(await fs.readFile(new URL('../../lib/styles/dance-moves-core.css',import.meta.url)));}else if(req.url==='/lib/index.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(new URL('../../lib/index.mjs',import.meta.url)));}else{res.setHeader('Content-Type','text/html');res.end(html(req.url==='/legacy'));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page;const checks=[],errors=[];
try{
 browser=await chromium.launch({headless:true,channel:process.env.DANCEMOVES_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone) Mobile'});
 await context.addInitScript(()=>{window.permissionCalls=0;Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class extends Event{static async requestPermission(){window.permissionCalls++;return 'granted';}}});});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/generic','/legacy']){
  await page.goto(`http://127.0.0.1:${server.address().port}${route}`);await page.waitForFunction(()=>window.connection);
  assert.equal(await page.locator('.ks-epk-orientation-control').count(),1);assert.equal(await page.evaluate(()=>window.permissionCalls),0);
  const control=await page.locator('.ks-epk-orientation-control').evaluate(e=>{const r=e.getBoundingClientRect();return {position:getComputedStyle(e).position,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight};});
  assert.equal(control.position,'fixed');assert.ok(control.top>=0&&control.bottom<=control.height&&control.left>=0&&control.right<=control.width,'permission control remains in the viewport on a long page with only the shared core stylesheet');
  assert.equal(await page.evaluate(()=>scrollY),0);
  checks.push(route+': permission control visible before scrolling with shared core CSS');
  await page.getByRole('button',{name:'Use phone motion',exact:true}).click();assert.equal(await page.evaluate(()=>window.permissionCalls),1);
  await page.evaluate(()=>{const e=new Event('deviceorientation');Object.assign(e,{beta:0,gamma:0});window.dispatchEvent(e);});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{const e=new Event('deviceorientation');Object.assign(e,{beta:12,gamma:10});window.dispatchEvent(e);});
  await page.waitForFunction(()=>Math.abs(Number(getComputedStyle(document.querySelector('#card')).getPropertyValue('--dance-moves-x')))>.1);
  assert.notEqual(await page.locator('#card').evaluate(e=>getComputedStyle(e).transform),'none');assert.equal(await page.locator('.ks-epk-orientation-control').count(),0);
  if(route==='/legacy')assert.equal(await page.evaluate(()=>connection.snapshot().source),'existing');
  checks.push(route+': one gesture and sensor owner reach a painted pointer consumer');
  await page.evaluate(()=>document.querySelector('#root').dataset.motion='off');await page.waitForFunction(()=>!connection.snapshot().allowed);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#card')).getPropertyValue('--dance-moves-x'))===0);
  assert.equal(await page.locator('#card').evaluate(e=>Number(getComputedStyle(e).getPropertyValue('--dance-moves-x'))),0);
  await page.evaluate(()=>document.querySelector('#root').dataset.motion='on');await page.waitForFunction(()=>connection.snapshot().allowed);
  await page.evaluate(()=>{window.nativeForcedEvents=0;window.nativeForcedQuery=matchMedia('(forced-colors: active)');nativeForcedQuery.addEventListener('change',()=>window.nativeForcedEvents++);});
  // Let the native media change event reach its listeners before polling MediaQueryList.matches.
  await page.emulateMedia({forcedColors:'active'});await page.waitForTimeout(200);await page.waitForFunction(()=>document.querySelectorAll('.ks-epk-orientation-control').length===0);assert.equal(await page.evaluate(()=>connection.snapshot().allowed),false);
  await page.emulateMedia({forcedColors:'none'});await page.waitForTimeout(200);await page.waitForFunction(()=>connection.snapshot().allowed);
  await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));});assert.equal(await page.evaluate(()=>connection.snapshot().allowed),false);
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.waitForFunction(()=>connection.snapshot().allowed);
  await page.evaluate(()=>document.querySelector('#root').remove());await page.waitForFunction(()=>connection.snapshot().destroyed);assert.equal(await page.locator('.ks-epk-orientation-control').count(),0);
  await page.evaluate(()=>runtime.destroy());checks.push(route+': switch, forced colours, page lifecycle, root removal and cleanup');
 }
 assert.deepEqual(errors,[]);
 await fs.mkdir(new URL('../../.build/browser-evidence/',import.meta.url),{recursive:true});
 await fs.writeFile(new URL('../../.build/browser-evidence/phone-motion.json',import.meta.url),JSON.stringify({status:'PASS',browser:browser.version(),checks,errors,limits:'Synthetic sensor and permission events in Chromium; physical phone/Safari evidence unavailable.'},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks}));
}catch(error){const state=await page?.evaluate(()=>({url:location.href,connection:window.connection?.snapshot(),controls:[...document.querySelectorAll('.ks-epk-orientation-control')].map(e=>({text:e.textContent,html:e.outerHTML})),forced:matchMedia('(forced-colors: active)').matches,nativeForcedEvents:window.nativeForcedEvents,resources:window.runtime.resources()}));await fs.mkdir(new URL('../../.build/browser-evidence/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../../.build/browser-evidence/phone-motion-failure.json',import.meta.url),JSON.stringify({state,errors,error:String(error)},null,2));console.log(JSON.stringify(state));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
