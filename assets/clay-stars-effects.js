/* ks-clay-stars-warm-light-v1-motion */
(function () {
  "use strict";
  var root = document.querySelector(".ks-epk.ks-clay-stars-v2");
  if (!root) return;
  var motion = window.DanceMoves || null;
  var cover = root.querySelector(".epk-cover-wrap");
  if (!cover) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var frame = 0;
  var pendingX = 0;
  var pendingY = 0;
  var clamp = function (value) { return Math.max(-1, Math.min(1, value)); };
  var apply = function (nx, ny) {
    cover.style.setProperty("--ks-rx", (-ny * 1.15).toFixed(2) + "deg");
    cover.style.setProperty("--ks-ry", (nx * 1.15).toFixed(2) + "deg");
    cover.style.setProperty("--ks-tx", (nx * 4).toFixed(2) + "px");
    cover.style.setProperty("--ks-ty", (ny * 4).toFixed(2) + "px");
    cover.style.setProperty("--ks-bloom-x", (nx * 8).toFixed(2) + "px");
    cover.style.setProperty("--ks-bloom-y", (ny * 7).toFixed(2) + "px");
    cover.style.setProperty("--ks-flare-x", (nx * 18).toFixed(2) + "px");
    cover.style.setProperty("--ks-flare-y", (ny * 14).toFixed(2) + "px");
    cover.style.setProperty("--ks-spec-x", (-nx * 24).toFixed(2) + "px");
    cover.style.setProperty("--ks-spec-y", (-ny * 18).toFixed(2) + "px");
  };
  var flush = function () { frame = 0; apply(pendingX, pendingY); };
  var reset = function () {
    pendingX = 0;
    pendingY = 0;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    apply(0, 0);
  };
  var move = function (event) {
    if (reduce.matches || !finePointer.matches) return reset();
    var rect = cover.getBoundingClientRect();
    if (!rect.width || !rect.height) return reset();
    pendingX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pendingY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1);
    if (!frame) frame = window.requestAnimationFrame(flush);
  };
  cover.addEventListener("pointermove", move, { passive: true });
  cover.addEventListener("pointerleave", reset, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) reset(); }, { passive: true });
  window.addEventListener("orientationchange", reset, { passive: true });
  reduce.addEventListener && reduce.addEventListener("change", reset);
  finePointer.addEventListener && finePointer.addEventListener("change", reset);
  reset();

  var particleControls = Array.prototype.slice.call(root.querySelectorAll(".epk-button, .epk-download, .ks-clay-stars-chapters button"));
  var releaseTimers = new WeakMap();
  var releaseFrames = new WeakMap();
  var releaseSnapshots = new WeakMap();
  var stopParticleSampling = function (control) {
    var frameId = releaseFrames.get(control);
    if (frameId) window.cancelAnimationFrame(frameId);
    releaseFrames.delete(control);
  };
  var sampleParticleOrbit = function (control) {
    var orbit = window.getComputedStyle(control, "::after");
    var opacity = Number(orbit.opacity);
    if (Number.isFinite(opacity) && opacity >= .02) {
      releaseSnapshots.set(control, {
        opacity: opacity,
        transform: orbit.transform === "none" ? "rotate(0deg) scale(.96)" : orbit.transform,
        filter: orbit.filter === "none" ? "drop-shadow(0 0 4px rgba(212,175,55,.44))" : orbit.filter
      });
    }
  };
  var startParticleSampling = function (control) {
    stopParticleSampling(control);
    var tick = function () {
      sampleParticleOrbit(control);
      if (control.matches(":hover") || document.activeElement === control) {
        releaseFrames.set(control, window.requestAnimationFrame(tick));
      } else {
        releaseFrames.delete(control);
      }
    };
    releaseFrames.set(control, window.requestAnimationFrame(tick));
  };
  var clearParticleRelease = function (control) {
    var timer = releaseTimers.get(control);
    if (timer) window.clearTimeout(timer);
    releaseTimers.delete(control);
    control.classList.remove("ks-particle-release");
    control.style.removeProperty("--ks-orbit-release-opacity");
    control.style.removeProperty("--ks-orbit-release-transform");
    control.style.removeProperty("--ks-orbit-release-filter");
  };
  var beginParticleRelease = function (control) {
    stopParticleSampling(control);
    var snapshot = releaseSnapshots.get(control);
    clearParticleRelease(control);
    if (reduce.matches) return;
    if (!snapshot) return;
    control.style.setProperty("--ks-orbit-release-opacity", String(snapshot.opacity));
    control.style.setProperty("--ks-orbit-release-transform", snapshot.transform);
    control.style.setProperty("--ks-orbit-release-filter", snapshot.filter);
    control.classList.add("ks-particle-release");
    releaseSnapshots.delete(control);
    var releaseDuration = motion ? motion.durationMilliseconds(32) : 1034.482759;
    releaseTimers.set(control, window.setTimeout(function () { clearParticleRelease(control); }, releaseDuration));
  };
  particleControls.forEach(function (control) {
    control.addEventListener("pointerenter", function () { clearParticleRelease(control); releaseSnapshots.delete(control); startParticleSampling(control); }, { passive: true });
    control.addEventListener("pointerleave", function () { beginParticleRelease(control); }, { passive: true });
    control.addEventListener("focus", function () { clearParticleRelease(control); releaseSnapshots.delete(control); startParticleSampling(control); }, { passive: true });
    control.addEventListener("blur", function () { if (!control.matches(":hover")) beginParticleRelease(control); }, { passive: true });
  });
  var resetParticleReleases = function () { particleControls.forEach(function (control) { stopParticleSampling(control); releaseSnapshots.delete(control); clearParticleRelease(control); }); };
  document.addEventListener("visibilitychange", function () { if (document.hidden) resetParticleReleases(); }, { passive: true });
  reduce.addEventListener && reduce.addEventListener("change", resetParticleReleases);

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
    motion.onCue("*", function (detail) {
      root.dataset.danceMovesCue = detail.normalisedName.toLowerCase().replace(/\s+/g, "-");
      root.dataset.danceMovesCueType = detail.normalisedType.toLowerCase().replace(/\s+/g, "-");
    });
  }
}());
