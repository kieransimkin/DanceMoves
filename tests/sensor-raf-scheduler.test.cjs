const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../assets/ks-epk-device-orientation-core.js");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../assets/ks-epk-device-orientation.js"), "utf8");

function identityMapper() {
  return { push: point => ({ ...point }), reset() {} };
}

function schedulerFixture(mapper = identityMapper()) {
  let clock = 0;
  let nextFrame = 1;
  const frames = new Map();
  const commits = [];
  const rejected = [];
  const scheduler = Core.createLatestSampleRafScheduler({
    mapper,
    requestFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
    now: () => clock,
    commit(x, y, detail) { commits.push({ x, y, detail }); },
    reject(event) { rejected.push(event); },
  });
  return {
    scheduler,
    frames,
    commits,
    rejected,
    setClock(value) { clock = value; },
    flush(value = clock) {
      clock = value;
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback(value));
    },
  };
}

// P-023 and P-024: one pending display frame and the final valid sample wins.
const burst = schedulerFixture();
for (let index = 0; index < 240; index += 1) {
  burst.setClock(index / 10);
  assert.equal(burst.scheduler.receive({ beta: index, gamma: index * -2 }, 0, index / 10), true);
}
assert.equal(burst.frames.size, 1, "a 240-event burst schedules one display frame");
assert.equal(burst.commits.length, 0, "sensor delivery performs no visual commit");
burst.flush(24);
assert.equal(burst.commits.length, 1);
assert.deepEqual(burst.commits[0].detail.sample, { x: -478, y: 239 }, "the final valid sample is committed, not a burst average");
burst.flush(40);
assert.equal(burst.commits.length, 1, "no fresh sample means no visual commit");

// P-021: invalid input is ignored and cannot replace a valid pending sample.
const finite = schedulerFixture();
finite.scheduler.receive({ beta: 4, gamma: 8 }, 0, 1);
for (const event of [{}, { beta: null, gamma: 1 }, { beta: NaN, gamma: 1 }, { beta: 1, gamma: Infinity }]) {
  assert.equal(finite.scheduler.receive(event, 0, 2), false);
}
assert.equal(finite.frames.size, 1);
finite.flush(16);
assert.deepEqual(finite.commits[0].detail.sample, { x: 8, y: 4 });
assert.equal(finite.rejected.length, 4);

// P-022: time-based smoothing has the same response over equal elapsed time.
const oneStep = Core.smoothTimeBased({ x: 0, y: 0 }, { x: 1, y: -1 }, 32, 32);
const halfStep = Core.smoothTimeBased({ x: 0, y: 0 }, { x: 1, y: -1 }, 16, 32);
const twoSteps = Core.smoothTimeBased(halfStep, { x: 1, y: -1 }, 16, 32);
assert.ok(Math.abs(oneStep.x - twoSteps.x) < 1e-12);
assert.ok(Math.abs(oneStep.y - twoSteps.y) < 1e-12);

function runAtFrequency(hz) {
  const fixture = schedulerFixture();
  fixture.scheduler.receive({ beta: 0, gamma: 0 }, 0, 0);
  fixture.flush(0);
  const interval = 1000 / hz;
  for (let time = interval; time <= 500 + 0.001; time += interval) {
    fixture.setClock(time);
    fixture.scheduler.receive({ beta: -1, gamma: 1 }, 0, time);
    fixture.flush(time);
  }
  return fixture.commits.at(-1);
}

const frequencyResults = [20, 60, 120, 240].map(runAtFrequency);
for (const result of frequencyResults) {
  assert.ok(result.x > 0.99 && result.y < -0.99, "20/60/120/240 Hz runs converge within the same elapsed time");
}
assert.ok(Math.max(...frequencyResults.map(result => result.x)) - Math.min(...frequencyResults.map(result => result.x)) < 0.002);

// P-026: the production rolling mapper and scheduler keep fuzzed outputs bounded.
const bounded = schedulerFixture(Core.createRollingMapper(2000, 1.5));
for (let index = 0; index < 1000; index += 1) {
  const magnitude = index % 2 ? 1e9 : -1e9;
  bounded.setClock(index * 4);
  bounded.scheduler.receive({ beta: magnitude, gamma: -magnitude }, (index % 4) * 90, index * 4);
  bounded.flush(index * 4);
}
assert.ok(bounded.commits.every(result => Number.isFinite(result.x) && Number.isFinite(result.y) && Math.abs(result.x) <= 1 && Math.abs(result.y) <= 1));

