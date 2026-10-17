import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBeatTimeline,phasePipsAtSeconds,tempoAtSeconds,tickAtSeconds} from '../../src/beat-timeline.mjs';
const SHA='a'.repeat(64);
function map() {
  const positions=[1000,5000,9000,14160,18080];
  return {schema:'stemlab.beat-timeline.v1',pips_per_beat:64,consensus_sha256:'b'.repeat(64),
    source_audio:{sha256:SHA,sample_rate:8000,num_frames:24000,num_channels:1,duration_seconds:3},origin_beat:0,review_status:'estimated',
    beats:positions.map((frame,beat)=>({beat,frame,source:'consensus',reference_frame:frame})),
    sync:{beat_1_index:0,beat_1_source_frame:1000,beat_1_start_seconds:.125,beat_1_start_pips:16,
      sync_phase_offset_pips:-16,exact_phase_offset_pips:'-16',canonical_first_beat_pip:0,pips_per_beat:64},
    beat_timeline:positions.map((frame,beat)=>({beat,source_frame:frame,time_seconds:frame/8000,pip:beat*64,consensus_reference_frame:frame})),
    tempo_segments:positions.slice(1).map((f,i)=>({start_frame:positions[i],end_frame:f,bpm:60*8000/(f-positions[i])}))};
}
test('consensus positions, phase and tempo are exact at anchors and vary per interval',()=>{
  const d=validateBeatTimeline(map());
  assert.equal(tickAtSeconds(d,.125),0);
  assert.equal(tickAtSeconds(d,0),-4);
  assert.equal(tempoAtSeconds(d,.625),120);
  assert.ok(Math.abs(tempoAtSeconds(d,1.125)-60/.645)<1e-8);
  assert.equal(phasePipsAtSeconds(d,1.125),128);
  assert.equal(tickAtSeconds(d,(1.125+1.77)/2),40);
  assert.equal(d.beats.length,5);
});
test('new Beat 1 and nonintegral pre-roll offset behave correctly',()=>{
  const m=map();m.origin_beat=2;
  m.beat_timeline.forEach(x=>{x.pip-=128;});
  m.sync={...m.sync,beat_1_index:2,beat_1_source_frame:9000,beat_1_start_seconds:1.125,beat_1_start_pips:144,
    sync_phase_offset_pips:-144,exact_phase_offset_pips:'-144'};
  const v=validateBeatTimeline(m);assert.equal(tickAtSeconds(v,1.125),0);assert.equal(tickAtSeconds(v,0),-36);
});
test('strict master identity, schema and derived timestamp mismatches are rejected',()=>{
  for(const mutation of [d=>d.pips_per_beat=16,d=>d.source_audio.sha256='wrong',d=>d.beats[1].frame=1000,
    d=>d.sync.sync_phase_offset_pips=-15,d=>d.sync.exact_phase_offset_pips='-15',
    d=>d.beat_timeline[2].pip=129,d=>d.tempo_segments[0].bpm=115,
    d=>d.beats[1].source='manual',d=>d.origin_beat=99]) {
    const m=map();mutation(m);assert.throws(()=>validateBeatTimeline(m));
  }
});
test('full source map needs verified URL for runtime; offline parser accepts StemLab export',()=>{
  assert.throws(()=>validateBeatTimeline(map(),{requireSourceUrl:true}));
  const m=map();m.source_url='https://example.test/master.wav';
  assert.equal(validateBeatTimeline(m,{requireSourceUrl:true}).source_url,m.source_url);
  m.source_url='javascript:alert(1)';assert.throws(()=>validateBeatTimeline(m,{requireSourceUrl:true}));
});
test('integer skipped beats integrate proportional phase without interpolating detections',()=>{
  const m=map();m.beats.slice(2).forEach(r=>r.beat++);m.beat_timeline.slice(2).forEach(r=>{r.beat++;r.pip+=64;});
  m.tempo_segments[1].bpm*=2;
  m.tempo_segments.slice(2).forEach(r=>{r.bpm=r.bpm;});
  const v=validateBeatTimeline(m);assert.equal(phasePipsAtSeconds(v,1.125),192);assert.equal(tempoAtSeconds(v,.8),240);
});
