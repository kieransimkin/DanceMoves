import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {environment, Element} from './fake-dom.mjs';
import {createScope} from '../../src/scope.mjs';
import {createRecordingService} from '../../src/recordings.mjs';
import {createSpectrumService} from '../../src/spectrum.mjs';
import {createSpectrumRecording} from '../fixtures/spectrum-recording.mjs';

// Lifecycle tests use the real native sampler and loader with a deliberately
// limited scheduler/Canvas double. Actual rendering is in spectrum-browser.mjs.
function fixture({fetch, config = {}, source, withoutResizeObserver = false} = {}) {
 const e=environment(), requests=[], signals=[], drivers=new Map(),mutationObservers=[];
 const Observer=e.host.MutationObserver;
 e.host.MutationObserver=class extends Observer {constructor(callback){super(callback);mutationObservers.push(this);}};
 let installed=0;
 e.host.fetch=async (url,options={})=>{
  requests.push(String(url));signals.push(options.signal);
  return fetch?fetch(url,options):new Response(JSON.stringify(createSpectrumRecording()));
 };
 if(withoutResizeObserver)e.host.ResizeObserver=undefined;
 const settings={bpm:150,...config},scope=createScope(e.root,settings);
 const audio=source||Object.assign(new Element(e.doc,'audio'),{
  currentTime:0,paused:true,ended:false,playbackRate:1,seeking:false,
  src:'http://localhost:4173/synthetic.wav',duration:10
 });
 if(audio.nodeType===1)e.root.append(audio);
 const runtime={playbackSource:()=>audio};
 runtime.rudiments={
  get:id=>drivers.get(id)?.handle||null,
  animate(options){
   installed++;
   let destroyed=false,paused=false,enabled=options.enabled!==false,status='loading';
   const emit=reason=>{
    if(destroyed)return;
    status=reason;
    options.render({audio,reason,sourceBeats:audio.currentTime*settings.bpm/60,
     rhythmicBeats:900+audio.currentTime,position:{x:0,y:0,z:0}});
   };
   const refresh=()=>{if(!destroyed&&!paused)emit(enabled?(audio.paused?'audio-paused':'frame'):'disabled');};
   const handle={ready:null,destroy(){destroyed=true;status='destroyed';drivers.delete(options.id);},
    pause(){paused=true;status='paused';},resume(){paused=false;refresh();},refresh,
    setEnabled(value){enabled=value;refresh();},snapshot:()=>({status,destroyed,error:null})};
   drivers.set(options.id,{handle,emit});handle.ready=Promise.resolve().then(refresh);
   return handle;
  }
 };
 runtime.recordings=createRecordingService(scope,runtime.rudiments,settings);
 runtime.spectrum=createSpectrumService(scope,runtime,settings);
 function canvas({width=400,height=220}={}){
  const target=new Element(e.doc,'canvas'),figure=new Element(e.doc,'figure'),calls=[],status=new Element(e.doc,'p');
  status.textContent='Page fallback';figure.append(target,status);
  figure.querySelector=()=>status;
  let size={width,height};
  const context=new Proxy({}, {get(object,key){
   if(!(key in object))object[key]=(...args)=>{calls.push([key,...args]);};
   return object[key];
  }});
  target.getContext=()=>context;
  target.getBoundingClientRect=()=>size;
  target.closest=()=>figure;
  target.setAttribute('width','300');target.setAttribute('height','150');
  target.setAttribute('role','presentation');target.setAttribute('aria-label','Page spectrum');
  Object.defineProperties(target,{
   width:{get:()=>Number(target.getAttribute('width')||300)},
   height:{get:()=>Number(target.getAttribute('height')||150)}
  });
  e.root.append(figure);
  return {target,calls,status,resize:(w,h)=>{size={width:w,height:h};e.host.dispatchEvent(new Event('resize'));}};
 }
 return {...e,scope,runtime,audio,requests,signals,drivers,mutationObservers,canvas,installed:()=>installed};
}
function options(f,c,id,extra={}) {
 return {id,target:c.target,audio:f.audio,recordingUrl:'/spectrum.json',offscreen:false,...extra};
}

test('spectrum setup and a configured page without spectrum canvases request no song data',()=>{
 const f=fixture({config:{spectrumRecordingUrl:'/unused-song.json'}});
 assert.deepEqual(f.runtime.spectrum.mountPage(),[]);
 assert.equal(f.requests.length,0);assert.equal(f.installed(),0);
 assert.equal(f.runtime.spectrum.snapshot().sources,0);
 f.scope.dispose();
});

