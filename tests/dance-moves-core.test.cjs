const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/dance-moves-core.js"), "utf8");

function load(config = {}) {
  const listeners = {};
  const properties = new Map();
  const document = {
    readyState: "loading",
    documentElement: {
      dataset: {},
      style: { setProperty: (name, value) => properties.set(name, value) }
    },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    dispatchEvent() {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const window = {
    danceMovesConfig: config,
    console,
    fetch: async () => ({ ok: true, text: async () => "" }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {}
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, WeakSet });
  return { api: window.DanceMoves, document, listeners, properties };
}

const fallback = load();
assert.equal(fallback.api.bpm, 120);
assert.equal(fallback.api.bpmSource, "fallback");
assert.equal(fallback.api.ticksPerBeat, 16);
assert.equal(fallback.api.durationMilliseconds(16), 500);

assert.equal(fallback.api.quantizeTicks(1.4), 1);
assert.equal(fallback.api.quantizeTicks(1.5), 2);
assert.equal(fallback.api.quantizeTicks(16), 16);
assert.equal(fallback.api.quantizeTicks(17), 16);
assert.equal(fallback.api.quantizeTicks(24), 32);
assert.equal(fallback.api.quantizeTicks(108), 112);
assert.equal(fallback.api.quantizeTicks(396), 400);
assert.equal(fallback.api.quantizeTicks(552), 560);
assert.equal(fallback.api.nextIntervalTick(16, 3), 16);
assert.equal(fallback.api.nextIntervalTick(16, 16), 16);
assert.equal(fallback.api.nextIntervalTick(16, 16, true), 32);
assert.equal(fallback.api.nextIntervalTick(64, 65), 128);
for (const helper of ["onNextInterval", "onEveryInterval", "onNextBeat", "onEveryBeat", "onNextBar", "onEveryBar"]) {
  assert.equal(typeof fallback.api[helper], "function", `${helper} is public`);
}

const clay = load({ bpm: 116, bpmSource: "explicit", version: "2.0.0" });
assert.equal(clay.api.bpm, 116);
assert.equal(clay.api.bpmSource, "explicit");
assert.ok(Math.abs(clay.api.durationMilliseconds(32) - 1034.4827586) < 0.0001);

const cues = clay.api.parseTimingFile([
  "[ti:Test]",
  "[00:00.04][SECTION: INTRO]",
  "[01:12.45][DROP: CHORUS 1]",
  "[05:54.22][TAG: FINAL LINE]"
].join("\n"));
assert.equal(cues.length, 3);
assert.equal(cues[0].time, 0.04);
assert.equal(cues[1].time, 72.45);
assert.equal(cues[1].type, "DROP");
assert.equal(cues[1].name, "CHORUS 1");
assert.equal(cues[2].normalisedName, "FINAL LINE");
assert.deepEqual(Array.from(clay.api.parseTimingFile("[00:00.00]A\n[00:01.00]B"), cue => cue.time), [0, 1]);
assert.equal(clay.api.parseTimingFile("bad\uFFFDfile").length, 0);

let played = 0;
const target = {
  nodeType: 1,
  matches: selector => selector === ".owned",
  closest: () => null
};
const animation = {
  effect: { target },
  playState: "running",
  currentTime: 99,
  playbackRate: 1,
  play() { played += 1; }
};
const root = {
  contains: item => item === target,
  getAnimations: () => [animation]
};
clay.api.registerAnimationScope(root, [".owned"]);
assert.equal(clay.api.resetRunningAnimations({ playbackRate: 1.5 }), 1);
assert.equal(animation.currentTime, 0);
assert.equal(animation.playbackRate, 1.5);
assert.equal(played, 1);

let calls = 0;
const unsubscribe = clay.api.onCue("Chorus 1", () => { calls += 1; });
assert.equal(typeof unsubscribe, "function");
unsubscribe();

console.log("DanceMoves timing, cue parsing and animation ownership tests passed");
