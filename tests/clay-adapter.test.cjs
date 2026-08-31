const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const productionSource = fs.readFileSync(path.join(repoRoot, "assets", "clay-stars-effects.js"), "utf8");
const productionCss = fs.readFileSync(path.join(repoRoot, "assets", "clay-stars-effects.css"), "utf8");
const adapterSource = fs.readFileSync(path.join(__dirname, "harness", "clay-stars", "effect-under-test-adapter.js"), "utf8");
const manifestPath = path.join(__dirname, "harness", "clay-stars", "clay-stars.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { this.listeners.set(type, [...(this.listeners.get(type) || []), handler]); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); }
  dispatch(type, event = {}) { for (const handler of [...(this.listeners.get(type) || [])]) handler.call(this, { type, ...event }); }
  listenerCount() { return [...this.listeners.values()].reduce((sum, items) => sum + items.length, 0); }
}

function styleDeclaration() {
  const values = new Map();
  return {
    setProperty(name, value) { values.set(name, String(value)); },
    removeProperty(name) { values.delete(name); },
    getPropertyValue(name) { return values.get(name) || ""; },
    values
  };
}

class Element extends Target {
  constructor(name) {
    super();
    this.name = name;
    this.style = styleDeclaration();
    this.dataset = {};
    this.isConnected = true;
    this.hovered = false;
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name)
    };
  }
  matches(selector) { return selector === ":hover" ? this.hovered : false; }
  getBoundingClientRect() { return { left: 10, top: 20, width: 200, height: 100 }; }
}

