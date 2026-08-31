#!/usr/bin/env node

import process from "node:process";
import fs from "node:fs/promises";

const webSocketUrl = process.argv[2];
const injectLocalOrientation = process.argv.includes("--inject-local-orientation");
const dispatchSynthetic = process.argv.includes("--dispatch-synthetic");
const emulateCdpOrientation = process.argv.includes("--emulate-cdp-orientation");
const invokeOrientationListener = process.argv.includes("--invoke-orientation-listener");
const navigateArgument = process.argv.find(argument => argument.startsWith("--navigate="));
const navigateUrl = navigateArgument ? navigateArgument.slice("--navigate=".length) : "";
if (!webSocketUrl || !/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/page\/[A-Za-z0-9-]+$/.test(webSocketUrl)) {
  console.error("Usage: node tools/inspect-phone-epk.mjs <filtered-local-epk-websocket-url>");
  process.exit(2);
}

let nextId = 1;
const pending = new Map();
const socket = new WebSocket(webSocketUrl);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out connecting to the filtered phone tab")), 10000);
  socket.addEventListener("open", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
  socket.addEventListener("error", error => {
    clearTimeout(timer);
    reject(error);
  }, { once: true });
});

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const item = pending.get(message.id);
  pending.delete(message.id);
  clearTimeout(item.timer);
  if (message.error) item.reject(new Error(message.error.message));
  else item.resolve(message.result || {});
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => {
    pending.delete(id);
    reject(new Error(`Timed out waiting for ${method}`));
  }, 15000);
  pending.set(id, { resolve, reject, timer });
  socket.send(JSON.stringify({ id, method, params }));
});

await send("Runtime.enable");
const evaluate = async (expression, options = {}) => {
  const evaluated = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: false,
    ...options
  });
  if (evaluated.exceptionDetails) {
    throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text || "Phone evaluation failed");
  }
  return evaluated.result.value;
};

if (navigateUrl) {
  const expectedPrefix = "https://kieransimkin.co.uk/made-from-the-clay-and-the-stars-anunnaki/";
  if (!navigateUrl.startsWith(expectedPrefix)) throw new Error("Refusing to navigate outside the Clay/Stars EPK");
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.navigate", { url: navigateUrl });
  await new Promise(resolve => setTimeout(resolve, 3500));
}

if (injectLocalOrientation) {
  const coreSource = await fs.readFile(new URL("../assets/ks-epk-device-orientation-core.js", import.meta.url), "utf8");
  const runtimeSource = await fs.readFile(new URL("../assets/ks-epk-device-orientation.js", import.meta.url), "utf8");
  await evaluate(`window.__danceMovesPhoneProbe = { commits: [], rejected: 0 };
    window.EPKEffectHarnessProbe = {
      noteCommit: age => window.__danceMovesPhoneProbe.commits.push(age),
      noteRejected: () => { window.__danceMovesPhoneProbe.rejected += 1; }
    };
    window.ksEpkOrientationConfig = ${JSON.stringify({
    adapter: "clay-stars",
    pageId: 252,
    version: "2.3.2-local-phone-test",
    bpm: 116,
    bpmSource: "explicit"
  })}; true;`);
  await evaluate(`${coreSource}\n;true;\n//# sourceURL=dance-moves-phone-orientation-core-2.3.2.js`, { returnByValue: false });
  await evaluate(`${runtimeSource}\n;true;\n//# sourceURL=dance-moves-phone-orientation-2.3.2.js`, { returnByValue: false });
}

if (dispatchSynthetic) {
  await evaluate(`(async () => {
    window.__danceMovesSyntheticSeen = [];
    const observe = event => window.__danceMovesSyntheticSeen.push({ beta: event.beta, gamma: event.gamma });
    window.addEventListener("deviceorientation", observe);
    const send = (beta, gamma) => {
      const event = new Event("deviceorientation");
      Object.defineProperties(event, {
        alpha: { value: 0 },
        beta: { value: beta },
        gamma: { value: gamma },
        absolute: { value: false }
      });
      window.dispatchEvent(event);
    };
    send(0, 0);
    await new Promise(resolve => setTimeout(resolve, 80));
    send(-24, 18);
    await new Promise(resolve => setTimeout(resolve, 250));
    window.removeEventListener("deviceorientation", observe);
    return true;
  })()`);
}

if (emulateCdpOrientation) {
  await send("DeviceOrientation.setDeviceOrientationOverride", { alpha: 0, beta: 0, gamma: 0 });
  await new Promise(resolve => setTimeout(resolve, 100));
  await send("DeviceOrientation.setDeviceOrientationOverride", { alpha: 30, beta: -24, gamma: 18 });
  await new Promise(resolve => setTimeout(resolve, 350));
  await evaluate(`(() => {
    const cover = document.querySelector(".ks-epk.ks-clay-stars-v2 .epk-cover-wrap");
    window.__danceMovesCdpOrientationSnapshot = {
      runtime: window.__ksEpkOrientationRuntime?.snapshot?.() || null,
      clay: window.DanceMovesClayStars?.snapshot?.() || null,
      coverVars: cover ? {
        rx: cover.style.getPropertyValue("--ks-rx"),
        ry: cover.style.getPropertyValue("--ks-ry"),
        tx: cover.style.getPropertyValue("--ks-tx"),
        ty: cover.style.getPropertyValue("--ks-ty")
      } : null
    };
    return true;
  })()`);
  await send("DeviceOrientation.clearDeviceOrientationOverride");
}

