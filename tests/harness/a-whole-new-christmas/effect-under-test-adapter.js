(function () {
  "use strict";

  let manifest = null;

  function root() {
    return document.querySelector(manifest?.effect?.rootSelector || '.ks-epk[data-release="a-whole-new-christmas"]');
  }

  function configure(nextManifest) {
    manifest = nextManifest;
    if (!root()) throw new Error(`Effect root not found: ${manifest.effect.rootSelector}`);
    if (!window.__ksEpkOrientationRuntime) throw new Error("The production DanceMoves orientation runtime did not initialise");
  }

  function applyParameters() {}

  function setMotion(sample) {
    const next = sample || { x: 0, y: 0 };
    const event = new Event("deviceorientation");
    Object.defineProperties(event, {
      beta: { value: Number(next.y || 0) * 20 },
      gamma: { value: Number(next.x || 0) * 20 },
    });
    window.dispatchEvent(event);
  }

  function fireCue(cue) {
    return typeof window.DanceMoves?.fireCue === "function" ? window.DanceMoves.fireCue(cue) : 0;
  }

  function reset() { window.__ksEpkOrientationRuntime.reset(); }

  function snapshot() {
    const target = root();
    return {
      rootFound: Boolean(target),
      cssVariables: {
        tiltX: target?.style.getPropertyValue("--awnc-tilt-x") || "",
        tiltY: target?.style.getPropertyValue("--awnc-tilt-y") || "",
        shiftX: target?.style.getPropertyValue("--awnc-shift-x") || "",
        shiftY: target?.style.getPropertyValue("--awnc-shift-y") || "",
        lightX: target?.style.getPropertyValue("--awnc-light-x") || "",
        lightY: target?.style.getPropertyValue("--awnc-light-y") || "",
      },
      production: window.__ksEpkOrientationRuntime?.snapshot?.() || null,
    };
  }

  function registerCueHandlers() { return []; }

  window.EPKEffectUnderTest = Object.freeze({ configure, applyParameters, setMotion, fireCue, reset, snapshot, registerCueHandlers });
}());
