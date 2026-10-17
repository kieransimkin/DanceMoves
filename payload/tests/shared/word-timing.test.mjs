import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseWordTimingFile} from '../../src/word-timing.mjs';

const nearly=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('StemLab words.tsv with probability and exact per-word start/end',()=>{
  const raw='start\tend\tprobability\tword\n0.125000\t0.250000\t0.72\tHello\n0.300000\t0.480000\t0.96\tworld';
  const rows=parseWordTimingFile(raw);
  assert.equal(rows.length,2);
  nearly(rows[0].start,0.125);nearly(rows[1].end,0.48);
  assert.equal(rows[1].text,'world');assert.ok(Object.isFrozen(rows));
});
test('enhanced LRC, standalone one-word LRC and StemLab JSON are supported',()=>{
  const enhanced=parseWordTimingFile('[00:00.10]<00:00.125>Hello <00:00.420>world');
  assert.deepEqual(enhanced.map(x=>x.word),['Hello','world']);
  nearly(enhanced[0].time,.125);nearly(enhanced[1].time,.42);
  const simple=parseWordTimingFile('[00:01.05]hello\n[00:01.25]world');
  assert.deepEqual(simple.map(x=>x.time),[1.05,1.25]);
  const json=parseWordTimingFile(JSON.stringify({schema:'stemlab.word-timings.v1',words:[{start:0.1,end:0.4,word:'Hi'}]}));
  assert.equal(json[0].word,'Hi');assert.equal(json[0].end,.4);
});
test('bad ordering, empty words, missing columns, mixed timestamps and oversize fail closed',()=>{
  for(const source of [
    'start\tend\tword\n1\t2\tLate\n0.5\t0.6\tEarly',
    'start\tend\tword\n0.5\t0.4\tBackwards',
    '[00:00.10]hello\n[00:00.09]wrong',
    '[00:00.10]hello\nuntimed text',
    '{"words":[{"start":0.1,"end":0.2,"word":""}]}',
    '[00:00.1] ',
    'start\tend\tprobability\n0.1\t0.3\t0.9',
    '\uFFFD',
    'x'.repeat(1048577),
  ]) assert.throws(()=>parseWordTimingFile(source));
});
test('word events use source time and remain independent of line lyrics',async()=>{
  // Legacy core is transformed by build-modules, which injects the shared word parser.
  const helper=fs.readFileSync(new URL('../../src/word-timing.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
  const core=fs.readFileSync(new URL('../../assets/dance-moves-core.js',import.meta.url),'utf8');
  const listeners=new Map(),events=[];
  const document={readyState:'loading',baseURI:'https://example.test/',
    addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent(evt){events.push(evt);return true;},
    querySelector(){return null;},querySelectorAll(){return [];}};
  const host={danceMovesConfig:{bpm:120,wordTimingUrl:'https://example.test/words.tsv'},performance:{now:()=>0},console};
  const context={window:host,document,console,URL,Map,Set,WeakSet,TextEncoder,TextDecoder,Uint8Array,CustomEvent};
  vm.runInNewContext(helper+'\n'+core,context);
  const api=host.DanceMoves;
  const words=api.parseWordTimingFile('[00:00.12]first\n[00:00.64]second');
  assert.equal(words[0].word,'first');
  assert.equal(typeof api.onWord,'function');
  const messages=[];const unsub=api.onWord(w=>messages.push(w.word));
  // Simulate no renderer/audio discovery: registering callbacks does not alter line playback.
  assert.equal(messages.length,0);unsub();
  assert.equal(typeof api.onLyric,'function');
  assert.equal(typeof api.parseLyricTimingFile,'function');
});
