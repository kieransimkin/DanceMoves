(function () {
  "use strict";

  let manifest = null;
  let values = {};

  function production() {
    const effect = window.DanceMovesClayStars;
    if (!effect || typeof effect.setParameters !== "function" || typeof effect.setMotion !== "function") {
      throw new Error("The production Clay/Stars runtime did not initialise");
    }
    return effect;
  }

  function configure(nextManifest) {
    if (!window.DanceMoves || typeof window.DanceMoves.fireCue !== "function") {
      throw new Error("The production DanceMoves core did not initialise");
    }
    manifest = nextManifest;
    const targetRoot = document.querySelector(manifest.effect.rootSelector);
    if (!targetRoot || production().root !== targetRoot) throw new Error(`Effect root not found: ${manifest.effect.rootSelector}`);
  }

  function cueScenario(value) {
    const scenarios = {
      clear: null,
      intro: { type: "SECTION", name: "INTRO" },
      chorus: { type: "DROP", name: "CHORUS 1" },
      bridge: { type: "SECTION", name: "BRIDGE" },
      coda: { type: "SECTION", name: "CODA" }
    };
    production().setCueState(scenarios[value] || null);
  }

  function applyParameters(nextValues, changedId) {
    values = { ...values, ...nextValues };
    production().setParameters({
      enabled: values["effect-enabled"],
      masterIntensity: values["master-intensity"],
      coverTiltDegrees: values["cover-tilt-degrees"],
      coverTranslationPixels: values["cover-translation-pixels"],
      bloomTravelPixels: values["bloom-travel-pixels"],
      flareTravelPixels: values["flare-travel-pixels"],
      specularTravelPixels: values["specular-travel-pixels"],
      particleReleaseTicks: values["particle-release-ticks"]
    });
    if (changedId === "cue-state-scenario") cueScenario(values["cue-state-scenario"]);
  }

  function setMotion(sample) {
    production().setMotion(sample || { x: 0, y: 0 });
  }

  function fireCue(cue) {
    return window.DanceMoves.fireCue(cue);
  }

  function reset() {
    values = Object.fromEntries(manifest.parameters.map(item => [item.id, item.default]));
    production().reset();
    applyParameters(values, "cue-state-scenario");
  }

  function snapshot() {
    return {
      values: { ...values },
      rootFound: Boolean(document.querySelector(manifest?.effect?.rootSelector || ".ks-epk.ks-clay-stars-v2")),
      production: production().snapshot()
    };
  }

  function registerCueHandlers(probe) {
    if (typeof window.DanceMoves?.setDiagnosticsSink !== "function" || typeof probe?.recordDiagnostic !== "function") return [];
    const enabled = window.DanceMoves.setDiagnosticsSink(record => probe.recordDiagnostic(record));
    return enabled ? ["clay-stars:cue-state"] : [];
  }

  window.EPKEffectUnderTest = Object.freeze({ configure, applyParameters, setMotion, fireCue, reset, snapshot, registerCueHandlers });
}());
