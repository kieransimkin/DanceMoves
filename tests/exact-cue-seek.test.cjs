const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/dance-moves-core.js"), "utf8");

(async () => {
  const documentListeners = {};
  const documentEvents = [];
  const audioListeners = {};
  const frames = [];
  const root = { dataset: {}, getAnimations: () => [] };
  const audio = {
    dataset: {},
    duration: 10,
    currentTime: 0,
    paused: true,
    ended: false,
    playbackRate: 1,
    addEventListener(name, handler) { audioListeners[name] = handler; }
  };
  const document = {
    readyState: "loading",
    body: { appendChild() {} },
    documentElement: { dataset: {}, style: { setProperty() {} } },
    addEventListener(name, handler) { documentListeners[name] = handler; },
    dispatchEvent(event) { documentEvents.push(event); },
    querySelector(selector) { return selector === ".ks-epk" ? root : null; },
    querySelectorAll(selector) { return selector === "audio" ? [audio] : []; }
  };
  const window = {
    danceMovesConfig: {
      version: "2.5.0",
      bpm: 86,
      bpmSource: "explicit",
      masterDurationMilliseconds: 10000,
      cueTimingUrl: "/cues.lrc"
    },
    console,
    performance: { now: () => 0 },
    fetch: async () => ({
      ok: true,
      text: async () => "[00:00.00][SECTION: INTRO]\n[00:02.00][SECTION: FIRST CHORUS]\n[00:05.00][SECTION: OUTRO]"
    }),
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }

  vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, WeakSet, Promise });
  documentListeners.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(document.documentElement.dataset.danceMovesCueCount, "3");

  audioListeners.seeking();
  audio.currentTime = 2;
  audioListeners.seeked();
  assert.equal(documentEvents.filter(event => event.type === "dance-moves-cue").length, 0, "paused landing waits for playback");

  audio.paused = false;
  audioListeners.play();
  let cueEvents = documentEvents.filter(event => event.type === "dance-moves-cue");
  assert.equal(cueEvents.length, 1, "exact landing dispatches one cue on playback");
  assert.equal(cueEvents[0].detail.normalisedName, "FIRST CHORUS");

  audioListeners.playing();
  cueEvents = documentEvents.filter(event => event.type === "dance-moves-cue");
  assert.equal(cueEvents.length, 1, "play and playing do not duplicate the armed cue");

  audio.paused = true;
  audioListeners.pause();
  audioListeners.seeking();
  audio.currentTime = 3;
  audioListeners.seeked();
  audio.paused = false;
  audioListeners.play();
  cueEvents = documentEvents.filter(event => event.type === "dance-moves-cue");
  assert.equal(cueEvents.length, 1, "scrubbing into a section does not replay skipped cues");

  audioListeners.seeking();
  audio.currentTime = 5.03;
  audioListeners.seeked();
  cueEvents = documentEvents.filter(event => event.type === "dance-moves-cue");
  assert.equal(cueEvents.length, 2, "an in-playback landing within tolerance dispatches once");
  assert.equal(cueEvents[1].detail.normalisedName, "OUTRO");

  audioListeners.playing();
  cueEvents = documentEvents.filter(event => event.type === "dance-moves-cue");
  assert.equal(cueEvents.length, 2, "the in-playback landing remains single-shot");

  console.log("DanceMoves exact cue seek test passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
