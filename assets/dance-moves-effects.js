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
    // Position can change without a ResizeObserver notification. Invalidate
    // lazily: one bounds read on the next input, never a scroll-frame loop.
    function invalidateBounds() {
      if (!rect) return;
      rect = null;
      reset("geometry-change");
    }
    function reconcile() {
      active = !state.reduced.matches && !state.forced.matches && !document.hidden && (!fineOnly || fine.matches);
      if (!active) reset("inactive"); else { rect = null; state.root.dataset.danceMovesPointer = "ready"; }
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
    listen(target, "pointerenter", cacheBounds, { passive: true }, state.removers);
    listen(target, "pointermove", move, { passive: true }, state.removers);
    listen(target, "pointerleave", function () { reset("leave"); }, { passive: true }, state.removers);
    listen(window, "scroll", invalidateBounds, { passive: true, capture: true }, state.removers);
    listen(window, "resize", invalidateBounds, { passive: true }, state.removers);
    if (window.visualViewport) {
      listen(window.visualViewport, "scroll", invalidateBounds, { passive: true }, state.removers);
      listen(window.visualViewport, "resize", invalidateBounds, { passive: true }, state.removers);
    }
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

  function cueTimeline(options) {
    options = options || {};
    var state = commonState(options, "cue-timeline");
    var audio = element(options.audio, state.root.querySelector("audio"));
    if (!audio) throw new Error("DanceMovesEffects cueTimeline requires an audio element");
    var cues = (Array.isArray(options.cues) ? options.cues : []).map(function (cue, index) {
      var time = finite(cue && cue.time, NaN);
      if (!Number.isFinite(time) || time < 0) throw new TypeError("DanceMovesEffects cueTimeline cue time must be a non-negative number");
      return Object.freeze({ id: String(cue.id || ("cue-" + index)), time: time, end: Number.isFinite(Number(cue.end)) ? Number(cue.end) : null, data: cue.data });
    }).sort(function (a, b) { return a.time - b.time; });
    var tolerance = Math.max(0, finite(options.seekLandingTolerance, .05));
    var maxCrossingGap = Math.max(.05, finite(options.maxCrossingGap, 1.25));
    var fired = new Set(), frame = 0, previous = finite(audio.currentTime, 0), status = "idle", generation = 0, previousWall = 0;
    function blocked() { return document.hidden || state.reduced.matches || state.forced.matches; }
    function activeAt(time) { return cues.filter(function (cue) { return cue.end !== null && time >= cue.time && time < cue.end; }); }
    function publish(reason, extra) {
      var time = finite(audio.currentTime, 0);
      state.root.dataset.danceMovesCueTimeline = reason;
      if (typeof options.render === "function") options.render({ root: state.root, audio: audio, time: time, previousTime: previous, reason: reason, playing: !audio.paused && !audio.ended && !blocked(), active: activeAt(time), generation: generation, detail: extra || null });
    }
    function fire(cue, reason) {
      if (fired.has(cue.id) || blocked()) return;
      fired.add(cue.id);
      if (typeof options.onCue === "function") options.onCue({ root: state.root, audio: audio, cue: cue, time: finite(audio.currentTime, cue.time), reason: reason, generation: generation });
    }
    function rebuild(time, reason, allowLanding) {
      time = Math.max(0, finite(time, 0));
      generation += 1; fired.clear();
      cues.forEach(function (cue) { if (cue.time < time - tolerance) fired.add(cue.id); });
      if (allowLanding) cues.forEach(function (cue) { if (Math.abs(cue.time - time) <= tolerance) fire(cue, "seek-landing"); });
      previous = time; publish(reason || "restore");
    }
    function stop(reason) {
      if (frame) window.cancelAnimationFrame(frame); frame = 0; status = reason || "paused"; publish(status);
    }
    function tick(wallNow) {
      frame = 0;
      if (audio.paused || audio.ended || blocked()) return stop(audio.ended ? "ended" : blocked() ? "inactive" : "paused");
      var now = Math.max(0, finite(audio.currentTime, previous));
      var delta = now - previous;
      if (delta < -.001 || delta > maxCrossingGap) rebuild(now, "discontinuity", false);
      else cues.forEach(function (cue) { if (previous < cue.time && now >= cue.time) fire(cue, "crossing"); });
      var wallDelta = previousWall ? Math.min(.25, Math.max(0, (finite(wallNow, previousWall) - previousWall) / 1000)) : 0;
      previousWall = finite(wallNow, previousWall);
      previous = now; status = "playing"; publish("frame", { deltaSeconds: wallDelta }); frame = window.requestAnimationFrame(tick);
    }
    function start(reason) {
      if (frame || audio.paused || audio.ended || blocked()) return publish(blocked() ? "inactive" : audio.ended ? "ended" : "paused");
      previous = Math.max(0, finite(audio.currentTime, 0)); previousWall = 0; status = reason || "playing"; publish(status); frame = window.requestAnimationFrame(tick);
    }
    function onSeeking() { stop("seeking"); }
    function onSeeked() { rebuild(audio.currentTime, "seeked", options.fireOnSeekLanding === true && !audio.paused); if (!audio.paused) start("resume-after-seek"); }
    listen(audio, "play", function () { start("play"); }, undefined, state.removers);
    listen(audio, "playing", function () { start("playing"); }, undefined, state.removers);
    listen(audio, "pause", function () { stop("paused"); }, undefined, state.removers);
    listen(audio, "seeking", onSeeking, undefined, state.removers);
    listen(audio, "seeked", onSeeked, undefined, state.removers);
    listen(audio, "ratechange", function () { rebuild(audio.currentTime, "ratechange", false); }, undefined, state.removers);
    listen(audio, "loadedmetadata", function () { rebuild(audio.currentTime, "metadata", false); }, undefined, state.removers);
    listen(audio, "ended", function () { stop("ended"); }, undefined, state.removers);
    listen(document, "visibilitychange", function () { if (document.hidden) stop("hidden"); else { rebuild(audio.currentTime, "visible", false); start("resume-after-visible"); } }, { passive: true }, state.removers);
    listen(state.reduced, "change", function () { rebuild(audio.currentTime, state.reduced.matches ? "reduced-motion" : "motion-restored", false); if (!state.reduced.matches) start("resume-after-motion"); }, undefined, state.removers);
    listen(state.forced, "change", function () { rebuild(audio.currentTime, state.forced.matches ? "forced-colours" : "colours-restored", false); if (!state.forced.matches) start("resume-after-colours"); }, undefined, state.removers);
    rebuild(previous, "initial", false); if (!audio.paused) start("initial-playing");
    return register(state.id, Object.freeze({
      id: state.id, type: "cue-timeline", restore: function (reason) { rebuild(audio.currentTime, reason || "manual-restore", false); }, start: start, stop: stop,
      snapshot: function () { return { id: state.id, type: "cue-timeline", status: status, time: finite(audio.currentTime, 0), previousTime: previous, generation: generation, fired: Array.from(fired), active: activeAt(finite(audio.currentTime, 0)).map(function (cue) { return cue.id; }) }; },
      teardown: function () { stop("teardown"); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  function spritePlayback(options) {
    options = options || {};
    var state = commonState(options, "sprite-playback");
    var audio = element(options.audio, state.root.querySelector("audio"));
    var target = element(options.target, state.root);
    if (!audio) throw new Error("DanceMovesEffects spritePlayback requires an audio element");
    if (!target) throw new Error("DanceMovesEffects spritePlayback requires a target element");
    var frameMap = Array.isArray(options.frameMap) && options.frameMap.length ? options.frameMap.map(function (value) {
      value = Math.floor(finite(value, -1));
      if (value < 0) throw new TypeError("DanceMovesEffects spritePlayback frameMap values must be non-negative integers");
      return value;
    }) : null;
    var frameCount = frameMap ? frameMap.length : Math.max(1, Math.round(finite(options.frameCount, 1)));
    var columns = Math.max(1, Math.round(finite(options.columns, frameCount)));
    var framesPerRow = clamp(Math.round(finite(options.framesPerRow, columns)), 1, columns);
    var columnOffset = clamp(Math.round(finite(options.columnOffset, 0)), 0, columns - framesPerRow);
    var rowOffset = Math.max(0, Math.round(finite(options.rowOffset, 0)));
    var cycleTicks = Math.max(1, Math.round(finite(options.cycleTicks, 32)));
    var phaseOffsetSeconds = finite(options.phaseOffsetSeconds, 0);
    var staticFrame = clamp(Math.round(finite(options.staticFrame, 0)), 0, frameCount - 1);
    var prefix = String(options.propertyPrefix || "--dance-moves-sprite").replace(/-+$/, "");
    if (prefix.slice(0, 2) !== "--") prefix = "--" + prefix.replace(/^-+/, "");
    var tiers = Array.isArray(options.qualityTiers) && options.qualityTiers.length ? options.qualityTiers.map(String) : ["full", "constrained", "minimal"];
    var suppliedFps = Array.isArray(options.qualityFramesPerSecond) ? options.qualityFramesPerSecond : [60, 30, 15];
    var qualityFps = tiers.map(function (_, index) { return Math.max(1, finite(suppliedFps[index], suppliedFps[suppliedFps.length - 1] || 15)); });
    var qualityIndex = clamp(Math.round(finite(options.initialQuality, 0)), 0, tiers.length - 1);
    var frame = 0, status = "idle", lastWall = -Infinity, renders = 0, latest = null;
    function blocked() { return document.hidden || state.reduced.matches || state.forced.matches; }
    function mappedFrame(localFrame) {
      var sourceFrame = frameMap ? frameMap[localFrame] : ((rowOffset + Math.floor(localFrame / framesPerRow)) * columns + columnOffset + (localFrame % framesPerRow));
      return { sourceFrame: sourceFrame, column: sourceFrame % columns, row: Math.floor(sourceFrame / columns) };
    }
    function calculate(reason, staticFallback) {
      var cycleSeconds = Math.max(.001, finite(motion.durationMilliseconds(cycleTicks), 1) / 1000);
      var time = Math.max(0, finite(audio.currentTime, 0));
      var phase = ((time - phaseOffsetSeconds) % cycleSeconds + cycleSeconds) % cycleSeconds / cycleSeconds;
      var localFrame = staticFallback ? staticFrame : Math.min(frameCount - 1, Math.floor(phase * frameCount + 1e-9));
      var mapped = mappedFrame(localFrame);
      return {
        root: state.root, target: target, audio: audio, reason: reason, time: time,
        playing: !audio.paused && !audio.ended && !blocked(), phase: phase,
        localFrame: localFrame, frame: mapped.sourceFrame, column: mapped.column, row: mapped.row,
        frameCount: frameCount, columns: columns, cycleTicks: cycleTicks, cycleSeconds: cycleSeconds,
        qualityTier: tiers[qualityIndex], qualityIndex: qualityIndex,
        reducedMotion: state.reduced.matches, forcedColours: state.forced.matches
      };
    }
    function publish(reason, staticFallback) {
      latest = calculate(reason, Boolean(staticFallback)); renders += 1;
      target.style.setProperty(prefix + "-frame", String(latest.frame));
      target.style.setProperty(prefix + "-local-frame", String(latest.localFrame));
      target.style.setProperty(prefix + "-column", String(latest.column));
      target.style.setProperty(prefix + "-row", String(latest.row));
      target.style.setProperty(prefix + "-phase", latest.phase.toFixed(6));
      target.style.setProperty(prefix + "-cycle-duration", latest.cycleSeconds.toFixed(6) + "s");
      target.dataset.danceMovesSpriteFrame = String(latest.frame);
      target.dataset.danceMovesSpriteLocalFrame = String(latest.localFrame);
      state.root.dataset.danceMovesSpritePlayback = reason;
      state.root.dataset.danceMovesSpriteQuality = tiers[qualityIndex];
      if (typeof options.render === "function") options.render(latest);
      return latest;
    }
    function stop(reason, staticFallback) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0; status = reason || "paused";
      publish(status, staticFallback === true);
    }
    function tick(wallNow) {
      frame = 0;
      if (audio.paused || audio.ended || blocked()) return stop(audio.ended ? "ended" : blocked() ? "inactive" : "paused", audio.ended || blocked());
      var minimumInterval = 1000 / qualityFps[qualityIndex];
      if (!Number.isFinite(lastWall) || finite(wallNow, lastWall) - lastWall >= minimumInterval - .01) {
        lastWall = finite(wallNow, lastWall); status = "playing"; publish("frame", false);
      }
      frame = window.requestAnimationFrame(tick);
    }
    function start(reason) {
      if (frame) return;
      if (audio.paused || audio.ended || blocked()) return stop(blocked() ? "inactive" : audio.ended ? "ended" : "paused", audio.ended || blocked());
      status = reason || "playing"; lastWall = -Infinity; publish(status, false); frame = window.requestAnimationFrame(tick);
    }
    function restore(reason) {
      if (audio.ended || blocked()) return stop(reason || (audio.ended ? "ended" : "inactive"), true);
      publish(reason || "restore", false);
      if (!audio.paused) start("resume-after-restore");
    }
    function preference(reason) {
      if (blocked()) stop(reason, true);
      else restore(reason);
    }
    function setQuality(value, reason) {
      var named = typeof value === "string" ? tiers.indexOf(value) : -1;
      qualityIndex = named >= 0 ? named : clamp(Math.round(finite(value, qualityIndex)), 0, tiers.length - 1);
      lastWall = -Infinity; publish(reason || "quality-change", audio.ended || blocked());
    }
    listen(audio, "play", function () { start("play"); }, undefined, state.removers);
    listen(audio, "playing", function () { start("playing"); }, undefined, state.removers);
    listen(audio, "pause", function () { stop("paused", false); }, undefined, state.removers);
    listen(audio, "seeking", function () { stop("seeking", false); }, undefined, state.removers);
    listen(audio, "seeked", function () { restore("seeked"); }, undefined, state.removers);
    listen(audio, "timeupdate", function () { if (!frame) restore("timeupdate"); }, undefined, state.removers);
    listen(audio, "ratechange", function () { restore("ratechange"); }, undefined, state.removers);
    listen(audio, "loadedmetadata", function () { restore("metadata"); }, undefined, state.removers);
    listen(audio, "ended", function () { stop("ended", true); }, undefined, state.removers);
    listen(document, "visibilitychange", function () { preference(document.hidden ? "hidden" : "visible"); }, { passive: true }, state.removers);
    listen(state.reduced, "change", function () { preference(state.reduced.matches ? "reduced-motion" : "motion-restored"); }, undefined, state.removers);
    listen(state.forced, "change", function () { preference(state.forced.matches ? "forced-colours" : "colours-restored"); }, undefined, state.removers);
    publish(audio.ended || blocked() ? "initial-static" : "initial", audio.ended || blocked());
    if (!audio.paused && !audio.ended && !blocked()) start("initial-playing");
    return register(state.id, Object.freeze({
      id: state.id, type: "sprite-playback", restore: restore, start: start, stop: function (reason) { stop(reason || "manual-stop", false); }, setQuality: setQuality,
      snapshot: function () { return { id: state.id, type: "sprite-playback", status: status, time: finite(audio.currentTime, 0), frame: latest ? latest.frame : null, localFrame: latest ? latest.localFrame : null, column: latest ? latest.column : null, row: latest ? latest.row : null, phase: latest ? latest.phase : null, cycleTicks: cycleTicks, cycleSeconds: latest ? latest.cycleSeconds : null, qualityTier: tiers[qualityIndex], qualityIndex: qualityIndex, renders: renders, running: Boolean(frame) }; },
      teardown: function () { stop("teardown", true); state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
    }));
  }

  function lyricStage(options) {
    options = options || {};
    var state = commonState(options, "lyric-stage");
    var audio = element(options.audio, state.root.querySelector("audio"));
    var popover = element(options.popover, document.querySelector(".dance-moves-lyric-popover"));
    if (!audio) throw new Error("DanceMovesEffects lyricStage requires an audio element");
    if (!popover) {
      var pending = true;
      function mountWhenReady() {
        if (!pending || !document.querySelector(".dance-moves-lyric-popover")) return;
        pending = false;
        state.removers.splice(0).forEach(function (remove) { remove(); });
        lyricStage(options);
      }
      listen(document, "dance-moves-lyric-ready", mountWhenReady, undefined, state.removers);
      return register(state.id, Object.freeze({
        id: state.id, type: "lyric-stage-pending",
        snapshot: function () { return { id: state.id, type: "lyric-stage-pending", phase: "waiting-for-popover" }; },
        teardown: function () { pending = false; state.removers.splice(0).forEach(function (remove) { remove(); }); instances.delete(state.id); }
      }));
    }
    var current = popover.querySelector(".dance-moves-lyric-popover__text");
    if (!current) throw new Error("DanceMovesEffects lyricStage requires the DanceMoves current lyric element");

    var viewport = document.createElement("div");
    var track = document.createElement("div");
    var previous = document.createElement("span");
    var next = document.createElement("span");
    viewport.className = "dance-moves-lyric-stage__viewport";
    track.className = "dance-moves-lyric-stage__track";
    previous.className = "dance-moves-lyric-stage__line dance-moves-lyric-stage__line--previous";
    current.className += " dance-moves-lyric-stage__line dance-moves-lyric-stage__line--current";
    next.className = "dance-moves-lyric-stage__line dance-moves-lyric-stage__line--next";
    previous.dataset.danceMovesLyricSlot = "previous";
    current.dataset.danceMovesLyricSlot = "current";
    next.dataset.danceMovesLyricSlot = "next";
    track.appendChild(previous);
    track.appendChild(current);
    track.appendChild(next);
    viewport.appendChild(track);
    popover.appendChild(viewport);
    popover.dataset.danceMovesLyricStage = "ready";
    popover.style.setProperty("--dance-moves-lyric-progress", "0");

    var travelTicks = Math.max(1, Math.round(finite(options.travelTicks, 32)));
    var defaultCueTicks = Math.max(1, Math.round(finite(options.cueDurationTicks, 32)));
    var latest = null, phase = "idle", progress = 0, frame = 0, wakeTimer = 0, cueTimer = 0, cueCleanup = null, cueCount = 0;
    var lyricEffects = [];
    var slots = Object.freeze({ previous: previous, current: current, next: next, viewport: viewport, track: track });

    function safely(callback, payload, label) {
      if (typeof callback !== "function") return null;
      try { return callback(payload); }
      catch (error) { if (window.console && typeof window.console.error === "function") window.console.error("DanceMoves " + label + " callback failed", error); }
      return null;
    }
    function blocked() { return document.hidden || state.reduced.matches || state.forced.matches; }
    function stopClock() {
      if (frame) window.cancelAnimationFrame(frame);
      if (wakeTimer) window.clearTimeout(wakeTimer);
      frame = 0; wakeTimer = 0;
    }
    function publish(reason) {
      popover.dataset.danceMovesLyricPhase = phase;
      safely(options.render, {
        root: state.root, popover: popover, audio: audio, slots: slots, detail: latest,
        phase: phase, progress: progress, reason: reason, playing: !audio.paused && !audio.ended && !blocked(),
        reducedMotion: state.reduced.matches, forcedColours: state.forced.matches
      }, "lyricStage render");
    }
    function setPhase(value, reason) {
      if (phase === value) return;
      phase = value;
      publish(reason || value);
    }
    function setProgress(value) {
      progress = clamp(finite(value, 0), 0, 1);
      popover.style.setProperty("--dance-moves-lyric-progress", progress.toFixed(5));
    }
    function copyLyrics(detail) {
      previous.textContent = detail ? String(detail.previousVisibleText || "") : "";
      current.textContent = detail ? String(detail.text || "") : "";
      next.textContent = detail ? String(detail.nextVisibleText || "") : "";
      previous.dataset.danceMovesLyricIndex = detail ? String(detail.previousVisibleIndex) : "-1";
      current.dataset.danceMovesLyricIndex = detail ? String(detail.index) : "-1";
      next.dataset.danceMovesLyricIndex = detail ? String(detail.nextVisibleIndex) : "-1";
    }
    function scheduleLyricEffect(result) {
      if (!result) return;
      var cleanup = typeof result === "function" ? result : (typeof result.cleanup === "function" ? result.cleanup : null);
      if (!cleanup) return;
      var durationTicks = result && typeof result === "object" ? Math.max(1, Math.round(finite(result.durationTicks, 64))) : 64;
      var record = { cleanup: cleanup, timer: 0 };
      record.timer = window.setTimeout(function () {
        lyricEffects = lyricEffects.filter(function (item) { return item !== record; });
        safely(cleanup, { reason: "complete" }, "lyricStage lyric cleanup");
      }, motion.durationMilliseconds(durationTicks));
      lyricEffects.push(record);
    }
    function travelWindow() {
      if (!latest || !Number.isFinite(Number(latest.nextVisibleTime))) return null;
      var end = Number(latest.nextVisibleTime);
      var duration = motion.durationMilliseconds(travelTicks) / 1000;
      return { start: Math.max(Number(latest.time) || 0, end - duration), end: end };
    }
    function tick() {
      frame = 0;
      if (audio.paused || audio.ended || blocked()) return reconcile("frame-inactive");
      var windowRange = travelWindow();
      if (!windowRange) { setProgress(0); return setPhase("waiting", "no-next-line"); }
      var now = Math.max(0, finite(audio.currentTime, 0));
      if (now < windowRange.start) return reconcile("frame-before-window");
      if (now >= windowRange.end) { setProgress(1); return setPhase("arrived", "line-arrival"); }
      setPhase("travelling", "travel-start");
      setProgress((now - windowRange.start) / Math.max(.001, windowRange.end - windowRange.start));
      frame = window.requestAnimationFrame(tick);
    }
    function reconcile(reason) {
      stopClock();
      if (blocked()) { setProgress(0); return setPhase("inactive", reason || "inactive"); }
      if (audio.ended) { setProgress(0); return setPhase("ended", reason || "ended"); }
      if (audio.paused) { setProgress(0); return setPhase("paused", reason || "paused"); }
      var windowRange = travelWindow();
      if (!windowRange) { setProgress(0); return setPhase("waiting", reason || "no-next-line"); }
      var now = Math.max(0, finite(audio.currentTime, 0));
      if (now >= windowRange.end) { setProgress(1); return setPhase("arrived", reason || "arrived"); }
      if (now >= windowRange.start) {
        setPhase("travelling", reason || "travelling");
        frame = window.requestAnimationFrame(tick);
        return;
      }
      setProgress(0);
      setPhase("waiting", reason || "waiting");
      wakeTimer = window.setTimeout(function () { wakeTimer = 0; tick(); }, Math.max(0, (windowRange.start - now) * 1000 / Math.max(.01, finite(audio.playbackRate, 1))));
    }
    function onLyric(detail) {
      var previousDetail = latest;
      var previousText = String(current.textContent || "");
      latest = detail || null;
      copyLyrics(latest);
      if (!blocked() && typeof options.renderLyric === "function") {
        scheduleLyricEffect(safely(options.renderLyric, {
          root: state.root, popover: popover, audio: audio, slots: slots, detail: latest,
          previousDetail: previousDetail, previousText: previousText,
          reducedMotion: false, forcedColours: false
        }, "lyricStage lyric"));
      }
      setProgress(0);
      publish("lyric-change");
      reconcile("lyric-change");
    }
    function clearCue(reason) {
      if (cueTimer) window.clearTimeout(cueTimer);
      cueTimer = 0;
      if (cueCleanup) safely(cueCleanup, { reason: reason || "complete" }, "lyricStage cue cleanup");
      cueCleanup = null;
      state.root.dataset.danceMovesLyricCue = reason || "idle";
    }
    function onCue(detail) {
      clearCue("restart");
      if (blocked() || typeof options.renderCue !== "function") return;
      cueCount += 1;
      state.root.dataset.danceMovesLyricCue = String(detail.normalisedName || detail.name || "cue");
      var result = safely(options.renderCue, {
        root: state.root, popover: popover, audio: audio, slots: slots, detail: detail,
        count: cueCount, reducedMotion: false, forcedColours: false
      }, "lyricStage cue");
      var durationTicks = defaultCueTicks;
      if (typeof result === "function") cueCleanup = result;
      else if (result && typeof result === "object") {
        if (typeof result.cleanup === "function") cueCleanup = result.cleanup;
        durationTicks = Math.max(1, Math.round(finite(result.durationTicks, defaultCueTicks)));
      }
      cueTimer = window.setTimeout(function () { clearCue("complete"); }, motion.durationMilliseconds(durationTicks));
    }

    var unsubscribeLyric = motion.onLyric(onLyric, { id: state.id });
    var unsubscribeCue = motion.onCue("*", onCue, { id: state.id + ":cue" });
    ["play", "playing", "pause", "ended", "seeking", "seeked", "ratechange", "timeupdate", "loadedmetadata"].forEach(function (name) {
      listen(audio, name, function () { reconcile(name); }, undefined, state.removers);
    });
    listen(document, "visibilitychange", function () { reconcile(document.hidden ? "hidden" : "visible"); }, { passive: true }, state.removers);
    listen(window, "resize", function () { publish("resize"); }, { passive: true }, state.removers);
    listen(state.reduced, "change", function () { reconcile(state.reduced.matches ? "reduced-motion" : "motion-restored"); }, undefined, state.removers);
    listen(state.forced, "change", function () { reconcile(state.forced.matches ? "forced-colours" : "colours-restored"); }, undefined, state.removers);
    copyLyrics(null);
    publish("initial");
    reconcile("initial");

    return register(state.id, Object.freeze({
      id: state.id, type: "lyric-stage", restore: function (reason) { reconcile(reason || "manual-restore"); },
      snapshot: function () {
        return { id: state.id, type: "lyric-stage", phase: phase, progress: progress, playing: !audio.paused && !audio.ended && !blocked(), lyricIndex: latest ? latest.index : -1, nextVisibleIndex: latest ? latest.nextVisibleIndex : -1, cueCount: cueCount };
      },
      teardown: function () {
        stopClock(); clearCue("teardown"); unsubscribeLyric(); unsubscribeCue();
        lyricEffects.splice(0).forEach(function (record) { if (record.timer) window.clearTimeout(record.timer); safely(record.cleanup, { reason: "teardown" }, "lyricStage lyric cleanup"); });
        state.removers.splice(0).forEach(function (remove) { remove(); });
        current.className = current.className.replace(/\s*dance-moves-lyric-stage__line(?:--current)?/g, "").trim();
        delete current.dataset.danceMovesLyricSlot;
        popover.appendChild(current);
        if (viewport.parentNode === popover) popover.removeChild(viewport);
        delete popover.dataset.danceMovesLyricStage;
        delete popover.dataset.danceMovesLyricPhase;
        popover.style.removeProperty("--dance-moves-lyric-progress");
        instances.delete(state.id);
      }
    }));
  }

  function cooperativeArena(options) {
    options = options || {};
    var state = commonState(options, "cooperative-arena");
    var stage = element(options.stage, state.root);
    if (!stage) throw new Error("DanceMovesEffects cooperativeArena requires a stage element");
    var shipSources = Array.isArray(options.shipSources) ? options.shipSources.filter(Boolean).map(String) : [];
    var hazardSources = Array.isArray(options.hazardSources) ? options.hazardSources.filter(Boolean).map(String) : [];
    if (!shipSources.length || !hazardSources.length) throw new Error("DanceMovesEffects cooperativeArena requires ship and hazard sources");
    var shipCount = clamp(Math.round(finite(options.shipCount, 3)), 2, 12);
    var hazardCount = clamp(Math.round(finite(options.hazardCount, 8)), 3, 48);
    var speed = clamp(finite(options.speed, 1), .35, 2.4);
    var inlineTransform = options.inlineTransform === true;
    var bpm = Math.max(1, finite(options.bpm, motion.bpm || 120));
    var shotIntervalTicks = clamp(Math.round(finite(options.shotIntervalTicks, 32)), 4, 256);
    var shotIntervalSeconds = motion.durationMilliseconds ? motion.durationMilliseconds(shotIntervalTicks, bpm) / 1000 : shotIntervalTicks * 60 / (bpm * 16);
    var burstDurationSeconds = clamp(finite(options.burstDurationBeats, 1.5), .1, 8) * 60 / bpm;
    var shipHitboxScale = clamp(finite(options.shipHitboxScale, 1), .4, 1);
    var hazardHitboxScale = clamp(finite(options.hazardHitboxScale, 1), .4, 1);
    var removers = state.removers, ships = [], hazards = [], shots = [], bursts = [], burstTimers = [];
    var activeShips = shipCount, activeHazards = hazardCount;
    var width = 1, height = 1, frame = 0, last = 0, elapsed = 0, nextShot = 0, hits = 0;
    var visible = true, enabled = options.enabled !== false, running = false, collisions = 0;
    function image(className, source, label) {
      var node = document.createElement("img");
      node.className = className; node.src = source; node.alt = ""; node.setAttribute("aria-hidden", "true");
      node.draggable = false; node.dataset.danceMovesArenaRole = label; stage.appendChild(node); return node;
    }
    function place(node, x, y, angle) {
      if (inlineTransform) { node.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0) translate(-50%,-50%) rotate(" + angle.toFixed(2) + "deg)"; return; }
      node.style.setProperty("--dance-moves-arena-x", x.toFixed(2) + "px");
      node.style.setProperty("--dance-moves-arena-y", y.toFixed(2) + "px");
      node.style.setProperty("--dance-moves-arena-angle", angle.toFixed(2) + "deg");
    }
    function measure() { var rect = stage.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); ships.concat(hazards).forEach(function (item) { var style = window.getComputedStyle(item.node); item.w = parseFloat(style.width) || item.w; item.h = parseFloat(style.height) || item.h; }); }
    function hitShape(item) {
      if (item.hitShape && item.hitShape.angle === item.angle && item.hitShape.w === item.w && item.hitShape.h === item.h) return item.hitShape;
      var angle = item.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), scale = item.hitboxScale || 1;
      item.hitShape = { angle: item.angle, w: item.w, h: item.h, c: c, s: s, halfW: item.w * scale / 2, halfH: item.h * scale / 2 };
      return item.hitShape;
    }
    function radius(shape, ax, ay) { return Math.abs(ax * shape.c + ay * shape.s) * shape.halfW + Math.abs(-ax * shape.s + ay * shape.c) * shape.halfH; }
    function touching(first, second) {
      var a = hitShape(first), b = hitShape(second), dx = second.x - first.x, dy = second.y - first.y;
      if (Math.abs(dx) >= Math.abs(a.c) * a.halfW + Math.abs(a.s) * a.halfH + Math.abs(b.c) * b.halfW + Math.abs(b.s) * b.halfH || Math.abs(dy) >= Math.abs(a.s) * a.halfW + Math.abs(a.c) * a.halfH + Math.abs(b.s) * b.halfW + Math.abs(b.c) * b.halfH) return false;
      return Math.abs(dx * a.c + dy * a.s) < a.halfW + radius(b, a.c, a.s) &&
        Math.abs(-dx * a.s + dy * a.c) < a.halfH + radius(b, -a.s, a.c) &&
        Math.abs(dx * b.c + dy * b.s) < b.halfW + radius(a, b.c, b.s) &&
        Math.abs(-dx * b.s + dy * b.c) < b.halfH + radius(a, -b.s, b.c);
    }
    function shotTouches(shot, hazard) { return touching(shot, hazard); }
    function chooseShipSpawn(item, index) {
      var best = null;
      for (var candidateIndex = 0; candidateIndex < 12; candidateIndex += 1) {
        var candidate = (candidateIndex + index + collisions) % 12;
        var x = width * (.12 + .76 * (candidate % 4) / 3), y = height * (.46 + .42 * Math.floor(candidate / 4) / 2);
        var proposed = { x: x, y: y, angle: 0, w: item.w, h: item.h, hitboxScale: item.hitboxScale };
        var occupied = ships.slice(0, activeShips).some(function (other) { return other !== item && other.cooldown <= 0 && touching(proposed, other); }) || hazards.slice(0, activeHazards).some(function (hazard) { return touching(proposed, hazard); });
        if (occupied) continue;
        var nearest = ships.slice(0, activeShips).reduce(function (distance, other) { return other === item || other.cooldown > 0 ? distance : Math.min(distance, Math.hypot(x - other.x, y - other.y)); }, Infinity);
        if (!best || nearest > best.nearest) best = { x: x, y: y, nearest: nearest };
      }
      if (!best) return false;
      item.x = best.x; item.y = best.y; item.vx = 0; item.vy = 0; item.angle = 0; place(item.node, item.x, item.y, item.angle); return true;
    }
    function resetHazard(item, index, initial) {
      var edge = (index + Math.floor(elapsed / 6)) % 3;
      var lane = ((index * 37 + 17) % 91) / 91;
      if (initial) { item.x = width * ((index * 29 + 11) % 89) / 89; item.y = height * ((index * 43 + 7) % 83) / 83; }
      else if (edge === 0) { item.x = width * lane; item.y = -48; }
      else if (edge === 1) { item.x = -48; item.y = height * lane; }
      else { item.x = width + 48; item.y = height * lane; }
      var targetX = width * (.22 + .56 * (((index * 19 + 5) % 79) / 79));
      var targetY = height * (.18 + .64 * (((index * 23 + 9) % 73) / 73));
      var length = Math.max(1, Math.hypot(targetX - item.x, targetY - item.y));
      var velocity = (18 + (index % 5) * 4) * speed;
      item.vx = (targetX - item.x) / length * velocity; item.vy = (targetY - item.y) / length * velocity;
      item.spin = (index % 2 ? -1 : 1) * (8 + index % 7); item.angle = index * 31 % 360;
    }
    function resetShip(item) { item.cooldown = .72; item.node.style.display = "none"; item.vx = 0; item.vy = 0; }
    function makeShip(index) {
      var item = { node: image("dance-moves-arena__ship", shipSources[index % shipSources.length], "ship"), x: width * (.14 + .72 * (index % 4) / 3), y: height * (.58 + .18 * Math.floor((index % 8) / 4)), vx: 0, vy: 0, angle: 0, cooldown: 0, index: index, w: 0, h: 0, hitboxScale: shipHitboxScale };
      ships.push(item); place(item.node, item.x, item.y, item.angle);
    }
    function makeHazard(index) {
      var item = { node: image("dance-moves-arena__hazard", hazardSources[index % hazardSources.length], "hazard"), index: index, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, w: 0, h: 0, hitboxScale: hazardHitboxScale };
      hazards.push(item); resetHazard(item, index, true); place(item.node, item.x, item.y, item.angle);
    }
    function fire(ship) {
      var node = document.createElement("i"); node.className = "dance-moves-arena__shot"; node.setAttribute("aria-hidden", "true"); stage.appendChild(node);
      shots.push({ node: node, x: ship.x, y: ship.y - 18, vx: Math.sin(ship.angle * Math.PI / 180) * 28, vy: -180 * speed, life: 2.4, angle: 0, w: 4, h: 24, hitboxScale: 1 });
    }
    function burst(x, y, cause) {
      var node = document.createElement("i"); node.className = "dance-moves-arena__explosion"; node.setAttribute("aria-hidden", "true"); node.dataset.danceMovesArenaExplosion = cause || "impact"; stage.appendChild(node); place(node, x, y, 0); node.style.setProperty("--dance-moves-arena-burst-duration", burstDurationSeconds.toFixed(4) + "s"); bursts.push(node);
      if (typeof options.onBurst === "function") options.onBurst({ root: state.root, stage: stage, node: node, x: x, y: y, cause: cause || "impact", durationSeconds: burstDurationSeconds });
      var timer = window.setTimeout(function () { var index = bursts.indexOf(node), timerIndex = burstTimers.indexOf(timer); if (node.parentNode) node.parentNode.removeChild(node); if (index >= 0) bursts.splice(index, 1); if (timerIndex >= 0) burstTimers.splice(timerIndex, 1); }, burstDurationSeconds * 1000);
      burstTimers.push(timer);
    }
    function removeShot(index) { var item = shots[index]; if (item.node.parentNode) item.node.parentNode.removeChild(item.node); shots.splice(index, 1); }
    function blocked() { return !enabled || document.hidden || !visible || state.reduced.matches || state.forced.matches; }
    function reconcile(reason) {
      running = !blocked(); stage.dataset.danceMovesArena = running ? "running" : "paused"; stage.dataset.danceMovesArenaReason = reason || "reconcile";
      if (running && !frame) { last = performance.now(); frame = window.requestAnimationFrame(tick); }
      if (!running && frame) { window.cancelAnimationFrame(frame); frame = 0; }
    }
    function tick(now) {
      frame = 0; if (!running) return;
      var dt = clamp((now - last) / 1000, 0, .05); last = now; elapsed += dt;
      var liveHazards = hazards.slice(0, activeHazards), liveShips = ships.slice(0, activeShips);
      liveHazards.forEach(function (hazard) {
        hazard.x += hazard.vx * dt; hazard.y += hazard.vy * dt; hazard.angle += hazard.spin * dt;
        if (hazard.x < -80 || hazard.x > width + 80 || hazard.y < -80 || hazard.y > height + 80) resetHazard(hazard, hazard.index, false);
        place(hazard.node, hazard.x, hazard.y, hazard.angle);
      });
      liveShips.forEach(function (ship) {
        if (ship.cooldown > 0) { ship.cooldown = Math.max(0, ship.cooldown - dt); if (ship.cooldown === 0 && chooseShipSpawn(ship, ship.index + collisions)) ship.node.style.display = ""; else if (ship.cooldown === 0) ship.cooldown = .1; if (ship.cooldown > 0) return; }
        var targetX = width * (.16 + .68 * (.5 + .5 * Math.sin(elapsed * (.29 + ship.index * .03) + ship.index * 2.1)));
        var targetY = height * (.58 + .18 * (.5 + .5 * Math.cos(elapsed * (.23 + ship.index * .02) + ship.index)));
        var ax = (targetX - ship.x) * .34, ay = (targetY - ship.y) * .34;
        liveHazards.forEach(function (hazard) { var dx = ship.x - hazard.x, dy = ship.y - hazard.y, distance = Math.max(18, Math.hypot(dx, dy)); if (distance < 150) { ax += dx / distance * (150 - distance) * 2.2; ay += dy / distance * (150 - distance) * 2.2; } });
        liveShips.forEach(function (other) { if (other === ship || other.cooldown > 0) return; var dx = ship.x - other.x, dy = ship.y - other.y, distance = Math.max(12, Math.hypot(dx, dy)); if (distance < 140) { ax += dx / distance * (140 - distance); ay += dy / distance * (140 - distance); } });
        ship.vx = clamp((ship.vx + ax * dt) * .985, -96, 96); ship.vy = clamp((ship.vy + ay * dt) * .985, -72, 72);
        ship.x = clamp(ship.x + ship.vx * dt, 30, width - 30); ship.y = clamp(ship.y + ship.vy * dt, height * .4, height - 34);
        ship.angle = clamp(ship.vx * .32, -28, 28); place(ship.node, ship.x, ship.y, ship.angle);
      });
      for (var firstShip = 0; firstShip < liveShips.length; firstShip += 1) {
        var ship = liveShips[firstShip]; if (ship.cooldown > 0) continue;
        for (var secondShip = firstShip + 1; secondShip < liveShips.length; secondShip += 1) { var other = liveShips[secondShip]; if (other.cooldown > 0) continue; if (touching(ship, other)) { collisions += 1; stage.dataset.danceMovesArenaLastCollision = "ship-ship"; stage.dataset.danceMovesArenaCollisions = String(collisions); burst((ship.x + other.x) / 2, (ship.y + other.y) / 2, "ship-ship"); resetShip(ship); resetShip(other); if (typeof options.onCollision === "function") options.onCollision({ root: state.root, stage: stage, type: "ship-ship", collisions: collisions }); break; } }
        if (ship.cooldown > 0) continue;
        for (var contactHazard = 0; contactHazard < liveHazards.length; contactHazard += 1) { var hazard = liveHazards[contactHazard]; if (touching(ship, hazard)) { collisions += 1; stage.dataset.danceMovesArenaLastCollision = "ship-hazard"; stage.dataset.danceMovesArenaCollisions = String(collisions); burst((ship.x + hazard.x) / 2, (ship.y + hazard.y) / 2, "ship-hazard"); resetShip(ship); resetHazard(hazard, hazard.index + collisions, false); if (typeof options.onCollision === "function") options.onCollision({ root: state.root, stage: stage, type: "ship-hazard", collisions: collisions }); break; } }
      }
      if (elapsed >= nextShot) { var readyShips = liveShips.filter(function (ship) { return ship.cooldown <= 0; }); if (readyShips.length) fire(readyShips[Math.floor(elapsed * 1.7) % readyShips.length]); nextShot = elapsed + shotIntervalSeconds; }
      for (var shotIndex = shots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        var shot = shots[shotIndex]; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt; place(shot.node, shot.x, shot.y, 0);
        var struck = false;
        for (var hazardIndex = 0; hazardIndex < liveHazards.length; hazardIndex += 1) { var hazard = liveHazards[hazardIndex]; if (shotTouches(shot, hazard)) { hits += 1; burst(hazard.x, hazard.y, "shot"); if (typeof options.onHit === "function") options.onHit({ root: state.root, stage: stage, x: hazard.x, y: hazard.y, hits: hits, hazard: hazard }); resetHazard(hazard, hazard.index + hits, false); struck = true; break; } }
        if (struck || shot.life <= 0 || shot.y < -40) removeShot(shotIndex);
      }
      if (typeof options.render === "function") options.render({ root: state.root, stage: stage, ships: ships, hazards: hazards, shots: shots, hits: hits });
      frame = window.requestAnimationFrame(tick);
    }
    measure(); for (var shipIndex = 0; shipIndex < shipCount; shipIndex += 1) makeShip(shipIndex); for (var hazardIndex = 0; hazardIndex < hazardCount; hazardIndex += 1) makeHazard(hazardIndex); measure();
    var resizeObserver = "ResizeObserver" in window ? new ResizeObserver(measure) : null; if (resizeObserver) resizeObserver.observe(stage);
    var intersectionObserver = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) { visible = Boolean(entries[0] && entries[0].isIntersecting); reconcile("intersection"); }, { rootMargin: "160px" }) : null;
    if (intersectionObserver) intersectionObserver.observe(stage);
    listen(document, "visibilitychange", function () { reconcile(document.hidden ? "hidden" : "visible"); }, { passive: true }, removers);
    listen(state.reduced, "change", function () { reconcile(state.reduced.matches ? "reduced-motion" : "motion-restored"); }, undefined, removers);
    listen(state.forced, "change", function () { reconcile(state.forced.matches ? "forced-colours" : "colours-restored"); }, undefined, removers);
    reconcile("initial");
    return register(state.id, Object.freeze({
      id: state.id, type: "cooperative-arena", setEnabled: function (value, reason) { enabled = Boolean(value); reconcile(reason || "manual"); },
      setDensity: function (nextShips, nextHazards) { var shipsNext = clamp(Math.round(finite(nextShips, activeShips)), 2, shipCount), hazardsNext = clamp(Math.round(finite(nextHazards, activeHazards)), 3, hazardCount); if (shipsNext === activeShips && hazardsNext === activeHazards) return; activeShips = shipsNext; activeHazards = hazardsNext; ships.forEach(function (item, index) { item.node.hidden = index >= activeShips; }); hazards.forEach(function (item, index) { item.node.hidden = index >= activeHazards; }); },
      snapshot: function () { return { id: state.id, type: "cooperative-arena", running: running, enabled: enabled, ships: activeShips, hazards: activeHazards, maximumShips: ships.length, maximumHazards: hazards.length, shots: shots.length, hits: hits, collisions: collisions, shotIntervalTicks: shotIntervalTicks }; },
      teardown: function () { running = false; if (frame) window.cancelAnimationFrame(frame); if (resizeObserver) resizeObserver.disconnect(); if (intersectionObserver) intersectionObserver.disconnect(); burstTimers.splice(0).forEach(window.clearTimeout); removers.splice(0).forEach(function (remove) { remove(); }); shots.concat(ships, hazards).forEach(function (item) { if (item.node.parentNode) item.node.parentNode.removeChild(item.node); }); bursts.splice(0).forEach(function (node) { if (node.parentNode) node.parentNode.removeChild(node); }); instances.delete(state.id); }
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
    version: String(motion.version || ""), pointer: pointer, playbackPulse: playbackPulse, cueClass: cueClass, cueTimeline: cueTimeline, spritePlayback: spritePlayback, lyricStage: lyricStage, cooperativeArena: cooperativeArena, quality: quality,
    get: function (id) { return instances.get(String(id)) || null; },
    snapshot: function () { return Array.from(instances.values()).map(function (instance) { return instance.snapshot(); }); },
    teardown: function (id) { var instance = instances.get(String(id)); if (instance) instance.teardown(); },
    teardownAll: function () { Array.from(instances.values()).forEach(function (instance) { instance.teardown(); }); }
  });
  document.dispatchEvent(new CustomEvent("dance-moves-effects-ready", { bubbles: true, detail: { api: window.DanceMovesEffects, version: window.DanceMovesEffects.version } }));
}(window, document));
