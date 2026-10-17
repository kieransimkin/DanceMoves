/** Independent, opt-in per-song DanceMoves playback mounts for a WordPress Page. */
import {validatePageConfig} from './config.mjs';

export const SONG_COLLECTION_SCHEMA = 'dancemoves.song-collection.v1';
const songId = /^[a-z][a-z0-9_-]{0,63}$/;
const url = value => {
  if (typeof value !== 'string' || value.length > 4096) throw new TypeError('Each song needs a bounded audio URL');
  const parsed = new URL(value, 'https://dancemoves.invalid/');
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || /[\u0000-\u001f]/.test(value))
    throw new TypeError('Song source URL must be HTTP(S) without credentials or fragments');
  return value;
};
export function validateSongCollection(input) {
  const songs = Array.isArray(input) ? input : input?.schema === SONG_COLLECTION_SCHEMA ? input.songs : null;
  if (!Array.isArray(songs) || songs.length < 1 || songs.length > 24)
    throw new RangeError('A song collection requires 1..24 songs');
  const ids = new Set();
  return Object.freeze(songs.map(entry => {
    if (!entry || typeof entry !== 'object' || !songId.test(entry.id) || ids.has(entry.id))
      throw new TypeError('Song IDs must be unique lower-case identifiers');
    ids.add(entry.id);
    if (typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160)
      throw new TypeError('Song title must contain 1..160 characters');
    const audioSrc = url(entry.audioSrc);
    // Require source-bound beat maps to be attached to exactly this song.
    if (entry.beatTimeline && new URL(entry.beatTimeline.source_url).href !== new URL(audioSrc, 'https://dancemoves.invalid/').href)
      throw new TypeError('Beat timeline audio URL must match the selected song');
    if (entry.beatAlignment && new URL(entry.beatAlignment.source_url).href !== new URL(audioSrc, 'https://dancemoves.invalid/').href)
      throw new TypeError('Fixed beat alignment audio URL must match the selected song');
    const config = validatePageConfig({...entry, lyricPopupsEnabled:entry.lyricPopupsEnabled === true});
    return Object.freeze({...config,id:entry.id,title:entry.title.trim(),audioSrc});
  }));
}