test('two views share one page request; the last owner releases its native source',async()=>{
 const f=fixture(),a=f.canvas(),b=f.canvas();
 const first=f.runtime.spectrum.animate(options(f,a,'first'));
 const second=f.runtime.spectrum.animate(options(f,b,'second',{renderer:'spectrum-ring'}));
 await Promise.all([first.ready,second.ready]);
 assert.deepEqual(f.requests,['http://localhost:4173/spectrum.json']);
 assert.equal(f.runtime.spectrum.snapshot().sources,1);
 assert.equal(first.snapshot().report.bands.length,4);
 assert.ok(Math.abs(first.snapshot().report.bands[0].rms-.1)<1e-12);
 assert.equal(first.snapshot().report.bands[3].rms,0);
 first.destroy();assert.equal(f.signals[0].aborted,false);
 assert.equal(second.snapshot().destroyed,false);
 second.destroy();assert.equal(f.signals[0].aborted,true);
 assert.equal(f.runtime.spectrum.snapshot().sources,0);
 assert.deepEqual(f.runtime.spectrum.snapshot().instances,[]);
 assert.equal(f.drivers.size,0);f.scope.dispose();
});

test('recording requests belong to each mount and only its selected URL',async()=>{
 const a=fixture(),b=fixture();
 const ca=a.canvas(),cb=b.canvas();
 const ha=a.runtime.spectrum.animate(options(a,ca,'song-a'));
 const hb=b.runtime.spectrum.animate(options(b,cb,'song-b',{recordingUrl:'/second-song.json'}));
 await Promise.all([ha.ready,hb.ready]);
 assert.deepEqual(a.requests,['http://localhost:4173/spectrum.json']);
 assert.deepEqual(b.requests,['http://localhost:4173/second-song.json']);
 a.scope.dispose();assert.equal(a.runtime.spectrum.snapshot().sources,0);
 assert.equal(hb.snapshot().destroyed,false);
 const next=b.runtime.spectrum.animate(options(b,b.canvas(),'another-source'));
 await next.ready;
 assert.deepEqual(b.requests,['http://localhost:4173/second-song.json','http://localhost:4173/spectrum.json']);
 assert.equal(b.runtime.spectrum.snapshot().sources,2);b.scope.dispose();
});

test('destroy aborts pending recording fetch and ignores an uncooperative late response',async()=>{
 let resolve;
 const pending=new Promise(done=>{resolve=done;});
 const f=fixture({fetch:()=>pending}),c=f.canvas();
 const handle=f.runtime.spectrum.animate(options(f,c,'pending'));
 assert.equal(f.requests.length,1);assert.equal(f.signals[0].aborted,false);
 f.scope.dispose();assert.equal(f.signals[0].aborted,true);
 resolve(new Response(JSON.stringify(createSpectrumRecording())));
 await handle.ready;
 assert.equal(handle.snapshot().destroyed,true);assert.equal(f.installed(),0);
 assert.deepEqual(f.runtime.spectrum.snapshot().instances,[]);
 assert.equal(f.runtime.spectrum.snapshot().sources,0);
 for(const key of ['listeners','frames','timers','observers'])assert.equal(f.scope.snapshot()[key],0,key);
});

test('source seconds preserve capture BPM and seek/hold determinism at every playback rate',async()=>{
 const f=fixture({config:{bpm:150}}),c=f.canvas(),recording=createSpectrumRecording();
 recording.clock.beat_zero_seconds=.25;
 const h=f.runtime.spectrum.animate(options(f,c,'source-clock',{recordingUrl:undefined,recording}));
 await h.ready;
 assert.equal(h.snapshot().status,'outside-recording');
 f.audio.currentTime=.5;h.refresh();
 const expected=structuredClone(h.snapshot().report);
 assert.equal(h.snapshot().pip,32,'120 BPM capture ignores the 150 BPM page clock');
 assert.ok(Math.abs(expected.bands[1].rms-.05)<1e-12);
 f.audio.currentTime=.375;h.refresh();assert.equal(h.snapshot().pip,16);
 assert.ok(Math.abs(h.snapshot().report.bands[1].rms-.45)<1e-12);
 f.audio.playbackRate=2;f.audio.currentTime=.5;h.refresh();
 assert.deepEqual(h.snapshot().report,expected);
 h.pause();f.audio.currentTime=1;h.refresh();
 assert.equal(h.snapshot().pip,32,'manual pause holds the last captured position');
 h.resume();assert.equal(h.snapshot().pip,96);
 f.audio.playbackRate=.5;f.audio.currentTime=.5;h.refresh();
 assert.deepEqual(h.snapshot().report,expected);
 f.scope.dispose();
});

