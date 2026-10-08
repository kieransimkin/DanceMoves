const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../assets/ks-epk-device-orientation-core.js");

const runtime = fs.readFileSync(
  path.join(__dirname, "../assets/ks-epk-device-orientation.js"),
  "utf8"
);

function createEnvironment({ mobile = true, permission = false, adapter = "dmitri-my-talisman", storage = new Map(), reduced = false, permissionResult = "granted", harness = false } = {}) {
  const windowListeners = {};
  const raf = [];
  const timers = new Map();
  let nextTimer = 1;
  const controls = [];
  let clock = 0;
  const properties = new Map();
  const coverProperties = new Map();
  const cover = {
    style: {
      setProperty: (name, value) => coverProperties.set(name, value),
      removeProperty: name => coverProperties.delete(name),
    },
  };
  const root = {
    classList: { contains: () => false },
    dataset: {},
    querySelector: selector => selector.includes("wwm-cover-stage") || selector === ".epk-cover-wrap" ? cover : null,
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: name => properties.delete(name),
    },
  };

  function OrientationEvent() {}
  let permissionCalls = 0;
  if (permission) OrientationEvent.requestPermission = async () => { permissionCalls++; return permissionResult; };

  const matchMedia = query => ({
    matches: query.includes("prefers-reduced-motion") ? reduced :
      query.includes("pointer: coarse") ? mobile :
      query.includes("max-width") ? true : false,
    addEventListener() {},
    addListener() {},
  });

  const window = {
    DeviceOrientationEvent: OrientationEvent,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    KSEpkOrientationCore: Core,
    ksEpkOrientationConfig: { adapter, pageId: adapter === "walk-with-me" ? 276 : adapter === "a-whole-new-christmas" ? 1359 : 298, harness },
    location: { hostname: harness ? "127.0.0.1" : "example.test" },
    navigator: {
      userAgent: mobile ? "Mozilla/5.0 (iPhone) Mobile" : "Mozilla/5.0 (Windows NT 10.0)",
      maxTouchPoints: mobile ? 5 : 0,
    },
    screen: { width: mobile ? 390 : 1920, orientation: { angle: 0, addEventListener() {} } },
    innerWidth: mobile ? 390 : 1920,
    matchMedia,
    performance: { now: () => clock },
    requestAnimationFrame: callback => { raf.push(callback); return raf.length; },
    cancelAnimationFrame: id => { if (id > 0 && id <= raf.length) raf[id - 1] = () => {}; },
    clearTimeout: id => timers.delete(id),
    setTimeout: (callback, delay = 0) => {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    addEventListener: (name, callback) => { windowListeners[name] = callback; },
    removeEventListener: name => { delete windowListeners[name]; },
  };

  const document = {
    readyState: "complete",
    hidden: false,
    body: { append: control => controls.push(control) },
    addEventListener() {},
    getElementById: () => null,
    querySelector: selector => {
      if (adapter === "dmitri-my-talisman" && selector === ".dmt-epk") return root;
      if (adapter === "walk-with-me" && selector === '.ks-epk[data-release="walk-with-me"]') return root;
      if (adapter === "a-whole-new-christmas" && selector === '.ks-epk[data-release="a-whole-new-christmas"]') return root;
      return null;
    },
    createElement: () => {
      const listeners = {};
      return {
        listeners,
        setAttribute() {},
        addEventListener: (name, callback) => { listeners[name] = callback; },
        remove() { this.removed = true; },
      };
    },
  };

  vm.runInNewContext(runtime, { window, document, console });
  return {
    controls,
    coverProperties,
    properties,
    root,
    windowListeners,
    permissionCalls: () => permissionCalls,
    expireAvailability() {
      [...timers.entries()].filter(([, timer]) => timer.delay === 3500).forEach(([id, timer]) => { timers.delete(id); timer.callback(); });
    },
    advance(value) { clock = value; },
    flush() {
      while (raf.length) raf.shift()();
      [...timers.entries()]
        .filter(([, timer]) => timer.delay <= 100)
        .forEach(([id, timer]) => {
          timers.delete(id);
          timer.callback();
        });
      while (raf.length) raf.shift()();
    },
  };
}

const desktop = createEnvironment({ mobile: false });
assert.equal(desktop.windowListeners.deviceorientation, undefined);

