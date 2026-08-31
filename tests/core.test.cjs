const assert = require("node:assert/strict");
const core = require("../assets/ks-epk-device-orientation-core.js");

const media = matches => () => ({ matches });

assert.equal(core.isMobileDevice({
  navigator: { userAgent: "Mozilla/5.0 (iPhone)", maxTouchPoints: 5 },
  matchMedia: media(true),
  screen: { width: 390 },
}), true);

assert.equal(core.isMobileDevice({
  navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0)", maxTouchPoints: 0 },
  matchMedia: media(false),
  screen: { width: 1920 },
}), false);

assert.equal(core.sensorSupported({ DeviceOrientationEvent: function () {} }), true);
assert.equal(core.sensorSupported({}), false);
assert.equal(core.sensorSupported({ isSecureContext: false, DeviceOrientationEvent: function () {} }), false);

function PermissionOrientation() {}
PermissionOrientation.requestPermission = () => Promise.resolve("granted");
assert.equal(core.permissionRequired({ DeviceOrientationEvent: PermissionOrientation }), true);
assert.equal(core.hasMotionData({ beta: 12, gamma: -4 }), true);
assert.equal(core.hasMotionData({ beta: null, gamma: -4 }), false);

assert.deepEqual(
  core.normalise({ beta: 10, gamma: 20 }, { beta: 10, gamma: 0 }, 0, 20),
  { x: 1, y: 0 }
);

const landscape = core.normalise(
  { beta: 30, gamma: 0 },
  { beta: 10, gamma: 0 },
  90,
  20
);
assert.ok(Math.abs(landscape.x - 1) < 1e-10);
assert.ok(Math.abs(landscape.y) < 1e-10);

assert.deepEqual(core.smooth({ x: 0, y: 0 }, { x: 1, y: -1 }, .2), { x: .2, y: -.2 });

const mapper = core.createRollingMapper(10000, 1);
mapper.push({ x: 0, y: 0 }, 0);
mapper.push({ x: 10, y: -10 }, 1000);
const mapped = mapper.push({ x: 10, y: -10 }, 2000);
assert.ok(mapped.x > 0);
assert.ok(mapped.y < 0);
assert.equal(mapped.minX, 0);
assert.equal(mapped.maxX, 10);
assert.equal(mapped.sampleCount, 3);
mapper.push({ x: 20, y: 20 }, 12001);
assert.equal(mapper.size(), 1);

const batchedMapper = core.createRollingMapper(2000, 1);
const batchedResult = batchedMapper.pushBatch({
  count: 3,
  sumX: 12,
  sumY: -6,
  minX: 0,
  maxX: 8,
  minY: -4,
  maxY: 0,
}, 80);
assert.equal(batchedResult.sampleCount, 3);
assert.equal(batchedResult.batchCount, 1);
assert.equal(batchedResult.meanX, 4);
assert.equal(batchedResult.meanY, -2);
assert.equal(batchedResult.minX, 0);
assert.equal(batchedResult.maxX, 8);
assert.deepEqual(core.mapPointToWindow({ x: 8, y: -4 }, batchedResult, 1), { x: 1, y: -1 });

console.log("Kieran EPK orientation core tests passed");
