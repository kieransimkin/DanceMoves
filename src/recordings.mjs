// DanceRudiments' native bounded recording accessor. No JS sampling fallback.
// Upstream v0.3.0: recording_view.hpp, SHA-256 d4cd976156860aa7a5c9665b27d2fda3cf6a0fa0da3dc0b9df365e425f1c6e29.
const WASM='AGFzbQEAAAABDwJgAAF/YAZ/f39/f38BfAMDAgABBQUBAQKAQAYIAX8BQYCIBAsHKgMGbWVtb3J5AgAKdGFibGVfYmFzZQAAEHNhbXBsZV9yZWNvcmRpbmcAAQpvAggAQYCIhIAAC2QCAXwBfkQAAAAAAAD4fyEGAkAgAEUNACABQQFIDQAgAkEBSA0AIAVBAEgNACAFIAJPDQAgBKwgA6x9IgdCAFMNACAHIAGtWg0AIAAgB6cgAmxBA3RqIAVBA3RqKwMAIQYLIAYL';
const MAX_VALUES=8388608, MAX_BYTES=64*1024*1024;
let modulePromise;
const finite=(n,label)=>{if(typeof n!=='number'||!Number.isFinite(n))throw new TypeError(label+' must be finite');return n;};
export function validateRecording(input) {
 if(!input||input.format!=='dancerudiments.recording'||input.schema_version!==1||input.pips_per_beat!==64||input.sample_dtype!=='float64')throw new TypeError('Expected dancerudiments.recording v1, float64, 64 pips per beat');
 if(typeof input.name!=='string'||!input.name.length||input.name.length>128)throw new TypeError('Recording name is required');
 const dimensions=input.dimensions;
 if(!Array.isArray(dimensions)||!dimensions.length||dimensions.length>64||new Set(dimensions).size!==dimensions.length||dimensions.some(d=>typeof d!=='string'||!/^[a-z][a-z0-9_]{0,127}$/.test(d)))throw new TypeError('Recording requires 1..64 unique named dimensions');
 const c=input.clock;if(!c||finite(c.bpm,'Recording BPM')<=0||!['confirmed','estimated'].includes(c.bpm_status)||!['unverified','estimated','supplied'].includes(c.phase_status)||typeof c.bpm_source!=='string'||!c.bpm_source.trim())throw new TypeError('Recording clock requires BPM and provenance');
 finite(c.beat_zero_seconds,'Beat zero');if(!Number.isInteger(c.start_pip)||c.start_pip<-2147483648)throw new RangeError('Invalid recording start pip');
 const rows=input.samples;if(!Array.isArray(rows)||!rows.length||rows.length*dimensions.length>MAX_VALUES||c.start_pip+rows.length>2147483647)throw new RangeError('Recording exceeds bounded sample limits');
 const values=new Float64Array(rows.length*dimensions.length);
 rows.forEach((row,i)=>{if(!Array.isArray(row)||row.length!==dimensions.length)throw new TypeError('Recording sample dimensions differ');row.forEach((v,j)=>{finite(v,'Sample');if(Math.abs(v)>1)throw new RangeError('Recording samples must be in [-1,1]');values[i*dimensions.length+j]=v;});});
 return Object.freeze({name:input.name,dimensions:Object.freeze([...dimensions]),count:rows.length,clock:Object.freeze({...c}),values});
}
export async function createRecordingSampler(input) {return samplerFromData(validateRecording(input));}
async function samplerFromData(data) {
 if(!modulePromise)modulePromise=WebAssembly.compile(Uint8Array.from(atob(WASM),c=>c.charCodeAt(0))).catch(error=>{modulePromise=null;throw error;});
 const api=(await WebAssembly.instantiate(await modulePromise,{})).exports;
 const base=api.table_base(),pages=Math.ceil((base+data.values.byteLength-api.memory.buffer.byteLength)/65536);
 if(pages>0)api.memory.grow(pages);new Float64Array(api.memory.buffer,base,data.values.length).set(data.values);
 // Once copied into native memory, retain only capture metadata and that one
 // table. A page with many visualisers must not keep a duplicate float64 table.
 const {name,dimensions,count,clock}=data;data=null;
 return Object.freeze({name,dimensions,count,clock,sample(pip){if(!Number.isInteger(pip)||pip<clock.start_pip||pip>=clock.start_pip+count)throw new RangeError('Position is outside the non-looping recording');return dimensions.map((_,axis)=>api.sample_recording(base,count,dimensions.length,clock.start_pip,pip,axis));}});
}
/** Compose native recording samples with the existing native scheduler/media lifecycle. */
export function createRecordingService(scope,rudiments,config) {
 const handles=new Map();
 async function load(url,options={}){
  if(scope.disposed)throw new Error('DanceMoves mount is destroyed');
  const response=await scope.window.fetch(url,{signal:options.signal});if(!response.ok)throw new Error('Recording request failed: '+response.status);
  if(Number(response.headers?.get('content-length'))>MAX_BYTES)throw new RangeError('Recording exceeds 64 MiB');
  // Stream the byte limit, including responses with no Content-Length.
  let text;
  if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new RangeError('Recording exceeds 64 MiB');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  else {text=await response.text();if(new TextEncoder().encode(text).length>MAX_BYTES)throw new RangeError('Recording exceeds 64 MiB');}
  if(scope.disposed)throw new Error('DanceMoves mount is destroyed');
  options.signal?.throwIfAborted();
  const input=JSON.parse(text);validateRecording(input);return input;
 }
 function animate(options={}){
  if(scope.disposed)throw new Error('DanceMoves mount is destroyed');
  if(typeof options.id!=='string'||!options.id.trim()||handles.has(options.id))throw new TypeError('Recording controller requires a unique id');
  if(typeof options.render!=='function')throw new TypeError('Recording render callback is required');
  if(!options.audio)throw new TypeError('Recording playback requires an audio/player source');
  if(['rate','phasePips','clock','bpm'].some(k=>Object.hasOwn(options,k)))throw new TypeError('Recording clock, rate and origin come from its capture');
  const data=validateRecording(options.recording);
  if(Math.abs(data.clock.bpm-config.bpm)>1e-9)throw new RangeError('Recording BPM does not match the authoritative page BPM');
  let inner=null,sampler=null,destroyed=false,enabled=options.enabled!==false,paused=false,status='loading',error=null,last=null;
  const output=(frame,values,pip,reason)=>{if(destroyed)return;last={...frame,rudiment:null,recording:data.name,dimensions:data.dimensions,values,position:{x:values[0]||0,y:values[1]||0,z:values[2]||0},pip,positionPips:pip,loopProgress:null,reason};options.render(last);};
  const handle={id:options.id,ready:null,
   setEnabled(value){if(typeof value!=='boolean')throw new TypeError('enabled must be boolean');enabled=value;inner?.setEnabled(value);},
   pause(){paused=true;inner?.pause();},resume(){paused=false;inner?.resume();},refresh(){inner?.refresh();},
   destroy(){if(destroyed)return;inner?.destroy();inner=null;sampler=null;destroyed=true;status='destroyed';handles.delete(options.id);},
   snapshot(){const state=inner?.snapshot()??null;return {id:options.id,type:'recording',recording:data.name,status:!destroyed&&['hidden','offscreen','paused','seeking'].includes(state?.status)?state.status:status,error,destroyed,enabled,paused,pip:last?.pip??null,dimensions:data.dimensions,count:data.count,clock:data.clock,inner:state};}};
  handle.teardown=handle.destroy;handles.set(options.id,handle);
  handle.ready=samplerFromData(data).then(async native=>{
   if(destroyed||scope.disposed)return handle;sampler=native;
   inner=rudiments.animate({id:options.id,root:options.root,target:options.target,audio:options.audio,clock:'audio',rudiment:'circle',rate:1,phasePips:0,amplitude:0,css:false,renderEveryFrame:true,offscreen:options.offscreen!==false,enabled,
    render(frame){if(destroyed)return;const neutral=['disabled','reduced-motion','forced-colors'].includes(frame.reason),precise=(frame.sourceBeats-data.clock.beat_zero_seconds*data.clock.bpm/60)*64;
     const pip=Math.floor(precise+1e-8),outside=pip<data.clock.start_pip||pip>=data.clock.start_pip+data.count;
     status=neutral?frame.reason:outside?'outside-recording':frame.reason;
     const values=neutral||outside?data.dimensions.map(()=>0):sampler.sample(pip);
     output(frame,values,pip,status);
    }});
   if(paused)inner.pause();await inner.ready;return handle;
  }).catch(failure=>{error=String(failure.message||failure);status='error';inner?.destroy();inner=null;sampler=null;if(handles.get(options.id)===handle)handles.delete(options.id);throw failure;});
  return handle;
 }
 scope.onDispose(()=>{for(const handle of [...handles.values()])handle.destroy();});
 return Object.freeze({load,animate,get:id=>handles.get(id)||null,destroyAll:()=>{for(const h of [...handles.values()])h.destroy();},snapshot:()=>({native:'DanceRudiments 0.3.0 recording C++/WASM',instances:[...handles.values()].map(h=>h.snapshot())})});
}