const loopbackHarness = createEnvironment({ mobile: false, permission: true, harness: true, adapter: "a-whole-new-christmas" });
assert.equal(typeof loopbackHarness.windowListeners.deviceorientation, "function", "loopback harness starts without a physical sensor gate");
assert.equal(loopbackHarness.controls.length, 0, "loopback harness does not enter the real permission-control branch");
assert.equal(loopbackHarness.permissionCalls(), 0, "loopback harness never requests physical-device permission");

const automatic = createEnvironment({ mobile: true, permission: false });
assert.equal(typeof automatic.windowListeners.deviceorientation, "function");
automatic.advance(0);
automatic.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
automatic.flush();
automatic.advance(1000);
automatic.windowListeners.deviceorientation({ beta: 0, gamma: 10 });
automatic.flush();
automatic.advance(2000);
automatic.windowListeners.deviceorientation({ beta: 0, gamma: 10 });
automatic.flush();
assert.equal(automatic.root.dataset.ksOrientation, "active");
assert.equal(automatic.root.dataset.ksOrientationWindow, "2000");
assert.equal(automatic.root.dataset.ksOrientationBatch, undefined);
assert.notEqual(automatic.properties.get("--parallax-x"), "0.00px");
const automaticTilt = Math.abs(parseFloat(automatic.properties.get("--tilt-y")));
const automaticShift = Math.abs(parseFloat(automatic.properties.get("--parallax-x")));
assert.ok(automaticTilt > 2 && automaticTilt <= 5, `Dmitri tilt is perceptible and bounded: ${automaticTilt}deg`);
assert.ok(automaticShift > 6 && automaticShift <= 14, `Dmitri parallax is perceptible and bounded: ${automaticShift}px`);

const batched = createEnvironment({ mobile: true, permission: false });
batched.advance(0);
batched.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
batched.flush();
const baselineTarget = batched.properties.get("--parallax-x");
batched.advance(5);
batched.windowListeners.deviceorientation({ beta: 2, gamma: 4 });
batched.advance(10);
batched.windowListeners.deviceorientation({ beta: 4, gamma: 8 });
assert.equal(batched.properties.get("--parallax-x"), baselineTarget, "a sensor burst does not write CSS before its display frame");
batched.flush();
assert.notEqual(batched.properties.get("--parallax-x"), baselineTarget, "the newest coalesced sample retargets CSS on the display frame");

const fastPath = createEnvironment({ mobile: true, permission: false });
fastPath.advance(0);
fastPath.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
fastPath.flush();
fastPath.advance(30);
fastPath.windowListeners.deviceorientation({ beta: 0, gamma: 10 });
fastPath.flush();
const firstSmoothedTarget = fastPath.properties.get("--parallax-x");
assert.ok(parseFloat(firstSmoothedTarget) < -5 && parseFloat(firstSmoothedTarget) >= -14, "the bounded target moves promptly in the sample direction");
fastPath.advance(35);
fastPath.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
assert.equal(fastPath.properties.get("--parallax-x"), firstSmoothedTarget, "a new reading does not write CSS before rAF");
fastPath.flush();
const returningTarget = fastPath.properties.get("--parallax-x");
assert.ok(parseFloat(returningTarget) > parseFloat(firstSmoothedTarget), "the next display frame moves toward the newest reading");
fastPath.advance(65);
fastPath.windowListeners.deviceorientation({ beta: 0, gamma: 10 });
assert.equal(fastPath.properties.get("--parallax-x"), returningTarget, "sensor delivery never performs a visual commit synchronously");
fastPath.flush();
assert.ok(parseFloat(fastPath.properties.get("--parallax-x")) < parseFloat(returningTarget), "the next rAF commits the newest reading with time-based smoothing");

const walk = createEnvironment({ mobile: true, permission: false, adapter: "walk-with-me" });
walk.advance(0);
walk.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
walk.flush();
walk.advance(1000);
walk.windowListeners.deviceorientation({ beta: 8, gamma: 12 });
walk.flush();
walk.advance(2000);
walk.windowListeners.deviceorientation({ beta: 8, gamma: 12 });
walk.flush();
assert.match(walk.coverProperties.get("--wwm-tilt-y"), /deg$/);
assert.match(walk.coverProperties.get("--wwm-shift-x"), /px$/);
assert.match(walk.coverProperties.get("--wwm-glow-x"), /%$/);
const walkTiltX = Math.abs(parseFloat(walk.coverProperties.get("--wwm-tilt-x")));
const walkTiltY = Math.abs(parseFloat(walk.coverProperties.get("--wwm-tilt-y")));
assert.ok(walkTiltX >= 3 && walkTiltX <= 6, `Walk vertical tilt is perceptible and bounded: ${walkTiltX}deg`);
assert.ok(walkTiltY >= 3.5 && walkTiltY <= 7, `Walk horizontal tilt is perceptible and bounded: ${walkTiltY}deg`);
assert.match(runtime, /Math\.sqrt\(Math\.abs\(bounded\)\)/);

