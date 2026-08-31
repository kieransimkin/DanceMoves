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

  return {
    clamp,
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
  };
});
