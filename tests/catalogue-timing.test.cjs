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
assert.doesNotMatch(source, /ownedSheet\s*\|\|/, "a stylesheet containing one EPK selector must not transfer ownership to unrelated rules");
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
const unrelatedRule = {
  type: 1,
  selectorText: ".wp-admin .toolbar",
  style: {
    values: { "transition-duration": "0.4s" },
    getPropertyValue(name) { return this.values[name] || ""; },
    getPropertyPriority() { return ""; },
    setProperty(name, value) { this.values[name] = value; },
    [Symbol.iterator]: function* () { yield* Object.keys(this.values); }
  }
};
const documentElement = { dataset: {} };
let selectorCalls = 0;
let pseudoStyle;
const document = {
  querySelector: selector => selector === ".ks-epk" ? root : null,
  querySelectorAll: selector => { selectorCalls += 1; return String(selector).includes("ks-epk") ? [root] : []; },
  styleSheets: [{ href: null, cssRules: [animationRule, viewRule, unrelatedRule] }],
  createElement() { return { id: "", textContent: "" }; },
  head: { appendChild(element) { pseudoStyle = element; } },
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
let observerCallback;
let observerOptions;
const animationFrames = [];
const window = {
  DanceMoves: motion,
  danceMovesConfig: { pageId: 248 },
  requestAnimationFrame(callback) { animationFrames.push(callback); return animationFrames.length; },
  addEventListener() {},
  getComputedStyle() {
    return {
      animationTimeline: "auto",
      getPropertyValue() { return ""; }
    };
  },
  MutationObserver: function (callback) { observerCallback = callback; this.observe = (_root, options) => { observerOptions = options; }; }
};

vm.runInNewContext(source, { window, document, MutationObserver: window.MutationObserver, Set, Array, Number, String });

assert.equal(animationRule.style.values["animation-duration"], "7500.000000ms", "7.5 seconds becomes 240 ticks at 120 BPM");
assert.equal(animationRule.style.values["animation-delay"], "-3500.000000ms", "negative phase remains a signed integer tick duration");
assert.equal(animationRule.style.values["transition-duration"], "187.500000ms", "0.2 seconds becomes 6 ticks at 120 BPM");
assert.equal(animationRule.style.values["transition-delay"], "0.01ms", "reduced-motion sentinel remains authoritative");
assert.equal(viewRule.style.values["animation-duration"], "1ms", "view-timeline interpolation sentinel stays view-driven");
assert.equal(unrelatedRule.style.values["transition-duration"], "0.4s", "unrelated rules in a mixed stylesheet remain untouched");
assert.equal(root.dataset.danceMovesCatalogueTiming, "ready");
assert.equal(documentElement.dataset.danceMovesCatalogueTiming, "ready");
assert.equal(window.DanceMovesCatalogueTiming.snapshot().conversionCount, 3);
assert.equal(observerOptions.attributeOldValue, true, "the observer compares timing declarations before and after a style change");

const initialCss = pseudoStyle.textContent;
const initialSelectorCalls = selectorCalls;
const movingSprite = { closest: () => ({}) };
observerCallback([{ type: "attributes", target: movingSprite, oldValue: "transform:translateX(0px)" }]);
observerCallback([{ type: "childList", target: movingSprite, addedNodes: [{ nodeType: 1 }] }]);
assert.equal(animationFrames.length, 0, "arena animation must not trigger a catalogue-wide rescan");

const ordinaryElement = {
  closest: () => null,
  getAttribute: () => "transform:translateX(8px); animation-duration: 1s"
};
observerCallback([{ type: "attributes", target: ordinaryElement, oldValue: "transform:translateX(0px); animation-duration: 1s" }]);
assert.equal(animationFrames.length, 0, "a transform-only change outside the arena must not trigger a rescan");
ordinaryElement.getAttribute = () => "transform:translateX(8px); animation-duration: 2s";
observerCallback([{ type: "attributes", target: ordinaryElement, oldValue: "transform:translateX(0px); animation-duration: 1s" }]);
assert.equal(animationFrames.length, 1, "a timing change must still trigger adoption");
animationFrames.shift()(0);
assert.ok(selectorCalls > initialSelectorCalls);
assert.equal(pseudoStyle.textContent, initialCss, "repeat adoption must replace, not grow, generated CSS");

observerCallback([{ type: "childList", target: root, addedNodes: [{ nodeType: 1 }] }]);
assert.equal(animationFrames.length, 1, "new non-arena content must still trigger adoption");
animationFrames.shift()(0);
assert.equal(pseudoStyle.textContent, initialCss, "repeated non-arena adoption must remain bounded");

console.log("DanceMoves catalogue-wide CSS timing adoption tests passed");