/** Only one song owns motion at once. Inactive audio does not dispatch timing. */
export function createSongCollection({root, songs, mount, host = root?.ownerDocument?.defaultView}) {
  if (!root || root.nodeType !== 1 || typeof mount !== 'function') throw new TypeError('Song collection requires a DOM root and DanceMoves mounting function');
  const entries = validateSongCollection(songs);
  const controls = new Map();
  for (const song of entries) {
    const section = [...root.querySelectorAll('[data-dance-moves-song]')].find(node => node.getAttribute('data-dance-moves-song') === song.id);
    const audio = section?.querySelector('audio');
    if (!section || !audio || new URL(audio.currentSrc || audio.src, host.location?.href || 'https://dancemoves.invalid/').href !==
       new URL(song.audioSrc, host.location?.href || 'https://dancemoves.invalid/').href) throw new TypeError(`Song ${song.id} is missing its correct player/root`);
    controls.set(song.id,{song,section,audio});
  }
  const select = root.querySelector('[data-dance-moves-song-select]');
  if (!select) throw new TypeError('Song selection control is missing');
  let current = null, activeRuntime = null, disposed = false, revision = 0, ready = Promise.resolve();
  const listeners = [];
  const listen = (el,type,fn) => {el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));};
  const playheads = new Map();

  async function timeline(entry, runtime, revisionAtStart) {
    const {song,section,audio} = entry;
    const lanes = [['line',song.lyricTimingUrl,runtime.parseLyricTimingFile],
      ['word',song.wordTimingUrl,runtime.parseWordTimingFile],
      ['cue',song.cueTimingUrl,runtime.parseTimingFile]];
    // Tempo-map beats are authoritative sample-frame anchors. Constant grids
    // remain explicitly labelled estimates; no unobserved detector events invented.
    const beatLane=section.querySelector('[data-dance-moves-lane="beat"]');
    if (beatLane) {
      beatLane.replaceChildren();
      const duration=Number(audio.duration), sr=song.beatTimeline?.source_audio?.sample_rate;
      const exact=song.beatTimeline?.beats;
      const events=Array.isArray(exact) && sr ? exact.map(row=>({time:row.frame/sr,label:`Beat ${row.beat+1} (${row.source})`})) :
        Array.from({length:Math.max(0,Math.min(2500,Math.floor((duration-(song.beatAlignment?.first_beat_seconds??0))*song.bpm/60)+1))},
          (_,i)=>({time:(song.beatAlignment?.first_beat_seconds??0)+i*60/song.bpm,label:`Fixed BPM grid beat ${i+1} (not a detection)`}));
      const stride=Math.max(1,Math.ceil(events.length/2500));
      for(let i=0; i<events.length;i+=stride) {
        const point=events[i];
        if(!Number.isFinite(point.time)||point.time<0||point.time>duration)continue;
        const node=host.document.createElement('button');node.type='button';node.className='dance-moves-song-marker';
        node.style.left=(100*point.time/duration).toFixed(6)+'%';node.title=point.label;
        node.setAttribute('aria-label',point.label);
        node.addEventListener('click',()=>{if(!disposed&&current===song.id)audio.currentTime=point.time;});
        beatLane.appendChild(node);
      }
      beatLane.dataset.danceMovesMarkerCount=String(events.length);
      beatLane.dataset.danceMovesStatus='ready';
    }
    const jobs = lanes.map(async ([kind,source,parse]) => {
      if (!source || typeof parse !== 'function') return;
      try {
      const response = await host.fetch(source,{cache:'no-store'});
      if (!response.ok) throw new Error(`${kind} timing HTTP ${response.status}`);
      if (Number(response.headers?.get('content-length')) > 1048576) throw new RangeError('Timing file exceeds 1 MiB');
      const content = await response.text();
      if (new TextEncoder().encode(content).length > 1048576) throw new RangeError('Timing file exceeds 1 MiB');
      const events = parse(content);
      if (revision !== revisionAtStart || disposed) return;
      const lane = section.querySelector(`[data-dance-moves-lane="${kind}"]`);
      if (!lane) return;
      lane.replaceChildren();
      const duration = Number(audio.duration);
      if (!Number.isFinite(duration) || duration <= 0) return;
      const maxMarkers = 2500, stride = Math.max(1,Math.ceil(events.length / maxMarkers));
      for (let i=0;i<events.length;i+=stride) {
        const item=events[i],time=Number(item.start ?? item.time);
        if (!Number.isFinite(time) || time<0 || time>duration) continue;
        const marker=host.document.createElement('button');marker.type='button';marker.className='dance-moves-song-marker';
        marker.style.left=(100*time/duration).toFixed(6)+'%';
        marker.title=String(item.word ?? item.text ?? item.name ?? item.label ?? kind);
        marker.setAttribute('aria-label',`${kind} at ${time.toFixed(3)} seconds: ${marker.title}`);
        marker.addEventListener('click',()=>{if (!disposed && current===song.id) audio.currentTime=time;});
        lane.appendChild(marker);
      }
      lane.dataset.danceMovesMarkerCount=String(events.length);
      lane.dataset.danceMovesStatus='ready';
      } catch (error) {
        if (revision!==revisionAtStart || disposed) return;
        const lane=section.querySelector(`[data-dance-moves-lane="${kind}"]`);
        if (lane) {
          lane.dataset.danceMovesStatus='unavailable';
          lane.setAttribute('title', `${kind} timing unavailable: ${error instanceof Error ? error.message : String(error)}`.slice(0,200));
        }
      }
    });
    await Promise.allSettled(jobs);
  }

  function stopPlayhead() {
    if (!playheads.size) return;
    for (const token of playheads.values()) host.cancelAnimationFrame(token);
    playheads.clear();
  }
  function updatePlayhead(entry) {
    const bar=entry.section.querySelector('[data-dance-moves-playhead]');
    if (bar && Number(entry.audio.duration)>0) bar.style.left=(100*Math.min(1,Math.max(0,entry.audio.currentTime/entry.audio.duration))).toFixed(6)+'%';
    const display=entry.section.querySelector('[data-dance-moves-current="bpm"]');
    if (display && activeRuntime && current===entry.song.id) {
      const tempo=activeRuntime.tempoAt?.(entry.audio) ?? entry.song.bpm;
      if (Number.isFinite(tempo)) display.textContent=tempo.toFixed(3);
    }
  }
  function beginPlayhead(entry) {
    stopPlayhead();
    const frame=()=>{
      if (disposed || current!==entry.song.id || entry.audio.paused || entry.audio.ended) return;
      updatePlayhead(entry);
      playheads.set(entry.song.id,host.requestAnimationFrame(frame));
    };
    if (!entry.audio.paused) playheads.set(entry.song.id,host.requestAnimationFrame(frame));
  }
  function choose(id) {
    if (disposed) throw new Error('Song collection is destroyed');
    const entry=controls.get(id);
    if (!entry) throw new RangeError('Unknown song');
    if (current===id) return activeRuntime;
    ++revision;
    stopPlayhead();
    if (current) controls.get(current).audio.pause();
    activeRuntime?.destroy();activeRuntime=null;
    current=id;
    for (const [key,row] of controls) row.section.hidden=key!==id;
    select.value=id;
    activeRuntime=mount({...entry.song,root:entry.section,legacyGlobals:false,catalogue:true});
    const clock=activeRuntime;
    const output=(name,value)=>{const dest=entry.section.querySelector(`[data-dance-moves-current="${name}"]`);if(dest)dest.textContent=value;};
    clock.onLyric?.(item=>{if(current===id)output('line',item.text||'');});
    clock.onWord?.(item=>{if(current===id)output('word',item.word||'');});
    clock.onCue?.('*',item=>{if(current===id)output('cue',item.name||'');});
    updatePlayhead(entry);
    if (Number(entry.audio.duration)>0) void timeline(entry,clock,revision);
    ready=Promise.resolve(clock.ready);
    if (typeof host.dispatchEvent === 'function' && typeof host.CustomEvent === 'function')
      host.dispatchEvent(new host.CustomEvent('dance-moves-song-selected',
        {detail:{songId:id,song:entry.song,runtime:clock},bubbles:false}));
    return clock;
  }
  for (const entry of controls.values()) {
    listen(entry.audio,'play',()=>{if(current!==entry.song.id)choose(entry.song.id);beginPlayhead(entry);});
    listen(entry.audio,'pause',()=>{if(current===entry.song.id){stopPlayhead();updatePlayhead(entry);}});
    listen(entry.audio,'timeupdate',()=>{if(current===entry.song.id)updatePlayhead(entry);});
    listen(entry.audio,'seeked',()=>{if(current===entry.song.id)updatePlayhead(entry);});
    listen(entry.audio,'loadedmetadata',()=>{if(current===entry.song.id&&activeRuntime)void timeline(entry,activeRuntime,revision);});
  }
  listen(select,'change',()=>choose(select.value));
  choose(entries[0].id);
  return Object.freeze({get destroyed(){return disposed;},get current(){return current;},get runtime(){return activeRuntime;},get ready(){return ready;},songs:entries,
    select:choose,destroy(){if(disposed)return;disposed=true;revision++;stopPlayhead();activeRuntime?.destroy();activeRuntime=null;
      for(const entry of controls.values())entry.audio.pause();listeners.splice(0).forEach(fn=>fn());}});
}
