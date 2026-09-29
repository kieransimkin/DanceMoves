'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createMemoryPageStore,ORIENTATION_ADAPTERS,VERSION} from '@kieransimkin/dancemoves';
import {useDanceMoves,useCue,useLyric,useRudiment,PageMetadataEditor} from '@kieransimkin/dancemoves/react';
const initial={bpm:145,masterDurationMilliseconds:273604.558,cueTimingUrl:'/media/sections.cue',lyricTimingUrl:'/media/canonical-lyric-timing.lrc',lyricPopupsEnabled:false,sharedControlTicks:8,lyricDisclosureTicks:6};
const sections=[['Intro',0],['Verse 1',57.46],['Pre-Chorus',70.82],['Build 1',85],['Drop 1',104.01],['Post-Drop',133.94],['Verse 2',154.44],['Build 2',167.75],['Final Drop',187.54],['Outro',222.1]];
const features=['rudiments','pointer','pulse','cues','timeline','quality','orientation','clay','planes','metadata','capture'];
function safe(value){return JSON.stringify(value,(key,v)=>typeof Element!=='undefined'&&v instanceof Element?`<${v.tagName.toLowerCase()}>`:v,2);}
function MovingTile({runtime,audio,name}){
 const target=useRef(null);
 const options=useMemo(()=>({id:'react:'+name,rudiment:name,clock:'audio',audio,amplitude:{x:32,y:24,z:0},offscreen:false}),[name,audio]);
 const {controller,error}=useRudiment(runtime,target,options);
 return <article className="motion-tile"><div ref={target} className="orb" aria-hidden="true"/><strong>{name}</strong>{error&&<p role="alert">{error.message}</p>}<button onClick={()=>controller?.pause()}>Pause motion</button><button onClick={()=>controller?.resume()}>Resume motion</button></article>;
}
export default function App({downloadUrl='',captureEnabled=false}){
 const [feature,setFeature]=useState('rudiments'),[config,setConfig]=useState(initial),[output,setOutput]=useState(''),[events,setEvents]=useState([]),[mounted,setMounted]=useState(true);
 const pageStore=useMemo(()=>createMemoryPageStore(),[]);
 return <main className="demo-shell"><header><p className="eyebrow">DanceFlow / {VERSION} / React + Next.js</p><h1>Arcadians.<br/>One song, shared motion.</h1><p>Artist-authored 145 BPM reference, canonical lyrics and the original StemLab demo. No replacement audio is generated.</p><a href="https://kieransimkin.co.uk/arcadians/">Original Arcadians EPK</a></header>
 <nav aria-label="Feature demos">{features.map(name=><button key={name} aria-pressed={feature===name} onClick={()=>{setFeature(name);setOutput('');setEvents([]);}}>{name}</button>)}</nav>
 <button onClick={()=>setMounted(value=>!value)}>{mounted?'Unmount runtime':'Remount runtime'}</button>
 {mounted&&<Demo key={feature} {...{feature,config,setConfig,pageStore,output,setOutput,events,setEvents,downloadUrl,captureEnabled}}/>}
 {!mounted&&<p data-testid="unmounted">Runtime destroyed. Timers, listeners, generated styles and controllers are disposed.</p>}
 </main>;
}
function Demo({feature,config,setConfig,pageStore,output,setOutput,events,setEvents,downloadUrl,captureEnabled}){
 const root=useRef(null),audioRef=useRef(null),subject=useRef(null),genericOrientation=useRef(null),recorder=useRef(null);
 const [audio,setAudio]=useState(null),[catalogue,setCatalogue]=useState([]),[key,setKey]=useState('');
 const options=useMemo(()=>({...config,effect:feature==='planes'?'paper-planes':'',catalogue:feature==='clay',clay:feature==='clay',diagnostics:true,
   paperPlanes:{atlasUrl:'/dancemoves-assets/paper-dreams-plane-atlas.png'}}),[config,feature]);
 const {runtime,error}=useDanceMoves(root,options);
 useEffect(()=>setAudio(audioRef.current),[]);
 const lyric=useLyric(runtime);
 useCue(runtime,'*',cue=>setEvents(previous=>[...previous.slice(-11),`${cue.time.toFixed(2)} ${cue.name}`]));
 useEffect(()=>{
  if(!runtime)return;let active=true;const handles=[];
  const own=controller=>{handles.push(controller);return controller;};
  const report=value=>{if(active)setOutput(safe(value));};
  window.__reactDanceMoves=runtime; // Local test visibility, not a required application global.
  runtime.rudiments.ready().then(()=>{if(active)setCatalogue(runtime.rudiments.catalogue());}).catch(e=>report({error:e.message}));
  if(feature==='pointer')own(runtime.effects.pointer({id:'react:pointer',root:root.current,target:subject.current,bounds:root.current,
    render:({x,y})=>subject.current?.style.setProperty('transform',`translate(${x*30}px,${y*25}px)`)}));
  if(feature==='pulse')own(runtime.effects.playbackPulse({id:'react:pulse',root:root.current,audio:audioRef.current,ticks:64,render:report}));
  if(feature==='cues')own(runtime.effects.cueClass({id:'react:cue',root:root.current,cue:'DROP 1',className:'accent',durationTicks:32}));
  if(feature==='timeline')own(runtime.effects.cueTimeline({id:'react:timeline',root:root.current,audio:audioRef.current,
    cues:sections.map(([name,time],index)=>({id:name,time,end:sections[index+1]?.[1] || 273.604558})),render:report,onCue:report}));
  if(feature==='quality')own(runtime.effects.quality({id:'react:quality',root:root.current,tiers:['full','reduced','minimal'],render:report}));
  if(feature==='orientation')genericOrientation.current=own(runtime.createOrientation({render:point=>{
    if(subject.current)subject.current.style.transform=`translate(${point.x*40}px,${point.y*30}px)`;report(point);
  }}));
  if(feature==='capture')recorder.current=runtime.createRecorder();
  return ()=>{active=false;for(const h of handles)h.destroy?h.destroy():h.teardown?.();recorder.current?.stop('unmounted');recorder.current=null;genericOrientation.current=null;if(window.__reactDanceMoves===runtime)delete window.__reactDanceMoves;};
 },[runtime,feature,setOutput]);
 async function attempt(fn){try{setOutput(safe(await fn()));}catch(e){setOutput(e.message);}}
 return <section ref={root} className={'ks-epk demo-runtime '+(feature==='clay'?'ks-clay-stars-v2':'')} data-release="arcadians" data-testid="runtime">
  {feature==='clay'&&<><div className="epk-atmosphere" aria-hidden="true"/><span className="ks-cloud-field" aria-hidden="true"/></>}
  <div className="epk-hero"><div className="epk-cover-wrap"><img src="/media/cover.jpg" alt="Arcadians by Kieran Simkin"/>{feature==='clay'&&<><span className="ks-warm-bloom"/><span className="ks-lens-flare"/><span className="ks-specular-sweep"/></>}</div><div className="epk-heading"><h2>Arcadians</h2><p>Kieran Simkin · {runtime?.bpm||config.bpm} BPM</p><audio ref={audioRef} controls preload="metadata" data-dance-moves-master src="/media/arcadians.mp3"/><p className="media-hint">Prepare media with npm run demo:prepare. Press Play to start; sound never autoplays.</p></div></div>
  <div className="chapters">{sections.map(([name,time])=><button key={name} onClick={()=>{audioRef.current.currentTime=time;}}>{name}</button>)}</div>
  <label>Playback speed <select defaultValue="1" onChange={e=>audioRef.current.playbackRate=Number(e.target.value)}><option>.75</option><option>1</option><option>1.25</option><option>1.5</option></select></label>
  <p className="lyric" aria-live="off">{lyric?.text||'Lyrics appear here during playback, including explicit clear gaps.'}</p>
  {error&&<p role="alert">{error.message}</p>}
  {feature==='rudiments'&&audio&&<div className="motions">{catalogue.map(row=><MovingTile key={row.name} {...{runtime,audio}} name={row.name}/>)}</div>}
  {['pointer','pulse','cues','orientation','quality'].includes(feature)&&<div className="motion-stage"><div ref={subject} className="orb"/></div>}
  {feature==='cues'&&<button onClick={()=>runtime.fireCue({name:'DROP 1',type:'DROP',time:104.01})}>Fire named cue</button>}
  {feature==='quality'&&<><button onClick={()=>runtime.effects.get('react:quality').setTier(2)}>Minimal quality</button><button onClick={()=>runtime.effects.get('react:quality').setTier(0)}>Full quality</button></>}
  {feature==='orientation'&&<><button onClick={()=>attempt(()=>genericOrientation.current.enable())}>Enable phone motion</button><button onClick={()=>genericOrientation.current.disable()}>Disable phone motion</button><p>Generic mapping above; the original nine DOM adapters are also available: {ORIENTATION_ADAPTERS.join(', ')}.</p></>}
  {feature==='metadata'&&<><PageMetadataEditor value={config} onSave={value=>{const record=pageStore.save('arcadians',value);setConfig(record.config);setOutput(safe(record));}}/><button onClick={()=>setOutput(safe(pageStore.revisions('arcadians')))}>Inspect revisions</button><button onClick={()=>attempt(()=>{const records=pageStore.revisions('arcadians');if(records.length<2)throw new Error('Save two revisions first');const result=pageStore.restore('arcadians',records.at(-2).revision);setConfig(result.config);return result;})}>Restore previous revision</button></>}
  {feature==='capture'&&<><p>Explicit permission is required. Upload is enabled only in the Next.js demo with server-side storage configured.</p><button onClick={()=>attempt(()=>recorder.current.start())}>Record phone motion</button><button onClick={()=>attempt(()=>recorder.current.stop())}>Stop capture</button><label>Demo upload key <input type="password" value={key} onChange={e=>setKey(e.target.value)}/></label><button disabled={!captureEnabled} onClick={()=>attempt(()=>recorder.current.upload('/api/capture',{headers:{'X-DanceMoves-Demo-Key':key}}))}>Upload privately</button></>}
  <div className="actions"><button onClick={()=>setOutput(safe(runtime?.resources()))}>Inspect lifecycle</button><button onClick={()=>setOutput(safe(runtime?.rudiments.snapshot()))}>Inspect native runtime</button>{downloadUrl&&<a href={downloadUrl} download>Download signed MP3</a>}</div>
  <pre className="readout" data-testid="readout">{output}</pre><pre className="events">{events.join('\n')}</pre>
 </section>;
}
