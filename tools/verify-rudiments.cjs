'use strict';
// Read-only packaging gate. No compiler or registry access is required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = (type, data) => crypto.createHash(type).update(data).digest('hex');
(async () => {
  const vendor = path.join(root, 'vendor/dancerudiments');
  const output = path.join(root, 'assets/vendor/dancerudiments');
  const pin = JSON.parse(fs.readFileSync(path.join(vendor, 'UPSTREAM.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.upstream, pin);
  for (const [name, expected] of Object.entries(pin.files)) {
    const bytes = fs.readFileSync(path.join(vendor, name));
    assert.equal(hash('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])), expected, name);
  }
  assert.equal(fs.readFileSync(path.join(vendor, 'LICENSE'), 'utf8'), fs.readFileSync(path.join(output, 'LICENSE'), 'utf8'));
  const source = fs.readFileSync(path.join(output, 'dancerudiments-native.js'));
  assert.equal(hash('sha256', source), manifest.runtimeSha256);
  const context = { window: {} }; vm.runInNewContext(source.toString('utf8'), context);
  const data = context.window.danceMovesRudimentsNative;
  const bytes = Buffer.from(data.wasmBase64, 'base64');
  assert.equal(hash('sha256', bytes), manifest.wasmSha256);
  assert.equal(data.wasmSha256, manifest.wasmSha256);
  assert.equal(data.commit, pin.commit); assert.equal(data.version, pin.version);
  assert.equal(data.pipsPerBeat, 64);
  const module = await WebAssembly.compile(bytes);
  assert.equal(WebAssembly.Module.imports(module).length, 0, 'backend has no JS math or host imports');
  const { exports: native } = await WebAssembly.instantiate(module, {});
  assert.equal(native.dr_abi(), 1); assert.equal(native.dr_count(), data.catalogue.length);
  const view = new DataView(native.memory.buffer);
  let positions = 0;
  data.catalogue.forEach((row, id) => {
    assert.equal(native.dr_period(id), row.periodPips);
    for (let p = 0; p < row.periodPips; p++) {
      const a = native.dr_sample(id, p), b = native.dr_sample(id, p-row.periodPips);
      for (let axis = 0; axis < 3; axis++) {
        const v = view.getFloat64(a+axis*8, true);
        assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.00000001);
        assert.equal(v, view.getFloat64(b+axis*8,true));
      }
      positions++;
    }
  });
  assert.equal(positions, manifest.sampleCount);
  assert.equal(native.dr_sample(-1, 0), 0);
  console.log(`PASS pinned native sources, MIT licence, JS/WASM hashes, ${data.catalogue.length} catalogue entries and ${positions} native positions`);
})().catch(error => { console.error(error); process.exitCode = 1; });
