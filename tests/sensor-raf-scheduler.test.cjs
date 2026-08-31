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

// P-025: production hot paths contain no layout reads or fixed-cadence batching.
assert.doesNotMatch(runtimeSource, /ksOrientationBatch|batchMilliseconds|pendingBatch|pushBatch\(/);
assert.doesNotMatch(runtimeSource, /getBoundingClientRect|getComputedStyle|offset(?:Width|Height|Top|Left)|scroll(?:Width|Height|Top|Left)|client(?:Width|Height|Top|Left)/);

function runtimeEnvironment({ permission = false } = {}) {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const orientationListeners = new Set();
  const reducedListeners = new Set();
  const frames = new Map();
  const timers = new Map();
  const controls = [];
  const observers = [];
  const properties = new Map();
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
  const root = {
    isConnected: true,
    classList: { contains: () => false },
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
    ksEpkOrientationConfig: { adapter: "dmitri-my-talisman", pageId: 298 },
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
  const document = {
    readyState: "complete",
    hidden: false,
    documentElement: {},
    body: { append(control) { controls.push(control); } },
    addEventListener(name, callback) { add(documentListeners, name, callback); },
    removeEventListener(name, callback) { remove(documentListeners, name, callback); },
    getElementById: () => null,
    querySelector: selector => selector === ".dmt-epk" ? root : null,
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
    load,
    emitWindow(name, event) { emit(windowListeners, name, event); },
    emitDocument(name, event) { emit(documentListeners, name, event); },
    listenerCount(name) { return windowListeners.get(name)?.size || 0; },
    flushFrame,
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
