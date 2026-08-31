(function (window, document) {
  "use strict";

  var motion = window.DanceMoves;
  var config = window.danceMovesConfig || {};
  var ROOT_SELECTORS = {
    130: ".dfad-motion-stage",
    137: ".birth-stories-page",
    140: "#light-will-win-top",
    150: ".mog-epk",
    298: ".dmt-epk",
    397: ".sft-epk",
    399: ".entry-content"
  };
  var root = document.querySelector(".ks-epk") || document.querySelector(ROOT_SELECTORS[Number(config.pageId)] || "[data-dance-moves-no-root]");
  var TIME_TOKEN = /(-?(?:\d+\.?\d*|\.\d+))\s*(ms|s)\b/gi;
  var MOTION_PROPERTIES = ["animation-duration", "animation-delay", "transition-duration", "transition-delay"];
  var REDUCED_MOTION_MAXIMUM_MILLISECONDS = 0.02;
  var VIEW_TIMELINE_SENTINEL_MILLISECONDS = 1;
  var MAX_EVIDENCE_RECORDS = 1000;
  var REDUCED_MOTION_CSS = "@media (prefers-reduced-motion: reduce){" +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready']," +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready'] *," +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready']::before," +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready']::after," +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready'] *::before," +
    "[data-dance-moves-catalogue-root='ready'][data-dance-moves-catalogue-timing='ready'] *::after{" +
    "animation-duration:0.01ms !important;" +
    "animation-delay:0ms !important;" +
    "animation-iteration-count:1 !important;" +
    "transition-duration:0.01ms !important;" +
    "transition-delay:0ms !important;" +
    "scroll-behavior:auto !important}" +
    "}";
  var records = [];
  var convertedCustomProperties = new Set();
  var observed = false;
  var pendingFrame = 0;
  var removeAnimationScope = function () {};
  var pseudoStyle = null;
  var pseudoElementCounter = 0;

  if (!motion || !root) return;

  root.dataset.danceMovesCatalogueRoot = "ready";

  function ensureCatalogueStyle() {
    if (pseudoStyle) return pseudoStyle;
    pseudoStyle = document.createElement("style");
    pseudoStyle.id = "dance-moves-catalogue-pseudo-timing";
    document.head.appendChild(pseudoStyle);
    return pseudoStyle;
  }

  function millisecondsFromToken(number, unit) {
    var value = Number(number);
    if (!Number.isFinite(value)) return null;
    return unit.toLowerCase() === "s" ? value * 1000 : value;
  }

  function quantizeSignedMilliseconds(milliseconds) {
    var sign = milliseconds < 0 ? -1 : 1;
    var absolute = Math.abs(milliseconds);
    var rawTicks = absolute / (3750 / motion.bpm);
    var ticks = motion.quantizeTicks(rawTicks);
    return {
      rawTicks: rawTicks,
      ticks: ticks * sign,
      milliseconds: motion.durationMilliseconds(ticks) * sign
    };
  }

  function recordConversion(source, property, before, after, conversions) {
    if (before === after || !conversions.length || records.length >= MAX_EVIDENCE_RECORDS) return;
    records.push({
      source: source,
      property: property,
      before: before,
      after: after,
      ticks: conversions.map(function (entry) { return entry.ticks; })
    });
  }

  function replaceTimeTokens(value, options) {
    if (typeof value !== "string" || !value || value.indexOf("--dance-moves-") !== -1) {
      return { value: value, conversions: [] };
    }
    var conversions = [];
    var converted = value.replace(TIME_TOKEN, function (literal, number, unit) {
      var milliseconds = millisecondsFromToken(number, unit);
      if (milliseconds === null || milliseconds === 0) return literal;
      if (Math.abs(milliseconds) <= REDUCED_MOTION_MAXIMUM_MILLISECONDS) return literal;
      if (options && options.viewTimeline && Math.abs(milliseconds) <= VIEW_TIMELINE_SENTINEL_MILLISECONDS) return literal;
      var quantized = quantizeSignedMilliseconds(milliseconds);
      conversions.push(quantized);
      return quantized.milliseconds.toFixed(6) + "ms";
    });
    return { value: converted, conversions: conversions };
  }

  function selectorWithoutTransientState(selector) {
    return String(selector || "")
      .replace(/::(?:before|after|marker|backdrop|first-letter|first-line)/gi, "")
      .replace(/:(?:hover|active|focus|focus-visible|focus-within|visited|target|checked|open|playing|paused)\b/gi, "");
  }

  function selectorOwnsRoot(selector) {
    if (!selector) return false;
    var rootTokens = Array.from(root.classList).map(function (name) { return "." + name; });
    if (root.id) rootTokens.push("#" + root.id);
    var release = root.getAttribute("data-release");
    if (release) rootTokens.push(release);
    if (rootTokens.some(function (token) { return selector.indexOf(token) !== -1; })) return true;
    try {
      return Array.from(document.querySelectorAll(selectorWithoutTransientState(selector))).some(function (element) {
        return element === root || root.contains(element);
      });
    } catch (error) {
      return false;
    }
  }

  function ruleUsesViewTimeline(rule) {
    var own = String(rule.style.getPropertyValue("animation-timeline") || "").trim();
    if (own && own !== "auto" && own !== "none") return true;
    if (Number(config.pageId) !== 248) return false;
    return String(rule.style.getPropertyValue("animation-duration") || "").trim() === "1ms";
  }

  function collectMotionVariablesFromRules(rules, variables) {
    Array.from(rules || []).forEach(function (rule) {
      if (rule.type === 1 && selectorOwnsRoot(rule.selectorText)) {
        MOTION_PROPERTIES.forEach(function (property) {
          var value = rule.style.getPropertyValue(property);
          Array.from(String(value || "").matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)).forEach(function (match) {
            variables.add(match[1]);
          });
        });
      }
      if (rule.cssRules) collectMotionVariablesFromRules(rule.cssRules, variables);
    });
  }

  function convertDeclaration(style, source, motionVariables, viewTimeline, includeMotionProperties) {
    if (includeMotionProperties !== false) {
      MOTION_PROPERTIES.forEach(function (property) {
        var before = style.getPropertyValue(property);
        if (!before) return;
        var result = replaceTimeTokens(before, { viewTimeline: viewTimeline && property.indexOf("animation-") === 0 });
        if (result.value !== before) {
          style.setProperty(property, result.value, style.getPropertyPriority(property));
          recordConversion(source, property, before, result.value, result.conversions);
        }
      });
    }

    Array.from(style).filter(function (property) {
      return property.indexOf("--") === 0 && motionVariables.has(property) && !property.startsWith("--dance-moves-");
    }).forEach(function (property) {
      var before = style.getPropertyValue(property);
      var result = replaceTimeTokens(before, { viewTimeline: false });
      if (result.value !== before) {
        style.setProperty(property, result.value, style.getPropertyPriority(property));
        convertedCustomProperties.add(property);
        recordConversion(source, property, before, result.value, result.conversions);
      }
    });
  }

  function convertRules(rules, sheetLabel, motionVariables) {
    Array.from(rules || []).forEach(function (rule, index) {
      if (rule.type === 1) {
        var ownsRoot = selectorOwnsRoot(rule.selectorText);
        var definesReferencedVariable = Array.from(rule.style).some(function (property) {
          return property.indexOf("--") === 0 && motionVariables.has(property) && !property.startsWith("--dance-moves-");
        });
        if (ownsRoot || definesReferencedVariable) {
          convertDeclaration(
            rule.style,
            sheetLabel + ":rule:" + index,
            motionVariables,
            ownsRoot && ruleUsesViewTimeline(rule),
            ownsRoot
          );
        }
      }
      if (rule.cssRules) convertRules(rule.cssRules, sheetLabel + ":group:" + index, motionVariables);
    });
  }

  function convertComputedDeclaration(element, source) {
    var computed = window.getComputedStyle(element);
    var viewTimeline = String(computed.animationTimeline || "").trim();
    MOTION_PROPERTIES.forEach(function (property) {
      var before = computed.getPropertyValue(property);
      if (!before) return;
      var isAnimation = property.indexOf("animation-") === 0;
      var result = replaceTimeTokens(before, {
        viewTimeline: isAnimation && viewTimeline && viewTimeline !== "auto" && viewTimeline !== "none"
      });
      if (result.value !== before) {
        element.style.setProperty(property, result.value, "important");
        recordConversion(source, "computed-" + property, before, result.value, result.conversions);
      }
    });
  }

  function convertPseudoDeclarations(element, source) {
    var rules = [];
    ["::before", "::after"].forEach(function (pseudo) {
      var computed = window.getComputedStyle(element, pseudo);
      var viewTimeline = String(computed.animationTimeline || "").trim();
      var declarations = [];
      MOTION_PROPERTIES.forEach(function (property) {
        var before = computed.getPropertyValue(property);
        if (!before) return;
        var isAnimation = property.indexOf("animation-") === 0;
        var result = replaceTimeTokens(before, {
          viewTimeline: isAnimation && viewTimeline && viewTimeline !== "auto" && viewTimeline !== "none"
        });
        if (result.value === before) return;
        declarations.push(property + ":" + result.value + " !important");
        recordConversion(source + pseudo, "computed-" + property, before, result.value, result.conversions);
      });
      if (!declarations.length) return;
      if (!element.dataset.danceMovesTimingElement) {
        pseudoElementCounter += 1;
        element.dataset.danceMovesTimingElement = String(pseudoElementCounter);
      }
      rules.push('[data-dance-moves-timing-element="' + element.dataset.danceMovesTimingElement + '"]' + pseudo + "{" + declarations.join(";") + "}");
    });
    return rules;
  }

  function accessibleRules(sheet) {
    try {
      return sheet.cssRules;
    } catch (error) {
      return null;
    }
  }

  function applyCatalogueTiming() {
    var motionVariables = new Set();
    Array.from(document.styleSheets).forEach(function (sheet) {
      var rules = accessibleRules(sheet);
      if (rules) collectMotionVariablesFromRules(rules, motionVariables);
    });

    Array.from(document.styleSheets).forEach(function (sheet, index) {
      var rules = accessibleRules(sheet);
      if (!rules) return;
      convertRules(rules, sheet.href || "inline-sheet-" + index, motionVariables);
    });

    var pseudoRules = [];
    [root].concat(Array.from(root.querySelectorAll("*"))).forEach(function (element, index) {
      convertDeclaration(element.style, "inline-element-" + index, motionVariables, false);
      convertComputedDeclaration(element, "computed-element-" + index);
      pseudoRules.push.apply(pseudoRules, convertPseudoDeclarations(element, "computed-element-" + index));
    });

    root.dataset.danceMovesCatalogueTiming = "ready";
    root.dataset.danceMovesCatalogueTimingConversions = String(records.length);
    ensureCatalogueStyle().textContent += pseudoRules.join("") + REDUCED_MOTION_CSS;
    document.documentElement.dataset.danceMovesCatalogueTiming = "ready";
    return snapshot();
  }

  function snapshot() {
    return {
      pageId: Number(config.pageId) || 0,
      bpm: motion.bpm,
      bpmSource: motion.bpmSource,
      conversionCount: records.length,
      convertedCustomProperties: Array.from(convertedCustomProperties).sort(),
      records: records.slice()
    };
  }

  function scheduleApply() {
    if (pendingFrame) return;
    pendingFrame = window.requestAnimationFrame(function () {
      pendingFrame = 0;
      applyCatalogueTiming();
    });
  }

  function observeDynamicMotion() {
    if (observed || typeof MutationObserver !== "function") return;
    observed = true;
    var observer = new MutationObserver(function (mutations) {
      if (mutations.some(function (mutation) {
        return mutation.type === "attributes" || Array.from(mutation.addedNodes || []).some(function (node) {
          return node.nodeType === 1;
        });
      })) scheduleApply();
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  }

  removeAnimationScope = motion.registerAnimationScope(root, ["*"]);
  motion.applyCatalogueTiming = applyCatalogueTiming;
  motion.catalogueTimingSnapshot = snapshot;
  motion.removeCatalogueAnimationScope = removeAnimationScope;
  window.DanceMovesCatalogueTiming = { apply: applyCatalogueTiming, snapshot: snapshot };

  applyCatalogueTiming();
  observeDynamicMotion();
  window.addEventListener("load", scheduleApply, { once: true });
}(window, document));