test('accessibility, disable and out-of-extent output stays empty instead of calibrating neutral zero',async()=>{
 const f=fixture(),c=f.canvas();
 const h=f.runtime.spectrum.animate(options(f,c,'neutral'));await h.ready;
 const expected=structuredClone(h.snapshot().report);
 for(const reason of ['reduced-motion','forced-colors']){
  f.drivers.get('neutral').emit(reason);
  assert.equal(h.snapshot().report,null,reason+' must not invent RMS energy from a neutral zero');
  assert.equal(h.snapshot().status,reason);
  f.drivers.get('neutral').emit('audio-paused');
  assert.deepEqual(h.snapshot().report,expected);
 }
 h.setEnabled(false);assert.equal(h.snapshot().report,null);
 h.setEnabled(true);assert.deepEqual(h.snapshot().report,expected);
 f.audio.currentTime=9;h.refresh();
 assert.equal(h.snapshot().status,'outside-recording');assert.equal(h.snapshot().report,null);
 f.audio.currentTime=0;h.refresh();assert.deepEqual(h.snapshot().report,expected);
 f.scope.dispose();
});

test('responsive backing buffers are bounded and destroy restores page attributes and status',async()=>{
 const f=fixture({withoutResizeObserver:true});
 const c=f.canvas({width:10000,height:10000});
 const h=f.runtime.spectrum.animate(options(f,c,'size',{pixelRatio:4}));await h.ready;
 assert.ok(c.target.width*c.target.height<=4194304);
 assert.ok(c.calls.some(call=>call[0]==='fillRect'||call[0]==='stroke'));
 // Use a resize-triggering scope without a ResizeObserver to exercise fallback.
 c.resize(320,160);h.refresh();
 assert.equal(c.target.width,1280);assert.equal(c.target.height,640);
 h.destroy();
 assert.equal(c.target.getAttribute('width'),'300');assert.equal(c.target.getAttribute('height'),'150');
 assert.equal(c.target.getAttribute('role'),'presentation');assert.equal(c.target.getAttribute('aria-label'),'Page spectrum');
 assert.equal(c.target.getAttribute('data-dance-moves-spectrum-state'),null);
 assert.equal(c.status.textContent,'Page fallback');
 assert.equal(f.drivers.size,0);assert.equal(f.runtime.spectrum.snapshot().sources,0);
 f.scope.dispose();
 for(const key of ['listeners','frames','timers','observers'])assert.equal(f.scope.snapshot()[key],0,key);
});

test('invalid calibration has a visible error and never installs a movement controller',async()=>{
 const invalid=createSpectrumRecording();invalid.provenance.axes[0].clipped_windows=1;
 const f=fixture({fetch:async()=>new Response(JSON.stringify(invalid))}),c=f.canvas();
 const h=f.runtime.spectrum.animate(options(f,c,'invalid'));
 await assert.rejects(h.ready,/Clipped Fourier axes/);
 assert.equal(h.snapshot().status,'error');assert.match(h.snapshot().error,/Clipped Fourier axes/);
 assert.match(c.status.textContent,/Spectrum unavailable/);
 assert.equal(c.target.getAttribute('data-dance-moves-spectrum-state'),'error');
 assert.equal(f.installed(),0);h.destroy();
 assert.equal(f.runtime.spectrum.snapshot().sources,0);f.scope.dispose();
});

test('elementless shared players cannot switch master identity under retained spectrum data',async()=>{
 const source={currentTime:0,paused:true,ended:false,playbackRate:1,
  masterId:'first-master',masterSourceUrl:'http://localhost:4173/first.wav',element:null};
 const f=fixture({source}),c=f.canvas(),h=f.runtime.spectrum.animate(options(f,c,'identity'));
 await h.ready;assert.ok(h.snapshot().report);
 source.masterId='second-master';source.masterSourceUrl='http://localhost:4173/second.wav';h.refresh();
 assert.equal(h.snapshot().status,'source-mismatch');assert.equal(h.snapshot().report,null);
 f.scope.dispose();
});

