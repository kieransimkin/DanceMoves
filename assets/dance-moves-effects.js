(function (window, document) {
  "use strict";
  var motion = window.DanceMoves;
  if (!motion || window.DanceMovesEffects) return;

  var instances = new Map();
  var serial = 0;
  function finite(value, fallback) { value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function element(value, fallback) {
    if (value && value.nodeType === 1) return value;
    if (typeof value === "string") return document.querySelector(value);
    return fallback || null;
  }
  function media(query) { return window.matchMedia(query); }
  function listen(target, name, callback, options, removers) {
    target.addEventListener(name, callback, options);
    removers.push(function () { target.removeEventListener(name, callback, options); });
  }
  function createId(type, supplied) { return String(supplied || ("dance-moves:" + type + ":" + (++serial))); }
  function register(id, api) {
    if (instances.has(id)) instances.get(id).teardown();
    instances.set(id, api);
    return api;
  }
  function commonState(options, type) {
    var root = element(options.root, document.querySelector(".ks-epk"));
    if (!root) throw new Error("DanceMovesEffects " + type + " requires a root element");
    return { id: createId(type, options.id), root: root, reduced: media("(prefers-reduced-motion: reduce)"), forced: media("(forced-colors: active)"), removers: [] };
  }

  function pointer(options) {
    options = options || {};
    var state = commonState(options, "pointer");
    var bounds = element(options.bounds, state.root);
    var target = element(options.target, bounds);
    var latestX = 0, latestY = 0, frame = 0, rect = null, active = false;
    var fineOnly = options.finePointer !== false;
    var fine = media("(hover: hover) and (pointer: fine)");
    function cacheBounds() { rect = bounds.getBoundingClientRect(); }
    function apply(x, y, reason) {
      latestX = clamp(finite(x, 0), -1, 1); latestY = clamp(finite(y, 0), -1, 1);
      state.root.style.setProperty("--dance-moves-x", latestX.toFixed(4));
      state.root.style.setProperty("--dance-moves-y", latestY.toFixed(4));
      state.root.dataset.danceMovesPointer = reason || "active";
      if (typeof options.render === "function") options.render({ x: latestX, y: latestY, root: state.root, bounds: rect, reason: reason || "active" });
    }
    function render() { frame = 0; apply(latestX, latestY, "active"); }
    function reset(reason) { if (frame) window.cancelAnimationFrame(frame); frame = 0; apply(0, 0, reason || "reset"); }
    function reconcile() {
      active = !state.reduced.matches && !state.forced.matches && !document.hidden && (!fineOnly || fine.matches);
      if (!active) reset("inactive"); else state.root.dataset.danceMovesPointer = "ready";
    }
    function move(event) {
      if (!active) return;
      if (!rect) cacheBounds();
      latestX = ((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2;
      latestY = ((event.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2;
      if (!frame) frame = window.requestAnimationFrame(render);
    }
    cacheBounds();
    var resizeObserver = "ResizeObserver" in window ? new ResizeObserver(cacheBounds) : null;
    if (resizeObserver) resizeObserver.observe(bounds);
    listen(target, "pointermove", move, { passive: true }, state.removers);
    listen(target, "pointerleave", function () { reset("leave"); }, { passive: true }, state.removers);
    listen(document, "visibilitychange", reconcile, { passive: true }, state.removers);
    listen(window, "orientationchange", function () { cacheBounds(); reset("orientation"); }, { passive: true }, state.removers);
    listen(state.reduced, "change", reconcile, undefined, state.removers);
    listen(state.forced, "change", reconcile, undefined, state.removers);
    listen(fine, "change", reconcile, undefined, state.removers);
    reconcile();
    return register(state.id, Object.freeze({
      id: state.id, type: "pointer", set: apply, reset: reset,
      snapshot: function () { return { id: state.id, type: "pointer", active: active, x: latestX, y: latestY, bounds: rect ? { width: rect.width, height: rect.height } : null }; },
      teardown: function () { reset("teardown"); if (resizeObserver) resizeObserver.disconnect(); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  function playbackPulse(options) {
    options = options || {};
    var state = commonState(options, "pulse");
    var audio = element(options.audio, state.root.querySelector("audio"));
    if (!audio) throw new Error("DanceMovesEffects pulse requires an audio element");
    var ticks = Math.max(1, Math.round(finite(options.ticks, 16)));
    var className = String(options.className || "dance-moves-playing");
    var prefix = String(options.propertyPrefix || "--dance-moves-pulse").replace(/-+$/, "");
    function sync() {
      var rate = Math.max(.01, finite(audio.playbackRate, 1));
      var duration = motion.durationMilliseconds(ticks) / 1000 / rate;
      var phase = -((finite(audio.currentTime, 0) / rate) % duration);
      state.root.style.setProperty(prefix + "-duration", duration.toFixed(6) + "s");
      state.root.style.setProperty(prefix + "-delay", phase.toFixed(6) + "s");
      state.root.dataset.danceMovesPulse = state.reduced.matches || state.forced.matches ? "inactive" : (audio.paused ? "paused" : "playing");
      if (typeof options.render === "function") options.render({ root: state.root, audio: audio, duration: duration, delay: phase, ticks: ticks });
    }
    function reconcile() {
      var playing = !audio.paused && !audio.ended && !state.reduced.matches && !state.forced.matches;
      state.root.classList.toggle(className, playing);
      sync();
    }
    ["loadedmetadata", "timeupdate", "seeking", "seeked", "ratechange", "play", "playing", "pause", "ended"].forEach(function (name) { listen(audio, name, reconcile, undefined, state.removers); });
    listen(state.reduced, "change", reconcile, undefined, state.removers);
    listen(state.forced, "change", reconcile, undefined, state.removers);
    reconcile();
    return register(state.id, Object.freeze({
      id: state.id, type: "playback-pulse", sync: sync,
      snapshot: function () { return { id: state.id, type: "playback-pulse", ticks: ticks, playing: state.root.classList.contains(className), duration: state.root.style.getPropertyValue(prefix + "-duration") }; },
      teardown: function () { state.root.classList.remove(className); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  function cueClass(options) {
    options = options || {};
    var state = commonState(options, "cue-class");
    var cue = String(options.cue || "*");
    var className = String(options.className || "dance-moves-cue-active");
    var durationTicks = Math.max(1, Math.round(finite(options.durationTicks, 16)));
    var timer = 0, count = 0;
    function clear(reason) {
      if (timer) window.clearTimeout(timer); timer = 0;
      state.root.classList.remove(className);
      state.root.dataset.danceMovesCueEffect = reason || "idle";
    }
    function fire(detail) {
      if (state.reduced.matches || state.forced.matches) return clear("inactive");
      clear("restart"); count += 1;
      state.root.classList.add(className);
      state.root.dataset.danceMovesCueEffect = "active";
      if (typeof options.render === "function") options.render({ root: state.root, detail: detail, count: count, durationMilliseconds: motion.durationMilliseconds(durationTicks) });
      timer = window.setTimeout(function () { clear("complete"); }, motion.durationMilliseconds(durationTicks));
    }
    var unsubscribe = motion.onCue(cue, fire, { id: state.id });
    listen(state.reduced, "change", function () { if (state.reduced.matches) clear("reduced-motion"); }, undefined, state.removers);
    listen(state.forced, "change", function () { if (state.forced.matches) clear("forced-colours"); }, undefined, state.removers);
    return register(state.id, Object.freeze({
      id: state.id, type: "cue-class", fire: fire, clear: clear,
      snapshot: function () { return { id: state.id, type: "cue-class", cue: cue, active: state.root.classList.contains(className), count: count }; },
      teardown: function () { clear("teardown"); unsubscribe(); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  function quality(options) {
    options = options || {};
    var state = commonState(options, "quality");
    var tiers = Array.isArray(options.tiers) && options.tiers.length ? options.tiers.map(String) : ["full", "constrained", "minimal"];
    var index = clamp(Math.round(finite(options.initial, 0)), 0, tiers.length - 1);
    var sampleMs = Math.max(800, finite(options.sampleMilliseconds, 1600));
    var poorWindows = Math.max(2, Math.round(finite(options.poorWindows, 2)));
    var healthyWindows = Math.max(3, Math.round(finite(options.healthyWindows, 5)));
    var downgradeRatio = clamp(finite(options.downgradeRatio, .72), .2, .95);
    var recoveryRatio = clamp(finite(options.recoveryRatio, .9), downgradeRatio, 1);
    var frame = 0, frames = 0, start = 0, reference = 0, poor = 0, healthy = 0, lastShift = 0, running = true;
    var preferenceLimited = false, tierBeforePreference = index;
    function publish(reason, sample) {
      state.root.dataset.danceMovesQuality = tiers[index];
      state.root.dataset.danceMovesQualityReason = reason;
      if (sample) { state.root.dataset.danceMovesFps = sample.fps.toFixed(1); state.root.dataset.danceMovesReferenceFps = reference.toFixed(1); }
      if (typeof options.render === "function") options.render({ root: state.root, tier: tiers[index], index: index, reason: reason, sample: sample || null });
    }
    function resetWindow(now) { start = now || performance.now(); frames = 0; }
    function tick(now) {
      if (!running) return;
      if (document.hidden || state.reduced.matches || state.forced.matches) { resetWindow(now); frame = window.requestAnimationFrame(tick); return; }
      frames += 1;
      if (!start) start = now;
      if (now - start >= sampleMs) {
        var fps = frames * 1000 / Math.max(1, now - start);
        reference = Math.max(reference, Math.min(60, fps));
        if (fps < reference * downgradeRatio) { poor += 1; healthy = 0; }
        else if (fps > reference * recoveryRatio) { healthy += 1; poor = 0; }
        else { poor = 0; healthy = 0; }
        if (poor >= poorWindows && index < tiers.length - 1 && now - lastShift >= finite(options.downgradeCooldownMilliseconds, 5000)) { index += 1; poor = 0; lastShift = now; publish("sustained-low-fps", { fps: fps }); }
        else if (healthy >= healthyWindows && index > 0 && now - lastShift >= finite(options.recoveryCooldownMilliseconds, 12000)) { index -= 1; healthy = 0; lastShift = now; publish("sustained-recovery", { fps: fps }); }
        else publish("measuring", { fps: fps });
        resetWindow(now);
      }
      frame = window.requestAnimationFrame(tick);
    }
    function preference() {
      if (state.reduced.matches || state.forced.matches) {
        if (!preferenceLimited) tierBeforePreference = index;
        preferenceLimited = true;
        index = tiers.length - 1;
        publish(state.reduced.matches ? "prefers-reduced-motion" : "forced-colours");
      } else if (preferenceLimited) {
        preferenceLimited = false;
        index = tierBeforePreference;
        publish("preference-restored");
      }
      resetWindow();
    }
    listen(document, "visibilitychange", function () { resetWindow(); }, { passive: true }, state.removers);
    listen(state.reduced, "change", preference, undefined, state.removers);
    listen(state.forced, "change", preference, undefined, state.removers);
    publish("initial"); frame = window.requestAnimationFrame(tick);
    return register(state.id, Object.freeze({
      id: state.id, type: "quality", setTier: function (value, reason) { index = clamp(Math.round(finite(value, index)), 0, tiers.length - 1); publish(reason || "manual"); },
      snapshot: function () { return { id: state.id, type: "quality", tier: tiers[index], index: index, referenceFps: reference, poorWindows: poor, healthyWindows: healthy }; },
      teardown: function () { running = false; if (frame) window.cancelAnimationFrame(frame); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  window.DanceMovesEffects = Object.freeze({
    version: String(motion.version || ""), pointer: pointer, playbackPulse: playbackPulse, cueClass: cueClass, quality: quality,
    get: function (id) { return instances.get(String(id)) || null; },
    snapshot: function () { return Array.from(instances.values()).map(function (instance) { return instance.snapshot(); }); },
    teardown: function (id) { var instance = instances.get(String(id)); if (instance) instance.teardown(); },
    teardownAll: function () { Array.from(instances.values()).forEach(function (instance) { instance.teardown(); }); }
  });
  document.dispatchEvent(new CustomEvent("dance-moves-effects-ready", { detail: { api: window.DanceMovesEffects, version: window.DanceMovesEffects.version } }));
}(window, document));
