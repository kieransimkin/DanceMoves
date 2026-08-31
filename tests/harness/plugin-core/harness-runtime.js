(function () {
  "use strict";

  const CHANNEL = "epk-effect-harness/v1";
  const MAX_TIMELINE_ITEMS = 120;
  const nodes = {};
  const state = {
    manifest: null,
    values: {},
    defaults: {},
    candidatePreset: {},
    activePreset: "a",
    captureActive: false,
    candidateConnected: false,
    candidateUrl: "",
    latestMetrics: null,
    pathFrame: 0,
    pathName: "stop",
    pathStart: 0,
    cueTimers: []
  };

  function byId(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function nowIso() { return new Date().toISOString(); }

  function addTimeline(label) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()} · ${label}`;
    nodes.timeline.prepend(item);
    while (nodes.timeline.children.length > MAX_TIMELINE_ITEMS) nodes.timeline.lastElementChild.remove();
  }

  function send(type, payload) {
    if (!nodes.candidate.contentWindow) return;
    nodes.candidate.contentWindow.postMessage({ channel: CHANNEL, type, payload: payload || {} }, location.origin);
  }

  function parameterById(id) {
    return state.manifest.parameters.find(parameter => parameter.id === id);
  }

  function typedValue(parameter, raw) {
    if (parameter.type === "checkbox") return Boolean(raw);
    if (parameter.type === "range" || parameter.type === "number" || parameter.type === "readonly") {
      const number = Number(raw);
      if (!Number.isFinite(number)) return parameter.default;
      if (Number.isFinite(parameter.min) && number < parameter.min) return parameter.min;
      if (Number.isFinite(parameter.max) && number > parameter.max) return parameter.max;
      return number;
    }
    if (parameter.type === "select" && Array.isArray(parameter.options)) {
      const match = parameter.options.find(option => String(option) === String(raw));
      if (match !== undefined) return match;
    }
    return String(raw);
  }

  function setControlValue(parameter, value) {
    const input = document.querySelector(`[data-parameter="${CSS.escape(parameter.id)}"]`);
    const output = document.querySelector(`[data-output="${CSS.escape(parameter.id)}"]`);
    if (!input) return;
    if (parameter.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
    if (output) output.value = `${value}${parameter.unit || ""}`;
  }

  function applyValues(values, changedId, source) {
    for (const parameter of state.manifest.parameters) {
      if (!Object.prototype.hasOwnProperty.call(values, parameter.id)) continue;
      state.values[parameter.id] = typedValue(parameter, values[parameter.id]);
      setControlValue(parameter, state.values[parameter.id]);
    }
    send("configure", { manifest: state.manifest, values: state.values, changedId: changedId || null });
    if (changedId) {
      const value = state.values[changedId];
      addTimeline(`${source || "parameter"}: ${changedId} = ${value}`);
      send("mark", { kind: "parameter", id: changedId, value, source: source || "control", timestamp: performance.now() });
    }
  }

  function createInput(parameter) {
    const label = document.createElement("label");
    label.textContent = parameter.label;
    const output = document.createElement("output");
    output.dataset.output = parameter.id;
    output.value = `${parameter.default}${parameter.unit || ""}`;
    label.append(output);
    let input;
    if (parameter.type === "select") {
      input = document.createElement("select");
      for (const optionValue of parameter.options || []) {
        const option = document.createElement("option");
        option.value = String(optionValue);
        option.textContent = String(optionValue);
        input.append(option);
      }
    } else {
      input = document.createElement("input");
      input.type = parameter.type === "readonly" ? "number" : parameter.type;
      if (Number.isFinite(parameter.min)) input.min = String(parameter.min);
      if (Number.isFinite(parameter.max)) input.max = String(parameter.max);
      if (Number.isFinite(parameter.step)) input.step = String(parameter.step);
      if (parameter.type === "readonly") input.readOnly = true;
    }
    input.dataset.parameter = parameter.id;
    if (parameter.type === "checkbox") input.checked = Boolean(parameter.default);
    else input.value = String(parameter.default);
    input.title = parameter.description;
    const eventName = parameter.type === "range" ? "input" : "change";
    input.addEventListener(eventName, () => {
      const value = typedValue(parameter, parameter.type === "checkbox" ? input.checked : input.value);
      state.activePreset = "b";
      state.candidatePreset[parameter.id] = value;
      updatePresetButtons();
      applyValues({ [parameter.id]: value }, parameter.id, "live control");
    });
    label.append(input);
    return label;
  }

  function buildParameters() {
    nodes.parameterGroups.replaceChildren();
    for (const groupName of ["master", "timing", "effect"]) {
      const parameters = state.manifest.parameters.filter(parameter => parameter.group === groupName);
      if (!parameters.length) continue;
      const panel = document.createElement("section");
      panel.className = "lab__panel";
      const heading = document.createElement("h2");
      heading.textContent = groupName[0].toUpperCase() + groupName.slice(1);
      panel.append(heading);
      for (const parameter of parameters) panel.append(createInput(parameter));
      nodes.parameterGroups.append(panel);
    }
  }

  function buildViewports() {
    nodes.viewport.replaceChildren();
    for (const viewport of state.manifest.preview.viewports) {
      const option = document.createElement("option");
      option.value = viewport.name;
      option.textContent = `${viewport.name} · ${viewport.width}×${viewport.height}`;
      nodes.viewport.append(option);
    }
    nodes.viewport.addEventListener("change", applyViewport);
    applyViewport();
  }

  function applyViewport() {
    const viewport = state.manifest.preview.viewports.find(item => item.name === nodes.viewport.value) || state.manifest.preview.viewports[0];
    nodes.viewportFrame.style.width = `${viewport.width}px`;
    nodes.viewportFrame.style.height = `${viewport.height}px`;
    addTimeline(`viewport: ${viewport.name} ${viewport.width}×${viewport.height}`);
  }

  function buildCues() {
    nodes.cue.replaceChildren();
    if (!state.manifest.cues.length) {
      const option = document.createElement("option");
      option.textContent = "No cues declared";
      option.value = "";
      nodes.cue.append(option);
      return;
    }
    state.manifest.cues.forEach((cue, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${cue.type}: ${cue.name} @ ${cue.time.toFixed(2)}s`;
      nodes.cue.append(option);
    });
  }

  function fireCue(cue) {
    if (!cue) return;
    send("fire-cue", cue);
    addTimeline(`cue: ${cue.type} ${cue.name}`);
  }

  function stopCueRun() {
    state.cueTimers.forEach(clearTimeout);
    state.cueTimers = [];
  }

  function runCues() {
    stopCueRun();
    state.manifest.cues.forEach((cue, index) => {
      state.cueTimers.push(setTimeout(() => fireCue(cue), index * 450));
    });
  }

  function motionPoint(path, elapsed) {
    const t = elapsed / 1000;
    if (path === "gentle") return { x: Math.sin(t * 1.13) * .35, y: Math.sin(t * .79 + .8) * .28 };
    if (path === "sweep") return { x: Math.sin(t * .65), y: Math.sin(t * .325 + Math.PI / 2) };
    if (path === "spin") return { x: Math.sin(t * 2.31) * Math.cos(t * .37), y: Math.cos(t * 1.73) * Math.sin(t * .53 + .4) };
    if (path === "maze") {
      const points = [[0,0],[.8,0],[.8,-.7],[-.4,-.7],[-.4,.45],[.35,.45],[.35,.9],[-.9,.9],[-.9,0],[0,0]];
      const segment = Math.min(points.length - 2, Math.floor(t * 1.3) % (points.length - 1));
      const p = (t * 1.3) % 1;
      return { x: points[segment][0] + (points[segment + 1][0] - points[segment][0]) * p, y: points[segment][1] + (points[segment + 1][1] - points[segment][1]) * p };
    }
    if (path === "noise") {
      const seed = Math.sin(Math.floor(t * 30) * 12.9898) * 43758.5453;
      const value = (seed - Math.floor(seed) - .5) * .08;
      return { x: value, y: -value * .73 };
    }
    return { x: Number(nodes.motionX.value), y: Number(nodes.motionY.value) };
  }

  function sendMotion(point, source) {
    const x = clamp(Number(point.x) || 0, -1, 1);
    const y = clamp(Number(point.y) || 0, -1, 1);
    nodes.motionX.value = String(x);
    nodes.motionY.value = String(y);
    nodes.xOutput.value = x.toFixed(2);
    nodes.yOutput.value = y.toFixed(2);
    send("set-motion", { x, y, source, timestamp: performance.now() });
  }

  function pathFrame(now) {
    if (state.pathName === "stop") return;
    sendMotion(motionPoint(state.pathName, now - state.pathStart), `simulator:${state.pathName}`);
    state.pathFrame = requestAnimationFrame(pathFrame);
  }

  function startPath(name) {
    cancelAnimationFrame(state.pathFrame);
    state.pathFrame = 0;
    state.pathName = name;
    state.pathStart = performance.now();
    if (name === "stop") {
      sendMotion({ x: 0, y: 0 }, "simulator:stop");
      addTimeline("motion path stopped");
      return;
    }
    addTimeline(`motion path: ${name}`);
    state.pathFrame = requestAnimationFrame(pathFrame);
  }

  function updatePresetButtons() {
    nodes.presetA.setAttribute("aria-pressed", String(state.activePreset === "a"));
    nodes.presetB.setAttribute("aria-pressed", String(state.activePreset === "b"));
  }

  function choosePreset(name) {
    state.activePreset = name;
    updatePresetButtons();
    applyValues(name === "a" ? state.defaults : state.candidatePreset, null, `preset ${name.toUpperCase()}`);
    addTimeline(`preset ${name.toUpperCase()}`);
  }

  function reset() {
    stopCueRun();
    startPath("stop");
    state.activePreset = "a";
    state.candidatePreset = { ...state.defaults };
    updatePresetButtons();
    applyValues(state.defaults, null, "reset");
    send("reset");
    addTimeline("reset to verified defaults");
  }

  function toggleCapture() {
    state.captureActive = !state.captureActive;
    nodes.capture.textContent = state.captureActive ? "Stop capture" : "Start capture";
    send(state.captureActive ? "start-capture" : "stop-capture", { timestamp: performance.now() });
    addTimeline(state.captureActive ? "capture started" : "capture stopped");
  }

  function exportEvidence() {
    send("snapshot");
    const result = {
      schema: "epk-effect-harness-export/v1",
      exportedAt: nowIso(),
      effect: state.manifest.effect,
      release: state.manifest.release,
      status: state.activePreset === "a" ? "verified-default" : "candidate",
      values: state.values,
      changedFromDefault: Object.fromEntries(Object.entries(state.values).filter(([key, value]) => value !== state.defaults[key])),
      metrics: state.latestMetrics,
      note: "Local harness export only; this does not approve or publish the effect."
    };
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.manifest.effect.slug}-harness-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    addTimeline("preset and metrics exported");
  }

  async function importPreset(file) {
    const parsed = JSON.parse(await file.text());
    if (parsed.schema !== "epk-effect-harness-export/v1") throw new Error("Unsupported preset schema");
    if (parsed.effect?.slug !== state.manifest.effect.slug) throw new Error("Preset belongs to another effect");
    const values = {};
    for (const parameter of state.manifest.parameters) {
      if (!Object.prototype.hasOwnProperty.call(parsed.values || {}, parameter.id)) throw new Error(`Missing parameter ${parameter.id}`);
      values[parameter.id] = typedValue(parameter, parsed.values[parameter.id]);
    }
    state.candidatePreset = values;
    state.activePreset = "b";
    updatePresetButtons();
    applyValues(values, null, "import");
    addTimeline("candidate preset imported");
  }

  function metricText(value, unit) {
    return Number.isFinite(value) ? `${value.toFixed(2)}${unit || ""}` : "—";
  }

  function updateMetrics(metrics) {
    state.latestMetrics = metrics;
    const summary = metrics?.summary || {};
    const values = {
      fps: metricText(summary.fps, ""),
      frameP95: metricText(summary.frame?.p95, " ms"),
      orientationP95: metricText(summary.orientation?.p95, " ms"),
      rafP95: metricText(summary.raf?.p95, " ms"),
      cueP95: metricText(summary.cue?.p95, " ms"),
      longTasks: String(summary.longTaskCount ?? "—"),
      dropped: Number.isFinite(summary.droppedFramePercent) ? `${summary.droppedFramePercent.toFixed(2)}%` : "—",
      samples: String(summary.sampleCount ?? "—")
    };
    for (const [name, value] of Object.entries(values)) {
      const node = document.querySelector(`[data-metric="${name}"]`);
      if (node) node.textContent = value;
    }
  }

  function handleCandidateMessage(event) {
    if (event.source !== nodes.candidate.contentWindow || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.type === "ready") {
      if (state.candidateUrl && new URL(message.payload?.href || "", location.href).href !== state.candidateUrl) {
        addTimeline(`error: candidate URL mismatch (${message.payload?.href || "missing"})`);
        nodes.status.textContent = "Harness failed: candidate URL mismatch";
        return;
      }
      send("configure", { manifest: state.manifest, values: state.values });
      markCandidateConnected();
    } else if (message.type === "parameter-applied") {
      markCandidateConnected();
    } else if (message.type === "metrics") {
      updateMetrics(message.payload);
    } else if (message.type === "warning" || message.type === "error") {
      addTimeline(`${message.type}: ${message.payload?.message || "Unknown"}`);
    }
  }

  function markCandidateConnected() {
    const firstConnection = !state.candidateConnected;
    state.candidateConnected = true;
    nodes.status.textContent = "Candidate connected · local harness only";
    if (firstConnection) addTimeline("candidate connected");
  }

  function configureCandidate() {
    send("configure", { manifest: state.manifest, values: state.values });
    if (!state.candidateConnected) nodes.status.textContent = "Configuring candidate…";
  }

  function bindStaticControls() {
    nodes.reset.addEventListener("click", reset);
    nodes.capture.addEventListener("click", toggleCapture);
    nodes.export.addEventListener("click", exportEvidence);
    nodes.importButton.addEventListener("click", () => nodes.importFile.click());
    nodes.importFile.addEventListener("change", async () => {
      try { if (nodes.importFile.files[0]) await importPreset(nodes.importFile.files[0]); }
      catch (error) { addTimeline(`import error: ${error.message}`); }
      nodes.importFile.value = "";
    });
    nodes.presetA.addEventListener("click", () => choosePreset("a"));
    nodes.presetB.addEventListener("click", () => choosePreset("b"));
    nodes.motionX.addEventListener("input", () => sendMotion({ x: nodes.motionX.value, y: nodes.motionY.value }, "manual"));
    nodes.motionY.addEventListener("input", () => sendMotion({ x: nodes.motionX.value, y: nodes.motionY.value }, "manual"));
    nodes.paths.addEventListener("click", event => {
      const button = event.target.closest("button[data-path]");
      if (button) startPath(button.dataset.path);
    });
    nodes.fireCue.addEventListener("click", () => fireCue(state.manifest.cues[Number(nodes.cue.value)]));
    nodes.fireCues.addEventListener("click", runCues);
    window.addEventListener("message", handleCandidateMessage);
    nodes.candidate.addEventListener("load", configureCandidate);
    window.addEventListener("keydown", event => {
      if (/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      const step = event.shiftKey ? .1 : .03;
      const point = { x: Number(nodes.motionX.value), y: Number(nodes.motionY.value) };
      if (event.key === "ArrowLeft") point.x -= step;
      else if (event.key === "ArrowRight") point.x += step;
      else if (event.key === "ArrowUp") point.y -= step;
      else if (event.key === "ArrowDown") point.y += step;
      else return;
      event.preventDefault();
      sendMotion(point, "keyboard");
    });
  }

  async function init() {
    Object.assign(nodes, {
      status: byId("lab-status"), candidate: byId("candidate"), parameterGroups: byId("parameter-groups"),
      viewport: byId("viewport"), viewportFrame: byId("viewport-frame"), cue: byId("cue"), timeline: byId("timeline"),
      reset: byId("reset"), capture: byId("capture"), export: byId("export"), importButton: byId("import"), importFile: byId("import-file"),
      presetA: byId("preset-a"), presetB: byId("preset-b"), motionX: byId("motion-x"), motionY: byId("motion-y"),
      xOutput: byId("x-output"), yOutput: byId("y-output"), paths: byId("paths"), fireCue: byId("fire-cue"), fireCues: byId("fire-cues")
    });
    const manifestUrl = new URLSearchParams(location.search).get("manifest") || "./effect-harness.manifest.json";
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
    state.manifest = await response.json();
    state.defaults = Object.fromEntries(state.manifest.parameters.map(parameter => [parameter.id, parameter.default]));
    state.values = { ...state.defaults };
    state.candidatePreset = { ...state.defaults };
    state.candidateUrl = new URL(state.manifest.effect.candidate, response.url).href;
    byId("lab-title").textContent = `${state.manifest.effect.title} · live test lab`;
    buildParameters();
    buildViewports();
    buildCues();
    bindStaticControls();
    nodes.candidate.src = state.candidateUrl;
    configureCandidate();
  }

  init().catch(error => {
    if (nodes.status) nodes.status.textContent = `Harness failed: ${error.message}`;
    console.error(error);
  });
})();
