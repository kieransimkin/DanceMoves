((root, factory) => {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KSMotionCapturePolicy = api;
})(typeof globalThis === "object" ? globalThis : this, () => {
  "use strict";

  const CAPTURE_DURATION_MS = 30000;
  const STORAGE_INTERVAL_MS = 100;
  const MAX_STORED_SAMPLES = 400;
  const SCHEDULING_TOLERANCE_MS = 1;

  function createSampler(options = {}) {
    const storageInterval = Number(options.storageIntervalMilliseconds) || STORAGE_INTERVAL_MS;
    const maximum = Number(options.maximumSamples) || MAX_STORED_SAMPLES;
    let samples = [];
    let lastStoredAt = -Infinity;
    let nextStoreAt = 0;

    function push(sample, elapsedMilliseconds, force = false) {
      const elapsed = Number(elapsedMilliseconds);
      if (!Number.isFinite(elapsed) || elapsed < 0) return false;
      if (!force && elapsed + SCHEDULING_TOLERANCE_MS < nextStoreAt) return false;

      if (force && samples.length && elapsed === lastStoredAt) {
        samples[samples.length - 1] = sample;
        return true;
      }
      if (samples.length >= maximum) {
        if (force && samples.length) {
          samples[samples.length - 1] = sample;
          lastStoredAt = elapsed;
        }
        return false;
      }

      samples.push(sample);
      lastStoredAt = elapsed;
      nextStoreAt = elapsed + storageInterval;
      return true;
    }

    function reset() {
      samples = [];
      lastStoredAt = -Infinity;
      nextStoreAt = 0;
    }

    return Object.freeze({
      push,
      reset,
      size: () => samples.length,
      samples: () => samples.slice(),
    });
  }

  return Object.freeze({
    CAPTURE_DURATION_MS,
    STORAGE_INTERVAL_MS,
    MAX_STORED_SAMPLES,
    createSampler,
  });
});