test('detaching a canvas releases its source and outer observers without disposing other page work',async()=>{
 const f=fixture(),a=f.canvas(),b=f.canvas();
 const first=f.runtime.spectrum.animate(options(f,a,'detach-a'));
 const second=f.runtime.spectrum.animate(options(f,b,'detach-b'));
 await Promise.all([first.ready,second.ready]);
 a.target.remove();
 for(const observer of f.mutationObservers)if(!observer.disconnected)observer.callback([{type:'childList'}]);
 assert.equal(first.snapshot().destroyed,true);assert.equal(second.snapshot().destroyed,false);
 assert.equal(f.runtime.spectrum.snapshot().sources,1);
 b.target.remove();
 for(const observer of f.mutationObservers)if(!observer.disconnected)observer.callback([{type:'childList'}]);
 assert.equal(second.snapshot().destroyed,true);assert.equal(f.runtime.spectrum.snapshot().sources,0);
 assert.equal(f.scope.snapshot().observers,0);assert.equal(f.drivers.size,0);
 assert.equal(f.scope.disposed,false);f.scope.dispose();
});

test('destroyed spectrum controllers release raw recordings and native tables',async()=>{
 if(typeof global.gc!=='function'){
  // Keep explicit full GC and WebAssembly instrumentation isolated from the
  // normal suite. Each attempt crosses a task boundary so WeakRef's current-job
  // keep-alive cannot make a released object appear retained.
  const result=spawnSync(process.execPath,['--expose-gc','--test',
   '--test-name-pattern=^destroyed spectrum controllers release raw recordings and native tables$',import.meta.filename],
   {encoding:'utf8',timeout:20000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  return;
 }
 const instantiate=WebAssembly.instantiate,memories=[];
 WebAssembly.instantiate=async(...args)=>{
  const result=await Reflect.apply(instantiate,WebAssembly,args),api=(result.instance||result).exports;
  if(typeof api.sample_recording==='function')memories.push(new WeakRef(api.memory));
  return result;
 };
 const f=fixture({fetch:async url=>{
  const recording=createSpectrumRecording();
  if(String(url).endsWith('/invalid.json'))recording.provenance.axes[0].clipped_windows=1;
  return new Response(JSON.stringify(recording));
 }});
 function inline(){
  const recording=createSpectrumRecording();
  return {raw:new WeakRef(recording.samples),handle:f.runtime.spectrum.animate(
   options(f,f.canvas(),'memory-inline',{recordingUrl:undefined,recording}))};
 }
 async function collected(refs,label){
  for(let attempt=0;attempt<12;attempt++){
   await new Promise(resolve=>setImmediate(resolve));global.gc();
   if(refs.every(ref=>ref.deref()===undefined))return;
  }
  assert.fail(label+' remains strongly reachable after explicit full collections');
 }
 try{
  const direct=inline(),remote=f.runtime.spectrum.animate(options(f,f.canvas(),'memory-url'));
  await Promise.all([direct.handle.ready,remote.ready]);
  assert.equal(memories.length,2);
  await collected([direct.raw],'Decoded inline sample array');
  // Retain both public spectrum handles and the scheduler's handles. Its saved
  // render callback must no longer keep a destroyed spectrum's native memory.
  const native=[f.runtime.rudiments.get('memory-inline'),f.runtime.rudiments.get('memory-url')];
  direct.handle.destroy();remote.destroy();
  const failed=f.runtime.spectrum.animate(options(f,f.canvas(),'memory-error',{recordingUrl:'/invalid.json'}));
  await assert.rejects(failed.ready,/Clipped Fourier axes/);
  assert.equal(memories.length,3);assert.equal(f.runtime.spectrum.snapshot().sources,0);
  await collected(memories,'Native recording table');
  assert.equal(direct.handle.snapshot().destroyed,true);assert.equal(remote.snapshot().destroyed,true);
  assert.ok(native.every(handle=>handle.snapshot().destroyed));
  assert.equal(failed.snapshot().status,'error','Failed handles release data before explicit destruction');
 }finally{f.scope.dispose();WebAssembly.instantiate=instantiate;}
});
