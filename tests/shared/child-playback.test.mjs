import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPlaybackPublisher,createPlaybackReceiver} from '../../src/child-playback.mjs';
const origin='https://example.test',channel='watch',assetId='original-fixture';
function host() {
  const window=new EventTarget(),document=new EventTarget(),timers=new Map();let serial=0,time=0;
  class Observer {observe(){}disconnect(){this.disconnected=true;}}
  Object.assign(document,{hidden:false,documentElement:new EventTarget()});
  Object.assign(window,{document,crypto:{randomUUID},performance:{now:()=>time},Event,EventTarget,MutationObserver:Observer,
    setTimeout(callback,delay){const id=++serial;timers.set(id,{callback,at:time+delay});return id;},clearTimeout(id){timers.delete(id);}});
  window.advance=ms=>{time+=ms;for(const [id,item] of [...timers])if(item.at<=time){timers.delete(id);item.callback();}};
  window.timers=timers;return window;
}
function message(target,source,data,eventOrigin=origin) {const event=new Event('message');Object.defineProperties(event,{source:{value:source},origin:{value:eventOrigin},data:{value:data}});target.dispatchEvent(event);}
function setup({allowPlayCommands=false}={}) {
  const parent=host(),child=host(),parentProxy={},childProxy={},messages=[];
  parentProxy.postMessage=data=>{messages.push({to:'parent',data});queueMicrotask(()=>message(parent,childProxy,data));};
  childProxy.postMessage=data=>{messages.push({to:'child',data});queueMicrotask(()=>message(child,parentProxy,data));};
  const iframe=Object.assign(new EventTarget(),{tagName:'IFRAME',contentWindow:childProxy,isConnected:true});
  const source=Object.assign(new EventTarget(),{currentTime:0,duration:30,playbackRate:1,paused:true,ended:false,seeking:false,error:null,
    pause(){this.paused=true;this.dispatchEvent(new Event('pause'));},play(){this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}});
  const sender=createPlaybackPublisher({source,window:child,targetWindow:parentProxy,origin,channel,assetId,allowPlayCommands});
  const receiver=createPlaybackReceiver({iframe,window:parent,origin,channel,assetId});
  return {parent,child,parentProxy,childProxy,iframe,source,sender,receiver,messages};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const playing=async env=>{env.source.currentTime=3;await env.source.play();await flush();};
test('actual state, pause, seek, rate, buffering and end cross one explicit child boundary',async()=>{
  const env=setup({allowPlayCommands:true});await flush();await env.receiver.ready;
  const events=[];for(const type of ['play','pause','seeking','seeked','ratechange','waiting','ended'])env.receiver.player.addEventListener(type,()=>events.push(type));
  await playing(env);assert.equal(env.receiver.player.paused,false);assert.equal(env.receiver.player.currentTime,3);
  env.parent.advance(200);assert.equal(env.receiver.player.currentTime,3.2);
  env.receiver.player.pause();await flush();assert.equal(env.source.paused,true);assert.equal(env.receiver.player.paused,true);
  env.source.seeking=true;env.source.currentTime=12;env.source.dispatchEvent(new Event('seeking'));await flush();
  env.source.seeking=false;env.source.dispatchEvent(new Event('seeked'));env.source.playbackRate=1.5;env.source.dispatchEvent(new Event('ratechange'));await flush();
  assert.equal(env.receiver.player.currentTime,12);assert.equal(env.receiver.player.playbackRate,1.5);
  env.receiver.player.currentTime=17;await flush();assert.equal(env.source.currentTime,17);
  await env.receiver.player.play();await flush();assert.equal(env.source.paused,false);
  env.source.dispatchEvent(new Event('waiting'));await flush();assert.equal(env.receiver.player.paused,true);
  env.source.ended=true;env.source.paused=true;env.source.currentTime=30;env.source.dispatchEvent(new Event('ended'));await flush();assert.equal(env.receiver.player.ended,true);
  for(const event of ['play','pause','seeking','seeked','ratechange','waiting','ended'])assert.ok(events.includes(event),event);
  env.receiver.teardown();env.sender.teardown();assert.equal(env.parent.timers.size,0);assert.equal(env.child.timers.size,0);
});
test('reject foreign origin, sibling frame, wrong asset, malformed numbers and replayed sessions',async()=>{
  const env=setup();await flush();await playing(env);
  const packet=env.messages.findLast(item=>item.to==='parent'&&item.data.type==='state').data;
  const forged={...packet,sequence:packet.sequence+1,state:{...packet.state,time:20}};
  message(env.parent,env.childProxy,forged,'https://wrong.test');message(env.parent,{},forged);
  message(env.parent,env.childProxy,{...forged,assetId:'wrong'});
  message(env.parent,env.childProxy,{...forged,state:{...forged.state,time:NaN}});
  message(env.parent,env.childProxy,{...forged,state:{...forged.state,paused:'false'}});
  message(env.parent,env.childProxy,{...forged,session:randomUUID()});
  message(env.parent,env.childProxy,{...forged,sequence:packet.sequence});
  assert.equal(env.receiver.player.currentTime,3);
  env.iframe.dispatchEvent(new Event('load'));await flush();
  message(env.parent,env.childProxy,forged);assert.equal(env.receiver.player.currentTime,3);
  env.receiver.teardown();env.sender.teardown();
});
test('lost child data stops the source and bounded interpolation cannot run indefinitely',async()=>{
  const env=setup();await flush();await playing(env);env.parent.advance(600);
  assert.equal(env.receiver.player.currentTime,3.5);env.parent.advance(1000);
  assert.equal(env.receiver.player.paused,true);assert.equal(env.receiver.snapshot().status,'stale');
  env.receiver.teardown();env.sender.teardown();
});
test('parent play is opt-in and command failures are observable',async()=>{
  const env=setup();await flush();await assert.rejects(env.receiver.player.play(),/rejected/);assert.equal(env.source.paused,true);
  env.receiver.teardown();env.sender.teardown();
});
test('visibility and pagehide pause media; reconnect uses a new session and teardown is idempotent',async()=>{
  const env=setup();await flush();await playing(env);
  env.parent.document.hidden=true;env.parent.document.dispatchEvent(new Event('visibilitychange'));await flush();
  assert.equal(env.source.paused,true);assert.equal(env.receiver.player.paused,true);
  env.parent.document.hidden=false;env.parent.document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(env.receiver.snapshot().connected,true);
  await playing(env);env.child.dispatchEvent(new Event('pagehide'));await flush();assert.equal(env.receiver.player.paused,true);assert.equal(env.source.paused,true);
  env.child.dispatchEvent(new Event('pageshow'));await flush();assert.equal(env.receiver.snapshot().connected,true);
  env.receiver.teardown();env.receiver.teardown();env.sender.teardown();env.sender.teardown();await flush();
  for(const controller of [env.receiver,env.sender]){assert.equal(controller.snapshot().listeners,0);assert.equal(controller.snapshot().timers,0);}
});
test('wildcard/opaque origin and invalid protocol identity cannot mount',()=>{
  for(const bad of ['*','null','https://example.test/path','https://example.test/'])assert.throws(()=>createPlaybackReceiver({window:host(),channel,assetId,origin:bad}));
  assert.throws(()=>createPlaybackPublisher({window:host(),channel:'',assetId,origin}));
});
test('state storm remains bounded; disconnect rejects late packets and reconnect rotates identity',async()=>{
 const env=setup();await flush();await playing(env);
 const packet=env.messages.findLast(item=>item.to==='parent'&&item.data.type==='state').data;
 for(let i=1;i<=2000;i++)message(env.parent,env.childProxy,{...packet,sequence:packet.sequence+i});
 assert.equal(env.parent.timers.size,1);assert.ok(env.receiver.snapshot().listeners<10);
 message(env.parent,env.childProxy,{...packet,type:'disconnect'});
 message(env.parent,env.childProxy,{...packet,sequence:packet.sequence+3000});assert.equal(env.receiver.player.paused,true);
 env.receiver.reconnect();await flush();assert.equal(env.receiver.snapshot().connected,true);
 env.receiver.teardown();env.sender.teardown();
});
test('child can request modal dismissal without a playback event',async()=>{
 const env=setup();await flush();let dismissed=0;env.receiver.player.addEventListener('dismiss',()=>dismissed++);
 env.sender.requestClose();await flush();assert.equal(dismissed,1);assert.equal(env.receiver.player.paused,true);
 env.receiver.teardown();env.sender.teardown();
});
