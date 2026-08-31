const assert = require("node:assert/strict");
const Policy = require("./motion-capture-policy.js");

assert.equal(Policy.CAPTURE_DURATION_MS, 30000);
assert.equal(Policy.STORAGE_INTERVAL_MS, 100);
assert.ok(Policy.MAX_STORED_SAMPLES < 500);

for (const frequency of [20, 50, 60, 120]) {
  const sampler = Policy.createSampler();
  const interval = 1000 / frequency;
  for (let elapsed = 0; elapsed <= Policy.CAPTURE_DURATION_MS; elapsed += interval) {
    sampler.push({ milliseconds: Number(elapsed.toFixed(2)), frequency }, elapsed);
  }
  sampler.push({ milliseconds: Policy.CAPTURE_DURATION_MS, frequency }, Policy.CAPTURE_DURATION_MS, true);
  const stored = sampler.samples();
  assert.equal(stored[0].milliseconds, 0, `${frequency} Hz keeps the first sample`);
  assert.equal(stored.at(-1).milliseconds, 30000, `${frequency} Hz keeps the terminal sample`);
  assert.ok(stored.length >= 295 && stored.length <= 302, `${frequency} Hz is safely decimated to about 10 Hz`);
  assert.ok(stored.length < 500, `${frequency} Hz remains under the WordPress sample limit`);
}

const capped = Policy.createSampler({ storageIntervalMilliseconds: 1, maximumSamples: 400 });
for (let elapsed = 0; elapsed <= 30000; elapsed += 1) capped.push({ milliseconds: elapsed }, elapsed);
capped.push({ milliseconds: 30000, terminal: true }, 30000, true);
assert.equal(capped.size(), 400);
assert.equal(capped.samples().at(-1).terminal, true, "a capped recording still preserves the terminal sample");

const maximumStoredPayload = {
  schema: "ks-epk-motion-recording/v1",
  capturedAt: "2026-08-28T00:00:00.000Z",
  userAgent: "Representative Android mobile browser user agent",
  screenAngle: 0,
  targetDurationMilliseconds: 30000,
  captureDurationMilliseconds: 30010,
  sampledDurationMilliseconds: 29980,
  processedPairCount: 3600,
  storedSampleCount: Policy.MAX_STORED_SAMPLES,
  storageIntervalMilliseconds: 100,
  sampleStrategy: "time-decimated",
  fullWindowObserved: true,
  expectedDifference: "Native Event.isTrusted is true; scripted Event.isTrusted is always false.",
  passed: true,
  failureCount: 0,
  failures: [],
  samples: Array.from({ length: Policy.MAX_STORED_SAMPLES }, (_, index) => ({
    milliseconds: Number((index * 75).toFixed(2)),
    alpha: 359.999999,
    beta: -179.999999,
    gamma: 89.999999,
    absolute: false,
    screenAngle: 0,
    nativeTrusted: true,
    simulatedTrusted: false,
    fieldParity: true,
    dispatchParity: true,
    mapperParity: true,
  })),
};
const maximumPayloadBytes = Buffer.byteLength(JSON.stringify(maximumStoredPayload, null, 2));
assert.ok(maximumPayloadBytes < 262144, `maximum sanitized payload is ${maximumPayloadBytes} bytes`);

console.log(`30-second capture duration and decimation tests passed; maximum payload ${maximumPayloadBytes} bytes`);
