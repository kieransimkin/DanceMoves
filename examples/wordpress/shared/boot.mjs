const BASE = '/examples/wordpress/';
const ASSET = '/lib/styles/';
const ADAPTERS = {
  'dying-for-a-diagnosis':130, 'light-will-win':140, 'presents-and-chocolate':243,
  'clay-stars':252, 'fully-nocturnal':268, 'amnesty-honestly':270, 'walk-with-me':276,
  'dmitri-my-talisman':298, 'california-screamin':839
};
const cleanup = [];
// Core has no global unbind API. A BFCache return gets a fresh document rather
// than reviving the demo's disposed controllers against stale core scopes.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function json(url) { return fetch(url).then(r=>{ if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }); }
function script(name) { return new Promise((resolve,reject)=>{ const s=document.createElement('script');s.src=name;s.onload=resolve;s.onerror=()=>reject(new Error(`Cannot load ${name}. Serve the repository root, not just examples/.`));document.head.append(s); }); }
function css(name) { const l=document.createElement('link');l.rel='stylesheet';l.href=ASSET+name;document.head.append(l); }
function format(value) { return JSON.stringify(value, (k,v)=>v instanceof Element ? `<${v.tagName.toLowerCase()}${v.id?'#'+v.id:''}>` : v, 2); }
function element(tag, text, parent, cls) { const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;parent?.append(e);return e; }
async function main() {
  const manifest=await json(BASE+'features.json'); const media=await json(BASE+'media/manifest.json');
  const app=document.querySelector('#app'); const id=document.body.dataset.demo;
  if(id==='index') {
    app.innerHTML=`<div class="toolbar">DanceMoves · simulated WordPress · local development only</div><main class="index-wrap"><p class="kicker">DanceFlow / Arcadians</p><h1>One song.<br>Every motion feature.</h1><p>Real DanceMoves 2.9.0 scripts, StemLab’s Arcadians demo and inspectable page metadata. These teaching pages do not publish or change WordPress.</p><p class="notice">Run <code>python tools/prepare-wordpress-examples.py</code> once to download and verify Arcadians. Then use <code>python tools/serve-wordpress-examples.py</code>. This gallery never substitutes a synthetic song when media is missing.</p><p><a href="/RELEASING.md">How to make a release</a> · <a href="/docs/wordpress-examples.md">WordPress setup recipes</a> · <a href="https://kieransimkin.co.uk/arcadians/">Original Arcadians EPK</a></p><div class="grid">${manifest.features.map(f=>`<article class="card"><span class="badge">${escape(f.kind)}</span><h2><a href="${f.page}">${escape(f.title)}</a></h2><p>${escape(f.summary)}</p><p class="note">145 BPM · Arcadians</p></article>`).join('')}</div></main>`;
    window.__danceMovesDemo={ready:true,index:true,features:manifest.features.map(f=>f.id)};return;
  }
  const feature=manifest.features.find(f=>f.id===id); if(!feature) throw new Error('Unknown example');
  let saved={meta:feature.meta,revisions:0};
  try { saved=await json(BASE+'api/page/'+id); } catch {} // Static preview still demonstrates the real client runtime.
  const meta=saved.meta;
  const adapter=new URLSearchParams(location.search).get('adapter')||'california-screamin';
  const selectedAdapter=Object.hasOwn(ADAPTERS,adapter)?adapter:'california-screamin';
  app.innerHTML=`<div class="toolbar"><span class="spinner" aria-hidden="true"></span>Simulated WordPress · no database, no public upload · <a href="index.html">All ${manifest.features.length} examples</a></div><div class="layout"><main><div class="top"><span class="kicker">Arcadians / ${escape(feature.kind)}</span><a href="https://kieransimkin.co.uk/arcadians/">Original EPK ↗</a></div><h1>${escape(feature.title)}</h1><p>${escape(feature.summary)}</p><p class="notice">${escape(feature.instructions)}</p><section class="ks-epk arcadians-demo" data-release="arcadians-demo"><div class="epk-hero"><div class="epk-cover-wrap wwm-cover-stage" data-tilt><img class="cover epk-cover" src="media/cover.jpg" alt="Arcadians cover artwork by Kieran Simkin"></div><div class="epk-heading"><h2>Arcadians</h2><p>Kieran Simkin · ${escape(meta._dance_moves_bpm||'unknown')} BPM</p><p class="note">One master recording, shared chapter and lyric timing.</p></div></div><section class="panel"><audio id="arcadians-audio" controls preload="metadata" data-dance-moves-master src="media/arcadians.mp3"></audio><p id="media-status" class="note">Press Play to start; audio never autoplays.</p><label>Playback rate <select id="audio-rate"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><div class="chapter-bar" aria-label="Arcadians chapters"></div><div class="progress-track"><div class="progress-fill"></div></div></section><div class="stage"><div class="demo-subject" aria-hidden="true"></div></div><div id="demo-controls" class="controls"></div><div id="demo-output"></div><details class="ks-epk-lyrics-track panel"><summary>Readable Arcadians lyrics <span aria-hidden="true">⌄</span></summary><div id="readable-lyrics"></div></details></section><details class="panel"><summary>Working source for this example</summary><pre class="source" id="demo-source"></pre></details><section class="panel"><h2>Event log</h2><pre class="log" id="demo-log" aria-live="off"></pre></section></main><aside class="meta card"><h2>EPK Timing</h2><span class="badge">Local editor simulation</span><p class="note">Save reloads the runtime. Your real WordPress site is never contacted.</p><form id="metadata-form"></form><details><summary>All six stored metadata keys</summary><pre id="meta-json"></pre></details><details><summary>Localised browser config</summary><pre id="config-json"></pre></details><p class="note">Master duration is an advanced hidden key, not a REST-visible editor field. Inspect the WordPress recipe for validated setup.</p><p><a href="/docs/wordpress-examples.md">WordPress setup</a> · <a href="/RELEASING.md">Release guide</a></p></aside></div>`;
  const root=app.querySelector('.ks-epk'), audio=root.querySelector('audio');
  const out=app.querySelector('#demo-output'), controls=app.querySelector('#demo-controls');
  const readouts=new Map(), logs=[];
  function log(type,detail) { logs.push({type,detail}); if(logs.length>60)logs.shift();app.querySelector('#demo-log').textContent=format(logs); }
  function readout(key,value) { if(!readouts.has(key)){const p=element('section',undefined,out,'panel');element('h2',key,p);readouts.set(key,element('pre','',p,'readout'));}readouts.get(key).textContent=format(value); }
  function listen(t,n,f,o) { t.addEventListener(n,f,o);cleanup.push(()=>t.removeEventListener(n,f,o)); }
  function button(text,fn) { const b=element('button',text,controls);b.type='button';listen(b,'click',async()=>{try{await fn();}catch(e){log('error',e.message);}});return b; }
  function select(label,choices,fn,value) { const l=element('label',label+' ',controls);const s=element('select',undefined,l); for(const [v,t] of choices.map(x=>Array.isArray(x)?x:[x,x])){const o=element('option',t,s);o.value=v;}if(value!==undefined)s.value=value;listen(s,'change',()=>{try{fn(s.value);}catch(e){log('error',e.message);}});return s; }
  const sections=await json(BASE+'media/sections.json');
  sections.forEach(s=>{const b=element('button',`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')} ${s.data.label}`,root.querySelector('.chapter-bar'));b.type='button';b.dataset.cue=s.id;listen(b,'click',()=>{audio.currentTime=s.time;});});
  listen(audio,'timeupdate',()=>{root.style.setProperty('--journey-progress',String(audio.duration?audio.currentTime/audio.duration:0));root.querySelectorAll('[data-cue]').forEach(b=>{const s=sections.find(s=>s.id===b.dataset.cue);b.setAttribute('aria-current',String(audio.currentTime>=s.time&&audio.currentTime<s.end));});});
  listen(audio,'error',()=>{const p=app.querySelector('#media-status');p.className='notice error';p.textContent='Arcadians media is unavailable. Run python tools/prepare-wordpress-examples.py (or supply --stemlab-root). No replacement audio is generated.';});
  listen(app.querySelector('#audio-rate'),'change',e=>audio.playbackRate=Number(e.target.value));
  const lrc=await fetch(BASE+'media/canonical-lyric-timing.lrc').then(r=>r.text());
  // Readable lyrics are generated from authored line text, not used as a second playback parser.
  lrc.split(/\r?\n/).filter(x=>/^\[\d/.test(x)).map(x=>x.replace(/^\[[^\]]+\]/,'')).filter(Boolean).forEach(x=>element('p',x,app.querySelector('#readable-lyrics')));
  await script(BASE+'shared/model.cjs');
  window.danceMovesConfig=window.DemoMetadataModel.config(feature,meta);
  const config=window.danceMovesConfig;
  app.querySelector('#meta-json').textContent=format(meta);app.querySelector('#config-json').textContent=format(config);
  const form=app.querySelector('#metadata-form');
  form.innerHTML=`<label>BPM <input name="bpm" type="number" min="20" max="400" step="0.001" value="${escape(meta._dance_moves_bpm||'')}" placeholder="Unknown → 120 fallback"></label><label>Lyric file <select name="lyric"><option value="0">None</option><option value="9001">9001 · canonical Arcadians LRC</option></select></label><label>Cue file <select name="cue"><option value="0">None</option><option value="9002">9002 · Arcadians sections</option></select></label><label><input name="popups" type="checkbox">Timed lyric pop-ups</label><label>Ambient effect <select name="effect"><option value="">None</option><option value="paper-planes">Paper planes</option></select></label><button type="submit">Save simulated page</button>`;
  form.elements.lyric.value=meta._dance_moves_lyric_timing_id;form.elements.cue.value=meta._dance_moves_cue_timing_id;form.elements.popups.checked=meta._dance_moves_lyric_popups_enabled;form.elements.effect.value=meta._dance_moves_effect;
  listen(form,'submit',async e=>{e.preventDefault();try{const f=new FormData(form); const r=await fetch(BASE+'api/page/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({meta:{_dance_moves_bpm:f.get('bpm')===''?'':Number(f.get('bpm')),_dance_moves_lyric_timing_id:Number(f.get('lyric')),_dance_moves_cue_timing_id:Number(f.get('cue')),_dance_moves_lyric_popups_enabled:f.has('popups'),_dance_moves_effect:f.get('effect')}})});if(!r.ok)throw new Error(await r.text());location.reload();}catch(e){log('metadata-save-unavailable',e.message);}});
  async function mutate(action){const r=await fetch(BASE+'api/page/'+id+'/'+action,{method:'POST'});if(!r.ok)throw new Error(await r.text());location.reload();}
  const revert=element('button','Restore previous local revision',form);revert.type='button';revert.disabled=!saved.revisions;listen(revert,'click',()=>mutate('restore').catch(e=>log('error',e.message)));
  const reset=element('button','Reset demo metadata',form);reset.type='button';listen(reset,'click',()=>mutate('reset').catch(e=>log('error',e.message)));
  if(id==='clay'||id==='orientation'&&selectedAdapter==='clay-stars'){
    root.classList.add('ks-clay-stars-v2');const atmosphere=element('div',undefined,root,'epk-atmosphere');atmosphere.setAttribute('aria-hidden','true');root.prepend(atmosphere);
    const clouds=element('span',undefined,root,'ks-cloud-field');clouds.setAttribute('aria-hidden','true');
    for(const name of ['ks-warm-bloom','ks-lens-flare','ks-specular-sweep'])element('span',undefined,root.querySelector('.epk-cover-wrap'),name).setAttribute('aria-hidden','true');
  }
  if(id==='orientation'){
    config.pageId=ADAPTERS[selectedAdapter];window.ksEpkOrientationConfig={adapter:selectedAdapter,pageId:config.pageId,version:config.version,bpm:config.bpm,bpmSource:config.bpmSource,ticksPerBeat:16,transitionTargetTicks:2,harness:true};
    if(selectedAdapter==='dying-for-a-diagnosis')root.classList.add('dfad-motion-stage');
    if(selectedAdapter==='light-will-win'){root.id='light-will-win-top';root.querySelector('.epk-hero').classList.add('lww-hero');root.querySelector('.epk-cover-wrap').classList.add('lww-player-card');}
    if(selectedAdapter==='presents-and-chocolate'||selectedAdapter==='walk-with-me'||selectedAdapter==='fully-nocturnal')root.dataset.release=selectedAdapter;
    if(selectedAdapter==='fully-nocturnal')root.classList.add('fn-live');
    if(selectedAdapter==='dmitri-my-talisman'){root.classList.add('dmt-epk');root.querySelector('.epk-hero').classList.add('chamber');root.querySelector('.epk-cover-wrap').classList.add('cover-frame');}
    if(selectedAdapter==='california-screamin'){root.id='cs-epk';root.classList.add('cs-epk');root.querySelector('.epk-cover-wrap').classList.add('cs-cover');}
  }
  if(id==='scheduling'){
    const e=element('p','Declarative start on the first available audio bar',root.querySelector('.stage'));
    e.setAttribute('data-dance-moves-start-interval','64');e.setAttribute('data-dance-moves-start-clock','audio');
    e.style.animation='demo-enter var(--dance-moves-16t) ease both';
  }
  app.querySelector('#config-json').textContent=format(config);
  css('dance-moves-core.css');
  if(root.classList.contains('ks-clay-stars-v2'))css('clay-stars-effects.css');
  if(meta._dance_moves_effect==='paper-planes')css('paper-dreams-flight.css');
  if(['orientation','orientation-math'].includes(id))css('ks-epk-device-orientation.css');
  const {createDanceMoves}=await import('/lib/index.mjs');
  const runtime=createDanceMoves({...config,root,legacyGlobals:true,catalogue:true,
    clay:root.classList.contains('ks-clay-stars-v2'),orientation:window.ksEpkOrientationConfig || {},
    paperPlanes:{atlasUrl:'/lib/assets/paper-dreams-plane-atlas.png',planeCount:12,compactPlaneCount:5}});
  cleanup.push(()=>runtime.destroy());
  await runtime.ready;
  const source=await fetch(BASE+feature.code).then(r=>r.text());app.querySelector('#demo-source').textContent=source;
  const ctx={root,audio,stage:root.querySelector('.stage'),target:root.querySelector('.demo-subject'),motion:window.DanceMoves,effects:window.DanceMovesEffects,
    sections,lrc,feature,meta,config,media,adapters:ADAPTERS,adapter:selectedAdapter,button,select,listen,log,readout,
    element:(tag,text,parent=out,cls)=>element(tag,text,parent,cls),onCleanup:fn=>cleanup.push(fn),
    own:h=>{cleanup.push(()=>{if(h.destroy)h.destroy();else h.teardown?.();});return h;},
    accessible:()=>!matchMedia('(prefers-reduced-motion: reduce)').matches&&!matchMedia('(forced-colors: active)').matches,
    json,base:BASE};
  const mod=await import(BASE+feature.code);const handle=await mod.mount(ctx);
  window.__danceMovesDemo={ready:true,id,version:window.DanceMoves.version,ctx,handle,cleanup:()=>cleanup.splice(0).reverse().forEach(fn=>{try{fn();}catch{}})};
  document.documentElement.dataset.demoReady=id;
  // Unload owns the demonstration's handles, not unrelated third-party page effects.
  window.addEventListener('pagehide',()=>window.__danceMovesDemo.cleanup(),{once:true});
}
main().catch(error=>{const app=document.querySelector('#app');element('p',error.message,app,'notice error');window.__danceMovesDemo={ready:false,error:error.message};console.error(error);});
