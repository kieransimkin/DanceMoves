const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/dance-moves-core.js"), "utf8");

function load(diagnostics) {
  let clock = 0;
  let nextTimer = 1;
  const timers = new Map();
  const documentListeners = new Map();
  const dispatched = [];
  const style = new Map();
  const document = {
    readyState: "loading",
    documentElement: {
      dataset: {},
      style: { setProperty: (name, value) => style.set(name, value) },
    },
    addEventListener(name, handler) { documentListeners.set(name, handler); },
    dispatchEvent(event) { dispatched.push(event.type); return true; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
  const window = {
    danceMovesConfig: { pageId: 252, bpm: 120, diagnostics },
    performance: { now: () => clock },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { error() {} },
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; this.bubbles = options.bubbles; }
  }
  vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, WeakSet, Date });
  return {
    api: window.DanceMoves,
    dispatched,
    advance(milliseconds) { clock += milliseconds; },
    flushTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
  };
}

function exercise(diagnostics) {
  const environment = load(diagnostics);
  const records = [];
  if (diagnostics) assert.equal(environment.api.setDiagnosticsSink(record => records.push(record)), true);
  else assert.equal(environment.api.setDiagnosticsSink(record => records.push(record)), false);

  let named = 0;
  let wildcard = 0;
  let isolated = 0;
  const namedHandler = () => { named += 1; environment.advance(0.25); };
  environment.api.onCue("HARNESS PULSE", namedHandler, { id: "test:named" });
  environment.api.onCue("HARNESS PULSE", namedHandler, { id: "test:named" });
  const removeWildcard = environment.api.onCue("*", () => { wildcard += 1; }, "test:wildcard");
  environment.api.onCue("*", () => { environment.advance(0.1); throw new Error("isolated failure"); }, { id: "test:failing" });
  environment.api.onCue("*", () => { isolated += 1; }, { id: "test:isolated" });

  const first = environment.api.fireCue({ name: "HARNESS PULSE", type: "TEST", time: 1.5 });
  assert.equal(first.normalisedName, "HARNESS PULSE");
  assert.equal(first.audio, null);
  removeWildcard();
  environment.api.fireCue({ name: "HARNESS PULSE", type: "TEST", time: 2 });

  let intervalCalls = 0;
  environment.api.scheduleAtInterval(16, () => { intervalCalls += 1; environment.advance(0.5); }, { id: "test:interval" });
  environment.flushTimers();

  return { environment, records, named, wildcard, isolated, intervalCalls };
}

const withoutDiagnostics = exercise(false);
const withDiagnostics = exercise(true);

assert.equal(withoutDiagnostics.environment.api.diagnosticsEnabled(), false);
assert.equal(withDiagnostics.environment.api.diagnosticsEnabled(), true);
assert.deepEqual(
  { named: withDiagnostics.named, wildcard: withDiagnostics.wildcard, isolated: withDiagnostics.isolated, interval: withDiagnostics.intervalCalls, events: withDiagnostics.environment.dispatched },
  { named: withoutDiagnostics.named, wildcard: withoutDiagnostics.wildcard, isolated: withoutDiagnostics.isolated, interval: withoutDiagnostics.intervalCalls, events: withoutDiagnostics.environment.dispatched },
  "diagnostics must not alter callbacks or custom-event delivery"
);
assert.equal(withoutDiagnostics.records.length, 0, "production-off mode emits no records");

const handlerIds = withDiagnostics.records.filter(record => record.type === "cue-handler").map(record => record.handlerId);
for (const id of ["test:named", "test:wildcard", "test:failing", "test:isolated", "custom-event:dance-moves-cue", "custom-event:kieran-epk-cue"]) {
  assert.ok(handlerIds.includes(id), `diagnostics attribute ${id}`);
}
assert.ok(withDiagnostics.records.some(record => record.type === "cue-handler" && record.handlerId === "test:failing" && record.error === "isolated failure"));
assert.equal(withDiagnostics.records.filter(record => record.type === "cue-dispatch-total").length, 2);
assert.equal(withDiagnostics.records.filter(record => record.type === "animation-reset").length, 2);
assert.ok(withDiagnostics.records.some(record => record.type === "interval-handler" && record.handlerId === "test:interval" && record.duration === 0.5));
assert.ok(withDiagnostics.records.every(record => !Object.prototype.hasOwnProperty.call(record, "audio")), "diagnostic records remain scalar and data-only");

const throwingSink = load(true);
let deliveredThroughThrowingSink = 0;
throwingSink.api.onCue("SAFE", () => { deliveredThroughThrowingSink += 1; }, { id: "test:safe" });
throwingSink.api.setDiagnosticsSink(() => { throw new Error("sink failure"); });
assert.doesNotThrow(() => throwingSink.api.fireCue({ name: "SAFE" }));
assert.equal(deliveredThroughThrowingSink, 1, "sink failures cannot break cue delivery");
assert.equal(throwingSink.api.setDiagnosticsSink(null), true);
assert.equal(throwingSink.api.diagnosticsEnabled(), false);
assert.throws(() => { load(true).api.setDiagnosticsSink({}); }, /must be a function or null/);

function benchmark(diagnostics, iterations = 2000) {
  const environment = load(diagnostics);
  let recordCount = 0;
  environment.api.onCue("BENCHMARK", () => {}, { id: "benchmark:cue" });
  if (diagnostics) environment.api.setDiagnosticsSink(() => { recordCount += 1; });
  for (let index = 0; index < 100; index += 1) environment.api.fireCue({ name: "BENCHMARK" });
  recordCount = 0;
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) environment.api.fireCue({ name: "BENCHMARK" });
  const elapsedMilliseconds = Number(process.hrtime.bigint() - started) / 1e6;
  return { millisecondsPerCue: elapsedMilliseconds / iterations, recordCount };
}

const benchmarkOff = benchmark(false);
const benchmarkOn = benchmark(true);
assert.equal(benchmarkOff.recordCount, 0);
assert.equal(benchmarkOn.recordCount, 2000 * 5, "each diagnostic cue dispatch emits a fixed five-span envelope");
assert.ok(benchmarkOn.millisecondsPerCue < 2, "diagnostic overhead remains below the deliberately generous unit ceiling");
const overheadMicroseconds = Math.max(0, benchmarkOn.millisecondsPerCue - benchmarkOff.millisecondsPerCue) * 1000;

console.log(`DanceMoves diagnostics equivalence passed with ${withDiagnostics.records.length} bounded spans; Node wrapper overhead ${overheadMicroseconds.toFixed(3)} microseconds/cue`);
