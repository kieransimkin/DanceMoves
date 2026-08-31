(function () {
  "use strict";

  const Core = window.KSEpkOrientationCore;
  const config = window.ksEpkOrientationConfig || {};
  const harnessMode = config.harness === true && /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname || "");
  if (!Core || (!harnessMode && (!Core.isMobileDevice(window) || !Core.sensorSupported(window)))) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return;

  const perceptualAxis = value => {
    const bounded = Core.clamp(value, -1, 1);
    return Math.sign(bounded) * Math.sqrt(Math.abs(bounded));
  };

  function lightWillWin() {
    const root = document.getElementById("light-will-win-top");
    if (!root) return null;
    const cards = [...root.querySelectorAll(".lww-player-card,.lww-story-quote,.lww-glass,.lww-contact-card,.lww-fact")];
    const reset = () => cards.forEach(card => {
      card.style.removeProperty("--lww-tilt-x");
      card.style.removeProperty("--lww-tilt-y");
    });
    const resetAll = () => {
      reset();
      root.style.removeProperty("--lww-cover-x");
      root.style.removeProperty("--lww-cover-y");
    };
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        root.style.setProperty("--lww-cover-x", `${(displayX * 14).toFixed(2)}px`);
        root.style.setProperty("--lww-cover-y", `${(displayY * 12).toFixed(2)}px`);
        cards.forEach(card => {
          card.style.setProperty("--lww-tilt-x", `${(-displayY * 4).toFixed(2)}deg`);
          card.style.setProperty("--lww-tilt-y", `${(displayX * 5).toFixed(2)}deg`);
        });
      },
      reset: resetAll,
    };
  }

  function walkWithMe() {
    const root = document.querySelector('.ks-epk[data-release="walk-with-me"]');
    if (!root) return null;
    const cover = root.querySelector(".wwm-cover-stage,.epk-cover-wrap");
    if (!cover) return null;
    const reset = () => [
      "--wwm-tilt-x", "--wwm-tilt-y", "--wwm-shift-x", "--wwm-shift-y",
      "--wwm-glow-x", "--wwm-glow-y",
    ].forEach(name => cover.style.removeProperty(name));
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        cover.style.setProperty("--wwm-tilt-x", `${(-displayY * 6).toFixed(2)}deg`);
        cover.style.setProperty("--wwm-tilt-y", `${(displayX * 7).toFixed(2)}deg`);
        cover.style.setProperty("--wwm-shift-x", `${(displayX * 16).toFixed(1)}px`);
        cover.style.setProperty("--wwm-shift-y", `${(displayY * 14).toFixed(1)}px`);
        cover.style.setProperty("--wwm-glow-x", `${(50 + displayX * 46).toFixed(1)}%`);
        cover.style.setProperty("--wwm-glow-y", `${(50 + displayY * 46).toFixed(1)}%`);
      },
      reset,
    };
  }

  function dyingForADiagnosis() {
    const root = document.querySelector(".dfad-motion-stage");
    if (!root) return null;
    const cover = root.querySelector("[data-tilt]");
    const art = root.querySelector("[data-parallax] img");
    const reset = () => {
      cover?.style.removeProperty("--cover-x");
      cover?.style.removeProperty("--cover-y");
      cover?.style.removeProperty("--cover-rotate");
      art?.style.removeProperty("transform");
    };
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        cover?.style.setProperty("--cover-x", `${(displayX * 10).toFixed(2)}px`);
        cover?.style.setProperty("--cover-y", `${(displayY * 10).toFixed(2)}px`);
        cover?.style.setProperty("--cover-rotate", `${(displayX * 1.2).toFixed(2)}deg`);
        if (art) {
          const scale = window.matchMedia("(max-width: 900px)").matches ? 1.035 : 1.045;
          art.style.transform = `translate3d(${(displayX * 10).toFixed(2)}px,calc(var(--art-y) + ${(displayY * 8).toFixed(2)}px),0) scale(${scale})`;
        }
      },
      reset,
    };
  }

  function fullyNocturnal() {
    const root = document.querySelector('.ks-epk.fn-live[data-release="fully-nocturnal"]');
    if (!root) return null;
    const cover = root.querySelector(".epk-cover-wrap");
    const reset = () => {
      root.style.removeProperty("--fnx-shift-x");
      root.style.removeProperty("--fnx-shift-y");
      cover?.style.removeProperty("--fnx-card-x");
      cover?.style.removeProperty("--fnx-card-y");
      cover?.style.removeProperty("--fnx-card-shift-x");
      cover?.style.removeProperty("--fnx-card-shift-y");
    };
    return {
      root,
      apply(x, y) {
        if (root.dataset.fnxMotion === "off") {
          reset();
          return;
        }
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        root.style.setProperty("--fnx-shift-x", `${(displayX * 18).toFixed(2)}px`);
        root.style.setProperty("--fnx-shift-y", `${(displayY * 14).toFixed(2)}px`);
        cover?.style.setProperty("--fnx-card-x", `${(-displayY * 6).toFixed(2)}deg`);
        cover?.style.setProperty("--fnx-card-y", `${(displayX * 6).toFixed(2)}deg`);
        cover?.style.setProperty("--fnx-card-shift-x", `${(displayX * 8).toFixed(2)}px`);
        cover?.style.setProperty("--fnx-card-shift-y", `${(displayY * 7).toFixed(2)}px`);
      },
      reset,
    };
  }

  function presentsAndChocolate() {
    const root = document.querySelector('.ks-epk[data-release="presents-and-chocolate"]');
    if (!root) return null;
    const reset = () => [
      "--pc-sensor-x", "--pc-sensor-y", "--pc-sensor-rotate",
    ].forEach(name => root.style.removeProperty(name));
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        root.style.setProperty("--pc-sensor-x", `${(displayX * 12).toFixed(2)}px`);
        root.style.setProperty("--pc-sensor-y", `${(displayY * 10).toFixed(2)}px`);
        root.style.setProperty("--pc-sensor-rotate", `${(displayX * 1.1).toFixed(2)}deg`);
      },
      reset,
    };
  }

  function amnestyHonestly() {
    const root = document.querySelector(".ks-epk");
    if (!root) return null;
    const reset = () => [
      "--epk-tilt-x", "--epk-tilt-y", "--epk-shift-x", "--epk-shift-y",
      "--epk-heading-x", "--epk-heading-y",
    ].forEach(name => root.style.removeProperty(name));
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        root.style.setProperty("--epk-tilt-x", `${(-displayY * 4.5).toFixed(2)}deg`);
        root.style.setProperty("--epk-tilt-y", `${(displayX * 5.5).toFixed(2)}deg`);
        root.style.setProperty("--epk-shift-x", `${(displayX * 10).toFixed(2)}px`);
        root.style.setProperty("--epk-shift-y", `${(displayY * 8).toFixed(2)}px`);
        root.style.setProperty("--epk-heading-x", `${(-displayX * 4).toFixed(2)}px`);
        root.style.setProperty("--epk-heading-y", `${(-displayY * 3).toFixed(2)}px`);
      },
      reset,
    };
  }

  function dmitriMyTalisman() {
    const root = document.querySelector(".dmt-epk");
    if (!root) return null;
    const reset = () => [
      "--mx", "--my", "--parallax-x", "--parallax-y", "--tilt-x", "--tilt-y",
    ].forEach(name => root.style.removeProperty(name));
    return {
      root,
      apply(x, y) {
        if (root.classList.contains("reduce-motion")) {
          reset();
          return;
        }
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        root.style.setProperty("--mx", `${(50 + displayX * 30).toFixed(1)}%`);
        root.style.setProperty("--my", `${(35 + displayY * 24).toFixed(1)}%`);
        root.style.setProperty("--parallax-x", `${(-displayX * 14).toFixed(2)}px`);
        root.style.setProperty("--parallax-y", `${(-displayY * 10).toFixed(2)}px`);
        root.style.setProperty("--tilt-y", `${(displayX * 5).toFixed(2)}deg`);
        root.style.setProperty("--tilt-x", `${(-displayY * 4).toFixed(2)}deg`);
      },
      reset,
    };
  }

  const factories = {
    "light-will-win": lightWillWin,
    "dying-for-a-diagnosis": dyingForADiagnosis,
    "presents-and-chocolate": presentsAndChocolate,
    "fully-nocturnal": fullyNocturnal,
    "amnesty-honestly": amnestyHonestly,
    "walk-with-me": walkWithMe,
    "dmitri-my-talisman": dmitriMyTalisman,
  };

  function detectFactory() {
    if (factories[config.adapter]) return factories[config.adapter];
    if (document.getElementById("light-will-win-top")) return lightWillWin;
    if (document.querySelector(".dfad-motion-stage")) return dyingForADiagnosis;
    if (document.querySelector('.ks-epk[data-release="presents-and-chocolate"]')) return presentsAndChocolate;
    if (document.querySelector('.ks-epk.fn-live[data-release="fully-nocturnal"]')) return fullyNocturnal;
    if (document.querySelector('.ks-epk[data-release="walk-with-me"]')) return walkWithMe;
    if (document.querySelector(".dmt-epk")) return dmitriMyTalisman;
    return null;
  }

  function initialise() {
    const factory = detectFactory();
    const adapter = factory && factory();
    if (!adapter) return;

    const windowMilliseconds = 2000;
    const batchMilliseconds = 30;
    const rollingMapper = Core.createRollingMapper(windowMilliseconds, 1.5);
    let latest = { x: 0, y: 0 };
    let pendingBatch = null;
    let sampleTimer = 0;
    let lastFlushTime = -Infinity;
    let active = false;
    let listening = false;
    let availabilityTimer = 0;
    let control = null;

    adapter.root.dataset.ksOrientation = "supported";
    adapter.root.dataset.ksOrientationAdapter = config.adapter || "detected";
    adapter.root.dataset.ksOrientationWindow = String(windowMilliseconds);
    adapter.root.dataset.ksOrientationBatch = String(batchMilliseconds);

    const reset = () => {
      window.clearTimeout(sampleTimer);
      sampleTimer = 0;
      pendingBatch = null;
      lastFlushTime = -Infinity;
      rollingMapper.reset();
      latest = { x: 0, y: 0 };
      active = false;
      adapter.root.dataset.ksOrientation = "supported";
      adapter.reset();
    };

    const flushBatch = () => {
      sampleTimer = 0;
      if (!pendingBatch) return;
      const now = window.performance.now();
      latest = rollingMapper.pushBatch(pendingBatch, now);
      pendingBatch = null;
      lastFlushTime = now;
      adapter.apply(latest.x, latest.y);
    };

    const onOrientation = event => {
      if (reducedMotion.matches || !Core.hasMotionData(event)) return;
      const aligned = Core.screenAligned(event, Core.screenAngle(window));
      const now = window.performance.now();
      if (!pendingBatch) {
        pendingBatch = {
          count: 0,
          sumX: 0,
          sumY: 0,
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        };
      }
      pendingBatch.count += 1;
      pendingBatch.sumX += aligned.x;
      pendingBatch.sumY += aligned.y;
      pendingBatch.minX = Math.min(pendingBatch.minX, aligned.x);
      pendingBatch.maxX = Math.max(pendingBatch.maxX, aligned.x);
      pendingBatch.minY = Math.min(pendingBatch.minY, aligned.y);
      pendingBatch.maxY = Math.max(pendingBatch.maxY, aligned.y);
      if (!active) {
        active = true;
        adapter.root.dataset.ksOrientation = "active";
        window.clearTimeout(availabilityTimer);
        if (control) control.remove();
        control = null;
      }
      if (!sampleTimer) {
        const remaining = Math.max(0, batchMilliseconds - (now - lastFlushTime));
        if (remaining === 0) flushBatch();
        else sampleTimer = window.setTimeout(flushBatch, remaining);
      }
    };

    const startListening = () => {
      if (listening || reducedMotion.matches) return;
      listening = true;
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
      availabilityTimer = window.setTimeout(() => {
        if (!active && control) {
          control.textContent = "Phone motion unavailable";
          control.disabled = true;
        }
      }, 3500);
    };

    const stopListening = () => {
      if (listening) window.removeEventListener("deviceorientation", onOrientation);
      listening = false;
      window.clearTimeout(availabilityTimer);
      reset();
    };

    const makePermissionControl = () => {
      control = document.createElement("button");
      control.type = "button";
      control.className = "ks-epk-orientation-control";
      control.textContent = "Use phone motion";
      control.setAttribute("aria-live", "polite");
      control.addEventListener("click", async () => {
        control.disabled = true;
        control.textContent = "Checking motion…";
        try {
          const result = await window.DeviceOrientationEvent.requestPermission();
          if (result !== "granted") {
            control.textContent = "Phone motion blocked";
            return;
          }
          control.textContent = "Move phone to enable…";
          startListening();
        } catch (error) {
          control.textContent = "Phone motion unavailable";
        }
      }, { once: true });
      document.body.append(control);
    };

    const recalibrate = () => {
      rollingMapper.reset();
      latest = { x: 0, y: 0 };
      adapter.reset();
    };

    window.addEventListener("orientationchange", recalibrate, { passive: true });
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === "function") {
      window.screen.orientation.addEventListener("change", recalibrate);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) recalibrate();
    });

    const preferenceChanged = () => {
      if (reducedMotion.matches) {
        stopListening();
        if (control) control.remove();
        control = null;
      } else if (Core.permissionRequired(window)) {
        makePermissionControl();
      } else {
        startListening();
      }
    };
    if (typeof reducedMotion.addEventListener === "function") reducedMotion.addEventListener("change", preferenceChanged);
    else reducedMotion.addListener(preferenceChanged);

    if (Core.permissionRequired(window)) makePermissionControl();
    else startListening();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
