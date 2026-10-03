import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createOrientationController} from '../../src/orientation.mjs';
import {createScope} from '../../src/scope.mjs';
import {environment} from './fake-dom.mjs';
const Core=createRequire(import.meta.url)('../../assets/ks-epk-device-orientation-core.js');
const key='dancemoves:phone-motion:v1';
function mount(storage, {reduced=false, forced=false, result='granted'}={}) {
  const e=environment();let requests=0;const samples=[];
  e.host.DeviceOrientationEvent={requestPermission:async()=>{requests++;return result;}};
  e.host.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  e.host.matchMedia('(prefers-reduced-motion: reduce)').matches=reduced;
  e.host.matchMedia('(forced-colors: active)').matches=forced;
  const s=createScope(e.root,{});s.window.KSEpkOrientationCore=Core;
  const controller=createOrientationController(s,{render:sample=>samples.push(sample)});
  return {...e,s,controller,samples,requests:()=>requests};
}
test('preference restores across documents without a permission request; disable persists',async()=>{
  const storage=new Map(),first=mount(storage);
  assert.equal(first.controller.snapshot().listening,false);
  await first.controller.enable();assert.equal(storage.get(key),'enabled');first.s.dispose();
  assert.equal(storage.get(key),'enabled','teardown is not an opt-out');
  const next=mount(storage);assert.equal(next.controller.snapshot().listening,true);assert.equal(next.requests(),0);
  next.controller.disable();assert.equal(storage.get(key),'disabled');next.s.dispose();
  const disabled=mount(storage);assert.equal(disabled.controller.snapshot().listening,false);disabled.s.dispose();
});
test('restoration respects accessibility and visibility and does not mistake null data for readings',()=>{
  const storage=new Map([[key,'enabled']]);
  for(const options of [{reduced:true},{forced:true}]){const e=mount(storage,options);assert.equal(e.controller.snapshot().listening,false);e.s.dispose();}
  const e=mount(storage);const event=new Event('deviceorientation');event.beta=null;event.gamma=null;
  e.host.dispatchEvent(event);e.advance();assert.equal(e.samples.length,0);
  e.doc.hidden=true;e.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(e.controller.snapshot().listening,false);
  e.doc.hidden=false;e.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(e.controller.snapshot().listening,true);
  e.s.dispose();assert.equal(e.frames.size,0);
});
test('denied permission stops restored input and storage failures remain usable',async()=>{
  const storage=new Map([[key,'enabled']]),denied=mount(storage,{result:'denied'});
  await assert.rejects(denied.controller.enable(),/denied/);assert.equal(denied.controller.snapshot().listening,false);assert.equal(storage.get(key),'disabled');denied.s.dispose();
  const e=mount({get(){throw new Error('blocked');},set(){throw new Error('blocked');}});
  await e.controller.enable();assert.equal(e.controller.snapshot().listening,true);e.controller.disable();assert.equal(e.controller.snapshot().listening,false);e.s.dispose();
});