// P-027: reset and teardown cancel pending work.
const lifecycleScheduler = schedulerFixture();
lifecycleScheduler.scheduler.receive({ beta: 2, gamma: 4 }, 0, 0);
assert.equal(lifecycleScheduler.scheduler.pending(), true);
lifecycleScheduler.scheduler.reset();
assert.equal(lifecycleScheduler.scheduler.pending(), false);
lifecycleScheduler.flush(16);
assert.equal(lifecycleScheduler.commits.length, 0);
lifecycleScheduler.scheduler.receive({ beta: 2, gamma: 4 }, 0, 20);
lifecycleScheduler.scheduler.teardown();
lifecycleScheduler.flush(32);
assert.equal(lifecycleScheduler.commits.length, 0);
assert.equal(lifecycleScheduler.scheduler.receive({ beta: 1, gamma: 1 }, 0, 40), false);

// P-029: DOM targets are rate-limited while the newest target is retained for
// a trailing CSS transition, and sub-threshold sensor jitter is suppressed.
{
  let clock = 0;
  let nextTimer = 1;
  const timers = new Map();
  const commits = [];
  const targets = Core.createTransitionTargetScheduler({
    intervalMilliseconds: 65,
    minimumDelta: 0.02,
    now: () => clock,
    schedule(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    cancel(id) { timers.delete(id); },
    commit(x, y, detail) { commits.push({ x, y, detail }); },
  });
  assert.equal(targets.receive(0, 0, { sampleAge: 2 }), true);
  assert.equal(commits.length, 1, "the first usable target is immediate");
  clock = 16;
  targets.receive(0.2, -0.2, { sampleAge: 3 });
  clock = 32;
  targets.receive(0.7, -0.6, { sampleAge: 4 });
  assert.equal(commits.length, 1, "rapid input does not write the DOM every frame");
  assert.equal(timers.size, 1, "one trailing target timer owns the burst");
  clock = 65;
  [...timers.values()][0].callback();
  timers.clear();
  assert.deepEqual({ x: commits.at(-1).x, y: commits.at(-1).y }, { x: 0.7, y: -0.6 });
  clock = 130;
  targets.receive(0.71, -0.61, {});
  assert.equal(commits.length, 2, "two-axis jitter below the minimum delta is ignored");
  targets.reset();
  assert.equal(targets.pending(), false);
  targets.teardown();
  assert.equal(targets.receive(1, 1, {}), false);
}

// P-025: production hot paths contain no layout reads or fixed-cadence batching.
assert.doesNotMatch(runtimeSource, /ksOrientationBatch|batchMilliseconds|pendingBatch|pushBatch\(/);
assert.doesNotMatch(runtimeSource, /getBoundingClientRect|getComputedStyle|offset(?:Width|Height|Top|Left)|scroll(?:Width|Height|Top|Left)|client(?:Width|Height|Top|Left)/);

function runtimeEnvironment({ permission = false, adapter = "dmitri-my-talisman" } = {}) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const orientationListeners = new Set();
  const reducedListeners = new Set();
  const frames = new Map();
  const timers = new Map();
  const controls = [];
  const observers = [];
  const properties = new Map();
  const claySamples = [];
  const clayTargetSamples = [];
  const clayLifecycle = [];
  let nextFrame = 1;
  let nextTimer = 1;
  let clock = 0;
  let reduced = false;

  function add(collection, name, callback) {
    if (!collection.has(name)) collection.set(name, new Set());
    collection.get(name).add(callback);
  }
  function remove(collection, name, callback) { collection.get(name)?.delete(callback); }
  function emit(collection, name, event = {}) { for (const callback of [...(collection.get(name) || [])]) callback(event); }

  const reducedMedia = {
    get matches() { return reduced; },
    addEventListener(name, callback) { if (name === "change") reducedListeners.add(callback); },
    removeEventListener(name, callback) { if (name === "change") reducedListeners.delete(callback); },
    addListener(callback) { reducedListeners.add(callback); },
    removeListener(callback) { reducedListeners.delete(callback); },
  };
  const classes = new Set();
  const root = {
    isConnected: true,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    dataset: {},
    querySelector: () => null,
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
    },
  };
  for (const property of ["offsetWidth", "offsetHeight", "scrollWidth", "scrollHeight", "clientWidth", "clientHeight"]) {
    Object.defineProperty(root, property, { get() { throw new Error(`layout read: ${property}`); } });
  }

  function OrientationEvent() {}
  if (permission) OrientationEvent.requestPermission = async () => "granted";

  class MutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }

  const window = {
    DeviceOrientationEvent: OrientationEvent,
    KSEpkOrientationCore: Core,
    ksEpkOrientationConfig: {
      adapter,
      pageId: adapter === "clay-stars" ? 252 : adapter === "california-screamin" ? 839 : 298,
      bpm: adapter === "clay-stars" ? 116 : adapter === "california-screamin" ? 110 : 120,
      ticksPerBeat: 16,
      transitionTargetTicks: 2,
    },
    navigator: { userAgent: "Mozilla/5.0 (iPhone) Mobile", maxTouchPoints: 5 },
    screen: {
      width: 390,
      orientation: {
        angle: 0,
        addEventListener(name, callback) { if (name === "change") orientationListeners.add(callback); },
        removeEventListener(name, callback) { if (name === "change") orientationListeners.delete(callback); },
      },
    },
    innerWidth: 390,
    matchMedia(query) {
      if (query.includes("prefers-reduced-motion")) return reducedMedia;
      return { matches: query.includes("pointer: coarse") || query.includes("max-width") };
    },
    performance: { now: () => clock },
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay = 0) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { add(windowListeners, name, callback); },
    removeEventListener(name, callback) { remove(windowListeners, name, callback); },
    MutationObserver,
  };
  if (adapter === "clay-stars") {
    window.DanceMovesClayStars = {
      root,
      setMotion(sample) { claySamples.push({ ...sample }); },
      setMotionTarget(sample) { clayTargetSamples.push({ ...sample }); },
      lifecycle(state) { clayLifecycle.push(state); },
    };
  }
  const document = {
    readyState: "complete",
    hidden: false,
    documentElement: {},
    body: { append(control) { controls.push(control); } },
    addEventListener(name, callback) { add(documentListeners, name, callback); },
    removeEventListener(name, callback) { remove(documentListeners, name, callback); },
    getElementById: () => null,
    querySelector: selector => {
      if (adapter === "clay-stars" && selector === ".ks-epk.ks-clay-stars-v2") return root;
      if (adapter === "california-screamin" && selector.includes("#cs-epk.cs-epk")) return root;
      return selector === ".dmt-epk" ? root : null;
    },
    createElement() {
      const listeners = new Map();
      return {
        removed: false,
        setAttribute() {},
        addEventListener(name, callback) { listeners.set(name, callback); },
        remove() { this.removed = true; },
        listeners,
      };
    },
  };

  function load() { vm.runInNewContext(runtimeSource, { window, document, console }); }
  function flushFrame(timestamp) {
    clock = timestamp;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(timestamp));
  }
  return {
    window, document, root, properties, controls, observers, frames, orientationListeners, reducedListeners,
    claySamples, clayTargetSamples, clayLifecycle,
    load,
    emitWindow(name, event) { emit(windowListeners, name, event); },
    emitDocument(name, event) { emit(documentListeners, name, event); },
    listenerCount(name) { return windowListeners.get(name)?.size || 0; },
    flushFrame,
    flushTimers(timestamp, maximumDelay = Infinity) {
      clock = timestamp;
      const pending = [...timers.entries()].filter(([, item]) => item.delay <= maximumDelay);
      pending.forEach(([id]) => timers.delete(id));
      pending.forEach(([, item]) => item.callback());
    },
    setReduced(value) { reduced = value; for (const callback of [...reducedListeners]) callback({ matches: value }); },
  };
}

