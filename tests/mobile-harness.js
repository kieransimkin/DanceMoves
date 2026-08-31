(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const adapter = params.get("adapter") || "light-will-win";
  const permission = params.get("permission") || "automatic";
  const Core = window.KSEpkOrientationCore;
  const mapper = Core.createRollingMapper(2000, 1.5);
  let frame = 0;
  let sequenceStart = 0;
  let latestAlpha = 0;

  const $ = id => document.getElementById(id);
  const adapterSelect = $("adapter-select");
  const permissionSelect = $("permission-select");
  const rotationSelect = $("rotation-select");
  const sequenceSelect = $("sequence-select");
  const betaInput = $("beta-input");
  const gammaInput = $("gamma-input");
  const status = $("harness-status");
  const motionField = $("motion-ball-field");
  const motionBall = $("motion-ball");
  const playbackProgress = $("playback-progress");
  const playbackTime = $("playback-time");
  let dragging = false;

  const recordings = window.KSEpkMotionRecordings || {
    gentle: [
      [0, 0, 0], [1000, -5, 4], [2200, -11, 9], [3500, -7, 13],
      [4800, 2, 10], [6100, 9, 3], [7500, 12, -6], [8900, 5, -11],
      [10300, -4, -8], [12000, 0, 0],
    ],
    sweep: [
      [0, -24, 22], [2000, -16, 15], [4000, -8, 8], [6000, 0, 0],
      [8000, 8, -8], [10000, 16, -15], [12000, 24, -22],
    ],
    "figure-eight": [
      [0, 0, 0], [1000, 11, 11], [2000, 19, 0], [3000, 11, -11],
      [4000, 0, 0], [5000, -11, 11], [6000, -19, 0], [7000, -11, -11],
      [8000, 0, 0], [9000, 11, 11], [10000, 19, 0], [11000, 10, -10], [12000, 0, 0],
    ],
    "pocket-lift": [
      [0, 26, -5], [1200, 18, -2], [2500, 9, 1], [3900, 1, 3],
      [5400, -7, 5], [7000, -13, 2], [8600, -8, -3], [10300, -3, -1], [12000, 0, 0],
    ],
  };

  adapterSelect.value = adapter;
  permissionSelect.value = permission;
  window.ksHarnessScreenAngle = Number(rotationSelect.value);

  const movementTargets = {
    "light-will-win": { selector: ".lww-hero", property: "backgroundPosition" },
    "dying-for-a-diagnosis": "[data-tilt]",
    "presents-and-chocolate": ".epk-cover-wrap",
    "fully-nocturnal": ".epk-cover",
    "amnesty-honestly": ".epk-cover-wrap",
    "walk-with-me": ".wwm-cover-stage",
    "dmitri-my-talisman": ".cover-frame",
  };

  function navigateWithState() {
    const next = new URL(location.href);
    next.searchParams.set("adapter", adapterSelect.value);
    next.searchParams.set("permission", permissionSelect.value);
    location.href = next.href;
  }

  function setMetric(id, value) {
    $(id).textContent = value;
  }

  function updateReadout(result) {
    setMetric("metric-samples", String(result.sampleCount));
    setMetric("metric-mean-x", `${result.meanX.toFixed(2)}°`);
    setMetric("metric-range-x", `${result.minX.toFixed(2)}° / ${result.maxX.toFixed(2)}°`);
    setMetric("metric-map-x", result.x.toFixed(3));
    setMetric("metric-mean-y", `${result.meanY.toFixed(2)}°`);
    setMetric("metric-range-y", `${result.minY.toFixed(2)}° / ${result.maxY.toFixed(2)}°`);
    setMetric("metric-map-y", result.y.toFixed(3));
    const root = document.querySelector("[data-ks-orientation]");
    setMetric("metric-state", root?.dataset.ksOrientation || "waiting");
    requestAnimationFrame(() => {
      const targetConfig = typeof movementTargets[adapter] === "string"
        ? { selector: movementTargets[adapter], property: "transform" }
        : movementTargets[adapter];
      const target = document.querySelector(targetConfig?.selector || "");
      setMetric("metric-transform", target ? getComputedStyle(target)[targetConfig.property] : "target missing");
    });
  }

  function updateBall(beta, gamma, alpha = latestAlpha) {
    const radius = Math.max(0, (Math.min(motionField.clientWidth, motionField.clientHeight) - motionBall.offsetWidth) / 2 - 14);
    const x = Math.max(-1, Math.min(1, gamma / 45)) * radius;
    const y = Math.max(-1, Math.min(1, beta / 45)) * radius;
    motionBall.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,30px) rotateZ(${alpha.toFixed(1)}deg) rotateX(${(-beta).toFixed(1)}deg) rotateY(${gamma.toFixed(1)}deg)`;
    motionBall.setAttribute("aria-label", `Simulated device orientation: alpha ${alpha.toFixed(1)} degrees, beta ${beta.toFixed(1)} degrees, gamma ${gamma.toFixed(1)} degrees`);
  }

  function dispatchSample(beta, gamma, alpha = latestAlpha) {
    latestAlpha = Number.isFinite(alpha) ? alpha : 0;
    betaInput.value = beta.toFixed(1);
    gammaInput.value = gamma.toFixed(1);
    $("beta-value").textContent = `${beta.toFixed(1)}°`;
    $("gamma-value").textContent = `${gamma.toFixed(1)}°`;
    updateBall(beta, gamma, latestAlpha);
    const event = new window.DeviceOrientationEvent("deviceorientation", { alpha: latestAlpha, beta, gamma });
    window.dispatchEvent(event);
    const aligned = Core.screenAligned(event, window.ksHarnessScreenAngle);
    updateReadout(mapper.push(aligned, performance.now()));
  }

  function recordingValues(kind, elapsed) {
    const points = recordings[kind] || recordings.gentle;
    const clamped = Math.max(0, Math.min(points.at(-1)[0], elapsed));
    const nextIndex = Math.max(1, points.findIndex(point => point[0] >= clamped));
    const previous = points[nextIndex - 1];
    const next = points[nextIndex] || previous;
    const span = Math.max(1, next[0] - previous[0]);
    const mix = (clamped - previous[0]) / span;
    return {
      beta: previous[1] + (next[1] - previous[1]) * mix,
      gamma: previous[2] + (next[2] - previous[2]) * mix,
      alpha: (previous[3] || 0) + ((next[3] || 0) - (previous[3] || 0)) * mix,
      duration: points.at(-1)[0],
    };
  }

  function formatTime(milliseconds) {
    return `00:${String(Math.floor(milliseconds / 1000)).padStart(2, "0")}`;
  }

  function runSequence(now) {
    if (!sequenceStart) sequenceStart = now;
    const elapsed = now - sequenceStart;
    const values = recordingValues(sequenceSelect.value, elapsed);
    dispatchSample(values.beta, values.gamma, values.alpha);
    playbackProgress.max = values.duration;
    playbackProgress.value = Math.min(elapsed, values.duration);
    playbackTime.textContent = `${formatTime(Math.min(elapsed, values.duration))} / ${formatTime(values.duration)}`;
    if (elapsed < values.duration) frame = requestAnimationFrame(runSequence);
    else {
      frame = 0;
      sequenceStart = 0;
      status.textContent = "Recorded movement complete.";
    }
  }

  function stopSequence(message = "Paused.") {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    sequenceStart = 0;
    status.textContent = message;
  }

  function dispatchFromPointer(event) {
    const box = motionField.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - .5) * 2));
    dispatchSample(y * 45, x * 45);
  }

  adapterSelect.addEventListener("change", navigateWithState);
  permissionSelect.addEventListener("change", navigateWithState);
  rotationSelect.addEventListener("change", () => {
    window.ksHarnessScreenAngle = Number(rotationSelect.value);
    mapper.reset();
    latestAlpha = 0;
    window.dispatchEvent(new Event("orientationchange"));
    status.textContent = `Recalibrated for ${rotationSelect.options[rotationSelect.selectedIndex].text}.`;
  });
  betaInput.addEventListener("input", () => dispatchSample(Number(betaInput.value), Number(gammaInput.value)));
  gammaInput.addEventListener("input", () => dispatchSample(Number(betaInput.value), Number(gammaInput.value)));
  motionField.addEventListener("pointerdown", event => {
    dragging = true;
    latestAlpha = 0;
    stopSequence("Manual orientation control active.");
    motionField.setPointerCapture(event.pointerId);
    dispatchFromPointer(event);
  });
  motionField.addEventListener("pointermove", event => {
    if (dragging) dispatchFromPointer(event);
  });
  const endDrag = event => {
    dragging = false;
    if (motionField.hasPointerCapture(event.pointerId)) motionField.releasePointerCapture(event.pointerId);
  };
  motionField.addEventListener("pointerup", endDrag);
  motionField.addEventListener("pointercancel", endDrag);
  motionBall.addEventListener("keydown", event => {
    if (!/^Arrow/.test(event.key)) return;
    event.preventDefault();
    latestAlpha = 0;
    stopSequence("Keyboard orientation control active.");
    const step = event.shiftKey ? 5 : 1;
    const beta = Number(betaInput.value) + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0);
    const gamma = Number(gammaInput.value) + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
    dispatchSample(Math.max(-45, Math.min(45, beta)), Math.max(-45, Math.min(45, gamma)));
  });
  $("start-button").addEventListener("click", () => {
    stopSequence("Playing recorded movement…");
    playbackProgress.value = 0;
    frame = requestAnimationFrame(runSequence);
  });
  $("stop-button").addEventListener("click", () => stopSequence());
  $("reset-button").addEventListener("click", () => {
    stopSequence("Rolling window reset.");
    mapper.reset();
    window.dispatchEvent(new Event("orientationchange"));
    playbackProgress.value = 0;
    playbackTime.textContent = "00:00 / 00:12";
    dispatchSample(Number(betaInput.value), Number(gammaInput.value));
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => dispatchSample(0, 0), { once: true });
  } else {
    dispatchSample(0, 0);
  }
})();
