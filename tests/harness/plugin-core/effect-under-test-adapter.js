(function () {
  "use strict";

  let manifest = null;
  let values = {};
  let lastMotion = { x: 0, y: 0, source: "reset", timestamp: 0 };

  function root() {
    return document.querySelector(manifest?.effect?.rootSelector || "[data-dance-moves-core-harness]");
  }

  function clamp(value, minimum, maximum) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
  }

  function parameter(id) {
    return manifest.parameters.find(item => item.id === id);
  }

  function formatCssValue(definition, value) {
    if (definition.type === "checkbox") return value ? "1" : "0";
    if (!definition.unit || definition.unit === "ticks") return String(value);
    return `${value}${definition.unit}`;
  }

  function configure(nextManifest) {
    if (!window.DanceMoves || typeof window.DanceMoves.durationMilliseconds !== "function") {
      throw new Error("The production DanceMoves core did not initialise");
    }
    manifest = nextManifest;
  }

  function applyParameters(nextValues) {
    values = { ...values, ...nextValues };
    const targetRoot = root();
    if (!targetRoot) throw new Error(`Effect root not found: ${manifest?.effect?.rootSelector}`);

    for (const definition of manifest.parameters) {
      if (!Object.prototype.hasOwnProperty.call(values, definition.id)) continue;
      if (definition.apply === "css-variable") {
        targetRoot.style.setProperty(definition.target, formatCssValue(definition, values[definition.id]));
      }
    }

    const ticksDefinition = parameter("interval-ticks");
    const ticks = clamp(values["interval-ticks"], ticksDefinition.min, ticksDefinition.max);
    const duration = window.DanceMoves.durationMilliseconds(ticks);
    targetRoot.style.setProperty("--dance-moves-harness-duration", `${duration.toFixed(6)}ms`);
    targetRoot.querySelector("[data-core-bpm]").value = String(window.DanceMoves.bpm);
    targetRoot.querySelector("[data-core-duration]").value = `${ticks} ticks = ${duration.toFixed(3)} ms`;
    setMotion(lastMotion);
  }

  function setMotion(sample) {
    const targetRoot = root();
    if (!targetRoot) return;
    const x = clamp(sample?.x, -1, 1);
    const y = clamp(sample?.y, -1, 1);
    const depthDefinition = parameter("fixture-depth");
    const depth = clamp(values["fixture-depth"], depthDefinition.min, depthDefinition.max);
    lastMotion = { x, y, source: String(sample?.source || "harness"), timestamp: Number(sample?.timestamp) || 0 };
    targetRoot.style.setProperty("--dance-moves-harness-x", `${(x * 18 * depth).toFixed(2)}px`);
    targetRoot.style.setProperty("--dance-moves-harness-y", `${(y * 18 * depth).toFixed(2)}px`);
  }

  function fireCue(cue) {
    if (typeof window.DanceMoves?.fireCue !== "function") {
      throw new Error("The production DanceMoves cue dispatcher is unavailable");
    }
    return window.DanceMoves.fireCue(cue);
  }

  function reset() {
    values = Object.fromEntries(manifest.parameters.map(item => [item.id, item.default]));
    lastMotion = { x: 0, y: 0, source: "reset", timestamp: 0 };
    applyParameters(values);
  }

  function snapshot() {
    const targetRoot = root();
    return {
      values: { ...values },
      rootFound: Boolean(targetRoot),
      production: {
        version: window.DanceMoves?.version || "",
        bpm: window.DanceMoves?.bpm || null,
        ticksPerBeat: window.DanceMoves?.ticksPerBeat || null,
        motion: { ...lastMotion },
        duration: targetRoot?.querySelector("[data-core-duration]")?.value || ""
      }
    };
  }

  function registerCueHandlers(probe) {
    if (typeof window.DanceMoves?.setDiagnosticsSink !== "function" || typeof probe?.recordDiagnostic !== "function") return [];
    const enabled = window.DanceMoves.setDiagnosticsSink(record => probe.recordDiagnostic(record));
    return enabled ? ["dance-moves-core"] : [];
  }

  window.EPKEffectUnderTest = Object.freeze({ configure, applyParameters, setMotion, fireCue, reset, snapshot, registerCueHandlers });
}());
