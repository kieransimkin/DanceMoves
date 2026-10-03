/** Compiled runtime, simulated sensor API; finite feedback lifecycle and edge bounds. */
import {chromium} from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const evidence=new URL('../../.build/browser-evidence/control-feedback/',import.meta.url);
await fs.mkdir(evidence,{recursive:true});
const html=`<!doctype html><meta name="viewport" content="width=device-width"><title>Motion control preview</title>
<link rel="stylesheet" href="/lib/dancemoves.css"><style>body{margin:0;background:#171923;color:#eee;font:16px system-ui}main{padding:2rem}</style>
<main class="dmt-epk"><h1>Phone motion</h1><p>Enable tilt effects with the button below.</p></main>
<script type="module">import {createDanceMoves} from '/lib/index.mjs';window.runtime=createDanceMoves({root:document.querySelector('main'),bpm:120,orientation:{adapter:'dmitri-my-talisman'}});</script>`;
const server=http.createServer(async(req,res)=>{
  if(['/lib/index.mjs','/lib/dancemoves.css'].includes(req.url)){
    res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');
    res.end(await fs.readFile(new URL('../..'+req.url,import.meta.url)));
  }else{res.setHeader('Content-Type','text/html');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.DANCEMOVES_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone) Mobile'});
  await context.addInitScript(()=>{window.permissionCalls=0;Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class extends Event{static async requestPermission(){window.permissionCalls++;return 'granted';}}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);await page.waitForFunction(()=>window.runtime);
  const button=page.getByRole('button',{name:'Use phone motion',exact:true});
  const before=await button.boundingBox();
  const pulse=await page.evaluate(()=>{const b=document.querySelector('button');const a=b.getAnimations({subtree:true})[0];a.pause();a.currentTime=0;const low=getComputedStyle(b,'::after').opacity;a.currentTime=1600;return {low,high:getComputedStyle(b,'::after').opacity,color:getComputedStyle(b).getPropertyValue('--dm-attention-color')};});
  assert.ok(Number(pulse.high)>Number(pulse.low));assert.equal(pulse.color,'#ffe066');
  await page.screenshot({path:fileURLToPath(new URL('glow-mobile.png',evidence))});
  await button.press('Enter');assert.equal(await page.evaluate(()=>window.permissionCalls),1);
  assert.equal(await page.locator('.dm-control-spark').count(),18);
  await page.evaluate(()=>document.querySelectorAll('.dm-control-spark').forEach(n=>{const a=n.getAnimations()[0];a.pause();a.currentTime=420;}));
  await page.screenshot({path:fileURLToPath(new URL('sparks-mobile.png',evidence))});
  const after=await page.locator('button').boundingBox();assert.equal(after.height,before.height);
  // The confirmation text may change width; decoration never changes padding/height.
  await page.evaluate(()=>{const e=new Event('deviceorientation');Object.assign(e,{beta:0,gamma:0});window.dispatchEvent(e);});
  await page.waitForFunction(()=>window.runtime.getOrientation().snapshot().active);
  assert.equal(await page.locator('button').count(),0);
  assert.equal(await page.locator('.dm-control-spark').count(),18,'burst outlives disappearing control');
  await page.evaluate(()=>document.querySelectorAll('.dm-control-spark').forEach(n=>n.getAnimations()[0].play()));
  await page.waitForTimeout(1250);assert.equal(await page.locator('.dm-control-spark').count(),0);
  const extents=[];
  for(const viewport of [{width:390,height:844},{width:900,height:1100},{width:1440,height:1000}]){
    await page.setViewportSize(viewport);
    for(const corner of ['top-left','top-right','bottom-left','bottom-right']){
      const result=await page.evaluate(({corner})=>{
        const b=document.createElement('button');b.className='ks-epk-orientation-control';b.textContent='Use phone motion';
        Object.assign(b.style,{left:corner.endsWith('left')?'12px':'auto',right:corner.endsWith('right')?'12px':'auto',top:corner.startsWith('top')?'12px':'auto',bottom:corner.startsWith('bottom')?'12px':'auto'});document.body.append(b);
        const f=window.runtime.orientationCore.createControlFeedback(window,b,{color:'#ffe066'});f.burst();
        const nodes=[...document.querySelectorAll('.dm-control-spark')];let violations=0;const samples=[];
        for(let t=0;t<=1120;t+=40){for(const n of nodes){const a=n.getAnimations()[0];a.pause();a.currentTime=t;const r=n.getBoundingClientRect();if(r.left-4<0||r.top-4<0||r.right+4>innerWidth||r.bottom+4>innerHeight)violations++;}samples.push(t);}
        f.destroy();b.remove();return {corner,violations,samples:samples.length};
      },{corner});assert.equal(result.violations,0);extents.push({...viewport,...result});
    }
  }
  await page.emulateMedia({forcedColors:'active'});await page.reload();await page.waitForFunction(()=>window.runtime);
  await page.getByRole('button',{name:'Use phone motion',exact:true}).click();assert.equal(await page.locator('.dm-control-spark').count(),0);
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.runtime);assert.equal(await page.locator('button').count(),0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await page.waitForFunction(()=>window.runtime);await page.getByRole('button',{name:'Use phone motion',exact:true}).click();await page.evaluate(()=>window.runtime.destroy());assert.equal(await page.locator('.dm-control-spark').count(),0);
  assert.deepEqual(errors,[]);
  const result={browser:browser.version(),pulse,extents,checks:['keyboard click requests permission once','18 finite sparks','sensor activation removes control without truncating burst','terminal cleanup','all corner trajectories include 4px glow padding','forced colours and reduced motion suppression','destroy cleanup'],physicalDevice:'unverified'};
  await fs.writeFile(new URL('result.json',evidence),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
