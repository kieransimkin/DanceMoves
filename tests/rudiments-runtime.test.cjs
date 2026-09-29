'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function emitter(object = {}) {
  const listeners = new Map();
  return Object.assign(object, {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { Array.from(listeners.get(event.type) || []).forEach(fn => fn(event)); return true; },
    fire(type, detail) { this.dispatchEvent({ type, detail }); },
    listenerCount() { return Array.from(listeners.values()).reduce((n, v) => n + v.size, 0); }
  });
}
function fixture(noWasm = false) {
  let pageTicks = 0, serial = 0;
  const frames = new Map(), media = new Map(), cues = new Set(), observers = [];
  const node = tagName => emitter({ nodeType: 1, tagName, isConnected: true, attributes: {},
    contains(e) { return e === target || e === audio || e === this; },
    hasAttribute(key) { return key in this.attributes; },
    getAttribute(key) { return this.attributes[key] ?? null; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    removeAttribute(key) { delete this.attributes[key]; },
    // No inline style surface: CSS mode must use a stylesheet, not DOM style mutations.
    remove() { this.isConnected = false; }
  });
  const root = node('MAIN'), target = node('DIV'), audio = node('AUDIO');
  Object.assign(audio, { currentTime: 0, paused: true, ended: false, seeking: false, playbackRate: 1 });
  const doc = emitter({ hidden: false, documentElement: node('HTML'), head: { appendChild() {} },
    querySelector(s) { return { '#root': root, '#target': target, '#audio': audio }[s] || null; },
    createElement(tag) {
      const n = node(tag); const rules = [];
      n.sheet = { cssRules: rules,
        insertRule(selector, index) { rules.splice(index, 0, { style: { values: {}, setProperty(k, v) { this.values[k] = v; } } }); return index; },
        deleteRule(index) { rules.splice(index, 1); }
      }; return n;
    }
  });
  class Observer { constructor(fn) { this.fn = fn; this.disconnected = false; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
  const win = emitter({ WebAssembly: noWasm ? null : WebAssembly, atob: value => Buffer.from(value, 'base64').toString('binary'),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    MutationObserver: class extends Observer { constructor(fn) { super(fn); this.kind = 'mutation'; } },
    IntersectionObserver: class extends Observer { constructor(fn) { super(fn); this.kind = 'intersection'; } },
    DanceMoves: { bpm: 90, currentTick: () => pageTicks, onCue(name, fn) { cues.add(fn); return () => cues.delete(fn); } },
    requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    matchMedia(query) { if (!media.has(query)) media.set(query, emitter({ matches: false })); return media.get(query); }
  });
  const context = { window: win, document: doc, console, Map, Set, WeakMap, Object, Array, Number, Math, Promise, DataView, Uint8Array };
  vm.runInNewContext(fs.readFileSync(path.join(base, 'assets/vendor/dancerudiments/dancerudiments-native.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(base, 'assets/dance-moves-rudiments.js'), 'utf8'), context);
  return { win, doc, root, target, audio, media, frames, observers, cues,
    setTicks(t) { pageTicks = t; },
    frame() { const pending = Array.from(frames.values()); frames.clear(); pending.forEach(fn => fn(0)); },
    option(id = 'test:one', extra = {}) { return { id, target, root, rudiment: 'clay_background', offscreen: false, ...extra }; }
  };
}
if (require.main === module) (async () => {
  const f = fixture(); const api = f.win.DanceMovesRudiments;
  check('API alias and metadata', () => { assert.equal(api, f.win.DanceMoves.rudiments); assert.equal(api.pipsPerTick, 4); assert.equal(api.catalogue().length, 15); });
  check('strict inputs before loading', () => { assert.throws(() => api.sample('clay_background', 0)); assert.throws(() => api.pipsFromTicks('1')); assert.throws(() => api.pipsFromSeconds(1, 401)); });
  assert.equal(api.ready(), api.ready()); await api.ready();
  check('native exact clay waypoints', () => { const p = api.sample('clay_background', 100); assert.equal(p.x, -1); assert.ok(Math.abs(p.y - .9) < 1e-12); assert.equal(api.sample('clay_background', 169).y, 1); });
  check('all catalogue pips, axes and negative wrapping', () => {
    for (const row of api.catalogue()) for (let p = 0; p < row.periodPips; p++) {
      const a = api.sample(row.name, p), b = api.sample(row.name, p - row.periodPips);
      for (const axis of ['x','y','z']) { assert.ok(Number.isFinite(a[axis])); assert.ok(Math.abs(a[axis]) <= 1.0000001); assert.equal(a[axis], b[axis]); }
    }
  });
  check('safe large pip inputs wrap before WASM i32', () => { const big = Number.MAX_SAFE_INTEGER; assert.equal(api.sample('clay_background', big).x, api.sample('clay_background', big % 256).x); });
  check('unknown, fractional and non-finite samples rejected', () => { for (const p of [.5, NaN, Infinity, 1e20]) assert.throws(() => api.sample('clay_background', p)); assert.throws(() => api.sample('bad', 0)); });
  check('musical unit conversions and floor', () => { assert.equal(api.pipsFromTicks(16), 64); assert.equal(api.pipsFromTicks(-.1), -1); assert.equal(api.pipsFromSeconds(60 / 90), 64); });
  check('mount option validation is synchronous', () => { for (const opt of [{ id: '' }, { rate: 0 }, { phasePips: .5 }, { clock: 'magic' }, { audio: f.target, clock: 'audio' }, { cssPrefix: 'bad{}' }, { amplitude: Infinity }]) assert.throws(() => api.animate(f.option('bad', opt))); });
  const draws = []; const h = api.animate(f.option('first', { render: d => draws.push(d) })); await h.ready;
  check('mount and CSSOM-only output', () => { assert.equal(h.snapshot().status, 'running'); assert.ok(f.target.hasAttribute('data-dance-moves-rudiment-owner')); assert.equal(api.get('first'), h); });
  check('duplicate IDs and CSS owners rejected', () => { assert.throws(() => api.animate(f.option('first', { css: false }))); assert.throws(() => api.animate(f.option('other'))); });
  const initialUpdates = h.snapshot().updates; f.frame();
  check('unchanged pip suppresses duplicate visual commits', () => assert.equal(h.snapshot().updates, initialUpdates));
  f.setTicks(25); f.frame();
  check('page clock samples tick*4', () => assert.equal(h.snapshot().pip, 100));
  const k = api.animate(f.option('second', { css: false })); await k.ready;
  check('two running controllers share one RAF', () => assert.equal(f.frames.size, 1));
  h.pause(); k.pause();
  check('local pause releases idle frame scheduler', () => { assert.equal(f.frames.size, 0); assert.equal(h.snapshot().status, 'paused'); });
  f.setTicks(42.25); h.resume();
  check('resume samples actual position, not elapsed timers', () => assert.equal(h.snapshot().pip, 169));
  h.reset();
  check('cue-style reset establishes new phase origin', () => assert.equal(h.snapshot().pip, 0));
  f.doc.hidden = true; f.doc.fire('visibilitychange');
  check('hidden page has no animation frame', () => { assert.equal(f.frames.size, 0); assert.equal(h.snapshot().status, 'hidden'); });
  f.setTicks(67.25); f.doc.hidden = false; f.doc.fire('visibilitychange');
  check('visibility restoration samples present position only', () => assert.equal(h.snapshot().pip, 100));
  for (const query of ['(prefers-reduced-motion: reduce)', '(forced-colors: active)']) {
    const m = f.win.matchMedia(query); m.matches = true; m.fire('change');
    check(query + ' neutral and idle', () => { assert.equal(h.snapshot().position.x, 0); assert.equal(f.frames.size, 0); });
    m.matches = false; m.fire('change');
  }
  h.setEnabled(false);
  check('quality-tier suspension and recovery', () => { assert.equal(h.snapshot().status, 'disabled'); assert.equal(f.frames.size, 0); h.setEnabled(true); assert.equal(h.snapshot().status, 'running'); });
  api.destroyAll();
  check('teardown restores CSS ownership and registry', () => { assert.equal(api.snapshot().instances.length, 0); assert.equal(f.frames.size, 0); assert.equal(f.target.hasAttribute('data-dance-moves-rudiment-owner'), false); });
  const a = api.animate(f.option('audio', { clock: 'audio', audio: f.audio, amplitude: { x: 14, y: 10 }, rate: .5 })); await a.ready;
  check('audio mode never falls back to page while paused', () => { assert.equal(a.snapshot().status, 'audio-paused'); assert.equal(a.snapshot().pip, 0); assert.equal(f.frames.size, 0); });
  f.audio.paused = false; f.audio.fire('play'); f.audio.currentTime = 100 / (90 / 60 * 64 * .5); f.frame();
  check('Clay eight-beat cycle at half native rate', () => { assert.equal(a.snapshot().pip, 100); assert.equal(a.snapshot().position.x, -14); assert.ok(Math.abs(a.snapshot().position.y - 9) < 1e-12); });
  f.audio.playbackRate = 2; f.audio.fire('ratechange');
  check('playback rate does not double-count audio.currentTime', () => assert.equal(a.snapshot().pip, 100));
  f.audio.seeking = true; f.audio.fire('seeking'); f.audio.currentTime = 169 / 48;
  check('seek freezes without intermediate renders', () => { assert.equal(f.frames.size, 0); assert.equal(a.snapshot().pip, 100); });
  f.audio.seeking = false; f.audio.fire('seeked');
  check('seek restores the exact landed native position', () => assert.equal(a.snapshot().pip, 169));
  f.audio.paused = true; f.audio.fire('pause'); f.setTicks(10000); f.frame();
  check('paused audio holds its own phase', () => assert.equal(a.snapshot().pip, 169));
  f.audio.ended = true; f.audio.fire('ended');
  check('end cancels animation work', () => { assert.equal(a.snapshot().status, 'ended'); assert.equal(f.frames.size, 0); });
  a.destroy(); a.destroy();
  check('destroy is idempotent and removes audio listeners', () => assert.equal(f.audio.listenerCount(), 0));
  f.audio.ended = false; f.audio.currentTime = 0;
  const auto = api.animate(f.option('auto', { clock: 'auto', audio: f.audio, resetOnCue: true })); await auto.ready;
  check('auto is ambient before the first play', () => assert.equal(auto.snapshot().sourceClock, 'page'));
  f.audio.paused = false; f.audio.fire('play'); f.audio.currentTime = 1; f.frame();
  f.audio.paused = true; f.audio.fire('pause');
  check('auto latches audio after playback, even on pause', () => { assert.equal(auto.snapshot().sourceClock, 'audio'); assert.equal(auto.snapshot().pip, 96); });
  f.cues.forEach(fn => fn({ audio: f.audio }));
  check('owned cue resets include paused state', () => assert.equal(auto.snapshot().pip, 0));
  auto.destroy();
  const doomed = api.animate(f.option('doomed')); doomed.destroy(); await doomed.ready;
  check('teardown before ready cannot resurrect a controller', () => { assert.equal(doomed.snapshot().destroyed, true); assert.equal(api.get('doomed'), null); });
  const remove = api.animate(f.option('remove')); await remove.ready; f.root.isConnected = false;
  f.observers.filter(o => !o.disconnected).forEach(o => o.fn([]));
  check('root removal releases controllers even without a playing clock', () => assert.equal(remove.snapshot().destroyed, true));
  f.root.isConnected = true;
  const broken = api.animate(f.option('broken', { render() { throw new Error('renderer failure'); } }));
  await assert.rejects(broken.ready);
  check('renderer errors stop loops and restore CSS ownership', () => { assert.equal(broken.snapshot().status, 'error'); assert.equal(f.frames.size, 0); assert.equal(f.target.hasAttribute('data-dance-moves-rudiment-owner'), false); });
  broken.destroy();
  const missing = fixture(true); const fail = missing.win.DanceMovesRudiments.animate(missing.option());
  await assert.rejects(fail.ready);
  check('WASM failure is explicit and never starts a JS movement mirror', () => { assert.equal(fail.snapshot().status, 'error'); assert.equal(missing.frames.size, 0); assert.equal(missing.target.hasAttribute('data-dance-moves-rudiment-owner'), false); });
  fail.destroy();
  console.log(`Completed ${checks} rudiment API contracts`);
})().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { fixture };
