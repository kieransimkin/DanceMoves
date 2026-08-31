(function () {
  "use strict";

  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancelRaf = window.cancelAnimationFrame.bind(window);
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  const wrappedOrientation = new WeakMap();
  const samples = new Map();
  const marks = [];
  const errors = [];
  const frameTimes = [];
  const counters = { orientationReceived: 0, orientationRejected: 0, sensorCommitted: 0, rafRequested: 0, rafCallbacks: 0, droppedSamples: 0, droppedMarks: 0, unattributedHandlers: 0 };
  let active = false;
  let maximumSamples = 20000;
  let overflow = false;
  let startedAt = 0;
  let stoppedAt = 0;
  let lastFrame = 0;
  let monitorFrame = 0;
  let longTaskCount = 0;

  function record(bucket, value) {
    if (!active || !Number.isFinite(value)) return;
    if (!samples.has(bucket)) samples.set(bucket, []);
    const values = samples.get(bucket);
    if (values.length >= maximumSamples) { counters.droppedSamples += 1; overflow = true; return; }
    values.push(value);
  }

  function percentile(sorted, fraction) {
    if (!sorted.length) return null;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
    return sorted[index];
  }

  function statistics(values) {
    if (!values || !values.length) return { count: 0, total: 0, mean: null, p50: null, p95: null, p99: null, max: null };
    const sorted = [...values].sort((a, b) => a - b);
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      count: values.length,
      total,
      mean: total / values.length,
      p50: percentile(sorted, .5),
      p95: percentile(sorted, .95),
      p99: percentile(sorted, .99),
      max: sorted[sorted.length - 1]
    };
  }

  function timed(bucket, callback, thisArg, args) {
    const start = performance.now();
    try { return callback.apply(thisArg, args); }
    catch (error) {
      if (active && errors.length < 100) errors.push({ bucket, time: performance.now(), message: String(error && error.message || error) });
      throw error;
    } finally {
      record(bucket, performance.now() - start);
    }
  }

  function wrapCueHandler(id, callback) {
    if (typeof callback !== "function") throw new TypeError("Cue handler must be a function");
    return function () { return timed(`cue:${id}`, callback, this, arguments); };
  }

  function measure(id, callback) {
    if (typeof callback !== "function") throw new TypeError("Measured callback must be a function");
    return timed(id, callback, null, []);
  }

  window.addEventListener = function (type, listener, options) {
    if (type !== "deviceorientation" || !listener) return nativeAdd(type, listener, options);
    const callable = typeof listener === "function" ? listener : listener.handleEvent?.bind(listener);
    if (!callable) return nativeAdd(type, listener, options);
    const wrapped = function (event) {
      if (active) counters.orientationReceived += 1;
      return timed("orientation", callable, this, [event]);
    };
    wrappedOrientation.set(listener, wrapped);
    return nativeAdd(type, wrapped, options);
  };

  window.removeEventListener = function (type, listener, options) {
    if (type === "deviceorientation" && wrappedOrientation.has(listener)) {
      const wrapped = wrappedOrientation.get(listener);
      wrappedOrientation.delete(listener);
      return nativeRemove(type, wrapped, options);
    }
    return nativeRemove(type, listener, options);
  };

  window.requestAnimationFrame = function (callback) {
    if (active) counters.rafRequested += 1;
    const label = callback && callback.name ? `raf:${callback.name}` : "raf:anonymous";
    return nativeRaf(timestamp => {
      if (active) counters.rafCallbacks += 1;
      return timed(label, callback, window, [timestamp]);
    });
  };

  window.cancelAnimationFrame = function (id) { return nativeCancelRaf(id); };

  function monitor(timestamp) {
    if (active && lastFrame) {
      const interval = timestamp - lastFrame;
      if (frameTimes.length < maximumSamples) frameTimes.push(interval);
      else overflow = true;
    }
    lastFrame = timestamp;
    monitorFrame = nativeRaf(monitor);
  }
  monitorFrame = nativeRaf(monitor);

  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver(list => {
        if (!active) return;
        for (const entry of list.getEntries()) {
          if (entry.entryType === "longtask") {
            longTaskCount += 1;
            record("longtask", entry.duration);
          }
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch (_) {}
  }

  function mark(kind, detail) {
    if (!active) return;
    if (marks.length >= Math.min(maximumSamples, 2000)) { counters.droppedMarks += 1; overflow = true; return; }
    marks.push({ kind, time: performance.now(), detail: detail || null });
  }

  function start(options) {
    samples.clear();
    marks.length = 0;
    errors.length = 0;
    frameTimes.length = 0;
    Object.keys(counters).forEach(key => { counters[key] = 0; });
    if (Number.isInteger(options?.maximumSamples) && options.maximumSamples >= 100) maximumSamples = options.maximumSamples;
    overflow = false;
    longTaskCount = 0;
    lastFrame = 0;
    startedAt = performance.now();
    stoppedAt = 0;
    active = true;
    mark("capture-start", options || null);
  }

  function stop() {
    mark("capture-stop");
    stoppedAt = performance.now();
    active = false;
    return snapshot();
  }

  function aggregateByPrefix(prefix) {
    const result = [];
    for (const [name, values] of samples) if (name.startsWith(prefix)) result.push(...values);
    return result;
  }

  function snapshot() {
    const end = active ? performance.now() : stoppedAt || performance.now();
    const duration = startedAt ? Math.max(0, end - startedAt) : 0;
    const frame = statistics(frameTimes);
    const refreshInterval = frame.p50;
    const over15 = refreshInterval ? frameTimes.filter(value => value > refreshInterval * 1.5).length : 0;
    const over2 = refreshInterval ? frameTimes.filter(value => value > refreshInterval * 2).length : 0;
    let currentMissedSequence = 0;
    let longestMissedFrameSequence = 0;
    for (const interval of frameTimes) {
      if (refreshInterval && interval > refreshInterval * 1.5) {
        currentMissedSequence += 1;
        longestMissedFrameSequence = Math.max(longestMissedFrameSequence, currentMissedSequence);
      } else {
        currentMissedSequence = 0;
      }
    }
    const named = {};
    for (const [name, values] of samples) named[name] = statistics(values);
    return {
      schema: "epk-effect-harness-metrics/v1",
      active,
      startedAt,
      stoppedAt,
      durationMilliseconds: duration,
      overflow,
      counters: { ...counters },
      summary: {
        fps: duration > 0 ? frameTimes.length / (duration / 1000) : null,
        frame,
        orientation: statistics(samples.get("orientation") || []),
        raf: statistics(aggregateByPrefix("raf:")),
        cue: statistics(aggregateByPrefix("cue:")),
        longTaskCount,
        sampleCount: [...samples.values()].reduce((sum, values) => sum + values.length, 0),
        refreshIntervalMilliseconds: refreshInterval,
        framesOver1_5x: over15,
        framesOver2x: over2,
        longestMissedFrameSequence,
        droppedFramePercent: frameTimes.length ? (over15 / frameTimes.length) * 100 : null
      },
      named,
      raw: Object.fromEntries(samples),
      frames: [...frameTimes],
      marks: [...marks],
      errors: [...errors]
    };
  }

  function noteCommit(sampleAge) {
    if (active) counters.sensorCommitted += 1;
    record("sample-age-at-commit", sampleAge);
  }

  function noteRejected() { if (active) counters.orientationRejected += 1; }

  function recordDiagnostic(span) {
    if (!active || !span || typeof span.type !== "string" || !Number.isFinite(span.duration)) return false;
    if ((span.type === "cue-handler" || span.type === "interval-handler") && (!span.handlerId || String(span.handlerId).startsWith("unattributed:"))) {
      counters.unattributedHandlers += 1;
      overflow = true;
    }
    const identifiers = {
      "cue-handler": `cue:${span.handlerId || "unattributed"}`,
      "cue-dispatch-total": "cue:total-dispatch",
      "animation-reset": "cue:animation-reset",
      "cue-detect": "cue:detection",
      "cue-reindex": "cue:reindex",
      "interval-handler": `interval:${span.handlerId || "unattributed"}`
    };
    const bucket = identifiers[span.type] || `dance-moves:${span.type}`;
    record(bucket, span.duration);
    if (span.error && errors.length < 100) {
      errors.push({ bucket, time: Number(span.endTime) || performance.now(), message: String(span.error) });
    }
    mark(`diagnostic:${span.type}`, {
      handlerId: typeof span.handlerId === "string" ? span.handlerId : null,
      cueName: typeof span.cueName === "string" ? span.cueName : null,
      cueType: typeof span.cueType === "string" ? span.cueType : null,
      duration: span.duration
    });
    return true;
  }

  window.EPKEffectHarnessProbe = Object.freeze({
    start, stop, snapshot, mark, measure, wrapCueHandler, noteCommit, noteRejected, recordDiagnostic,
    isActive: () => active,
    nativeRequestAnimationFrame: nativeRaf
  });
})();
