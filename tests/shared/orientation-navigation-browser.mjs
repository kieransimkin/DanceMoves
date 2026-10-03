/** Two real document loads; sensor/permission inputs are explicitly simulated. */
import {chromium} from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=`<!doctype html><meta name="viewport" content="width=device-width"><title>Phone motion navigation test</title>
<main class="dmt-epk" style="padding:2rem"><h1>Phone motion test</h1><a href="/second">Next page</a></main>
<script type="module">import {createDanceMoves} from '/lib/index.mjs';
window.runtime=createDanceMoves({root:document.querySelector('main'),bpm:120,orientation:{adapter:'dmitri-my-talisman'}});</script>`;
const server=http.createServer(async(req,res)=>{
  if(req.url==='/lib/index.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(new URL('../../lib/index.mjs',import.meta.url)));}
  else {res.setHeader('Content-Type','text/html');res.end(html);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true,channel:process.env.DANCEMOVES_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone) Mobile'});
  await context.addInitScript(()=>{
    window.permissionCalls=0;
    Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class extends Event {
      static async requestPermission(){window.permissionCalls++;return 'granted';}
    }});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/first');await page.waitForFunction(()=>window.runtime);
  await page.getByRole('button',{name:'Use phone motion',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.permissionCalls),1);
  await page.getByRole('link',{name:'Next page'}).click();await page.waitForURL(base+'/second');await page.waitForFunction(()=>window.runtime);
  assert.equal(await page.evaluate(()=>window.permissionCalls),0);
  assert.equal(await page.evaluate(()=>window.runtime.getOrientation().snapshot().listening),true);
  await page.waitForTimeout(3600);
  assert.equal(await page.getByRole('button',{name:'Use phone motion',exact:true}).isEnabled(),true);
  await page.evaluate(()=>{const e=new Event('deviceorientation');Object.assign(e,{beta:0,gamma:0});window.dispatchEvent(e);});
  await page.waitForFunction(()=>window.runtime.getOrientation().snapshot().active);
  assert.equal(await page.locator('.ks-epk-orientation-control').count(),0);
  await page.evaluate(()=>window.runtime.destroy());
  assert.equal(await page.evaluate(()=>localStorage.getItem('dancemoves:phone-motion:v1')),'enabled');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.runtime);
  assert.equal(await page.evaluate(()=>window.runtime.getOrientation().snapshot().listening),false);
  assert.equal(await page.locator('.ks-epk-orientation-control').count(),0);
  assert.deepEqual(errors,[]);
  const result={browser:browser.version(),viewport:'390x844',checks:['gesture stores choice','full-document link navigation restores listening with zero permission requests','absent sensor data leaves a usable enable button','finite simulated reading activates and removes control','teardown retains preference','reduced motion suppresses restored input'],sensorEvidence:'simulated; physical iPhone Safari permission reuse unverified'};
  await fs.mkdir(new URL('../../.build/browser-evidence/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL('../../.build/browser-evidence/orientation-navigation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
