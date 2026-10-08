(function () {
  "use strict";

  const Core = window.KSEpkOrientationCore;
  const config = window.ksEpkOrientationConfig || {};
  const harnessMode = config.harness === true && /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname || "");
  if (!Core || (!harnessMode && (!Core.isMobileDevice(window) || !Core.sensorSupported(window)))) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

  function clayStars() {
    const root = document.querySelector(".ks-epk.ks-clay-stars-v2");
    const api = window.DanceMovesClayStars;
    if (!root || !api || api.root !== root || typeof api.setMotion !== "function") return null;
    if (typeof api.lifecycle === "function") api.lifecycle(document.hidden ? "hidden" : "visible");
    return {
      root,
      apply(x, y) {
        const setter = typeof api.setMotionTarget === "function" ? api.setMotionTarget : api.setMotion;
        setter({ x: perceptualAxis(x), y: perceptualAxis(y) });
      },
      reset() {
        if (typeof api.lifecycle === "function") api.lifecycle(document.hidden ? "hidden" : "visible");
        else api.setMotion({ x: 0, y: 0 });
      },
    };
  }

  function californiaScreamin() {
    const root = document.querySelector('#cs-epk.cs-epk[data-release="california-screamin"],#cs-epk.cs-epk');
    if (!root) return null;
    const reset = () => {
      root.style.setProperty("--cs-x", "0");
      root.style.setProperty("--cs-y", "0");
    };
    return {
      root,
      apply(x, y) {
        if (root.classList.contains("motion-paused")) {
          reset();
          return;
        }
        root.style.setProperty("--cs-x", perceptualAxis(x).toFixed(3));
        root.style.setProperty("--cs-y", perceptualAxis(y).toFixed(3));
      },
      reset,
    };
  }

  function aWholeNewChristmas() {
    const root = document.querySelector('.ks-epk[data-release="a-whole-new-christmas"]');
    if (!root) return null;
    const cover = root.querySelector(".epk-cover-wrap");
    if (!cover) return null;
    const reset = () => [
      "--awnc-tilt-x", "--awnc-tilt-y", "--awnc-shift-x", "--awnc-shift-y",
      "--awnc-light-x", "--awnc-light-y",
    ].forEach(name => cover.style.removeProperty(name));
    return {
      root,
      apply(x, y) {
        const displayX = perceptualAxis(x);
        const displayY = perceptualAxis(y);
        cover.style.setProperty("--awnc-tilt-x", `${(-displayY * 3.2).toFixed(2)}deg`);
        cover.style.setProperty("--awnc-tilt-y", `${(displayX * 4).toFixed(2)}deg`);
        cover.style.setProperty("--awnc-shift-x", `${(displayX * 7).toFixed(2)}px`);
        cover.style.setProperty("--awnc-shift-y", `${(displayY * 6).toFixed(2)}px`);
        cover.style.setProperty("--awnc-light-x", `${(50 + displayX * 34).toFixed(1)}%`);
        cover.style.setProperty("--awnc-light-y", `${(42 + displayY * 30).toFixed(1)}%`);
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
    "clay-stars": clayStars,
    "california-screamin": californiaScreamin,
    "a-whole-new-christmas": aWholeNewChristmas,
  };

  function detectFactory() {
    if (factories[config.adapter]) return factories[config.adapter];
    if (document.getElementById("light-will-win-top")) return lightWillWin;
    if (document.querySelector(".dfad-motion-stage")) return dyingForADiagnosis;
    if (document.querySelector('.ks-epk[data-release="presents-and-chocolate"]')) return presentsAndChocolate;
    if (document.querySelector('.ks-epk.fn-live[data-release="fully-nocturnal"]')) return fullyNocturnal;
    if (document.querySelector('.ks-epk[data-release="walk-with-me"]')) return walkWithMe;
    if (document.querySelector(".dmt-epk")) return dmitriMyTalisman;
    if (document.querySelector(".ks-epk.ks-clay-stars-v2")) return clayStars;
    if (document.querySelector('#cs-epk.cs-epk[data-release="california-screamin"],#cs-epk.cs-epk')) return californiaScreamin;
    if (document.querySelector('.ks-epk[data-release="a-whole-new-christmas"]')) return aWholeNewChristmas;
    return null;
  }

  function initialise() {
    if (window.__ksEpkOrientationRuntime && typeof window.__ksEpkOrientationRuntime.teardown === "function") {
      window.__ksEpkOrientationRuntime.teardown();
    }
    const factory = detectFactory();
    const adapter = factory && factory();
    if (!adapter) return;

    const windowMilliseconds = 2000;
    const rollingMapper = Core.createRollingMapper(windowMilliseconds, 1.5);
    let latest = { x: 0, y: 0 };
    let active = false;
    let listening = false;
    let availabilityTimer = 0;
    let control = null;
    let observer = null;
    let destroyed = false;
    let controlFeedback = null;
    const phonePreference = Core.createOrientationPreference(window);

    adapter.root.dataset.ksOrientation = "supported";
    adapter.root.dataset.ksOrientationAdapter = config.adapter || "detected";
    adapter.root.dataset.ksOrientationWindow = String(windowMilliseconds);
    const ticksPerBeat = Math.max(1, Number(config.ticksPerBeat) || 16);
    const transitionTargetTicks = Math.max(1, Math.round(Number(config.transitionTargetTicks) || 2));
    const bpm = Math.max(20, Math.min(400, Number(config.bpm) || 120));
    const targetIntervalMilliseconds = (60000 / bpm / ticksPerBeat) * transitionTargetTicks;
    adapter.root.dataset.ksOrientationTargetTicks = String(transitionTargetTicks);
    adapter.root.dataset.ksOrientationTargetMilliseconds = targetIntervalMilliseconds.toFixed(3);

    const removeControl = () => {
      if (control) control.remove();
      control = null;
    };

    const targetScheduler = Core.createTransitionTargetScheduler({
      intervalMilliseconds: targetIntervalMilliseconds,
      minimumDelta: 0.02,
      now: () => window.performance.now(),
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer),
      commit(x, y, detail) {
        if (destroyed || adapter.root.isConnected === false) return;
        latest = { x, y };
        if (!active) {
          active = true;
          adapter.root.dataset.ksOrientation = "active";
          window.clearTimeout(availabilityTimer);
          removeControl();
        }
        adapter.apply(x, y);
        window.EPKEffectHarnessProbe?.noteCommit?.(detail.sampleAge);
      },
    });

    const scheduler = Core.createLatestSampleRafScheduler({
      mapper: rollingMapper,
      smoothingTimeConstantMilliseconds: 32,
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: frame => window.cancelAnimationFrame(frame),
      now: () => window.performance.now(),
      commit(x, y, detail) {
        targetScheduler.receive(x, y, detail);
      },
      reject() {
        window.EPKEffectHarnessProbe?.noteRejected?.();
      },
    });

    const reset = () => {
      scheduler.reset();
      targetScheduler.reset();
      latest = { x: 0, y: 0 };
      active = false;
      adapter.root.dataset.ksOrientation = "supported";
      adapter.reset();
    };

    const onOrientation = event => {
      if (reducedMotion.matches) return;
      if (!Core.hasMotionData(event)) {
        window.EPKEffectHarnessProbe?.noteRejected?.();
        return;
      }
      scheduler.receive(event, Core.screenAngle(window), window.performance.now());
    };

    const startListening = () => {
      if (listening || reducedMotion.matches || document.hidden || destroyed) return;
      listening = true;
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
      availabilityTimer = window.setTimeout(() => {
        if (!active && control) {
          control.textContent = Core.permissionRequired(window) ? "Use phone motion" : "Phone motion unavailable";
          control.disabled = !Core.permissionRequired(window);
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
      if (control || destroyed) return;
      control = document.createElement("button");
      control.type = "button";
      control.className = "ks-epk-orientation-control";
      control.textContent = "Use phone motion";
      control.setAttribute("aria-live", "polite");
      controlFeedback?.destroy();
      controlFeedback = Core.createControlFeedback(window, control, { color: "#ffe066" });
      control.addEventListener("click", async () => {
        const button = control;
        // Decoration must never prevent the permission request in this gesture.
        try { controlFeedback.burst(); } catch (error) { controlFeedback.clear(); }
        button.disabled = true;
        button.textContent = "Checking motion…";
        try {
          const result = await window.DeviceOrientationEvent.requestPermission();
          if (destroyed || control !== button) return;
          if (result !== "granted") {
            phonePreference.write(false);
            stopListening();
            button.textContent = "Phone motion blocked";
            button.disabled = false;
            return;
          }
          phonePreference.write(true);
          button.textContent = "Move phone to enable…";
          stopListening();
          startListening();
        } catch (error) {
          if (destroyed || control !== button) return;
          button.textContent = "Use phone motion";
          button.disabled = false;
        }
      });
      document.body.append(control);
    };

    const recalibrate = () => {
      reset();
    };

    const visibilityChanged = () => {
      if (document.hidden) controlFeedback?.clear();
      if (document.hidden) stopListening();
      else pageShown();
    };

    const pageHidden = () => { controlFeedback?.clear(); stopListening(); };
    const pageShown = () => {
      if (destroyed || reducedMotion.matches) return;
      if (harnessMode) startListening();
      else if (Core.permissionRequired(window)) {
        makePermissionControl();
        if (phonePreference.read() === "enabled") startListening();
      }
      else if (phonePreference.read() !== "disabled") startListening();
    };

    window.addEventListener("orientationchange", recalibrate, { passive: true });
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === "function") {
      window.screen.orientation.addEventListener("change", recalibrate);
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", pageShown);

    const preferenceChanged = () => {
      if (reducedMotion.matches) {
        controlFeedback?.clear();
        stopListening();
        removeControl();
      } else {
        pageShown();
      }
    };
    if (typeof reducedMotion.addEventListener === "function") reducedMotion.addEventListener("change", preferenceChanged);
    else reducedMotion.addListener(preferenceChanged);

    const teardown = () => {
      if (destroyed) return;
      destroyed = true;
      if (listening) window.removeEventListener("deviceorientation", onOrientation);
      listening = false;
      window.clearTimeout(availabilityTimer);
      scheduler.teardown();
      targetScheduler.teardown();
      latest = { x: 0, y: 0 };
      active = false;
      adapter.reset();
      controlFeedback?.destroy();
      removeControl();
      window.removeEventListener("orientationchange", recalibrate);
      window.removeEventListener("pagehide", pageHidden);
      window.removeEventListener("pageshow", pageShown);
      document.removeEventListener("visibilitychange", visibilityChanged);
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.removeEventListener === "function") {
        window.screen.orientation.removeEventListener("change", recalibrate);
      }
      if (typeof reducedMotion.removeEventListener === "function") reducedMotion.removeEventListener("change", preferenceChanged);
      else if (typeof reducedMotion.removeListener === "function") reducedMotion.removeListener(preferenceChanged);
      observer?.disconnect();
      observer = null;
      if (window.__ksEpkOrientationRuntime?.teardown === teardown) delete window.__ksEpkOrientationRuntime;
    };

    const snapshot = () => ({
      adapter: config.adapter || "detected",
      active,
      listening,
      destroyed,
      latest: { ...latest },
      reducedMotion: reducedMotion.matches,
      documentHidden: document.hidden,
    });
    window.__ksEpkOrientationRuntime = Object.freeze({ reset, teardown, snapshot });
    if (typeof window.MutationObserver === "function" && document.documentElement) {
      observer = new window.MutationObserver(() => {
        if (adapter.root.isConnected === false) teardown();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    pageShown();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
