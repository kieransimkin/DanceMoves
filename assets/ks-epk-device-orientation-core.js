(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KSEpkOrientationCore = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function isMobileDevice(environment) {
    const nav = environment.navigator || {};
    const ua = String(nav.userAgent || "");
    const uaMobile = nav.userAgentData && nav.userAgentData.mobile === true;
    const mobileUa = /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(ua);
    const touchIpad = /Macintosh/i.test(ua) && Number(nav.maxTouchPoints || 0) > 1;
    const coarse = Boolean(environment.matchMedia && environment.matchMedia("(pointer: coarse)").matches);
    const touch = Number(nav.maxTouchPoints || 0) > 0;
    const screenWidth = Number(environment.screen && environment.screen.width) || Number(environment.innerWidth) || 9999;
    return Boolean(uaMobile || mobileUa || touchIpad || (coarse && touch && screenWidth <= 1024));
  }

  function sensorSupported(environment) {
    return environment.isSecureContext !== false &&
      typeof environment.DeviceOrientationEvent !== "undefined";
  }

  function permissionRequired(environment) {
    return sensorSupported(environment) &&
      typeof environment.DeviceOrientationEvent.requestPermission === "function";
  }

  function hasMotionData(event) {
    return Number.isFinite(event && event.beta) && Number.isFinite(event && event.gamma);
  }

  function shortestDelta(value, origin) {
    let delta = value - origin;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function screenAngle(environment) {
    if (Number.isFinite(environment.ksHarnessScreenAngle)) return environment.ksHarnessScreenAngle;
    const modern = environment.screen && environment.screen.orientation;
    if (modern && Number.isFinite(modern.angle)) return modern.angle;
    return Number.isFinite(environment.orientation) ? environment.orientation : 0;
  }

  function screenAligned(event, angle) {
    const radians = (Number(angle) || 0) * Math.PI / 180;
    return {
      x: event.gamma * Math.cos(radians) + event.beta * Math.sin(radians),
      y: event.beta * Math.cos(radians) - event.gamma * Math.sin(radians),
    };
  }

  function mapMean(mean, minimum, maximum, minimumSpan) {
    if (maximum - minimum < minimumSpan) return 0;
    return clamp(((mean - minimum) / (maximum - minimum)) * 2 - 1, -1, 1);
  }

  function mapPointToWindow(point, windowState, minimumSpanDegrees) {
    const minimumSpan = Number(minimumSpanDegrees) || 1.5;
    return {
      x: mapMean(point.x, windowState.minX, windowState.maxX, minimumSpan),
      y: mapMean(point.y, windowState.minY, windowState.maxY, minimumSpan),
    };
  }

  function createRollingMapper(windowMilliseconds, minimumSpanDegrees) {
    const duration = Number(windowMilliseconds) || 10000;
    const minimumSpan = Number(minimumSpanDegrees) || 1.5;
    let samples = [];

    function calculate(currentX, currentY) {
      let weightedCount = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      samples.forEach(sample => {
        const count = sample.count || 1;
        weightedCount += count;
        sumX += sample.sumX;
        sumY += sample.sumY;
        minX = Math.min(minX, sample.minX);
        maxX = Math.max(maxX, sample.maxX);
        minY = Math.min(minY, sample.minY);
        maxY = Math.max(maxY, sample.maxY);
      });

      const meanX = sumX / weightedCount;
      const meanY = sumY / weightedCount;
      return {
        x: mapMean(currentX, minX, maxX, minimumSpan),
        y: mapMean(currentY, minY, maxY, minimumSpan),
        currentX,
        currentY,
        meanX,
        meanY,
        minX,
        maxX,
        minY,
        maxY,
        sampleCount: weightedCount,
        batchCount: samples.length,
        windowMilliseconds: duration,
      };
    }

    function append(sample, timestamp) {
      const time = Number(timestamp);
      samples.push({ time, ...sample });
      const cutoff = time - duration;
      while (samples.length && samples[0].time < cutoff) samples.shift();
      return calculate(sample.sumX / sample.count, sample.sumY / sample.count);
    }

    return {
      push(point, timestamp) {
        return append({
          count: 1,
          sumX: point.x,
          sumY: point.y,
          minX: point.x,
          maxX: point.x,
          minY: point.y,
          maxY: point.y,
        }, timestamp);
      },
      pushBatch(batch, timestamp) {
        const count = Math.max(1, Number(batch.count) || 1);
        return append({
          count,
          sumX: Number(batch.sumX),
          sumY: Number(batch.sumY),
          minX: Number(batch.minX),
          maxX: Number(batch.maxX),
          minY: Number(batch.minY),
          maxY: Number(batch.maxY),
        }, timestamp);
      },
      reset() {
        samples = [];
      },
      size() {
        return samples.length;
      },
    };
  }

  function normalise(event, neutral, angle, maximumDegrees) {
    const limit = Number(maximumDegrees) || 20;
    const betaDelta = shortestDelta(event.beta, neutral.beta);
    const gammaDelta = shortestDelta(event.gamma, neutral.gamma);
    const radians = (Number(angle) || 0) * Math.PI / 180;
    const rotatedX = gammaDelta * Math.cos(radians) + betaDelta * Math.sin(radians);
    const rotatedY = betaDelta * Math.cos(radians) - gammaDelta * Math.sin(radians);
    return {
      x: clamp(rotatedX / limit, -1, 1),
      y: clamp(rotatedY / limit, -1, 1),
    };
  }

  function smooth(previous, next, amount) {
    const alpha = clamp(Number(amount) || 0.18, 0.01, 1);
    return {
      x: previous.x + (next.x - previous.x) * alpha,
      y: previous.y + (next.y - previous.y) * alpha,
    };
  }

  function smoothTimeBased(previous, next, elapsedMilliseconds, timeConstantMilliseconds) {
    const elapsed = Math.max(0, Number(elapsedMilliseconds) || 0);
    const timeConstant = Math.max(1, Number(timeConstantMilliseconds) || 32);
    const alpha = elapsed === 0 ? 0 : 1 - Math.exp(-elapsed / timeConstant);
    return {
      x: previous.x + (next.x - previous.x) * alpha,
      y: previous.y + (next.y - previous.y) * alpha,
    };
  }

  function createLatestSampleRafScheduler(options) {
    if (!options || typeof options.requestFrame !== "function" || typeof options.commit !== "function") {
      throw new TypeError("A frame requester and commit callback are required");
    }
    const requestFrame = options.requestFrame;
    const cancelFrame = typeof options.cancelFrame === "function" ? options.cancelFrame : function () {};
    const now = typeof options.now === "function" ? options.now : () => 0;
    const mapper = options.mapper || createRollingMapper(2000, 1.5);
    const smoothingTimeConstantMilliseconds = Number(options.smoothingTimeConstantMilliseconds) || 32;
    let frame = 0;
    let latestSample = null;
    let previous = { x: 0, y: 0 };
    let lastCommitTime = null;
    let running = true;
    let commits = 0;

    function flush(frameTimestamp) {
      frame = 0;
      if (!running || !latestSample) return;
      const sample = latestSample;
      latestSample = null;
      const commitTime = Number.isFinite(frameTimestamp) ? frameTimestamp : now();
      const mapped = mapper.push(sample.point, sample.timestamp);
      const elapsed = lastCommitTime === null
        ? smoothingTimeConstantMilliseconds * 8
        : Math.max(0, commitTime - lastCommitTime);
      previous = smoothTimeBased(previous, mapped, elapsed, smoothingTimeConstantMilliseconds);
      lastCommitTime = commitTime;
      commits += 1;
      options.commit(previous.x, previous.y, {
        sample: { ...sample.point },
        sampleTimestamp: sample.timestamp,
        frameTimestamp: commitTime,
        sampleAge: Math.max(0, commitTime - sample.timestamp),
        commitCount: commits,
      });
      if (running && latestSample && !frame) frame = requestFrame(flush);
    }

    function receive(event, angle, timestamp) {
      if (!running || !hasMotionData(event)) {
        if (running && typeof options.reject === "function") options.reject(event);
        return false;
      }
      latestSample = {
        point: screenAligned(event, angle),
        timestamp: Number.isFinite(timestamp) ? timestamp : now(),
      };
      if (!frame) frame = requestFrame(flush);
      return true;
    }

    function reset() {
      if (frame) cancelFrame(frame);
      frame = 0;
      latestSample = null;
      previous = { x: 0, y: 0 };
      lastCommitTime = null;
      commits = 0;
      mapper.reset();
    }

    function teardown() {
      reset();
      running = false;
    }

    return {
      receive,
      reset,
      teardown,
      pending: () => Boolean(frame),
      commitCount: () => commits,
    };
  }

  return {
    clamp,
    createLatestSampleRafScheduler,
    createRollingMapper,
    hasMotionData,
    isMobileDevice,
    mapPointToWindow,
    normalise,
    permissionRequired,
    screenAligned,
    screenAngle,
    sensorSupported,
    smooth,
    smoothTimeBased,
  };
});
