'use strict';
// Read-only release gate. The exact npm package must already be installed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

(async () => {
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'vendor/dancerudiments/UPSTREAM.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const packageRoot = path.join(root, 'node_modules', ...pin.package.split('/'));
  const installed = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const locked = lock.packages['node_modules/' + pin.package];
  assert.equal(locked.version, pin.version);
  assert.equal(locked.integrity, pin.integrity);
  assert.equal(installed.name, pin.package);
  assert.equal(installed.version, pin.version);
  assert.equal(installed.license, pin.licenseExpression);
  const packageLicence = fs.readFileSync(path.join(packageRoot, 'LICENSE'));
  assert.equal(hash(packageLicence), pin.licenseSha256);

  const output = path.join(root, 'assets/vendor/dancerudiments');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.upstream, pin);
  assert.equal(manifest.schema, 'dance-moves-rudiments-build/v2');
  assert.equal(manifest.backend, 'selected-official-npm-api-samples-wasm-lookup');
  assert.equal(manifest.sourceCatalogueCount, pin.sourceCatalogueCount);
  assert.equal(manifest.selectedCount, pin.selection.length);
  assert.equal(hash(fs.readFileSync(path.join(output, 'LICENSE'))), pin.licenseSha256);

  const source = fs.readFileSync(path.join(output, 'dancerudiments-native.js'));
  assert.equal(hash(source), manifest.runtimeSha256);
  const context = { window: {} };
  vm.runInNewContext(source.toString('utf8'), context);
  const data = context.window.danceMovesRudimentsNative;
  const bytes = Buffer.from(data.wasmBase64, 'base64');
  assert.equal(hash(bytes), manifest.wasmSha256);
  assert.equal(data.wasmSha256, manifest.wasmSha256);
  assert.equal(data.schema, 2);
  assert.equal(data.commit, pin.commit);
  assert.equal(data.version, pin.version);
  assert.equal(data.package, pin.package);
  assert.equal(data.pipsPerBeat, 64);
  assert.equal(data.sourceCatalogueCount, pin.sourceCatalogueCount);
  assert.deepEqual(Array.from(data.catalogue, row => row.name), pin.selection);

  const module = await WebAssembly.compile(bytes);
  assert.equal(WebAssembly.Module.imports(module).length, 0, 'backend has no JS math or host imports');
  const { exports: native } = await WebAssembly.instantiate(module, {});
  assert.equal(native.dr_abi(), 2);
  assert.equal(native.dr_count(), data.catalogue.length);
  const view = new DataView(native.memory.buffer);
  let positions = 0;
  data.catalogue.forEach((row, id) => {
    assert.equal(native.dr_period(id), row.periodPips);
    for (let pip = 0; pip < row.periodPips; pip++) {
      const direct = native.dr_sample(id, pip);
      const wrapped = native.dr_sample(id, pip - row.periodPips);
      for (let axis = 0; axis < 3; axis++) {
        const value = view.getFloat64(direct + axis * 8, true);
        assert.ok(Number.isFinite(value) && Math.abs(value) <= 1.00000001);
        assert.equal(value, view.getFloat64(wrapped + axis * 8, true));
      }
      positions++;
    }
  });
  assert.equal(positions, manifest.sampleCount);
  assert.equal(native.dr_sample(-1, 0), 0);
  console.log(`PASS pinned ${pin.package}@${pin.version}, ${data.catalogue.length} selected of ${data.sourceCatalogueCount} movements, ${positions} native positions`);
})().catch(error => { console.error(error); process.exitCode = 1; });
