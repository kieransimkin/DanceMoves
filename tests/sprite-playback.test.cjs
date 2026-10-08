const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/dance-moves-effects.js'), 'utf8');
const audioListeners = new Map();
const documentListeners = new Map();
const media = new Map();
const frames = [];
let frameSerial = 0;

function emitter(store) {
  return {
    addEventListener(name, handler) { if (!store.has(name)) store.set(name, []); store.get(name).push(handler); },
    removeEventListener(name, handler) { store.set(name, (store.get(name) || []).filter(item => item !== handler)); }
  };
}
function emit(store, name) { for (const handler of store.get(name) || []) handler({ type: name }); }
function mediaQuery(query) {
  if (!media.has(query)) {
    const handlers = new Map();
    media.set(query, Object.assign(emitter(handlers), { matches: false, handlers }));
  }
  return media.get(query);
}
function style() {
  return { values: new Map(), setProperty(name, value) { this.values.set(name, value); }, getPropertyValue(name) { return this.values.get(name) || ''; } };
}
function runFrame(now) {
  let record;
  while ((record = frames.shift())) {
    if (!record.cancelled) { record.handler(now); return; }
  }
  throw new Error('No active animation frame was scheduled');
}

const target = { nodeType: 1, dataset: {}, style: style() };
const root = {
  nodeType: 1,
  dataset: {},
  style: style(),
  querySelector(selector) { return selector === 'audio' ? audio : null; }
};
const audio = Object.assign(emitter(audioListeners), { nodeType: 1, currentTime: .08, paused: true, ended: false, playbackRate: 1 });
const document = Object.assign(emitter(documentListeners), {
  hidden: false,
  querySelector(selector) { return selector === '.ks-epk' ? root : null; },
  dispatchEvent() {}
});
const window = {
  DanceMoves: { version: '3.1.13', durationMilliseconds(ticks) { return ticks * 10; }, onCue() { return () => {}; } },
  matchMedia: mediaQuery,
  requestAnimationFrame(handler) { const record = { id: ++frameSerial, handler, cancelled: false }; frames.push(record); return record.id; },
  cancelAnimationFrame(id) { const record = frames.find(item => item.id === id); if (record) record.cancelled = true; },
  clearTimeout,
  setTimeout,
  performance: { now: () => 0 }
};
class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }

vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, Array, Object, Number, Math });

const rendered = [];
const sprite = window.DanceMovesEffects.spritePlayback({
  id: 'test:sprite', root, audio, target,
  frameCount: 64,
  columns: 16,
  framesPerRow: 8,
  columnOffset: 8,
  cycleTicks: 32,
  phaseOffsetSeconds: .08,
  staticFrame: 0,
  qualityFramesPerSecond: [60, 30, 15],
  render(state) { rendered.push({ reason: state.reason, frame: state.frame, localFrame: state.localFrame, phase: state.phase }); }
});

assert.equal(sprite.snapshot().localFrame, 0);
assert.equal(sprite.snapshot().frame, 8, 'right-hand half starts at atlas column 8');
assert.equal(target.style.getPropertyValue('--dance-moves-sprite-cycle-duration'), '0.320000s');

audio.paused = false;
audio.currentTime = .16;
emit(audioListeners, 'play');
assert.equal(sprite.snapshot().localFrame, 16, 'play restores from media currentTime rather than a timer counter');
assert.equal(sprite.snapshot().column, 8);
assert.equal(sprite.snapshot().row, 2);
assert.equal(sprite.snapshot().frame, 40);

audio.currentTime = .24;
runFrame(0);
assert.equal(sprite.snapshot().localFrame, 32);
assert.equal(sprite.snapshot().frame, 72, 'paired atlas row and column mapping remains deterministic');

sprite.setQuality('minimal', 'test-downgrade');
assert.equal(sprite.snapshot().qualityTier, 'minimal');
audio.currentTime = .28;
runFrame(5);
const afterFirstMinimalFrame = sprite.snapshot();
audio.currentTime = .30;
runFrame(10);
assert.equal(sprite.snapshot().frame, afterFirstMinimalFrame.frame, 'minimal tier limits render frequency');
audio.currentTime = .36;
runFrame(80);
assert.equal(sprite.snapshot().localFrame, 56, 'throttled updates still derive the exact frame from media time');

audio.currentTime = .20;
audio.paused = true;
emit(audioListeners, 'pause');
assert.equal(sprite.snapshot().localFrame, 24, 'pause freezes the pose at current media time');
assert.equal(sprite.snapshot().running, false);

emit(audioListeners, 'seeking');
audio.currentTime = .32;
emit(audioListeners, 'seeked');
assert.equal(sprite.snapshot().localFrame, 48, 'paused seeking reconstructs the frame without starting a loop');
audio.playbackRate = 2;
emit(audioListeners, 'ratechange');
assert.equal(sprite.snapshot().localFrame, 48, 'playbackRate changes do not double-scale media-clock phase');

audio.paused = false;
emit(audioListeners, 'play');
const reduced = mediaQuery('(prefers-reduced-motion: reduce)');
reduced.matches = true;
emit(reduced.handlers, 'change');
assert.equal(sprite.snapshot().localFrame, 0, 'reduced motion uses the declared static frame');
assert.equal(sprite.snapshot().running, false);
reduced.matches = false;
emit(reduced.handlers, 'change');
assert.equal(sprite.snapshot().localFrame, 48, 'motion restoration reconstructs from currentTime');
assert.equal(sprite.snapshot().running, true);

document.hidden = true;
emit(documentListeners, 'visibilitychange');
assert.equal(sprite.snapshot().localFrame, 0, 'hidden documents stop work and expose a static pose');
document.hidden = false;
audio.currentTime = .12;
emit(documentListeners, 'visibilitychange');
assert.equal(sprite.snapshot().localFrame, 8, 'visibility recovery resumes from the actual media position');

const mappedTarget = { nodeType: 1, dataset: {}, style: style() };
const mapped = window.DanceMovesEffects.spritePlayback({
  id: 'test:mapped-sprite', root, audio, target: mappedTarget,
  columns: 4,
  frameMap: [3, 6, 9, 12],
  cycleTicks: 32,
  phaseOffsetSeconds: .08
});
audio.paused = true;
audio.currentTime = .24;
emit(audioListeners, 'pause');
assert.equal(mapped.snapshot().frame, 9, 'frameMap supports non-contiguous atlas layouts');
assert.equal(mapped.snapshot().column, 1);
assert.equal(mapped.snapshot().row, 2);

mapped.teardown();
sprite.teardown();
assert.equal(window.DanceMovesEffects.get('test:sprite'), null);
assert.equal(window.DanceMovesEffects.get('test:mapped-sprite'), null);
assert.equal(rendered.at(-1).reason, 'teardown');
console.log('DanceMoves sprite playback media-clock and lifecycle contracts passed.');
