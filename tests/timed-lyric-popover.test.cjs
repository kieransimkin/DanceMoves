const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/dance-moves-core.js"), "utf8");

function element(tagName) {
  return {
    tagName,
    className: "",
    dataset: {},
    children: [],
    attributes: {},
    offsetWidth: 100,
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

(async () => {
  const listeners = {};
  const documentEvents = [];
  const body = element("body");
  const root = element("main");
  root.dataset = {};
  root.getAnimations = () => [];
  const audioListeners = {};
  const audio = {
    dataset: {},
    duration: 10,
    currentTime: 0,
    paused: true,
    ended: false,
    playbackRate: 1,
    addEventListener(name, handler) { audioListeners[name] = handler; }
  };
  const frames = [];
  const document = {
    readyState: "loading",
    body,
    documentElement: { dataset: {}, style: { setProperty() {} } },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatchEvent(event) { documentEvents.push(event); },
    createElement: element,
    querySelector(selector) { return selector === ".ks-epk" ? root : null; },
    querySelectorAll(selector) { return selector === "audio" ? [audio] : []; }
  };
  const window = {
    danceMovesConfig: {
      version: "2.4.0",
      bpm: 148,
      bpmSource: "explicit",
      masterDurationMilliseconds: 10000,
      lyricTimingUrl: "/lyrics.lrc",
      lyricPopupsEnabled: true
    },
    console,
    performance: { now: () => 0 },
    fetch: async () => ({ ok: true, text: async () => "[00:00.00]First line\n[00:01.00]\n[00:02.00]Second line" }),
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }

  vm.runInNewContext(source, { window, document, console, CustomEvent, Map, Set, WeakSet, Promise });
  listeners.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(document.documentElement.dataset.danceMovesLyricCount, "3");
  assert.equal(document.documentElement.dataset.danceMovesLyricStatus, "ready");
  assert.equal(body.children.length, 1, "opt-in renderer is appended once");
  const popover = body.children[0];
  assert.equal(popover.attributes["aria-hidden"], "true");
  assert.equal(popover.dataset.danceMovesLyricState, "idle");

  audio.paused = false;
  audioListeners.play();
  frames.shift()();
  assert.equal(popover.children[0].textContent, "First line");
  assert.equal(popover.dataset.danceMovesLyricState, "active");

  audio.currentTime = 1.1;
  frames.shift()();
  assert.equal(popover.children[0].textContent, "");
  assert.equal(popover.dataset.danceMovesLyricState, "idle", "blank canonical cue clears the pop-up");

  audio.currentTime = 2.1;
  frames.shift()();
  assert.equal(popover.children[0].textContent, "Second line");
  assert.ok(documentEvents.some(event => event.type === "dance-moves-lyric" && event.detail.text === "Second line"));

  audio.paused = true;
  audioListeners.pause();
  assert.equal(popover.dataset.danceMovesLyricState, "idle");

  console.log("DanceMoves timed lyric pop-over playback test passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
