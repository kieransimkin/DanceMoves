import test from 'node:test';
import assert from 'node:assert/strict';
import {installPlayback,validatePlaybackMapping} from '../../src/playback.mjs';
import {createScope} from '../../src/scope.mjs';
import {environment,Element} from './fake-dom.mjs';
function fixture(){
  const env=environment();
  const master=new Element(env.doc,'audio');
  Object.assign(master,{duration:120,currentTime:0,paused:true,ended:false,playbackRate:1,seeking:false,src:'https://example.invalid/master.mp3',pause(){this.paused=true;this.dispatchEvent(new Event('pause'));},play(){this.paused=false;this.dispatchEvent(new Event('play'));}});
  env.root.append(master);
  const scope=createScope(env.root,{},{legacyGlobals:false}),api={config:{masterDurationMilliseconds:120000}};
  installPlayback(scope,api,env.host);
  return {...env,master,scope,api};
}
function video(env){const v=new Element(env.doc,'video');Object.assign(v,{duration:20,currentTime:0,paused:true,ended:false,playbackRate:1,seeking:false,pause(){this.paused=true;this.dispatchEvent(new Event('pause'));},play(){this.paused=false;this.dispatchEvent(new Event('play'));}});env.root.append(v);return v;}
test('clip times map to exact master coordinates and mapped seeks remain within the clip',()=>{
  const env=fixture(),v=video(env);const handle=env.api.registerPlayer({master:env.master,player:v,masterVerified:true,offset:48,duration:20});
  v.currentTime=3;v.play();assert.equal(handle.source.currentTime,51);assert.equal(handle.source.duration,120);assert.equal(handle.source.paused,false);
  handle.source.currentTime=60;assert.equal(v.currentTime,12);handle.source.currentTime=2;assert.equal(v.currentTime,0);handle.source.currentTime=100;assert.equal(v.currentTime,20);env.scope.dispose();
});
test('switching full and partial players pauses the prior transport without playing silent duplicate audio',()=>{
  const env=fixture(),v=video(env),source=env.api.playbackSource(env.master);env.master.play();assert.equal(source.activePlayer,env.master);
  env.api.registerPlayer({master:env.master,player:v,masterVerified:true,offset:35,duration:20});v.currentTime=4;v.play();assert.equal(env.master.paused,true);assert.equal(source.currentTime,39);assert.equal(source.activePlayer,v);
  env.master.currentTime=10;env.master.play();assert.equal(v.paused,true);assert.equal(source.currentTime,10);assert.equal(source.activePlayer,env.master);env.scope.dispose();
});
test('equal duration never supplies a master identity and invalid windows are refused',()=>{
  const env=fixture(),v=video(env);assert.throws(()=>env.api.registerPlayer({master:env.master,player:v,offset:0,duration:120}),/verified master/);
  for(const mapping of [{offset:-1,duration:2},{offset:119,duration:2},{offset:0,duration:0},{offset:NaN,duration:2},{offset:0,duration:Infinity}])assert.throws(()=>validatePlaybackMapping(mapping,120),RangeError);
  assert.deepEqual(validatePlaybackMapping({offset:0,duration:120},120),{offset:0,duration:120,playerStart:0,masterDuration:120});env.scope.dispose();
});
test('preroll and postroll do not acquire a song clock',()=>{
  const env=fixture(),v=video(env),handle=env.api.registerPlayer({master:env.master,player:v,masterVerified:true,offset:10,duration:5,playerStart:2});v.play();assert.equal(handle.source.paused,true);
  v.currentTime=3;assert.equal(handle.source.currentTime,11);assert.equal(handle.source.paused,false);v.currentTime=8;assert.equal(handle.source.currentTime,15);assert.equal(handle.source.paused,true);env.scope.dispose();
});
test('teardown prevents a removed player reacquiring the group and leaves no owned listeners',()=>{
  const env=fixture(),v=video(env),handle=env.api.registerPlayer({master:env.master,player:v,masterVerified:true,offset:0,duration:20});v.play();handle.teardown();v.play();assert.equal(handle.source.activePlayer,env.master);env.scope.dispose();assert.equal(env.scope.snapshot().listeners,0);assert.equal(env.scope.snapshot().frames,0);assert.throws(()=>env.api.playbackSource(env.master),/destroyed/);
});
test('a player has one owner, can remount after teardown and cannot cross runtime roots',()=>{
  const env=fixture(),v=video(env),settings={master:env.master,player:v,masterVerified:true,offset:0,duration:20};const owner=env.api.registerPlayer(settings);
  assert.throws(()=>env.api.registerPlayer(settings),/already has/);owner.teardown();assert.doesNotThrow(()=>env.api.registerPlayer(settings));
  const outside=new Element(env.doc,'audio');env.doc.body.append(outside);assert.throws(()=>env.api.playbackSource(outside),/runtime root/);env.scope.dispose();
});
test('a video-only page uses an explicit master identity and duration without hidden audio playback',async()=>{
  const env=fixture(),v=video(env),reference={id:'synthetic-master:v1',duration:120};let registeredSource;
  env.api.registerPlaybackSource=source=>{registeredSource=source;};const handle=env.api.registerPlayer({master:reference,player:v,masterVerified:true,offset:48,duration:20});await Promise.resolve();
  assert.equal(registeredSource,handle.source);assert.equal(handle.source.element,null);v.currentTime=4;v.play();assert.equal(handle.source.currentTime,52);assert.equal(handle.source.masterId,reference.id);assert.equal(env.master.paused,true);env.scope.dispose();
});
test('an unloaded native master and its verified reference keep one stable transport',()=>{
  const env=fixture();env.api.config.masterDurationMilliseconds=0;env.master.duration=NaN;const source=env.api.playbackSource(env.master),v=video(env);
  const reference={id:'synthetic-master:v1',duration:120,element:env.master};const owner=env.api.registerPlayer({master:reference,player:v,masterVerified:true,offset:48,duration:20});assert.equal(owner.source,source);assert.equal(source.duration,120);v.currentTime=2;v.play();assert.equal(source.currentTime,50);assert.throws(()=>env.api.playbackSource({...reference,duration:121}),/Conflicting/);env.scope.dispose();
});
test('YouTube states, seeks, buffering, rate and cleanup use the same source',async()=>{
  const env=fixture();let callbacks,time=0,rate=1,destroyed=false;
  env.host.YT={Player:class {constructor(iframe,options){callbacks=options.events;queueMicrotask(()=>callbacks.onReady());}getVideoUrl(){return 'https://www.youtube.com/watch?v=ABCDEFGHIJK';}getCurrentTime(){return time;}getPlaybackRate(){return rate;}pauseVideo(){callbacks.onStateChange({data:2});}playVideo(){callbacks.onStateChange({data:1});}seekTo(value){time=value;}destroy(){destroyed=true;}}};
  const iframe=new Element(env.doc,'iframe');iframe.src='https://www.youtube.com/embed/ABCDEFGHIJK';env.root.append(iframe);
  const handle=env.api.registerYouTube({iframe,master:env.master,masterVerified:true,offset:40,duration:20});await handle.ready;
  assert.match(iframe.src,/enablejsapi=1/);assert.match(iframe.src,/origin=/);
  let seeks=0;handle.source.addEventListener('seeked',()=>seeks++);
  callbacks.onStateChange({data:1});time=2;env.advance();assert.equal(handle.source.currentTime,42);assert.equal(handle.source.paused,false);
  time=10;env.advance();assert.ok(seeks>=1);rate=1.5;callbacks.onPlaybackRateChange();assert.equal(handle.source.playbackRate,1.5);
  callbacks.onStateChange({data:3});assert.equal(handle.source.paused,true);assert.equal(handle.snapshot().polling,false);
  callbacks.onStateChange({data:1});assert.equal(handle.snapshot().polling,true);handle.teardown();assert.equal(destroyed,true);assert.equal(handle.snapshot().polling,false);env.scope.dispose();assert.equal(env.scope.snapshot().frames,0);
});
test('a different YouTube asset never continues the master clock and hidden pages suspend sampling',async()=>{
  const env=fixture();let callbacks,id='ABCDEFGHIJK';
  env.host.YT={Player:class {constructor(iframe,options){callbacks=options.events;queueMicrotask(()=>callbacks.onReady());}getVideoUrl(){return 'https://www.youtube.com/watch?v='+id;}getCurrentTime(){return 2;}getPlaybackRate(){return 1;}pauseVideo(){callbacks.onStateChange({data:2});}destroy(){}}};
  const iframe=new Element(env.doc,'iframe');iframe.src='https://www.youtube.com/embed/ABCDEFGHIJK';env.root.append(iframe);const handle=env.api.registerYouTube({iframe,master:env.master,masterVerified:true,offset:40,duration:20});await handle.ready;
  callbacks.onStateChange({data:1});assert.equal(handle.snapshot().polling,true);env.doc.hidden=true;env.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(handle.snapshot().polling,false);env.doc.hidden=false;env.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(handle.snapshot().polling,true);
  env.host.dispatchEvent(new Event('pagehide'));assert.equal(handle.snapshot().polling,false);env.host.dispatchEvent(new Event('pageshow'));assert.equal(handle.snapshot().polling,true);
  id='LMNOPQRSTUV';callbacks.onStateChange({data:1});assert.equal(handle.source.paused,true);assert.equal(handle.snapshot().polling,false);assert.match(handle.snapshot().error.message,/verified soundtrack/);env.scope.dispose();
});
