import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {environment} from './fake-dom.mjs';
import {createScope} from '../../src/scope.mjs';
import {transformOwnedOperations} from '../../tools/build-modules.mjs';

function fixture() {
  const e=environment();
  e.host.matchMedia('(hover: hover) and (pointer: fine)').matches=true;
  let top=100, reads=0;
  e.root.getBoundingClientRect=()=>{reads++;return {left:20,top,width:400,height:300};};
  const scope=createScope(e.root,{});
  scope.window.DanceMoves={};
  const source=fs.readFileSync(new URL('../../assets/dance-moves-effects.js',import.meta.url),'utf8');
  const code=transformOwnedOperations(source,'assets/dance-moves-effects.js');
  vm.runInNewContext('(function(__dmScope){const window=__dmScope.window,document=__dmScope.document;const {CustomEvent,ResizeObserver}=window;'+code+'\n})',{console})(scope);
  const pointer=scope.window.DanceMovesEffects.pointer({root:e.root,target:e.root,bounds:e.root});
  function move(x=60,y=top+30){const event=new Event('pointermove');Object.assign(event,{clientX:x,clientY:y});e.root.dispatchEvent(event);e.advance();}
  return {e,scope,pointer,move,setTop:v=>{top=v;},reads:()=>reads};
}

test('scroll refreshes translated bounds without reading geometry on every scroll',()=>{
  const f=fixture();f.move();assert.equal(f.pointer.snapshot().y,-.8);
  const before=f.reads();f.setTop(0);
  for(let i=0;i<20;i++)f.e.host.dispatchEvent(new Event('scroll'));
  assert.equal(f.reads(),before);assert.equal(f.pointer.snapshot().y,0);
  f.move();assert.equal(f.pointer.snapshot().y,-.8);assert.equal(f.reads(),before+1);
  f.scope.dispose();assert.equal(f.e.frames.size,0);
});
test('resize refreshes position even when the target size is unchanged',()=>{
  const f=fixture();f.move();f.setTop(200);f.e.host.dispatchEvent(new Event('resize'));f.move();
  assert.equal(f.pointer.snapshot().y,-.8);f.scope.dispose();
});
test('geometry invalidation cancels an outstanding pointer frame',()=>{
  const f=fixture();const event=new Event('pointermove');Object.assign(event,{clientX:380,clientY:370});f.e.root.dispatchEvent(event);
  assert.equal(f.e.frames.size,1);f.e.host.dispatchEvent(new Event('scroll'));assert.equal(f.e.frames.size,0);
  f.e.advance();assert.equal(f.pointer.snapshot().x,0);f.scope.dispose();
});
test('teardown removes geometry listeners and pending work',()=>{
  const f=fixture();f.move();f.pointer.teardown();const before=f.reads();
  f.e.host.dispatchEvent(new Event('scroll'));f.e.host.dispatchEvent(new Event('resize'));f.e.root.dispatchEvent(new Event('pointerenter'));
  assert.equal(f.reads(),before);assert.equal(f.e.frames.size,0);f.scope.dispose();assert.equal(f.scope.snapshot().listeners,0);
});