function createEnvironment({ withRoot = true, withMotion = true, withAudio = true } = {}) {
  const cover = new Element("cover");
  const control = new Element("control");
  const audio = new Element("audio");
  const root = new Element("root");
  const documentTarget = new Target();
  documentTarget.hidden = false;
  documentTarget.activeElement = null;
  documentTarget.querySelector = selector => selector === ".ks-epk.ks-clay-stars-v2" && withRoot ? root : null;
  const mediaReduce = new Target();
  mediaReduce.matches = false;
  const mediaFine = new Target();
  mediaFine.matches = true;
  root.querySelector = selector => selector === ".epk-cover-wrap" ? cover : selector === "audio" && withAudio ? audio : null;
  root.querySelectorAll = selector => selector.includes("epk-button") ? [control] : [];

  let rafId = 0;
  let timerId = 0;
  const rafs = new Map();
  const timers = new Map();
  let computedStyleReads = 0;
  let cueHandler = null;
  let cueMetadata = null;
  let cueUnsubscribed = false;
  let animationScope = null;
  const windowTarget = new Target();
  Object.assign(windowTarget, {
    requestAnimationFrame(callback) { const id = ++rafId; rafs.set(id, callback); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { timers.delete(id); },
    getComputedStyle() { computedStyleReads += 1; return { opacity: ".86", transform: "matrix(1, 0, 0, 1, 2, -2)" }; },
    matchMedia(query) { return query.includes("reduced-motion") ? mediaReduce : mediaFine; }
  });
  if (withMotion) {
    windowTarget.DanceMoves = {
      durationMilliseconds(ticks) { return ticks * 10; },
      registerAnimationScope(target, selectors) { animationScope = { target, selectors }; },
      onCue(name, handler, metadata) { cueHandler = handler; cueMetadata = { name, metadata }; return () => { cueUnsubscribed = true; }; }
    };
  }
  const context = vm.createContext({ window: windowTarget, document: documentTarget, console });
  vm.runInContext(productionSource, context, { filename: "clay-stars-effects.js" });
  return {
    window: windowTarget, document: documentTarget, root, cover, control, audio, mediaReduce, mediaFine, rafs, timers,
    flushRaf(timestamp = 16.667) { const callbacks = [...rafs.values()]; rafs.clear(); callbacks.forEach(callback => callback(timestamp)); },
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(item => item.callback()); },
    get computedStyleReads() { return computedStyleReads; },
    get cueHandler() { return cueHandler; },
    get cueMetadata() { return cueMetadata; },
    get cueUnsubscribed() { return cueUnsubscribed; },
    get animationScope() { return animationScope; }
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

const env = createEnvironment();
const effect = env.window.DanceMovesClayStars;
assert.ok(effect, "P-030 target page initialises the Clay runtime");
assert.equal(effect.defaults.masterIntensity, 2, "P-033 Clay phone-motion gain defaults to the reviewed 2x setting");
assert.equal(createEnvironment({ withRoot: false }).window.DanceMovesClayStars, undefined, "P-030 unknown page receives no runtime");
assert.equal(env.animationScope.target, env.root);
assert.equal(env.cueMetadata.name, "*");
assert.equal(env.cueMetadata.metadata.id, "clay-stars:cue-state", "P-043 wildcard handler has a stable ID");

const reviewedGain = createEnvironment();
reviewedGain.window.DanceMovesClayStars.setMotion({ x: 1, y: -1 });
reviewedGain.flushRaf();
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-ry"), "2.300deg");
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-rx"), "2.300deg");
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-tx"), "8.000px");
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-bloom-x"), "16.000px");
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-flare-x"), "36.000px");
assert.equal(reviewedGain.cover.style.getPropertyValue("--ks-spec-x"), "-48.000px", "P-033 reviewed 2x gain remains inside the existing visual bounds");

const clamped = effect.setParameters({
  enabled: true,
  masterIntensity: 9,
  coverTiltDegrees: 9,
  coverTranslationPixels: 99,
  bloomTravelPixels: 99,
  flareTravelPixels: 99,
  specularTravelPixels: 99,
  particleReleaseTicks: 999
});
assert.deepEqual(JSON.parse(JSON.stringify(clamped)), {
  enabled: true,
  masterIntensity: 2,
  coverTiltDegrees: 4,
  coverTranslationPixels: 16,
  bloomTravelPixels: 32,
  flareTravelPixels: 48,
  specularTravelPixels: 64,
  particleReleaseTicks: 128
}, "P-033 live parameters clamp to documented bounds");
assert.equal(env.root.style.getPropertyValue("--ks-particle-release-duration"), "1280.000000ms");

effect.setMotion({ x: -1, y: 1 });
effect.setMotion({ x: .5, y: -.25 });
assert.equal(env.rafs.size, 1, "P-033 latest motion sample coalesces to one frame");
env.flushRaf();
assert.equal(env.cover.style.getPropertyValue("--ks-ry"), "4.000deg");
assert.equal(env.cover.style.getPropertyValue("--ks-rx"), "2.000deg");
assert.equal(env.cover.style.getPropertyValue("--ks-tx"), "16.000px");
assert.equal(env.cover.style.getPropertyValue("--ks-spec-x"), "-64.000px");

env.control.hovered = true;
env.control.dispatch("pointerenter");
assert.equal(env.rafs.size, 1, "P-033 particle snapshot schedules one frame");
env.flushRaf();
assert.equal(env.computedStyleReads, 1, "P-033 particle snapshot performs one computed-style read");
assert.equal(env.rafs.size, 0, "P-033 particle snapshot has no recurring rAF loop");
env.control.hovered = false;
env.control.dispatch("pointerleave");
assert.equal(env.control.classList.contains("ks-particle-release"), true);
assert.equal(env.timers.size, 1);
env.flushTimers();
assert.equal(env.control.classList.contains("ks-particle-release"), false);

env.document.activeElement = env.control;
env.control.dispatch("focus");
env.flushRaf();
env.document.activeElement = null;
env.control.dispatch("blur");
assert.equal(env.control.classList.contains("ks-particle-release"), true, "P-035 focus/blur has the same bounded release path");
env.flushTimers();

const readsBeforeDetach = env.computedStyleReads;
env.control.isConnected = true;
env.control.hovered = true;
env.control.dispatch("pointerenter");
env.control.isConnected = false;
env.flushRaf();
assert.equal(env.computedStyleReads, readsBeforeDetach, "P-045 detached controls are not sampled");
assert.equal(effect.snapshot().particles.pendingFrames, 0);
env.control.isConnected = true;

env.cueHandler({ normalisedName: "CHORUS 1", normalisedType: "DROP" });
assert.equal(env.root.dataset.danceMovesCue, "chorus-1");
assert.equal(env.root.dataset.danceMovesCueType, "drop");
env.audio.dispatch("seeking");
assert.equal(effect.snapshot().cue, "");
env.audio.dispatch("seeked");
assert.equal(effect.snapshot().cue, "seeked", "P-033 seek lifecycle is deterministic");

env.document.hidden = true;
env.document.dispatch("visibilitychange");
assert.equal(effect.snapshot().lifecycle, "hidden");
env.document.hidden = false;
env.document.dispatch("visibilitychange");
assert.equal(effect.snapshot().lifecycle, "visible");
env.mediaReduce.matches = true;
env.mediaReduce.dispatch("change");
assert.equal(env.cover.style.getPropertyValue("--ks-rx"), "0.000deg", "P-036 reduced motion neutralises tilt");
assert.equal(env.root.style.getPropertyValue("--ks-master-intensity"), "2", "P-036 reduced motion does not hide content state");

env.mediaReduce.matches = false;
effect.reset();
const listenerBaseline = env.root.listenerCount() + env.cover.listenerCount() + env.control.listenerCount() + env.audio.listenerCount();
const frameDurations60 = [];
const frameDurations120 = [];
for (let index = 0; index < 3600; index += 1) {
  const start = process.hrtime.bigint();
  effect.setMotion({ x: Math.sin(index), y: Math.cos(index) });
  env.flushRaf(index * 8.333);
  effect.lifecycle(index % 900 === 0 ? "hidden" : "visible");
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  frameDurations60.push(elapsed);
  frameDurations120.push(elapsed);
}
assert.ok(percentile(frameDurations60, .95) <= 4.2, "P-041 synthetic 60 Hz rAF work stays inside the reference budget");
assert.ok(percentile(frameDurations120, .95) <= 2.1, "P-042 synthetic 120 Hz rAF work stays inside the reference budget");
assert.equal(env.rafs.size, 0);
assert.equal(env.timers.size, 0);
assert.equal(env.root.listenerCount() + env.cover.listenerCount() + env.control.listenerCount() + env.audio.listenerCount(), listenerBaseline, "P-045 virtual five-minute lifecycle run has no listener growth");

const cueDurations = [];
for (let index = 0; index < 1000; index += 1) {
  const start = process.hrtime.bigint();
  env.cueHandler({ normalisedName: `CUE ${index}`, normalisedType: "TEST" });
  cueDurations.push(Number(process.hrtime.bigint() - start) / 1e6);
}
assert.ok(percentile(cueDurations, .95) <= (1000 / 120) * .25, "P-043 named Clay cue handler stays inside a 120 Hz quarter-frame software budget");

effect.teardown();
assert.equal(effect.snapshot().destroyed, true);
assert.equal(env.rafs.size, 0);
assert.equal(env.timers.size, 0);
assert.equal(env.cueUnsubscribed, true, "P-045 teardown removes the named cue handler");

assert.ok(createEnvironment({ withMotion: false, withAudio: false }).window.DanceMovesClayStars, "P-046 missing core/audio leaves a readable effect API without throwing");

const keyframeStart = productionCss.indexOf("@keyframes");
const firstMediaAfterKeyframes = productionCss.indexOf("@media", keyframeStart);
const keyframes = productionCss.slice(keyframeStart, firstMediaAfterKeyframes === -1 ? undefined : firstMediaAfterKeyframes);
assert.doesNotMatch(keyframes, /background-position\s*:/i, "P-034 no keyframe animates background-position");
assert.doesNotMatch(keyframes, /\b(?:width|height|top|right|bottom|left|inset|margin|padding|gap)\s*:/i, "P-034 no keyframe animates layout properties");
assert.doesNotMatch(keyframes, /filter\s*:/i, "P-034 no keyframe animates filter");
assert.doesNotMatch(productionCss, /will-change\s*:[^;]*(?:filter|background-position)/i, "P-034 permanent filter/background-position promotion is absent");
assert.match(productionCss, /--ks-particle-release-duration/);
assert.match(productionCss, /prefers-reduced-motion:\s*reduce/);
assert.match(productionCss, /forced-colors:\s*active/);
assert.match(productionCss, /\\1214E\s+\\1202D\s+\\121A0/, "P-038 Cuneiform remains transport-safe CSS escapes");
assert.doesNotMatch(productionCss, /\uFFFD/);

assert.equal(manifest.effect.pageId, 252);
assert.equal(manifest.release.bpm, 116);
assert.equal(manifest.release.bpmSource, "verified");
assert.equal(manifest.release.masterSha256, "03F681507F47389AD6E7085C9C0167D74F6AC24A6F2ABC497CA356AEDBE1B838");
assert.equal(manifest.cues.length, 19);
assert.deepEqual(manifest.preview.viewports.map(item => item.width), [1440, 900, 390]);
assert.ok(manifest.cues.every((cue, index) => index === 0 || cue.time > manifest.cues[index - 1].time));
for (const id of ["effect-enabled", "master-intensity", "particle-release-ticks", "cover-tilt-degrees", "cover-translation-pixels", "bloom-travel-pixels", "flare-travel-pixels", "specular-travel-pixels", "cue-state-scenario"]) {
  assert.ok(manifest.parameters.some(parameter => parameter.id === id), `manifest control missing: ${id}`);
}

for (const [asset, expected] of Object.entries(manifest.effect.productionHashes)) {
  assert.match(expected, /^[A-F0-9]{64}$/, `production hash must be pinned: ${asset}`);
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.resolve(path.dirname(manifestPath), asset))).digest("hex").toUpperCase();
  assert.equal(actual, expected, `production hash mismatch: ${asset}`);
}

