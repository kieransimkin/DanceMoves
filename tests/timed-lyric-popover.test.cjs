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
      version: "2.5.1",
      bpm: 148,
      bpmSource: "explicit",
      masterDurationMilliseconds: 10000,
      lyricTimingUrl: "/lyrics.lrc",
      lyricPopupsEnabled: true
    },
    console,
    performance: { now: () => 0 },
    fetch: async () => ({ ok: true, text: async () => "[00:00.00]First line\n[00:01.00]\n[00:01.00]Second line" }),
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
  const firstEvent = documentEvents.find(event => event.type === "dance-moves-lyric" && event.detail.text === "First line");
  assert.equal(firstEvent.detail.nextTime, 1);
  assert.equal(firstEvent.detail.nextText, "", "the immediate blank cue remains observable");
  assert.equal(firstEvent.detail.nextIndex, 1);
  assert.equal(firstEvent.detail.nextVisibleTime, 1, "the next visible lyric may share a blank cue timestamp");
  assert.equal(firstEvent.detail.nextVisibleText, "Second line");
  assert.equal(firstEvent.detail.nextVisibleIndex, 2);
  assert.equal(firstEvent.detail.previousVisibleTime, null);
  assert.equal(firstEvent.detail.previousVisibleText, "");
  assert.equal(firstEvent.detail.previousVisibleIndex, -1);

  audio.currentTime = 1.1;
  frames.shift()();
  assert.equal(popover.children[0].textContent, "Second line");
  const lastEvent = documentEvents.find(event => event.type === "dance-moves-lyric" && event.detail.text === "Second line");
  assert.equal(lastEvent.detail.nextTime, null);
  assert.equal(lastEvent.detail.nextText, "");
  assert.equal(lastEvent.detail.nextIndex, -1);
  assert.equal(lastEvent.detail.nextVisibleTime, null);
  assert.equal(lastEvent.detail.nextVisibleText, "");
  assert.equal(lastEvent.detail.nextVisibleIndex, -1);
  assert.equal(lastEvent.detail.previousVisibleTime, 0);
  assert.equal(lastEvent.detail.previousVisibleText, "First line", "blank entries are skipped when finding the previous visible lyric");
  assert.equal(lastEvent.detail.previousVisibleIndex, 0);

  audio.paused = true;
  audioListeners.pause();
  assert.equal(popover.dataset.danceMovesLyricState, "idle");

  console.log("DanceMoves timed lyric pop-over playback test passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
