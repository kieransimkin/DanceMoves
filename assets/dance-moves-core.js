(function (window, document) {
  "use strict";

  var rawConfig = window.danceMovesConfig || {};
  var DEFAULT_BPM = 120;
  var LONG_DURATION_QUANTUM_TICKS = 16;
  var TICKS_PER_BEAT = 16;
  var CSS_TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 32, 64, 128, 192, 432, 1584, 2208];
  var handlers = new Map();
  var lyricHandlers = new Map();
  var animationScopes = [];
  var cueList = [];
  var lyricList = [];
  var lyricRenderer = null;
  var boundAudio = new WeakSet();
  var activeAudio = null;
  var pageClockStarted = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
  var referenceDurationSeconds = positiveNumber(rawConfig.masterDurationMilliseconds) / 1000;
  var diagnosticsAllowed = rawConfig.diagnostics === true;
  var diagnosticsSink = null;

  function diagnosticNow() {
    return window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
  }

  function diagnosticHandlerId(metadata, fallback) {
    var value = "";
    if (typeof metadata === "string") value = metadata;
    else if (metadata && typeof metadata === "object") value = metadata.id || metadata.handlerId || "";
    value = String(value || "").trim().slice(0, 160);
    return value || "unattributed:" + String(fallback || "handler").slice(0, 140);
  }

  function setDiagnosticsSink(sink) {
    if (!diagnosticsAllowed) return false;
    if (sink === null || typeof sink === "undefined") {
      diagnosticsSink = null;
      return true;
    }
    if (typeof sink !== "function") throw new TypeError("DanceMoves diagnostics sink must be a function or null.");
    diagnosticsSink = sink;
    return true;
  }

  function emitDiagnostic(type, startedAt, details, error) {
    if (!diagnosticsSink) return;
    var endedAt = diagnosticNow();
    var record = {
      type: String(type),
      startTime: startedAt,
      endTime: endedAt,
      duration: Math.max(0, endedAt - startedAt),
      pageId: Number(rawConfig.pageId) || 0
    };
    if (details) Object.keys(details).forEach(function (key) { record[key] = details[key]; });
    if (error) record.error = String(error && error.message || error).slice(0, 500);
    try { diagnosticsSink(record); } catch (sinkError) {}
  }

  function runDiagnosticSpan(type, details, callback) {
    if (!diagnosticsSink) return callback();
    var startedAt = diagnosticNow();
    var thrown = null;
    try { return callback(); }
    catch (error) { thrown = error; throw error; }
    finally { emitDiagnostic(type, startedAt, details, thrown); }
  }

  function positiveNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function effectiveBpm(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 20 && number <= 400 ? number : DEFAULT_BPM;
  }

  function roundHalfUp(value) {
    return Math.floor(Number(value) + 0.5);
  }

  function quantizeTicks(value) {
    var ticks = Math.max(1, roundHalfUp(value));
    if (ticks > LONG_DURATION_QUANTUM_TICKS) {
      ticks = Math.max(LONG_DURATION_QUANTUM_TICKS, roundHalfUp(ticks / LONG_DURATION_QUANTUM_TICKS) * LONG_DURATION_QUANTUM_TICKS);
    }
    return ticks;
  }

  var bpm = effectiveBpm(rawConfig.bpm);

  function durationMilliseconds(ticks, bpmOverride) {
    return (3750 / effectiveBpm(bpmOverride || bpm)) * quantizeTicks(ticks);
  }

  function currentTick(options) {
    var settings = options || {};
    var audio = settings.audio || (settings.clock === "audio" ? activeAudio : null);
    if (audio && !audio.paused && !audio.ended && Number.isFinite(Number(audio.currentTime))) {
      return Number(audio.currentTime) * effectiveBpm(settings.bpm || bpm) * TICKS_PER_BEAT / 60;
    }
    var now = window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
    return Math.max(0, now - pageClockStarted) * effectiveBpm(settings.bpm || bpm) * TICKS_PER_BEAT / 60000;
  }

  function nextIntervalTick(intervalTicks, fromTick, strictlyFuture) {
    var interval = Math.max(1, roundHalfUp(intervalTicks));
    var tick = Math.max(0, Number(fromTick) || 0);
    var remainder = tick % interval;
    if (remainder < 0.001 || interval - remainder < 0.001) return strictlyFuture ? tick + interval : tick;
    return tick + (interval - remainder);
  }

  function scheduleAtInterval(intervalTicks, callback, options) {
    if (typeof callback !== "function") throw new TypeError("DanceMoves scheduled start must be a function.");
    var interval = Math.max(1, roundHalfUp(intervalTicks));
    var settings = options || {};
    var handlerId = diagnosticHandlerId(settings, "schedule-at-interval:" + interval);
    var cancelled = false;
    var frame = 0;
    var timer = 0;

    function cancel() {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      frame = 0;
      timer = 0;
    }

    function finish(boundaryTick, sourceAudio) {
      if (cancelled) return;
      cancel();
      var detail = {
        intervalTicks: interval,
        boundaryTick: boundaryTick,
        audio: sourceAudio || null,
        clock: sourceAudio ? "audio" : "page"
      };
      if (!diagnosticsSink) {
        callback(detail);
        return;
      }
      runDiagnosticSpan("interval-handler", {
        handlerId: handlerId,
        intervalTicks: interval,
        boundaryTick: boundaryTick,
        clock: detail.clock,
        repeating: false
      }, function () { return callback(detail); });
    }

    if (settings.clock === "audio" || settings.audio) {
      var targetTick = null;
      var sourceAudio = null;
      var pollAudio = function () {
        if (cancelled) return;
        var candidate = settings.audio || activeAudio;
        if (!candidate || candidate.paused || candidate.ended) {
          if (sourceAudio && sourceAudio.ended) {
            cancel();
            return;
          }
          sourceAudio = null;
          targetTick = null;
          frame = window.requestAnimationFrame(pollAudio);
          return;
        }
        if (candidate !== sourceAudio) {
          sourceAudio = candidate;
          targetTick = nextIntervalTick(interval, currentTick({ clock: "audio", audio: sourceAudio }), Boolean(settings.strictlyFuture));
        }
        var nowTick = currentTick({ clock: "audio", audio: sourceAudio });
        if (targetTick === null || nowTick > targetTick + interval) targetTick = nextIntervalTick(interval, nowTick);
        if (nowTick + 0.02 >= targetTick) {
          finish(targetTick, sourceAudio);
          return;
        }
        frame = window.requestAnimationFrame(pollAudio);
      };
      frame = window.requestAnimationFrame(pollAudio);
      return cancel;
    }

    var nowTick = currentTick({ clock: "page" });
    var boundaryTick = nextIntervalTick(interval, nowTick);
    var delay = Math.max(0, (boundaryTick - nowTick) * 3750 / bpm);
    if (delay <= 1) finish(boundaryTick, null);
    else timer = window.setTimeout(function () { finish(boundaryTick, null); }, delay);
    return cancel;
  }

  function deferStart(target, intervalTicks, options) {
    if (!target || target.nodeType !== 1) throw new TypeError("DanceMoves deferred start requires an element.");
    var settings = options || {};
    target.dataset.danceMovesWaiting = "true";
    target.removeAttribute("data-dance-moves-started");
    return scheduleAtInterval(intervalTicks, function (boundary) {
      target.dataset.danceMovesStarted = "true";
      delete target.dataset.danceMovesWaiting;
      if (typeof target.getAnimations === "function") {
        target.getAnimations({ subtree: true }).forEach(function (animation) {
          try {
            animation.currentTime = 0;
            animation.play();
          } catch (error) {}
        });
      }
      if (typeof settings.start === "function") settings.start(boundary);
      target.dispatchEvent(new CustomEvent("dance-moves-start", { bubbles: true, detail: boundary }));
    }, {
      audio: settings.audio,
      clock: settings.clock,
      strictlyFuture: settings.strictlyFuture,
      handlerId: diagnosticHandlerId(settings, "defer-start:" + String(target.id || target.tagName || "element").toLowerCase())
    });
  }

  function onNextInterval(func, interval, metadata) {
    return scheduleAtInterval(interval, func, {
      clock: "audio",
      strictlyFuture: true,
      handlerId: diagnosticHandlerId(metadata, "on-next-interval:" + interval)
    });
  }

  function onEveryInterval(func, interval, metadata) {
    if (typeof func !== "function") throw new TypeError("DanceMoves interval handler must be a function.");
    var intervalTicks = Math.max(1, roundHalfUp(interval));
    var handlerId = diagnosticHandlerId(metadata, "on-every-interval:" + intervalTicks);
    var cancelled = false;
    var frame = 0;
    var sourceAudio = null;
    var boundaryTick = null;

    function remove() {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function poll() {
      frame = 0;
      if (cancelled) return;
      var candidate = activeAudio;
      if (!candidate || candidate.paused) {
        if (sourceAudio && sourceAudio.ended) {
          remove();
          return;
        }
        frame = window.requestAnimationFrame(poll);
        return;
      }
      if (candidate.ended) {
        remove();
        return;
      }
      var nowTick = currentTick({ clock: "audio", audio: candidate });
      if (candidate !== sourceAudio) {
        sourceAudio = candidate;
        boundaryTick = nextIntervalTick(intervalTicks, nowTick, true);
      }
      if (nowTick > boundaryTick + intervalTicks) boundaryTick = nextIntervalTick(intervalTicks, nowTick, true);
      while (!cancelled && nowTick + 0.02 >= boundaryTick) {
        var detail = { intervalTicks: intervalTicks, boundaryTick: boundaryTick, audio: sourceAudio, clock: "audio" };
        boundaryTick += intervalTicks;
        try {
          if (diagnosticsSink) {
            runDiagnosticSpan("interval-handler", {
              handlerId: handlerId,
              intervalTicks: intervalTicks,
              boundaryTick: detail.boundaryTick,
              clock: detail.clock,
              repeating: true
            }, function () { return func(detail); });
          } else {
            func(detail);
          }
        } catch (error) {
          if (window.console && typeof window.console.error === "function") window.console.error("DanceMoves interval handler failed", error);
        }
      }
      if (!cancelled) frame = window.requestAnimationFrame(poll);
    }

    frame = window.requestAnimationFrame(poll);
    return remove;
  }

  function onNextBeat(func, metadata) { return onNextInterval(func, TICKS_PER_BEAT, metadata); }
  function onEveryBeat(func, metadata) { return onEveryInterval(func, TICKS_PER_BEAT, metadata); }
  function onNextBar(func, metadata) { return onNextInterval(func, TICKS_PER_BEAT * 4, metadata); }
  function onEveryBar(func, metadata) { return onEveryInterval(func, TICKS_PER_BEAT * 4, metadata); }

  function normaliseCueName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }

  function parseTimestamp(minutes, seconds, fraction) {
    var decimal = fraction ? Number("0." + String(fraction).padEnd(3, "0").slice(0, 3)) : 0;
    return Number(minutes) * 60 + Number(seconds) + decimal;
  }

  function parseTimingFile(text) {
    if (typeof text !== "string" || text.indexOf("\uFFFD") !== -1 || text.indexOf("\0") !== -1) return [];
    var entries = [];
    text.replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
      var stamps = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/g));
      if (!stamps.length) return;
      var label = line.replace(/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/g, "").trim();
      if (!label) return;
      var cueMatch = label.match(/^\[?\s*([A-Za-z][A-Za-z0-9 _-]*)\s*:\s*([^\]]+)\]?$/);
      var type = cueMatch ? cueMatch[1].trim() : "CUE";
      var name = cueMatch ? cueMatch[2].trim() : label.replace(/^\[|\]$/g, "").trim();
      stamps.forEach(function (stamp) {
        entries.push({
          time: parseTimestamp(stamp[1], stamp[2], stamp[3]),
          type: type,
          name: name,
          label: label,
          normalisedType: normaliseCueName(type),
          normalisedName: normaliseCueName(name),
          normalisedLabel: normaliseCueName(label)
        });
      });
    });
    return entries
      .filter(function (entry) { return Number.isFinite(entry.time) && entry.time >= 0; })
      .sort(function (left, right) { return left.time - right.time; });
  }

  function parseLyricTimingFile(text) {
    if (typeof text !== "string" || text.indexOf("\uFFFD") !== -1 || text.indexOf("\0") !== -1) return [];
    var entries = [];
    text.replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
      var stamps = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/g));
      if (!stamps.length) return;
      var textValue = line.replace(/\[(\d{1,3}):(\d{2})(?:[\.:](\d{1,3}))?\]/g, "").trim();
      stamps.forEach(function (stamp) {
        entries.push({
          time: parseTimestamp(stamp[1], stamp[2], stamp[3]),
          text: textValue,
          normalisedText: normaliseCueName(textValue)
        });
      });
    });
    return entries
      .filter(function (entry) { return Number.isFinite(entry.time) && entry.time >= 0; })
      .sort(function (left, right) { return left.time - right.time; });
  }

  function setTimingProperties() {
    var style = document.documentElement.style;
    var sharedControlTicks = Number(rawConfig.sharedControlTicks) || 0;
    var lyricDisclosureTicks = quantizeTicks(Number(rawConfig.lyricDisclosureTicks) || 6);
    style.setProperty("--dance-moves-beat", (60000 / bpm).toFixed(6) + "ms");
    style.setProperty("--dance-moves-tick", (3750 / bpm).toFixed(6) + "ms");
    CSS_TICKS.forEach(function (ticks) {
      style.setProperty("--dance-moves-" + ticks + "t", durationMilliseconds(ticks).toFixed(6) + "ms");
    });
    style.setProperty("--dance-moves-neg-64t", (-durationMilliseconds(64)).toFixed(6) + "ms");
    style.setProperty("--dance-moves-lyric-disclosure-duration", durationMilliseconds(lyricDisclosureTicks).toFixed(6) + "ms");
    style.setProperty("--dance-moves-lyric-disclosure-ticks", String(lyricDisclosureTicks));
    if (sharedControlTicks > 0) {
      sharedControlTicks = quantizeTicks(sharedControlTicks);
      style.setProperty("--dance-moves-shared-control-duration", durationMilliseconds(sharedControlTicks).toFixed(6) + "ms");
      style.setProperty("--dance-moves-shared-control-ticks", String(sharedControlTicks));
      document.documentElement.dataset.danceMovesSharedControls = "true";
    } else {
      delete document.documentElement.dataset.danceMovesSharedControls;
    }
    document.documentElement.dataset.danceMovesBpm = String(bpm);
    document.documentElement.dataset.danceMovesBpmSource = rawConfig.bpmSource === "explicit" ? "explicit" : "fallback";
    document.documentElement.dataset.danceMovesVersion = String(rawConfig.version || "");
  }

  function registerAnimationScope(root, selectors) {
    if (!root || typeof root.getAnimations !== "function") return function () {};
    var selectorList = Array.isArray(selectors) ? selectors.filter(Boolean) : [];
    var scope = { root: root, selectors: selectorList };
    animationScopes.push(scope);
    return function () {
      var index = animationScopes.indexOf(scope);
      if (index !== -1) animationScopes.splice(index, 1);
    };
  }

  function scopeOwnsAnimation(scope, animation) {
    var target = animation && animation.effect && animation.effect.target;
    if (!target || target.nodeType !== 1) return false;
    if (!scope.root.contains(target) && scope.root !== target) return false;
    if (!scope.selectors.length) return false;
    return scope.selectors.some(function (selector) {
      try {
        return target.matches(selector) || Boolean(target.closest(selector));
      } catch (error) {
        return false;
      }
    });
  }

  function ownedAnimations() {
    var found = [];
    animationScopes.forEach(function (scope) {
      scope.root.getAnimations({ subtree: true }).forEach(function (animation) {
        if (scopeOwnsAnimation(scope, animation) && found.indexOf(animation) === -1) found.push(animation);
      });
    });
    return found;
  }

  function setOwnedPlaybackRate(rate) {
    var playbackRate = positiveNumber(rate) || 1;
    ownedAnimations().forEach(function (animation) {
      try { animation.playbackRate = playbackRate; } catch (error) {}
    });
  }

  function resetRunningAnimations(audio) {
    var diagnosticStartedAt = diagnosticsSink ? diagnosticNow() : 0;
    var playbackRate = positiveNumber(audio && audio.playbackRate) || 1;
    var resetCount = 0;
    ownedAnimations().forEach(function (animation) {
      if (animation.playState !== "running" && animation.playState !== "pending") return;
      try {
        animation.currentTime = 0;
        animation.playbackRate = playbackRate;
        animation.play();
        resetCount += 1;
      } catch (error) {}
    });
    if (diagnosticsSink) emitDiagnostic("animation-reset", diagnosticStartedAt, { resetCount: resetCount, playbackRate: playbackRate });
    return resetCount;
  }

  function onCue(name, handler, metadata) {
    if (typeof handler !== "function") throw new TypeError("DanceMoves cue handler must be a function.");
    var key = name === "*" ? "*" : normaliseCueName(name);
    if (!handlers.has(key)) handlers.set(key, new Map());
    handlers.get(key).set(handler, {
      callback: handler,
      id: diagnosticHandlerId(metadata, "cue:" + (key || "unnamed"))
    });
    return function () {
      var group = handlers.get(key);
      if (!group) return;
      group.delete(handler);
      if (!group.size) handlers.delete(key);
    };
  }

  function onLyric(handler, metadata) {
    if (typeof handler !== "function") throw new TypeError("DanceMoves lyric handler must be a function.");
    lyricHandlers.set(handler, {
      callback: handler,
      id: diagnosticHandlerId(metadata, "lyric")
    });
    return function () { lyricHandlers.delete(handler); };
  }

  function dispatchLyric(entry, audio, index) {
    var previousVisibleIndex = -1;
    var previousVisibleEntry = null;
    if (Number.isFinite(index)) {
      for (var previousCursor = index - 1; previousCursor >= 0; previousCursor -= 1) {
        if (String(lyricList[previousCursor].text || "").trim()) {
          previousVisibleIndex = previousCursor;
          previousVisibleEntry = lyricList[previousCursor];
          break;
        }
      }
    }
    var nextIndex = Number.isFinite(index) && index + 1 < lyricList.length ? index + 1 : -1;
    var nextEntry = nextIndex >= 0 ? lyricList[nextIndex] : null;
    var nextVisibleIndex = -1;
    var nextVisibleEntry = null;
    if (Number.isFinite(index)) {
      for (var cursor = index + 1; cursor < lyricList.length; cursor += 1) {
        if (String(lyricList[cursor].text || "").trim()) {
          nextVisibleIndex = cursor;
          nextVisibleEntry = lyricList[cursor];
          break;
        }
      }
    }
    var detail = {
      pageId: Number(rawConfig.pageId) || 0,
      time: entry ? entry.time : 0,
      text: entry ? entry.text : "",
      normalisedText: entry ? entry.normalisedText : "",
      index: Number.isFinite(index) ? index : -1,
      previousVisibleTime: previousVisibleEntry ? previousVisibleEntry.time : null,
      previousVisibleText: previousVisibleEntry ? previousVisibleEntry.text : "",
      previousVisibleNormalisedText: previousVisibleEntry ? previousVisibleEntry.normalisedText : "",
      previousVisibleIndex: previousVisibleIndex,
      nextTime: nextEntry ? nextEntry.time : null,
      nextText: nextEntry ? nextEntry.text : "",
      nextNormalisedText: nextEntry ? nextEntry.normalisedText : "",
      nextIndex: nextIndex,
      nextVisibleTime: nextVisibleEntry ? nextVisibleEntry.time : null,
      nextVisibleText: nextVisibleEntry ? nextVisibleEntry.text : "",
      nextVisibleNormalisedText: nextVisibleEntry ? nextVisibleEntry.normalisedText : "",
      nextVisibleIndex: nextVisibleIndex,
      audio: audio || null
    };
    Array.from(lyricHandlers.values()).forEach(function (registered) {
      try {
        if (diagnosticsSink) {
          runDiagnosticSpan("lyric-handler", {
            handlerId: registered.id,
            lyricIndex: detail.index,
            lyricTime: detail.time
          }, function () { return registered.callback(detail); });
        } else {
          registered.callback(detail);
        }
      } catch (error) {
        if (window.console && typeof window.console.error === "function") window.console.error("DanceMoves lyric handler failed", error);
      }
    });
    document.dispatchEvent(new CustomEvent("dance-moves-lyric", { bubbles: true, detail: detail }));
    return detail;
  }

  function lyricAtOrBefore(time) {
    var low = 0;
    var high = lyricList.length;
    while (low < high) {
      var middle = Math.floor((low + high) / 2);
      if (lyricList[middle].time <= time + 0.001) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  }

  function createLyricRenderer() {
    if (!rawConfig.lyricPopupsEnabled || lyricRenderer || !document.body) return lyricRenderer;
    var container = document.createElement("div");
    var textNode = document.createElement("span");
    container.className = "dance-moves-lyric-popover";
    container.setAttribute("aria-hidden", "true");
    container.dataset.danceMovesLyricState = "idle";
    textNode.className = "dance-moves-lyric-popover__text";
    container.appendChild(textNode);
    document.body.appendChild(container);
    lyricRenderer = {
      element: container,
      text: textNode,
      index: -2,
      update: function (detail, playing) {
        if (detail.index !== this.index) {
          this.index = detail.index;
          this.element.dataset.danceMovesLyricIndex = String(detail.index);
          this.text.textContent = detail.text;
          delete this.element.dataset.danceMovesLyricPulse;
          void this.element.offsetWidth;
          this.element.dataset.danceMovesLyricPulse = "true";
        }
        this.element.dataset.danceMovesLyricState = playing && detail.text ? "active" : "idle";
      },
      hide: function () { this.element.dataset.danceMovesLyricState = "idle"; }
    };
    document.dispatchEvent(new CustomEvent("dance-moves-lyric-ready", { bubbles: true, detail: { element: container } }));
    return lyricRenderer;
  }

  function callHandlers(key, detail) {
    var group = handlers.get(key);
    if (!group) return;
    Array.from(group.values()).forEach(function (entry) {
      try {
        if (diagnosticsSink) {
          runDiagnosticSpan("cue-handler", {
            handlerId: entry.id,
            registration: key,
            cueName: detail.normalisedName,
            cueType: detail.normalisedType
          }, function () { return entry.callback(detail); });
        } else {
          entry.callback(detail);
        }
      } catch (error) {
        if (window.console && typeof window.console.error === "function") window.console.error("DanceMoves cue handler failed", error);
      }
    });
  }

  function dispatchCueEvent(type, detail) {
    if (!diagnosticsSink) return document.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: detail }));
    return runDiagnosticSpan("cue-handler", {
      handlerId: "custom-event:" + type,
      registration: type,
      cueName: detail.normalisedName,
      cueType: detail.normalisedType
    }, function () { return document.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: detail })); });
  }

  function dispatchCue(cue, audio) {
    var diagnosticStartedAt = diagnosticsSink ? diagnosticNow() : 0;
    var detail;
    try {
      detail = {
        pageId: Number(rawConfig.pageId) || 0,
        time: cue.time,
        type: cue.type,
        name: cue.name,
        label: cue.label,
        normalisedType: cue.normalisedType,
        normalisedName: cue.normalisedName,
        audio: audio,
        resetAnimationCount: resetRunningAnimations(audio)
      };
      callHandlers(cue.normalisedName, detail);
      if (cue.normalisedLabel !== cue.normalisedName) callHandlers(cue.normalisedLabel, detail);
      callHandlers("*", detail);
      dispatchCueEvent("dance-moves-cue", detail);
      dispatchCueEvent("kieran-epk-cue", detail);
      return detail;
    } finally {
      if (diagnosticsSink) emitDiagnostic("cue-dispatch-total", diagnosticStartedAt, {
        cueName: cue.normalisedName,
        cueType: cue.normalisedType,
        resetAnimationCount: detail ? detail.resetAnimationCount : 0
      });
    }
  }

  function fireCue(input) {
    var source = input && typeof input === "object" ? input : {};
    var name = String(source.name || source.label || "").trim();
    if (!name) throw new TypeError("DanceMoves fireCue requires a cue name.");
    var type = String(source.type || "CUE").trim() || "CUE";
    var label = String(source.label || name).trim() || name;
    var time = Number(source.time);
    if (!Number.isFinite(time) || time < 0) time = 0;
    return dispatchCue({
      time: time,
      type: type,
      name: name,
      label: label,
      normalisedType: normaliseCueName(type),
      normalisedName: normaliseCueName(name),
      normalisedLabel: normaliseCueName(label)
    }, null);
  }

  function firstCueAfter(time) {
    var diagnosticStartedAt = diagnosticsSink ? diagnosticNow() : 0;
    var low = 0;
    var high = cueList.length;
    while (low < high) {
      var middle = Math.floor((low + high) / 2);
      if (cueList[middle].time <= time + 0.001) low = middle + 1;
      else high = middle;
    }
    if (diagnosticsSink) emitDiagnostic("cue-reindex", diagnosticStartedAt, { time: Number(time) || 0, nextIndex: low, cueCount: cueList.length });
    return low;
  }

  function cueAtLanding(time) {
    var tolerance = 0.05;
    var index = firstCueAfter(time - tolerance - 0.001);
    if (index >= cueList.length) return null;
    return Math.abs(cueList[index].time - time) <= tolerance ? cueList[index] : null;
  }

  function matchesMasterDuration(audio) {
    var duration = positiveNumber(audio.duration);
    if (!duration || !referenceDurationSeconds) return false;
    return Math.abs(duration - referenceDurationSeconds) <= Math.max(0.25, duration / 100000);
  }

  function bindAudio(audio) {
    if (boundAudio.has(audio) || !matchesMasterDuration(audio)) return;
    boundAudio.add(audio);
    audio.dataset.danceMovesTiming = "master-length";
    var state = {
      next: firstCueAfter(audio.currentTime || 0),
      lyric: -2,
      last: audio.currentTime || 0,
      seeking: false,
      frame: 0,
      pendingCue: cueAtLanding(audio.currentTime || 0)
    };

    function stopFrame() {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      state.frame = 0;
    }

    function tick() {
      state.frame = 0;
      if (audio.paused || audio.ended || state.seeking) return;
      var diagnosticStartedAt = diagnosticsSink ? diagnosticNow() : 0;
      var firedCount = 0;
      var now = 0;
      try {
        now = positiveNumber(audio.currentTime);
        if (now + 0.001 < state.last) state.next = firstCueAfter(now);
        var lyricIndex = lyricAtOrBefore(now);
        if (lyricIndex !== state.lyric) {
          state.lyric = lyricIndex;
          var lyricDetail = dispatchLyric(lyricIndex >= 0 ? lyricList[lyricIndex] : null, audio, lyricIndex);
          var renderer = createLyricRenderer();
          if (renderer) renderer.update(lyricDetail, true);
        }
        while (state.next < cueList.length && cueList[state.next].time <= now + 0.001) {
          var cue = cueList[state.next];
          if (cue.time > state.last + 0.001) {
            dispatchCue(cue, audio);
            firedCount += 1;
          }
          state.next += 1;
        }
      } finally {
        if (diagnosticsSink) emitDiagnostic("cue-detect", diagnosticStartedAt, {
          currentTime: now,
          firedCount: firedCount,
          nextIndex: state.next
        });
      }
      state.last = now;
      state.frame = window.requestAnimationFrame(tick);
    }

    function start() {
      stopFrame();
      activeAudio = audio;
      state.last = positiveNumber(audio.currentTime);
      state.next = firstCueAfter(state.last);
      state.lyric = -2;
      if (state.pendingCue) {
        dispatchCue(state.pendingCue, audio);
        state.pendingCue = null;
      }
      setOwnedPlaybackRate(audio.playbackRate);
      state.frame = window.requestAnimationFrame(tick);
    }

    audio.addEventListener("play", start);
    audio.addEventListener("playing", start);
    audio.addEventListener("pause", function () { stopFrame(); if (activeAudio === audio) activeAudio = null; if (lyricRenderer) lyricRenderer.hide(); });
    audio.addEventListener("ended", function () { stopFrame(); if (activeAudio === audio) activeAudio = null; state.last = 0; state.next = 0; state.lyric = -2; state.pendingCue = cueAtLanding(0); if (lyricRenderer) lyricRenderer.hide(); });
    audio.addEventListener("seeking", function () { state.seeking = true; state.pendingCue = null; stopFrame(); });
    audio.addEventListener("seeked", function () {
      state.seeking = false;
      state.last = positiveNumber(audio.currentTime);
      state.next = firstCueAfter(state.last);
      state.lyric = -2;
      state.pendingCue = cueAtLanding(state.last);
      if (!audio.paused && !audio.ended) start();
    });
    audio.addEventListener("ratechange", function () { setOwnedPlaybackRate(audio.playbackRate); });
    audio.addEventListener("timeupdate", function () { if (!audio.paused && !state.frame && !state.seeking) tick(); });
  }

  function discoverAudio() {
    var audioElements = Array.from(document.querySelectorAll("audio"));
    if (!referenceDurationSeconds) {
      var canonical = document.querySelector("audio[data-dance-moves-master], #ks-clay-stars-audio") || audioElements[0];
      if (canonical && positiveNumber(canonical.duration)) referenceDurationSeconds = canonical.duration;
    }
    audioElements.forEach(function (audio) {
      if (positiveNumber(audio.duration)) bindAudio(audio);
      else audio.addEventListener("loadedmetadata", function () {
        if (!referenceDurationSeconds && (audio.matches("[data-dance-moves-master], #ks-clay-stars-audio") || audioElements[0] === audio)) {
          referenceDurationSeconds = positiveNumber(audio.duration);
        }
        bindAudio(audio);
      }, { once: true });
    });
  }

  function loadCueFile() {
    var url = String(rawConfig.cueTimingUrl || "");
    if (!url) return Promise.resolve([]);
    return window.fetch(url, { credentials: "same-origin", cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Cue timing request returned " + response.status);
        return response.text();
      })
      .then(function (text) {
        cueList = parseTimingFile(text);
        return cueList;
      })
      .catch(function (error) {
        document.documentElement.dataset.danceMovesCueStatus = "unavailable";
        if (window.console && typeof window.console.warn === "function") window.console.warn("DanceMoves cue file unavailable", error);
        return [];
      });
  }

  function loadLyricFile() {
    var url = String(rawConfig.lyricTimingUrl || "");
    if (!url) return Promise.resolve([]);
    return window.fetch(url, { credentials: "same-origin", cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Lyric timing request returned " + response.status);
        return response.text();
      })
      .then(function (text) {
        lyricList = parseLyricTimingFile(text);
        return lyricList;
      })
      .catch(function (error) {
        document.documentElement.dataset.danceMovesLyricStatus = "unavailable";
        if (window.console && typeof window.console.warn === "function") window.console.warn("DanceMoves lyric file unavailable", error);
        return [];
      });
  }

  function initialise() {
    setTimingProperties();
    var root = document.querySelector(".ks-epk");
    if (root) {
      root.dataset.danceMovesBpm = String(bpm);
      root.dataset.danceMovesBpmSource = rawConfig.bpmSource === "explicit" ? "explicit" : "fallback";
      if (rawConfig.lyricTimingUrl) root.dataset.danceMovesLyricTiming = String(rawConfig.lyricTimingUrl);
      if (rawConfig.cueTimingUrl) root.dataset.danceMovesCueTiming = String(rawConfig.cueTimingUrl);
      var sharedSelectors = [".ks-epk-lyrics-track summary span[aria-hidden]"];
      if (rawConfig.sharedControlTicks) sharedSelectors.push(".epk-button", ".epk-download");
      registerAnimationScope(root, sharedSelectors);
    }
    Array.from(document.querySelectorAll("[data-dance-moves-start-interval]")).forEach(function (target) {
      var interval = Number(target.getAttribute("data-dance-moves-start-interval"));
      if (!Number.isFinite(interval) || interval < 1) return;
      deferStart(target, interval, { clock: target.getAttribute("data-dance-moves-start-clock") === "audio" ? "audio" : "page" });
    });
    Promise.all([loadCueFile(), loadLyricFile()]).then(function () {
      document.documentElement.dataset.danceMovesCueCount = String(cueList.length);
      document.documentElement.dataset.danceMovesCueStatus = cueList.length ? "ready" : "none";
      document.documentElement.dataset.danceMovesLyricCount = String(lyricList.length);
      document.documentElement.dataset.danceMovesLyricStatus = lyricList.length ? "ready" : "none";
      if (rawConfig.lyricPopupsEnabled && lyricList.length) createLyricRenderer();
      discoverAudio();
    });
  }

  var api = {
    version: String(rawConfig.version || ""),
    bpm: bpm,
    bpmSource: rawConfig.bpmSource === "explicit" ? "explicit" : "fallback",
    ticksPerBeat: TICKS_PER_BEAT,
    quantizeTicks: quantizeTicks,
    durationMilliseconds: durationMilliseconds,
    currentTick: currentTick,
    nextIntervalTick: nextIntervalTick,
    scheduleAtInterval: scheduleAtInterval,
    deferStart: deferStart,
    onNextInterval: onNextInterval,
    onEveryInterval: onEveryInterval,
    onNextBeat: onNextBeat,
    onEveryBeat: onEveryBeat,
    onNextBar: onNextBar,
    onEveryBar: onEveryBar,
    parseTimingFile: parseTimingFile,
    parseLyricTimingFile: parseLyricTimingFile,
    normaliseCueName: normaliseCueName,
    onCue: onCue,
    onLyric: onLyric,
    fireCue: fireCue,
    registerAnimationScope: registerAnimationScope,
    resetRunningAnimations: resetRunningAnimations,
    discoverAudio: discoverAudio,
    setDiagnosticsSink: setDiagnosticsSink,
    diagnosticsEnabled: function () { return diagnosticsAllowed && Boolean(diagnosticsSink); }
  };
  window.DanceMoves = api;
  window.KieranEpkMotion = api;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
}(window, document));
