import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateBeatAlignment} from '../../src/beat-alignment.mjs';
import {validatePageConfig,fromWordPressMeta} from '../../src/config.mjs';
import {readWordPressConfig} from '../../src/wordpress-config.mjs';
const reading = () => ({schema:'stemlab.beat-alignment.v1',source_sha256:'a'.repeat(64),source_url:'https://example.test/master.mp3',
  source_audio_verified:true,source_audio:{sample_rate:48000,num_frames:480000},bpm:120,exact_bpm:'120',bpm_basis:'canonical',bpm_status:'canonical',
  phase_status:'estimated',analysis_id:'consensus',evidence_sha256:'b'.repeat(64),report_sha256:'c'.repeat(64),
  first_beat_seconds:.125,first_beat_exact_seconds:'1/8',offset_pips:-16,exact_offset_pips:'-16',pips_per_beat:64,canonical_first_beat_pip:0});
function core(config) {
  const document={readyState:'loading',baseURI:'https://example.test/',addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};
  const window={danceMovesConfig:config,performance:{now:()=>1000},console};
  vm.runInNewContext(fs.readFileSync('assets/dance-moves-core.js','utf8'),{window,document,console,URL,Map,Set,WeakSet});
  return window.DanceMoves;
}
test('exact fractional alignment; analysis authority never becomes confirmed',()=>{
  assert.equal(validateBeatAlignment(reading()).phase_status,'estimated');
  const cfg=validatePageConfig({beatAlignment:{...reading(),bpm_status:'estimated',bpm_basis:'combined_fit'}});
  assert.equal(cfg.bpmSource,'analysis');assert.equal(cfg.bpm,120);
  assert.throws(()=>validatePageConfig({bpm:145,beatAlignment:reading()}),/disagree/);
});
test('reject mismatched rational, frame bounds, unsafe source, units and provenance',()=>{
  for(const change of [{exact_offset_pips:'-15'},{first_beat_seconds:10},{source_sha256:'wrong'},
    {source_url:'javascript:alert(1)'},{pips_per_beat:16},{source_audio_verified:'true'},
    {phase_status:'automatic-approval'},{exact_bpm:'1e999'},{report_sha256:null}]) assert.throws(()=>validateBeatAlignment({...reading(),...change}));
});
test('WordPress uses selected master attachment; scalar localization retains exact strings',async()=>{
  const r=reading();delete r.source_url;
  const cfg=await fromWordPressMeta({_dance_moves_beat_alignment:JSON.stringify(r),_dance_moves_beat_alignment_audio_id:42},id=>{assert.equal(id,42);return reading().source_url;});
  assert.equal(cfg.beatAlignment.source_url,reading().source_url);
  const wire={...reading(),bpm:'120',first_beat_seconds:'0.125',offset_pips:'-16',pips_per_beat:'64',canonical_first_beat_pip:'0',source_audio_verified:'1',source_audio:{sample_rate:'48000',num_frames:'480000'}};
  assert.equal(validatePageConfig(readWordPressConfig({beatAlignment:wire})).beatAlignment.exact_offset_pips,'-16');
});
test('first beat is pip zero; negative pre-beat phase and paused seeks preserve source clock',()=>{
  const api=core(validatePageConfig({beatAlignment:reading()}));
  const audio={currentTime:.125,paused:false,ended:false,currentSrc:reading().source_url};
  assert.equal(api.sourceTick(audio),0);assert.equal(api.currentTick({clock:'audio',audio}),0);assert.equal(audio.currentTime,.125);
  audio.currentTime=0;assert.equal(api.sourceTick(audio),-4);
  audio.currentTime=.625;audio.paused=true;assert.equal(api.sourceTick(audio),16);assert.equal(audio.currentTime,.625);
  audio.currentSrc='https://example.test/alternate.mp3';assert.equal(api.beatAlignmentState(audio).status,'source-mismatch');assert.equal(api.rhythmicTime(audio),.625);
});
test('mapped clip master time receives phase once; cue and lyric timestamps remain unchanged',()=>{
  const api=core(validatePageConfig({beatAlignment:reading()}));
  // Existing playback mapping has already converted preroll/clip time to master seconds.
  const transport={currentTime:3.125,paused:false,ended:false,masterSourceUrl:reading().source_url};
  assert.equal(api.sourceTick(transport),96);assert.equal(transport.currentTime,3.125);
  assert.deepEqual(Array.from(api.parseTimingFile('[00:03.125][DROP: chorus]'),r=>r.time),[3.125]);
  assert.deepEqual(Array.from(api.parseLyricTimingFile('[00:03.125]Original lyric'),r=>r.time),[3.125]);
});