// P-027 and P-028: runtime lifecycle, neutral reset, adapter removal and reinitialisation.
const runtime = runtimeEnvironment();
runtime.load();
assert.equal(runtime.listenerCount("deviceorientation"), 1);
for (let index = 0; index < 240; index += 1) runtime.emitWindow("deviceorientation", { beta: index / 10, gamma: index / 20 });
assert.equal(runtime.frames.size, 1);
assert.equal(runtime.properties.size, 0, "the sensor callback performs no adapter writes");
runtime.flushFrame(16);
assert.equal(runtime.root.dataset.ksOrientation, "active");
assert.ok(runtime.properties.size > 0);

runtime.emitWindow("deviceorientation", { beta: 3, gamma: 6 });
runtime.document.hidden = true;
runtime.emitDocument("visibilitychange");
assert.equal(runtime.frames.size, 0);
assert.equal(runtime.properties.size, 0);
assert.equal(runtime.root.dataset.ksOrientation, "supported");

runtime.document.hidden = false;
runtime.emitWindow("deviceorientation", { beta: 3, gamma: 6 });
runtime.emitWindow("orientationchange");
assert.equal(runtime.frames.size, 0);
assert.equal(runtime.properties.size, 0);

runtime.setReduced(true);
assert.equal(runtime.listenerCount("deviceorientation"), 0);
runtime.setReduced(false);
assert.equal(runtime.listenerCount("deviceorientation"), 1);
runtime.emitWindow("deviceorientation", { beta: 1, gamma: 2 });
runtime.emitWindow("pagehide");
assert.equal(runtime.frames.size, 0);
assert.equal(runtime.listenerCount("deviceorientation"), 0);
runtime.emitWindow("pageshow");
assert.equal(runtime.listenerCount("deviceorientation"), 1);

