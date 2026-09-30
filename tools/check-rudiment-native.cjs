'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
(async () => {
  const [runtime, nativeSamples] = process.argv.slice(2);
  if (!runtime || !nativeSamples) throw new Error('Usage: node tools/check-rudiment-native.cjs runtime.js samples.json');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(runtime, 'utf8'), context);
  const data = context.window.danceMovesRudimentsNative;
  const bytes = Buffer.from(data.wasmBase64, 'base64');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), data.wasmSha256);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const ex = instance.exports;
  const view = new DataView(ex.memory.buffer);
  const rows = JSON.parse(fs.readFileSync(nativeSamples, 'utf8'));
  assert.equal(data.schema, 2);
  assert.ok(Number.isSafeInteger(data.sourceCatalogueCount));
  assert.ok(data.sourceCatalogueCount >= rows.length);
  assert.equal(ex.dr_abi(), 2);
  assert.equal(ex.dr_count(), rows.length);
  let count = 0;
  rows.forEach((row, id) => {
    assert.equal(data.catalogue[id].name, row.name);
    assert.equal(ex.dr_period(id), row.periodPips);
    row.samples.forEach((expected, pip) => {
      for (const input of [pip, pip - row.periodPips, pip + row.periodPips]) {
        const ptr = ex.dr_sample(id, input);
        expected.forEach((value, axis) => assert.ok(Math.abs(view.getFloat64(ptr + axis * 8, true) - value) <= 1e-12,
          `${row.name} pip=${input} axis=${axis}`));
        count++;
      }
    });
  });
  assert.equal(ex.dr_sample(-1, 0), 0);
  assert.equal(ex.dr_sample(rows.length, 0), 0);
  console.log(`PASS official API/shipped WASM parity: ${rows.length} selected of ${data.sourceCatalogueCount} movements, ${count} wrapped positions, three axes each`);
})().catch(error => { console.error(error); process.exitCode = 1; });
