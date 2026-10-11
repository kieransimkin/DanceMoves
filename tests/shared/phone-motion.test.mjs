import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {environment} from './fake-dom.mjs';
import {createScope} from '../../src/scope.mjs';
import {connectPhoneMotion} from '../../src/phone-motion.mjs';
const Core=createRequire(import.meta.url)('../../assets/ks-epk-device-orientation-core.js');
function setup({mobile=true,permission=true,result='granted',stored=null}={}){
 const e=environment(),storage=new Map(stored?[['dancemoves:phone-motion:v1',stored]]:[]),samples=[],pointer=[],observers=[];
 e.host.MutationObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 e.host.navigator={userAgent:mobile?'Android Mobile':'Desktop',maxTouchPoints:mobile?1:0};
 e.host.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 let requests=0;e.host.DeviceOrientationEvent=permission?{requestPermission:async()=>{requests++;return result;}}:function(){};
 const scope=createScope(e.root,{});scope.window.KSEpkOrientationCore=Core;
 scope.window.DanceMoves={root:e.root,getOrientation:()=>null};scope.window.DanceMovesEffects={get:id=>id==='cover'?{set:(x,y)=>pointer.push([x,y]),reset:()=>pointer.push([0,0])}:null};
 let allowed=true;
 const connection=connectPhoneMotion(scope,{pointers:['cover'],enabled:()=>allowed,render:p=>samples.push(p)});
 return {...e,scope,storage,samples,pointer,observers,connection,requests:()=>requests,setAllowed:v=>{allowed=v;connection.reconcile();}};
}
function event(e,beta,gamma){const s=new Event('deviceorientation');Object.assign(s,{beta,gamma});e.host.dispatchEvent(s);e.advance();}
test('desktop bridge has no control, sensor listeners or appearance writes',()=>{
 const e=setup({mobile:false});assert.equal(e.connection.snapshot().eligible,false);assert.equal(e.samples.length,0);assert.equal(e.doc.body.querySelector('button'),null);assert.equal(e.scope.snapshot().listeners,0);e.scope.dispose();
});
test('permission is requested only by enable; finite samples fan out and remove control',async()=>{
 const e=setup();assert.equal(e.requests(),0);assert.equal(e.connection.snapshot().orientation.listening,false);assert.equal(e.doc.body.querySelector('button').textContent,'Use phone motion');
 await e.connection.enable();assert.equal(e.requests(),1);event(e,null,null);assert.equal(e.connection.snapshot().sensorActive,false);
 event(e,0,0);event(e,15,-10);assert.equal(e.connection.snapshot().sensorActive,true);assert.equal(e.doc.body.querySelector('button'),null);
 assert.ok(e.pointer.some(([x,y])=>x!==0||y!==0));assert.ok(e.samples.every(s=>Math.abs(s.x)<=1&&Math.abs(s.y)<=1));
 e.setAllowed(false);assert.equal(e.connection.snapshot().orientation.listening,false);assert.deepEqual(e.pointer.at(-1),[0,0]);assert.equal(e.storage.get('dancemoves:phone-motion:v1'),'enabled');
 e.setAllowed(true);assert.equal(e.connection.snapshot().orientation.listening,true);assert.equal(e.requests(),1);
 e.scope.dispose();assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);assert.equal(e.doc.body.querySelector('button'),null);
});
test('Android direct input; denied and unavailable sensor states remain honest',async()=>{
 const android=setup({permission:false});await Promise.resolve();assert.equal(android.connection.snapshot().orientation.listening,true);android.scope.dispose();
 const denied=setup({result:'denied'});assert.equal(await denied.connection.enable(),false);assert.equal(denied.connection.snapshot().orientation.listening,false);assert.equal(denied.doc.body.querySelector('button').textContent,'Phone motion blocked');denied.scope.dispose();
 const missing=setup({stored:'enabled'});for(const [id,t] of [...missing.timers]){if(t.ms===3500){missing.timers.delete(id);t.fn();}}assert.equal(missing.doc.body.querySelector('button').disabled,false);assert.equal(missing.connection.snapshot().sensorActive,false);missing.scope.dispose();
});
test('preferences, pagehide and screen rotation cancel pending input without opting out',async()=>{
 const e=setup({stored:'enabled'});event(e,0,0);event(e,10,10);
 e.host.dispatchEvent(new Event('pagehide'));assert.equal(e.connection.snapshot().orientation.listening,false);assert.deepEqual(e.pointer.at(-1),[0,0]);
 e.host.dispatchEvent(new Event('pageshow'));assert.equal(e.connection.snapshot().orientation.listening,true);
 e.host.screen.orientation.dispatchEvent(new Event('change'));assert.deepEqual(e.pointer.at(-1),[0,0]);
 for(const query of ['(prefers-reduced-motion: reduce)','(forced-colors: active)']){const media=e.host.matchMedia(query);media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(e.connection.snapshot().orientation.listening,false);assert.equal(e.doc.body.querySelector('button'),null);assert.equal(await e.connection.enable(),false);media.matches=false;media.dispatchEvent(new Event('change'));}
 assert.equal(e.storage.get('dancemoves:phone-motion:v1'),'enabled');assert.equal(e.requests(),0);e.scope.dispose();
});
test('existing provider is reused with one subscriber and no second permission control',()=>{
 const e=environment();e.host.navigator={userAgent:'Android Mobile',maxTouchPoints:1};e.host.DeviceOrientationEvent=function(){};
 const scope=createScope(e.root,{});scope.window.KSEpkOrientationCore=Core;let callback,removed=0,suspended=[];const samples=[];
 const existing={subscribe(fn){callback=fn;return()=>{removed++;};},suspend:v=>suspended.push(v),snapshot:()=>({listening:true})};
 scope.window.DanceMoves={root:e.root,getOrientation:()=>existing};scope.window.DanceMovesEffects={get:()=>null};
 const connection=connectPhoneMotion(scope,{render:p=>samples.push(p)});callback({x:.6,y:-.5,reason:'phone'});assert.equal(connection.snapshot().source,'existing');assert.equal(samples.at(-1).x,.6);assert.equal(e.doc.body.querySelector('button'),null);
 const reduced=e.host.matchMedia('(prefers-reduced-motion: reduce)');reduced.matches=true;reduced.dispatchEvent(new Event('change'));assert.equal(suspended.at(-1),true);assert.equal(samples.at(-1).x,0);connection.destroy();assert.equal(removed,1);scope.dispose();
});

test('one owner per mount; pointer remount and root removal release pending input',async()=>{
 const e=setup({stored:'enabled'});
 assert.throws(()=>connectPhoneMotion(e.scope),/already connected/);
 event(e,0,0);event(e,10,10);
 const remounted=[];e.scope.window.DanceMovesEffects.get=()=>({set:(x,y)=>remounted.push([x,y]),reset:()=>remounted.push([0,0])});
 event(e,-10,-10);assert.ok(remounted.some(([x,y])=>x!==0||y!==0));
 e.root.isConnected=false;e.observers.at(-1).callback([{type:'childList'}]);
 assert.equal(e.connection.snapshot().destroyed,true);assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);assert.equal(e.doc.body.querySelector('button'),null);
 const last=e.samples.length;event(e,45,45);assert.equal(e.samples.length,last);e.scope.dispose();
});
