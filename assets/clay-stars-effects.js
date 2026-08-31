/* ks-clay-stars-warm-light-v2-motion */
(function () {
  "use strict";

  var root = document.querySelector(".ks-epk.ks-clay-stars-v2");
  if (!root) return;
  if (window.DanceMovesClayStars && window.DanceMovesClayStars.root === root && typeof window.DanceMovesClayStars.snapshot === "function" && !window.DanceMovesClayStars.snapshot().destroyed) return;

  var motion = window.DanceMoves || null;
  var cover = root.querySelector(".epk-cover-wrap");
  if (!cover) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var defaults = Object.freeze({
    enabled: true,
    masterIntensity: 1,
    coverTiltDegrees: 1.15,
    coverTranslationPixels: 4,
    bloomTravelPixels: 8,
    flareTravelPixels: 18,
    specularTravelPixels: 24,
    particleReleaseTicks: 32
  });
  var settings = Object.assign({}, defaults);
  var frame = 0;
  var pendingX = 0;
  var pendingY = 0;
  var lastX = 0;
  var lastY = 0;
  var pointerBounds = null;
  var destroyed = false;
  var disposers = [];
  var cueUnsubscribe = null;
  var computedStyleReads = 0;
  var motionCommits = 0;
  var particleSamples = 0;

  var clamp = function (value, minimum, maximum, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
  };

  var listen = function (target, type, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, options);
    disposers.push(function () { target.removeEventListener(type, handler, options); });
  };

  var durationMilliseconds = function (ticks) {
    return motion && typeof motion.durationMilliseconds === "function"
      ? motion.durationMilliseconds(ticks)
      : ticks * (3750 / 116);
  };

  var apply = function (nx, ny) {
    var active = settings.enabled && !reduce.matches ? settings.masterIntensity : 0;
    lastX = clamp(nx, -1, 1, 0);
    lastY = clamp(ny, -1, 1, 0);
    var x = lastX * active;
    var y = lastY * active;
    cover.style.setProperty("--ks-rx", (-y * settings.coverTiltDegrees).toFixed(3) + "deg");
    cover.style.setProperty("--ks-ry", (x * settings.coverTiltDegrees).toFixed(3) + "deg");
    cover.style.setProperty("--ks-tx", (x * settings.coverTranslationPixels).toFixed(3) + "px");
    cover.style.setProperty("--ks-ty", (y * settings.coverTranslationPixels).toFixed(3) + "px");
    cover.style.setProperty("--ks-bloom-x", (x * settings.bloomTravelPixels).toFixed(3) + "px");
    cover.style.setProperty("--ks-bloom-y", (y * settings.bloomTravelPixels * .875).toFixed(3) + "px");
    cover.style.setProperty("--ks-flare-x", (x * settings.flareTravelPixels).toFixed(3) + "px");
    cover.style.setProperty("--ks-flare-y", (y * settings.flareTravelPixels * .777777778).toFixed(3) + "px");
    cover.style.setProperty("--ks-spec-x", (-x * settings.specularTravelPixels).toFixed(3) + "px");
    cover.style.setProperty("--ks-spec-y", (-y * settings.specularTravelPixels * .75).toFixed(3) + "px");
    motionCommits += 1;
  };

  var flush = function () {
    frame = 0;
    if (!destroyed) apply(pendingX, pendingY);
  };

  var setMotion = function (sample) {
    if (destroyed) return false;
    pendingX = clamp(sample && sample.x, -1, 1, 0);
    pendingY = clamp(sample && sample.y, -1, 1, 0);
    if (!frame) frame = window.requestAnimationFrame(flush);
    return true;
  };

  var cancelMotion = function () {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    pendingX = 0;
    pendingY = 0;
    apply(0, 0);
  };

  var setParameters = function (next) {
    next = next || {};
    settings.enabled = Object.prototype.hasOwnProperty.call(next, "enabled") ? Boolean(next.enabled) : settings.enabled;
    settings.masterIntensity = clamp(next.masterIntensity, 0, 1.5, settings.masterIntensity);
    settings.coverTiltDegrees = clamp(next.coverTiltDegrees, 0, 4, settings.coverTiltDegrees);
    settings.coverTranslationPixels = clamp(next.coverTranslationPixels, 0, 16, settings.coverTranslationPixels);
    settings.bloomTravelPixels = clamp(next.bloomTravelPixels, 0, 32, settings.bloomTravelPixels);
    settings.flareTravelPixels = clamp(next.flareTravelPixels, 0, 48, settings.flareTravelPixels);
    settings.specularTravelPixels = clamp(next.specularTravelPixels, 0, 64, settings.specularTravelPixels);
    settings.particleReleaseTicks = Math.round(clamp(next.particleReleaseTicks, 1, 128, settings.particleReleaseTicks));
    root.style.setProperty("--ks-master-intensity", settings.enabled ? String(settings.masterIntensity) : "0");
    root.style.setProperty("--ks-particle-release-duration", durationMilliseconds(settings.particleReleaseTicks).toFixed(6) + "ms");
    apply(lastX, lastY);
    return Object.assign({}, settings);
  };

  var move = function (event) {
    if (reduce.matches || !finePointer.matches || !settings.enabled || !pointerBounds) return cancelMotion();
    if (!pointerBounds.width || !pointerBounds.height) return cancelMotion();
    setMotion({
      x: ((event.clientX - pointerBounds.left) / pointerBounds.width) * 2 - 1,
      y: ((event.clientY - pointerBounds.top) / pointerBounds.height) * 2 - 1
    });
  };

  var refreshPointerBounds = function () {
    pointerBounds = cover.getBoundingClientRect();
  };

  var resetPointer = function () {
    pointerBounds = null;
    cancelMotion();
  };

  listen(cover, "pointerenter", refreshPointerBounds, { passive: true });
  listen(cover, "pointermove", move, { passive: true });
  listen(cover, "pointerleave", resetPointer, { passive: true });

  var controls = Array.prototype.slice.call(root.querySelectorAll(".epk-button, .epk-download, .ks-clay-stars-chapters button"));
  var controlStates = controls.map(function (control) {
    return { control: control, releaseTimer: 0, sampleFrame: 0, snapshot: null };
  });

  var stopParticleSample = function (state) {
    if (state.sampleFrame) window.cancelAnimationFrame(state.sampleFrame);
    state.sampleFrame = 0;
  };

  var sampleParticleOrbit = function (state) {
    if (!state.control.isConnected) return;
    computedStyleReads += 1;
    var orbit = window.getComputedStyle(state.control, "::after");
    var opacity = Number(orbit.opacity);
    if (!Number.isFinite(opacity) || opacity < .02) return;
    particleSamples += 1;
    state.snapshot = {
      opacity: opacity,
      transform: orbit.transform === "none" ? "rotate(0deg) scale(.96)" : orbit.transform
    };
  };

  var scheduleParticleSample = function (state) {
    stopParticleSample(state);
    state.sampleFrame = window.requestAnimationFrame(function () {
      state.sampleFrame = 0;
      if (destroyed || !state.control.isConnected) return;
      if (state.control.matches(":hover") || document.activeElement === state.control) sampleParticleOrbit(state);
    });
  };

  var clearParticleRelease = function (state) {
    if (state.releaseTimer) window.clearTimeout(state.releaseTimer);
    state.releaseTimer = 0;
    state.control.classList.remove("ks-particle-release");
    state.control.style.removeProperty("--ks-orbit-release-opacity");
    state.control.style.removeProperty("--ks-orbit-release-transform");
  };

  var prepareParticle = function (state) {
    clearParticleRelease(state);
    state.snapshot = null;
    scheduleParticleSample(state);
  };

  var beginParticleRelease = function (state) {
    stopParticleSample(state);
    var snapshot = state.snapshot;
    clearParticleRelease(state);
    if (reduce.matches || !settings.enabled || !state.control.isConnected || !snapshot) return;
    state.control.style.setProperty("--ks-orbit-release-opacity", String(snapshot.opacity));
    state.control.style.setProperty("--ks-orbit-release-transform", snapshot.transform);
    state.control.classList.add("ks-particle-release");
    state.snapshot = null;
    state.releaseTimer = window.setTimeout(function () { clearParticleRelease(state); }, durationMilliseconds(settings.particleReleaseTicks));
  };

  controlStates.forEach(function (state) {
    listen(state.control, "pointerenter", function () { prepareParticle(state); }, { passive: true });
    listen(state.control, "pointerleave", function () { beginParticleRelease(state); }, { passive: true });
    listen(state.control, "focus", function () { prepareParticle(state); }, { passive: true });
    listen(state.control, "blur", function () { if (!state.control.matches(":hover")) beginParticleRelease(state); }, { passive: true });
  });

  var resetParticles = function () {
    controlStates.forEach(function (state) {
      stopParticleSample(state);
      state.snapshot = null;
      clearParticleRelease(state);
    });
  };

  var setCueState = function (detail) {
    detail = detail || {};
    var name = String(detail.normalisedName || detail.name || "").trim();
    var type = String(detail.normalisedType || detail.type || "").trim();
    if (!name && !type) {
      delete root.dataset.danceMovesCue;
      delete root.dataset.danceMovesCueType;
      return;
    }
    root.dataset.danceMovesCue = name.toLowerCase().replace(/\s+/g, "-");
    root.dataset.danceMovesCueType = type.toLowerCase().replace(/\s+/g, "-");
  };

  var lifecycle = function (state) {
    if (state === "seeking" || state === "hidden" || state === "pagehide" || state === "reduced-motion") {
      setCueState(null);
      resetParticles();
      cancelMotion();
    } else if (state === "seeked") {
      setCueState({ name: "seeked", type: "state" });
    } else if (state === "visible" || state === "pageshow") {
      cancelMotion();
    }
    root.dataset.danceMovesClayLifecycle = state;
  };

  listen(document, "visibilitychange", function () { lifecycle(document.hidden ? "hidden" : "visible"); }, { passive: true });
  listen(window, "pagehide", function () { lifecycle("pagehide"); }, { passive: true });
  listen(window, "pageshow", function () { lifecycle("pageshow"); }, { passive: true });
  listen(window, "orientationchange", resetPointer, { passive: true });
  listen(window, "resize", function () { pointerBounds = null; }, { passive: true });
  listen(reduce, "change", function () { lifecycle(reduce.matches ? "reduced-motion" : "visible"); });
  listen(finePointer, "change", resetPointer);

  var audio = root.querySelector("audio");
  if (audio) {
    listen(audio, "seeking", function () { lifecycle("seeking"); });
    listen(audio, "seeked", function () { lifecycle("seeked"); });
  }

  if (motion) {
    motion.registerAnimationScope(root, [
      ".ks-cloud-field",
      ".epk-atmosphere",
      ".epk-signal-line",
      ".ks-warm-bloom",
      ".ks-lens-flare",
      ".ks-specular-sweep",
      ".epk-button",
      ".epk-download",
      ".ks-clay-stars-chapters button"
    ]);
    cueUnsubscribe = motion.onCue("*", setCueState, { id: "clay-stars:cue-state" });
  }

  var reset = function () {
    settings = Object.assign({}, defaults);
    setCueState(null);
    resetParticles();
    cancelMotion();
    setParameters(settings);
    root.dataset.danceMovesClayLifecycle = "reset";
  };

  var snapshot = function () {
    return {
      destroyed: destroyed,
      settings: Object.assign({}, settings),
      motion: { x: lastX, y: lastY, pendingFrame: Boolean(frame), commits: motionCommits },
      particles: {
        controls: controlStates.length,
        pendingFrames: controlStates.filter(function (state) { return Boolean(state.sampleFrame); }).length,
        pendingTimers: controlStates.filter(function (state) { return Boolean(state.releaseTimer); }).length,
        computedStyleReads: computedStyleReads,
        samples: particleSamples
      },
      cue: root.dataset.danceMovesCue || "",
      cueType: root.dataset.danceMovesCueType || "",
      lifecycle: root.dataset.danceMovesClayLifecycle || ""
    };
  };

  var teardown = function () {
    if (destroyed) return;
    destroyed = true;
    resetParticles();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    disposers.splice(0).forEach(function (dispose) { dispose(); });
    if (typeof cueUnsubscribe === "function") cueUnsubscribe();
    cueUnsubscribe = null;
    root.dataset.danceMovesClayRuntime = "stopped";
  };

  var api = Object.freeze({
    root: root,
    defaults: defaults,
    setParameters: setParameters,
    setMotion: setMotion,
    setCueState: setCueState,
    lifecycle: lifecycle,
    reset: reset,
    snapshot: snapshot,
    teardown: teardown
  });
  window.DanceMovesClayStars = api;
  root.dataset.danceMovesClayRuntime = "ready";
  reset();
}());
