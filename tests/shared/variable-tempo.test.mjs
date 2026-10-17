import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validatePageConfig,fromWordPressMeta} from '../../src/config.mjs';
import {readWordPressConfig} from '../../src/wordpress-config.mjs';
import {phasePipsAtSeconds} from '../../src/beat-timeline.mjs';

const audioUrl='https://example.test/master.mp3';
const altUrl='https://example.test/other.mp3';
const sha='a'.repeat(64);
function map() {
  return {schema:'stemlab.beat-timeline.v1',pips_per_beat:64,
    source_audio:{sha256:sha,sample_rate:8000,num_frames:24000,num_channels:1},
    consensus_sha256:'b'.repeat(64),origin_beat:0,review_status:'estimated',source_url:audioUrl,
    beats:[1000,5000,9000,14160,18080].map((frame,beat)=>({beat,frame,source:'consensus',reference_frame:frame}))};
}
function fixed(url=audioUrl) {
  return {schema:'stemlab.beat-alignment.v1',source_sha256:sha,source_url:url,
    source_audio_verified:true,source_audio:{sample_rate:8000,num_frames:24000},
    bpm:120,exact_bpm:'120',bpm_basis:'canonical',bpm_status:'canonical',phase_status:'estimated',
    analysis_id:'consensus',evidence_sha256:'b'.repeat(64),report_sha256:'c'.repeat(64),
    first_beat_seconds:.125,first_beat_exact_seconds:'1/8',offset_pips:-16,exact_offset_pips:'-16',pips_per_beat:64,canonical_first_beat_pip:0};
}
function core(config) {
  const document={readyState:'loading',baseURI:'https://example.test/',addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};
  const window={danceMovesConfig:config,performance:{now:()=>1000},console};
  vm.runInNewContext(fs.readFileSync('assets/dance-moves-core.js','utf8'),{window,document,console,URL,Map,Set,WeakSet});
  return window.DanceMoves;
}
const audio=(time,url=audioUrl)=>({currentTime:time,currentSrc:url,paused:false,ended:false});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);

test('optional variable tempo and exact phase use edited native frames, not a constant BPM',()=>{
  const api=core(validatePageConfig({bpm:120,beatTimeline:map()}));
  assert.equal(api.beatTimelineState(audio(.125)).mode,'variable');
  assert.equal(api.beatTimelineState(audio(.125)).applied,true);
  assert.equal(api.sourceTick(audio(.125)),0);
  assert.equal(api.sourceTick(audio(.625)),16);
  assert.equal(api.sourceTick(audio(1.125)),32);
  near(api.sourceTick(audio((1.125+1.77)/2)),40);
  assert.equal(api.sourceTick(audio(0)),-4);
  near(api.tempoAt(audio(1.15)),60/.645);
  near(api.durationMillisecondsAt(audio(1.15),16),645);
  assert.equal(api.beatAlignmentState(audio(1.125)).mode,'variable');
  assert.equal(api.rhythmicTime(audio(1.125)),1); // source seconds, unchanged
});
test('Beat 1 can be later; fractional phase before Beat 1 is preserved',()=>{
  const m=map();m.origin_beat=2;
  const api=core(validatePageConfig({beatTimeline:m}));
  assert.equal(api.sourceTick(audio(1.125)),0);
  assert.equal(api.sourceTick(audio(0)),-36);
  assert.equal(api.beatTimelineState(audio(1.125)).offsetPips,-144);
  assert.equal(phasePipsAtSeconds(m,0),-144);
});
test('fixed BPM and v1 alignment behave identically with optional feature absent',()=>{
  const api=core(validatePageConfig({beatAlignment:fixed()}));
  assert.equal(api.sourceTick(audio(0)),-4);
  assert.equal(api.sourceTick(audio(.125)),0);
  assert.equal(api.sourceTick(audio(.625)),16);
  assert.equal(api.tempoAt(audio(.625)),120);
  assert.equal(api.durationMilliseconds(16),500);
  assert.equal(api.beatTimelineState(audio(.125)).applied,false);
  assert.equal(api.beatAlignmentState(audio(.125)).mode,'constant');
});
test('master switching keeps independently source-bound fixed alignment available',()=>{
  const api=core(validatePageConfig({bpm:120,beatAlignment:fixed(altUrl),beatTimeline:map()}));
  assert.equal(api.beatTimelineState(audio(1.125,altUrl)).status,'source-mismatch');
  assert.equal(api.sourceTick(audio(.125,altUrl)),0);
  assert.equal(api.beatAlignmentState(audio(.125,altUrl)).mode,'constant');
  assert.equal(api.sourceTick(audio(.625)),16);
  const wrong=audio(1.125,'https://unrelated.test/master.mp3');
  assert.equal(api.beatTimelineState(wrong).applied,false);
  near(api.sourceTick(wrong),36); // default unaligned 120 BPM, no forged phase
});
test('WordPress opt-in uses selected master and accepts compact meta form',async()=>{
  const doc=map();delete doc.source_url;
  const json=JSON.stringify(doc);
  const cfg=await fromWordPressMeta({
    _dance_moves_use_beat_timeline:'1',_dance_moves_beat_timeline:json,
    _dance_moves_beat_alignment_audio_id:42,
  },id=>{assert.equal(id,42);return audioUrl;});
  assert.equal(cfg.beatTimeline.source_url,audioUrl);
  const disabled=await fromWordPressMeta({_dance_moves_use_beat_timeline:'0',_dance_moves_beat_timeline:json,
    _dance_moves_beat_alignment_audio_id:42},()=>{throw new Error('Disabled map must not load attachment');});
  assert.equal(disabled.beatTimeline,null);
  const wire={...cfg,beatTimeline:{...cfg.beatTimeline,pips_per_beat:'64',origin_beat:'0',
    source_audio:{...cfg.beatTimeline.source_audio,sample_rate:'8000',num_frames:'24000',num_channels:'1'},
    beats:cfg.beatTimeline.beats.map(x=>({...x,beat:String(x.beat),frame:String(x.frame),reference_frame:String(x.reference_frame)}))}};
  assert.equal(validatePageConfig(readWordPressConfig(wire)).beatTimeline.beats[0].frame,1000);
});