assert.match(adapterSource, /DanceMovesClayStars/);
assert.match(adapterSource, /setParameters/);
assert.match(adapterSource, /setMotion/);
assert.doesNotMatch(adapterSource, /style\.setProperty|getComputedStyle|requestAnimationFrame|classList\./, "P-033 harness adapter contains no duplicated visual logic");

const adapterCalls = { parameters: [], motion: [], cues: [], states: [], diagnostics: null, resets: 0 };
const adapterRoot = {};
const adapterProduction = {
  root: adapterRoot,
  setParameters(value) { adapterCalls.parameters.push(value); },
  setMotion(value) { adapterCalls.motion.push(value); },
  setCueState(value) { adapterCalls.states.push(value); },
  reset() { adapterCalls.resets += 1; },
  snapshot() { return { ready: true }; }
};
const adapterWindow = {
  DanceMovesClayStars: adapterProduction,
  DanceMoves: {
    fireCue(cue) { adapterCalls.cues.push(cue); return cue; },
    setDiagnosticsSink(sink) { adapterCalls.diagnostics = sink; return true; }
  }
};
vm.runInContext(adapterSource, vm.createContext({
  window: adapterWindow,
  document: { querySelector: selector => selector === manifest.effect.rootSelector ? adapterRoot : null },
  console
}), { filename: "clay-stars-effect-under-test-adapter.js" });
const harnessAdapter = adapterWindow.EPKEffectUnderTest;
harnessAdapter.configure(manifest);
const defaults = Object.fromEntries(manifest.parameters.map(item => [item.id, item.default]));
harnessAdapter.applyParameters(defaults, "cue-state-scenario");
harnessAdapter.setMotion({ x: .25, y: -.4 });
harnessAdapter.fireCue(manifest.cues[0]);
assert.equal(harnessAdapter.registerCueHandlers({ recordDiagnostic() {} })[0], "clay-stars:cue-state");
assert.equal(adapterCalls.parameters[0].coverTiltDegrees, 1.15);
assert.deepEqual(adapterCalls.motion[0], { x: .25, y: -.4 });
assert.equal(adapterCalls.cues[0].name, "INTRO");
assert.equal(adapterCalls.states[0], null);
harnessAdapter.applyParameters({ ...defaults, "cue-state-scenario": "bridge" }, "cue-state-scenario");
assert.equal(adapterCalls.states.at(-1).name, "BRIDGE");
harnessAdapter.reset();
assert.equal(adapterCalls.resets, 1, "P-033 harness reset delegates to production");

