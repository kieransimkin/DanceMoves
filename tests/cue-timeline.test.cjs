const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/dance-moves-effects.js'), 'utf8');
const listeners = new Map();
const documentListeners = new Map();
const frames = [];
const media = new Map();

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

const classes = new Set();
const root = {
  nodeType: 1,
  dataset: {},
  style: { values: new Map(), setProperty(name, value) { this.values.set(name, value); }, getPropertyValue(name) { return this.values.get(name) || ''; } },
  classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, toggle(name, value) { value ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } },
  querySelector(selector) { return selector === 'audio' ? audio : null; }
};
const audio = Object.assign(emitter(listeners), { nodeType: 1, currentTime: 0, paused: true, ended: false, playbackRate: 1 });
const document = Object.assign(emitter(documentListeners), {
  hidden: false,
  querySelector(selector) { return selector === '.ks-epk' ? root : null; },
  dispatchEvent() {}
});
const window = {
  DanceMoves: { version: '2.8.0', durationMilliseconds(ticks) { return ticks * 10; }, onCue() { return () => {}; } },
  matchMedia: mediaQuery,
  requestAnimationFrame(handler) { frames.push(handler); return frames.length; },
  cancelAnimationFrame() {},
  clearTimeout,
  setTimeout,
  performance: { now: () => 0 }
};
class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }

vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, Array, Object, Number, Math });

const fired = [];
const rendered = [];
const timeline = window.DanceMovesEffects.cueTimeline({
  id: 'test:timeline', root, audio,
  cues: [
    { id: 'a', time: 1 },
    { id: 'b', time: 2, end: 3 },
    { id: 'c', time: 4 }
  ],
  onCue(event) { fired.push({ id: event.cue.id, reason: event.reason, generation: event.generation }); },
  render(state) { rendered.push({ reason: state.reason, time: state.time, active: state.active.map(cue => cue.id) }); }
});

assert.deepEqual(timeline.snapshot().fired, []);
audio.paused = false;
emit(listeners, 'play');
audio.currentTime = .9;
frames.shift()(16);
assert.deepEqual(fired, []);
audio.currentTime = 1.01;
frames.shift()(32);
assert.deepEqual(fired.map(item => item.id), ['a']);
audio.currentTime = 1.2;
frames.shift()(48);
assert.deepEqual(fired.map(item => item.id), ['a'], 'ordinary frames do not duplicate cues');

audio.paused = true;
emit(listeners, 'pause');
assert.equal(timeline.snapshot().status, 'paused');
audio.paused = false;
emit(listeners, 'play');
audio.currentTime = 1.4;
frames.shift()(64);
assert.deepEqual(fired.map(item => item.id), ['a'], 'resume does not replay the last cue');

emit(listeners, 'seeking');
audio.currentTime = 2.5;
emit(listeners, 'seeked');
assert.deepEqual(fired.map(item => item.id), ['a'], 'seeking across a cue does not manufacture a transient firing');
assert.deepEqual(timeline.snapshot().active, ['b'], 'seek reconstruction restores the active interval at currentTime');
audio.currentTime = 3.5;
frames.shift()(72);
audio.currentTime = 4.01;
frames.shift()(80);
assert.deepEqual(fired.map(item => item.id), ['a', 'c'], 'future crossings continue after seek restoration');

emit(listeners, 'seeking');
audio.currentTime = .5;
emit(listeners, 'seeked');
audio.currentTime = 1.01;
frames.shift()(96);
assert.deepEqual(fired.map(item => item.id), ['a', 'c', 'a'], 'a backward seek starts a new traversal without stale deduplication');

document.hidden = true;
emit(documentListeners, 'visibilitychange');
audio.currentTime = 2.6;
document.hidden = false;
emit(documentListeners, 'visibilitychange');
assert.deepEqual(timeline.snapshot().active, ['b'], 'visibility recovery rebuilds from the actual playback position');
assert.equal(rendered.at(-1).time, 2.6);

timeline.teardown();
assert.equal(window.DanceMovesEffects.get('test:timeline'), null);
console.log('DanceMoves cue timeline playback recovery contracts passed.');
