const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/dance-moves-effects.js'), 'utf8');

function emitter(store) {
  return {
    addEventListener(name, handler) { if (!store.has(name)) store.set(name, []); store.get(name).push(handler); },
    removeEventListener(name, handler) { store.set(name, (store.get(name) || []).filter(item => item !== handler)); }
  };
}
function emit(store, name) { for (const handler of store.get(name) || []) handler({ type: name }); }
function makeElement(tagName) {
  const values = new Map();
  return {
    nodeType: 1,
    tagName,
    className: '',
    dataset: {},
    children: [],
    parentNode: null,
    textContent: '',
    style: {
      setProperty(name, value) { values.set(name, value); },
      getPropertyValue(name) { return values.get(name) || ''; },
      removeProperty(name) { values.delete(name); }
    },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter(item => item !== child);
      child.parentNode = null;
      return child;
    },
    querySelector(selector) {
      if (selector === 'audio') return this.audio || null;
      if (selector === '.dance-moves-lyric-popover__text') return this.children.find(child => child.className.includes('dance-moves-lyric-popover__text')) || null;
      return null;
    }
  };
}

const audioListeners = new Map();
const documentListeners = new Map();
const windowListeners = new Map();
const media = new Map();
const frames = [];
const timers = [];
const lyricHandlers = [];
const cueHandlers = [];

function mediaQuery(query) {
  if (!media.has(query)) {
    const handlers = new Map();
    media.set(query, Object.assign(emitter(handlers), { matches: false, handlers }));
  }
  return media.get(query);
}

const root = makeElement('main');
const audio = Object.assign(makeElement('audio'), emitter(audioListeners), { currentTime: 0, paused: true, ended: false, playbackRate: 1 });
root.audio = audio;
const popover = makeElement('div');
const current = makeElement('span');
current.className = 'dance-moves-lyric-popover__text';
popover.appendChild(current);

const document = Object.assign(emitter(documentListeners), {
  hidden: false,
  createElement: makeElement,
  querySelector(selector) {
    if (selector === '.ks-epk') return root;
    if (selector === '.dance-moves-lyric-popover') return popover;
    return null;
  },
  dispatchEvent() {}
});
const motion = {
  version: '3.0.5',
  durationMilliseconds(ticks) { return ticks * 10; },
  onLyric(handler) { lyricHandlers.push(handler); return () => lyricHandlers.splice(lyricHandlers.indexOf(handler), 1); },
  onCue(name, handler) { cueHandlers.push(handler); return () => cueHandlers.splice(cueHandlers.indexOf(handler), 1); }
};
const window = Object.assign(emitter(windowListeners), {
  DanceMoves: motion,
  console,
  matchMedia: mediaQuery,
  requestAnimationFrame(handler) { frames.push(handler); return frames.length; },
  cancelAnimationFrame() {},
  setTimeout(handler, delay) { const timer = { handler, delay, active: true }; timers.push(timer); return timers.length; },
  clearTimeout(id) { if (timers[id - 1]) timers[id - 1].active = false; },
  performance: { now: () => 0 }
});
class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }

vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, Array, Object, Number, Math });

let cueRenders = 0;
let cueCleanups = 0;
let lyricRenders = 0;
let lyricCleanups = 0;
const stage = window.DanceMovesEffects.lyricStage({
  id: 'test:lyric-stage', root, audio, popover, travelTicks: 100,
  renderLyric() { lyricRenders += 1; return { durationTicks: 64, cleanup() { lyricCleanups += 1; } }; },
  renderCue() { cueRenders += 1; return () => { cueCleanups += 1; }; }
});

assert.equal(popover.dataset.danceMovesLyricStage, 'ready');
assert.equal(popover.children.length, 1, 'shared stage wraps the three lyric lines once');
assert.equal(popover.children[0].children[0].children.length, 3);
assert.equal(stage.snapshot().phase, 'paused');

lyricHandlers[0]({
  time: 1, text: 'Current', index: 2,
  previousVisibleText: 'Previous', previousVisibleIndex: 1,
  nextVisibleTime: 4, nextVisibleText: 'Next', nextVisibleIndex: 3
});
const track = popover.children[0].children[0];
assert.deepEqual(track.children.map(item => item.textContent), ['Previous', 'Current', 'Next']);
assert.equal(lyricRenders, 1);
const lyricTimer = timers.find(timer => timer.active && timer.delay === 640);
assert.ok(lyricTimer, 'DanceMoves owns the finite lyric callback lifetime');
lyricTimer.handler();
assert.equal(lyricCleanups, 1);

audio.currentTime = 2.5;
audio.paused = false;
emit(audioListeners, 'play');
assert.equal(stage.snapshot().phase, 'waiting');

audio.currentTime = 3.5;
emit(audioListeners, 'timeupdate');
assert.equal(stage.snapshot().phase, 'travelling');
frames.shift()();
assert.equal(stage.snapshot().progress, 0.5);
assert.equal(popover.style.getPropertyValue('--dance-moves-lyric-progress'), '0.50000');

cueHandlers[0]({ name: 'Chorus 1', normalisedName: 'CHORUS 1' });
assert.equal(cueRenders, 1);
assert.equal(stage.snapshot().cueCount, 1);
const cueTimer = timers.find(timer => timer.active && timer.delay === 320);
assert.ok(cueTimer, 'DanceMoves owns the finite cue callback lifetime');
cueTimer.handler();
assert.equal(cueCleanups, 1);

audio.paused = true;
emit(audioListeners, 'pause');
assert.equal(stage.snapshot().phase, 'paused');

mediaQuery('(prefers-reduced-motion: reduce)').matches = true;
emit(mediaQuery('(prefers-reduced-motion: reduce)').handlers, 'change');
assert.equal(stage.snapshot().phase, 'inactive');
assert.equal(stage.snapshot().progress, 0);

stage.teardown();
assert.equal(window.DanceMovesEffects.get('test:lyric-stage'), null);
assert.equal(popover.dataset.danceMovesLyricStage, undefined);
assert.equal(popover.children.at(-1), current, 'teardown restores the original current lyric element');

console.log('DanceMoves shared lyric stage lifecycle contracts passed.');