const php = fs.readFileSync(path.join(repoRoot, "kieran-epk-device-orientation.php"), "utf8");
assert.match(php, /DANCE_MOVES_CLAY_STARS_PAGE_ID\s*===\s*\(int\) \$page_id\s*&&\s*!defined\('KS_CLAY_STARS_EFFECTS_VERSION'\)/, "P-031 legacy plugin suppresses shared assets");
assert.match(php, /defined\('KS_CLAY_STARS_EFFECTS_VERSION'\).*dance_moves_clay_stars_is_target/s, "P-031 legacy plugin suppresses shared transform");
for (const selector of ["epk-actions > p:empty", "ks-clay-stars-chapters > br", "epk-artwork > p:empty"]) {
  assert.ok(productionCss.includes(selector), `P-039 scoped WordPress formatting selector missing: ${selector}`);
}

const candidate = fs.readFileSync(path.join(repoRoot, "qa", "clay-stars-harness-candidate.html"), "utf8");
assert.ok(candidate.indexOf("harness-probe.js") < candidate.indexOf("dance-moves-core.js"), "probe loads before production core");
assert.ok(candidate.indexOf("clay-stars-effects.js") < candidate.indexOf("effect-under-test-adapter.js"), "thin adapter loads after the production Clay runtime");
assert.equal((candidate.match(/class="ks-warm-bloom"/g) || []).length, 1, "P-032 candidate has one warm bloom");
assert.equal((candidate.match(/class="ks-lens-flare"/g) || []).length, 1, "P-032 candidate has one lens flare");
assert.equal((candidate.match(/class="ks-specular-sweep"/g) || []).length, 1, "P-032 candidate has one specular sweep");
assert.doesNotMatch(candidate, /kieran-made-from-clay-stars-epk-effects\/assets/, "P-031 candidate has no legacy effect assets");

console.log("Clay/Stars P-030 through P-040 and P-043 through P-046 automated contracts passed");
console.log("P-041/P-042 synthetic software budgets passed; physical 60 Hz/120 Hz evidence remains BLOCKED until device runs");