runtime.load();
assert.equal(runtime.listenerCount("deviceorientation"), 1, "reinitialisation owns one sensor listener");
assert.equal(runtime.orientationListeners.size, 1, "reinitialisation owns one screen-orientation listener");
runtime.emitWindow("deviceorientation", { beta: 2, gamma: 4 });
runtime.root.isConnected = false;
runtime.observers.at(-1).callback([]);
assert.equal(runtime.frames.size, 0);
assert.equal(runtime.listenerCount("deviceorientation"), 0);
assert.equal(runtime.properties.size, 0);
assert.equal(runtime.orientationListeners.size, 0);

// The Clay/Stars page uses the shared device-orientation mapper and routes its
// bounded display coordinates into the release-specific public motion API.
const clay = runtimeEnvironment({ adapter: "clay-stars" });
clay.load();
assert.equal(clay.listenerCount("deviceorientation"), 1);
assert.equal(clay.clayLifecycle.at(-1), "visible");
assert.deepEqual(JSON.parse(JSON.stringify(clay.window.__ksEpkOrientationRuntime.snapshot())), {
  adapter: "clay-stars",
  active: false,
  listening: true,
  destroyed: false,
  latest: { x: 0, y: 0 },
  reducedMotion: false,
  documentHidden: false,
});
clay.emitWindow("deviceorientation", { beta: 0, gamma: 0 });
clay.flushFrame(0);
clay.emitWindow("deviceorientation", { beta: -12, gamma: 9 });
clay.flushFrame(32);
assert.equal(clay.clayTargetSamples.length, 1, "Clay does not add a nested per-frame DOM target");
clay.flushTimers(65, 100);
assert.ok(clay.clayTargetSamples.length >= 2, "Clay receives the latest trailing transition target");
assert.equal(clay.claySamples.length, 0, "the shared path bypasses Clay's pointer rAF scheduler");
assert.ok(Math.abs(clay.clayTargetSamples.at(-1).x) > 0.2, "Clay receives perceptually scaled horizontal motion");
assert.ok(Math.abs(clay.clayTargetSamples.at(-1).y) > 0.2, "Clay receives perceptually scaled vertical motion");
assert.equal(clay.root.dataset.ksOrientation, "active");
assert.equal(clay.window.__ksEpkOrientationRuntime.snapshot().active, true);
clay.setReduced(true);
assert.equal(clay.listenerCount("deviceorientation"), 0);
assert.equal(clay.clayLifecycle.at(-1), "visible", "visible reduced-motion reset remains neutral without inventing page visibility");

const california = runtimeEnvironment({ adapter: "california-screamin" });
california.load();
california.emitWindow("deviceorientation", { beta: 0, gamma: 0 });
california.flushFrame(0);
california.emitWindow("deviceorientation", { beta: 8, gamma: -10 });
california.flushFrame(32);
california.flushTimers(69, 100);
assert.equal(california.root.dataset.ksOrientationAdapter, "california-screamin");
assert.equal(california.root.dataset.ksOrientationTargetTicks, "2");
assert.ok(Math.abs(Number(california.properties.get("--cs-x"))) > 0.2);
assert.ok(Math.abs(Number(california.properties.get("--cs-y"))) > 0.2);
california.root.classList.add("motion-paused");
california.emitWindow("deviceorientation", { beta: -10, gamma: 10 });
california.flushFrame(140);
assert.equal(california.properties.get("--cs-x"), "0", "the page's Pause visual effects state remains authoritative");
assert.equal(california.properties.get("--cs-y"), "0");

// P-020: permission remains user-gesture gated and creates one control.
(async () => {
  const gated = runtimeEnvironment({ permission: true });
  gated.load();
  assert.equal(gated.listenerCount("deviceorientation"), 0);
  assert.equal(gated.controls.length, 1);
  await gated.controls[0].listeners.get("click")();
  assert.equal(gated.listenerCount("deviceorientation"), 1);
  console.log("DanceMoves sensor rAF scheduler tests P-020 through P-028 passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
