(function () {
  "use strict";

  const CHANNEL = "epk-effect-harness/v1";
  const probe = window.EPKEffectHarnessProbe;
  const effect = window.EPKEffectUnderTest;
  let configured = false;
  let cueHandlersRegistered = false;
  let metricsTimer = 0;

  function post(type, payload) {
    window.parent.postMessage({ channel: CHANNEL, type, payload: payload || {} }, location.origin);
  }

  function guarded(label, callback) {
    try { return callback(); }
    catch (error) {
      post("error", { label, message: String(error && error.message || error) });
      return undefined;
    }
  }

  function handle(event) {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || typeof message.type !== "string") return;
    const payload = message.payload || {};
    if (message.type === "configure") {
      guarded("configure", () => {
        effect.configure(payload.manifest);
        if (!cueHandlersRegistered) {
          effect.registerCueHandlers(probe);
          cueHandlersRegistered = true;
        }
        effect.applyParameters(payload.values || {}, payload.changedId || null);
        configured = true;
        post("parameter-applied", effect.snapshot());
      });
    } else if (!configured) {
      post("warning", { message: "Candidate is not configured" });
    } else if (message.type === "set-motion") {
      guarded("set-motion", () => probe.measure("motion-dispatch", () => effect.setMotion(payload)));
    } else if (message.type === "fire-cue") {
      guarded("fire-cue", () => probe.measure("cue:total-dispatch", () => effect.fireCue(payload)));
    } else if (message.type === "reset") {
      guarded("reset", () => effect.reset());
    } else if (message.type === "snapshot") {
      post("snapshot", guarded("snapshot", () => effect.snapshot()));
    } else if (message.type === "mark") {
      probe.mark(payload.kind || "mark", payload);
    } else if (message.type === "start-capture") {
      probe.start({ maximumSamples: payload.maximumSamples });
    } else if (message.type === "stop-capture") {
      post("metrics", probe.stop());
    }
  }

  window.addEventListener("message", handle);
  metricsTimer = window.setInterval(() => {
    if (probe.isActive()) post("metrics", probe.snapshot());
  }, 500);
  window.addEventListener("pagehide", () => window.clearInterval(metricsTimer), { once: true });
  post("ready", { href: location.href });
})();
