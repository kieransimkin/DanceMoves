const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "simulated-device-orientation-event.js"), "utf8");
const window = {};
vm.runInNewContext(source, { window, Event });
const SimulatedEvent = window.KSSimulatedDeviceOrientationEvent;
const event = new SimulatedEvent("deviceorientation", {
  alpha: 123.5,
  beta: -42.25,
  gamma: 17.75,
  absolute: true,
});

assert.equal(event.type, "deviceorientation");
assert.equal(event.alpha, 123.5);
assert.equal(event.beta, -42.25);
assert.equal(event.gamma, 17.75);
assert.equal(event.absolute, true);
assert.equal(event.bubbles, false);
assert.equal(event.cancelable, false);
assert.equal(event.composed, false);
assert.equal(event.isTrusted, false);

const nullable = new SimulatedEvent("deviceorientation", {});
assert.equal(nullable.alpha, null);
assert.equal(nullable.beta, null);
assert.equal(nullable.gamma, null);
assert.equal(nullable.absolute, false);
console.log("Simulated DeviceOrientationEvent contract tests passed");
