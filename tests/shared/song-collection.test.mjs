import test from 'node:test';
import assert from 'node:assert/strict';
import {createSongCollection,validateSongCollection} from '../../src/song-collection.mjs';

const song=(id,bpm=120)=>({id,title:`Song ${id}`,bpm,audioSrc:`https://example.test/${id}.mp3`,
  lyricTimingUrl:`https://example.test/${id}.lrc`,wordTimingUrl:`https://example.test/${id}.tsv`,cueTimingUrl:`https://example.test/${id}.cue`});
function fixture(){
  const songs=[song('first',120),song('second',145)];
  const select=new EventTarget();select.value='first';
  const sections=[];const audios=[];
  const host={location:new URL('https://example.test/'),document:{createElement(tag){return Object.assign(new EventTarget(),{
    tagName:tag,style:{},setAttribute(){},addEventListener:EventTarget.prototype.addEventListener,
  });}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},fetch:async()=>({ok:true,headers:{get:()=>null},text:async()=>''})};
  for(const entry of songs){
    const audio=Object.assign(new EventTarget(),{src:entry.audioSrc,currentSrc:'',duration:180,currentTime:0,paused:true,ended:false,
      pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}});
    const outputs=new Map();
    const section={hidden:false,getAttribute:key=>key==='data-dance-moves-song'?entry.id:null,
      querySelector:selector=>selector==='audio'?audio:selector.startsWith('[data-dance-moves-current=')?outputs.get(selector):null};
    sections.push(section);audios.push(audio);
  }
  const root={nodeType:1,ownerDocument:{defaultView:host},querySelectorAll:key=>key==='[data-dance-moves-song]'?sections:[],
    querySelector:key=>key==='[data-dance-moves-song-select]'?select:null};
  const mounts=[];
  const mount=options=>{const value={options,destroyed:false,ready:Promise.resolve(),onLyric(){},onWord(){},onCue(){},
    destroy(){value.destroyed=true;}};mounts.push(value);return value;};
  return {songs,root,host,select,sections,audios,mounts,mount};
}
test('song collection preserves two distinct BPMs and all file URLs',()=>{
  const entries=validateSongCollection({schema:'dancemoves.song-collection.v1',songs:[song('first'),song('second',145)]});
  assert.equal(entries[0].bpm,120);assert.equal(entries[1].bpm,145);
  assert.ok(entries[1].wordTimingUrl.endsWith('second.tsv'));
});
test('one active motion owner; switching destroys previous mount and pauses audio',()=>{
  const f=fixture();const controller=createSongCollection({root:f.root,songs:f.songs,mount:f.mount,host:f.host});
  assert.equal(controller.current,'first');assert.equal(f.mounts.length,1);
  assert.equal(f.sections[0].hidden,false);assert.equal(f.sections[1].hidden,true);
  f.audios[0].paused=false;
  controller.select('second');
  assert.equal(controller.current,'second');assert.equal(f.mounts[0].destroyed,true);
  assert.equal(f.audios[0].paused,true);assert.equal(f.sections[0].hidden,true);
  assert.equal(f.sections[1].hidden,false);assert.equal(f.mounts[1].options.bpm,145);
  controller.select('first');assert.equal(f.mounts[1].destroyed,true);
  assert.equal(f.mounts[2].options.wordTimingUrl,f.songs[0].wordTimingUrl);
  controller.destroy();assert.equal(f.mounts[2].destroyed,true);
  assert.throws(()=>controller.select('second'),/destroyed/);
});
test('repeated selection is idempotent; duplicate identifiers or unsafe URLs fail',()=>{
  const f=fixture();const controller=createSongCollection({root:f.root,songs:f.songs,mount:f.mount,host:f.host});
  controller.select('first');assert.equal(f.mounts.length,1);
  assert.throws(()=>controller.select('missing'));
  assert.throws(()=>validateSongCollection([song('first'),song('first')]));
  assert.throws(()=>validateSongCollection([{...song('first'),audioSrc:'javascript:evil()'}]));
  assert.throws(()=>validateSongCollection([song('first',0)]));
  assert.throws(()=>validateSongCollection([]));
  controller.destroy();
});