const christmas = createEnvironment({ mobile: true, permission: false, adapter: "a-whole-new-christmas" });
christmas.advance(0);
christmas.windowListeners.deviceorientation({ beta: 0, gamma: 0 });
christmas.flush();
christmas.advance(1000);
christmas.windowListeners.deviceorientation({ beta: 8, gamma: 12 });
christmas.flush();
christmas.advance(2000);
christmas.windowListeners.deviceorientation({ beta: 8, gamma: 12 });
christmas.flush();
assert.match(christmas.coverProperties.get("--awnc-tilt-y"), /deg$/);
assert.match(christmas.coverProperties.get("--awnc-shift-x"), /px$/);
assert.match(christmas.coverProperties.get("--awnc-light-x"), /%$/);
assert.ok(Math.abs(parseFloat(christmas.coverProperties.get("--awnc-tilt-y"))) <= 4, "Christmas tilt remains bounded");
assert.ok(Math.abs(parseFloat(christmas.coverProperties.get("--awnc-shift-x"))) <= 7, "Christmas shift remains bounded");

(async () => {
  const gated = createEnvironment({ mobile: true, permission: true });
  assert.equal(gated.windowListeners.deviceorientation, undefined);
  assert.equal(gated.controls.length, 1);
  assert.equal(gated.controls[0].textContent, "Use phone motion");
  await gated.controls[0].listeners.click();
  assert.equal(typeof gated.windowListeners.deviceorientation, "function");
  const storage = new Map();
  const first = createEnvironment({ permission: true, storage });
  await first.controls[0].listeners.click();
  assert.equal(storage.get("dancemoves:phone-motion:v1"), "enabled");
  const next = createEnvironment({ permission: true, storage });
  assert.equal(typeof next.windowListeners.deviceorientation, "function", "new document restores the choice");
  assert.equal(next.permissionCalls(), 0, "restoration never invokes the permission API");
  next.windowListeners.deviceorientation({ beta: null, gamma: null }); next.flush();
  assert.equal(next.root.dataset.ksOrientation, "supported", "invalid samples do not prove permission");
  next.expireAvailability();
  assert.equal(next.controls[0].textContent, "Use phone motion");
  assert.equal(next.controls[0].disabled, false, "expired permission can be requested with a fresh click");
  await next.controls[0].listeners.click();
  next.windowListeners.deviceorientation({ beta: 0, gamma: 0 }); next.flush();
  assert.equal(next.root.dataset.ksOrientation, "active");
  assert.equal(next.controls[0].removed, true, "usable readings clear the enable control");
  next.windowListeners.pagehide(); next.windowListeners.pageshow();
  assert.equal(typeof next.windowListeners.deviceorientation, "function", "BFCache restoration resumes without another click");
  assert.equal(next.permissionCalls(), 1);
  const blocked = createEnvironment({ permission: true, storage, permissionResult: "denied" });
  await blocked.controls[0].listeners.click();
  assert.equal(storage.get("dancemoves:phone-motion:v1"), "disabled");
  assert.equal(blocked.windowListeners.deviceorientation, undefined);
  assert.equal(createEnvironment({ permission: true, storage }).windowListeners.deviceorientation, undefined);
  storage.set("dancemoves:phone-motion:v1", "enabled");
  const reducedPage = createEnvironment({ permission: true, storage, reduced: true });
  assert.equal(reducedPage.controls.length, 0);
  assert.equal(reducedPage.windowListeners.deviceorientation, undefined);
  const unavailableStorage = { get() { throw new Error("Storage blocked"); }, set() { throw new Error("Storage blocked"); } };
  const privatePage = createEnvironment({ permission: true, storage: unavailableStorage });
  await privatePage.controls[0].listeners.click();
  privatePage.windowListeners.pagehide(); privatePage.windowListeners.pageshow();
  assert.equal(typeof privatePage.windowListeners.deviceorientation, "function", "blocked storage still works within the page");
  console.log("Kieran EPK orientation runtime tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