const windowObject = await send("Runtime.evaluate", { expression: "window", returnByValue: false });
const listenerResult = windowObject.result.objectId
  ? await send("DOMDebugger.getEventListeners", { objectId: windowObject.result.objectId })
  : { listeners: [] };
const deviceOrientationListeners = (listenerResult.listeners || []).filter(listener => listener.type === "deviceorientation");

if (invokeOrientationListener) {
  const handlerId = deviceOrientationListeners[0]?.handler?.objectId || deviceOrientationListeners[0]?.originalHandler?.objectId;
  if (deviceOrientationListeners.length !== 1 || !handlerId) {
    throw new Error(`Expected one callable deviceorientation listener, found ${deviceOrientationListeners.length}`);
  }
  const call = (beta, gamma) => send("Runtime.callFunctionOn", {
    objectId: handlerId,
    functionDeclaration: "function(beta, gamma) { return this({ beta: beta, gamma: gamma, alpha: 0, absolute: false }); }",
    arguments: [{ value: beta }, { value: gamma }],
    returnByValue: true
  });
  await call(0, 0);
  await new Promise(resolve => setTimeout(resolve, 100));
  await call(-24, 18);
  await new Promise(resolve => setTimeout(resolve, 350));
  await evaluate(`(() => {
    const cover = document.querySelector(".ks-epk.ks-clay-stars-v2 .epk-cover-wrap");
    window.__danceMovesListenerInvocationSnapshot = {
      runtime: window.__ksEpkOrientationRuntime?.snapshot?.() || null,
      clay: window.DanceMovesClayStars?.snapshot?.() || null,
      coverVars: cover ? {
        rx: cover.style.getPropertyValue("--ks-rx"),
        ry: cover.style.getPropertyValue("--ks-ry"),
        tx: cover.style.getPropertyValue("--ks-tx"),
        ty: cover.style.getPropertyValue("--ks-ty")
      } : null
    };
    return true;
  })()`);
}

const expression = `(async () => {
  const events = [];
  const probe = event => events.push({
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    absolute: event.absolute
  });
  window.addEventListener("deviceorientation", probe, { passive: true });
  await new Promise(resolve => setTimeout(resolve, ${injectLocalOrientation ? 5000 : 2500}));
  window.removeEventListener("deviceorientation", probe);
  const root = document.querySelector(".ks-epk.ks-clay-stars-v2");
  const cover = root && root.querySelector(".epk-cover-wrap");
  const control = document.querySelector(".ks-epk-orientation-control");
  return {
    url: location.href,
    visibility: document.visibilityState,
    secure: window.isSecureContext,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    rootCount: document.querySelectorAll(".ks-epk.ks-clay-stars-v2").length,
    coverCount: document.querySelectorAll(".ks-epk.ks-clay-stars-v2 .epk-cover-wrap").length,
    scripts: Array.from(document.scripts, script => script.src).filter(value => value.includes("kieran-epk-device-orientation")),
    deviceOrientationType: typeof window.DeviceOrientationEvent,
    requestPermissionType: window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission,
    orientationEventCount: events.length,
    orientationSample: events.slice(-3),
    control: control ? {
      text: control.textContent.trim(),
      disabled: control.disabled,
      display: getComputedStyle(control).display
    } : null,
    clayApi: Boolean(window.DanceMovesClayStars),
    orientationRuntime: Boolean(window.__ksEpkOrientationRuntime),
    orientationRuntimeSnapshot: window.__ksEpkOrientationRuntime && typeof window.__ksEpkOrientationRuntime.snapshot === "function"
      ? window.__ksEpkOrientationRuntime.snapshot()
      : null,
    syntheticRoutingProbe: ${dispatchSynthetic},
    cdpOrientationProbe: ${emulateCdpOrientation},
    cdpOrientationSnapshot: window.__danceMovesCdpOrientationSnapshot || null,
    listenerInvocationProbe: ${invokeOrientationListener},
    listenerInvocationSnapshot: window.__danceMovesListenerInvocationSnapshot || null,
    syntheticEventsSeen: window.__danceMovesSyntheticSeen || [],
    orientationState: root ? {
      status: root.dataset.ksOrientation || "",
      adapter: root.dataset.ksOrientationAdapter || "",
      window: root.dataset.ksOrientationWindow || ""
    } : null,
    probe: window.__danceMovesPhoneProbe || null,
    claySnapshot: window.DanceMovesClayStars && typeof window.DanceMovesClayStars.snapshot === "function"
      ? window.DanceMovesClayStars.snapshot()
      : null,
    coverVars: cover ? {
      rx: cover.style.getPropertyValue("--ks-rx"),
      ry: cover.style.getPropertyValue("--ks-ry"),
      tx: cover.style.getPropertyValue("--ks-tx"),
      ty: cover.style.getPropertyValue("--ks-ty")
    } : null
  };
})()`;

const diagnostics = await evaluate(expression);
diagnostics.deviceOrientationListenerCount = deviceOrientationListeners.length;
diagnostics.deviceOrientationListenerLines = deviceOrientationListeners.map(listener => ({
  lineNumber: listener.lineNumber,
  columnNumber: listener.columnNumber,
  scriptId: listener.scriptId,
  passive: listener.passive,
  once: listener.once
}));
console.log(JSON.stringify(diagnostics, null, 2));
socket.close();
