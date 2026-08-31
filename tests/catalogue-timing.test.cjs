const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/dance-moves-catalogue-timing.js"), "utf8");

assert.match(source, /animation-duration/);
assert.match(source, /animation-delay/);
assert.match(source, /transition-duration/);
assert.match(source, /transition-delay/);
assert.match(source, /motion\.quantizeTicks\(rawTicks\)/);
assert.match(source, /motion\.durationMilliseconds\(ticks\)/);
assert.match(source, /REDUCED_MOTION_MAXIMUM_MILLISECONDS/);
assert.match(source, /VIEW_TIMELINE_SENTINEL_MILLISECONDS/);
assert.match(source, /registerAnimationScope\(root, \["\*"\]\)/);
assert.match(source, /ROOT_SELECTORS/);
assert.match(source, /rulesOwnRoot/);
assert.match(source, /convertComputedDeclaration/);
assert.match(source, /convertPseudoDeclarations/);
assert.match(source, /dance-moves-catalogue-pseudo-timing/);
assert.match(source, /prefers-reduced-motion: reduce/, "the adopter should enforce reduced-motion across the owned EPK subtree");
assert.match(source, /animation-iteration-count:1 !important/, "reduced-motion should stop repeating catalogue animations");
assert.match(source, /MutationObserver/);
assert.match(source, /requestAnimationFrame/);
assert.doesNotMatch(source, /setInterval|setTimeout/);
assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|wp-json|admin-ajax/i);

const root = {
  id: "",
  classList: ["ks-epk"],
  getAttribute: () => "fixture",
  querySelectorAll: () => [],
  contains: () => true,
  dataset: {},
  style: {
    getPropertyValue() { return ""; },
    getPropertyPriority() { return ""; },
    setProperty() {},
    [Symbol.iterator]: function* () {}
  }
};
const animationRule = {
  type: 1,
  selectorText: ".ks-epk .ambient",
  style: {
    values: {
      "animation-duration": "7.5s",
      "animation-delay": "-3.5s",
      "transition-duration": "0.2s",
      "transition-delay": "0.01ms"
    },
    getPropertyValue(name) { return this.values[name] || ""; },
    getPropertyPriority() { return ""; },
    setProperty(name, value) { this.values[name] = value; },
    [Symbol.iterator]: function* () { yield* Object.keys(this.values); }
  }
};
const viewRule = {
  type: 1,
  selectorText: ".ks-epk .view-reveal",
  style: {
    values: { "animation-duration": "1ms", "animation-timeline": "view()" },
    getPropertyValue(name) { return this.values[name] || ""; },
    getPropertyPriority() { return ""; },
    setProperty(name, value) { this.values[name] = value; },
    [Symbol.iterator]: function* () { yield* Object.keys(this.values); }
  }
};
const documentElement = { dataset: {} };
const document = {
  querySelector: selector => selector === ".ks-epk" ? root : null,
  querySelectorAll: () => [root],
  styleSheets: [{ href: null, cssRules: [animationRule, viewRule] }],
  createElement() { return { id: "", textContent: "" }; },
  head: { appendChild() {} },
  documentElement
};
const motion = {
  bpm: 120,
  bpmSource: "fallback",
  quantizeTicks(value) {
    let ticks = Math.max(1, Math.floor(Number(value) + 0.5));
    if (ticks > 16) ticks = Math.max(16, Math.floor(ticks / 16 + 0.5) * 16);
    return ticks;
  },
  durationMilliseconds(ticks) { return 31.25 * ticks; },
  registerAnimationScope(scopeRoot, selectors) {
    assert.equal(scopeRoot, root);
    assert.equal(Array.from(selectors).join(","), "*");
    return () => {};
  }
};
const window = {
  DanceMoves: motion,
  danceMovesConfig: { pageId: 248 },
  requestAnimationFrame(callback) { callback(); return 1; },
  addEventListener() {},
  getComputedStyle() {
    return {
      animationTimeline: "auto",
      getPropertyValue() { return ""; }
    };
  },
  MutationObserver: function () { this.observe = () => {}; }
};

vm.runInNewContext(source, { window, document, MutationObserver: window.MutationObserver, Set, Array, Number, String });

assert.equal(animationRule.style.values["animation-duration"], "7500.000000ms", "7.5 seconds becomes 240 ticks at 120 BPM");
assert.equal(animationRule.style.values["animation-delay"], "-3500.000000ms", "negative phase remains a signed integer tick duration");
assert.equal(animationRule.style.values["transition-duration"], "187.500000ms", "0.2 seconds becomes 6 ticks at 120 BPM");
assert.equal(animationRule.style.values["transition-delay"], "0.01ms", "reduced-motion sentinel remains authoritative");
assert.equal(viewRule.style.values["animation-duration"], "1ms", "view-timeline interpolation sentinel stays view-driven");
assert.equal(root.dataset.danceMovesCatalogueTiming, "ready");
assert.equal(documentElement.dataset.danceMovesCatalogueTiming, "ready");
assert.equal(window.DanceMovesCatalogueTiming.snapshot().conversionCount, 3);

console.log("DanceMoves catalogue-wide CSS timing adoption tests passed");
