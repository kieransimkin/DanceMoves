'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../assets/ks-epk-device-orientation-core.js');
const Policy = require('./motion-capture-policy.js');
const client = fs.readFileSync(path.join(__dirname, 'mobile-api-conformance.js'), 'utf8');
const simulator = fs.readFileSync(path.join(__dirname, 'simulated-device-orientation-event.js'), 'utf8');

async function harness(config, response = {ok: true, json: async () => ({captureId: 12})}) {
  const elements = new Map(), listeners = new Map(), requests = [];
  let now = 1, finish;
  const document = {getElementById(id) {
    if (!elements.has(id)) elements.set(id, {textContent: '', hidden: true, disabled: false,
      addEventListener(type, fn) { this[type] = fn; }});
    return elements.get(id);
  }};
  const window = {
    KSEpkOrientationCore: Core, KSMotionCapturePolicy: Policy,
    DeviceOrientationEvent: class NativeFixture extends Event {}, isSecureContext: true,
    location: new URL('https://example.test/motion-lab/'), ksMotionCaptureConfig: config,
    setTimeout(fn) { finish = fn; return 1; }, clearTimeout() {},
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  const context = {window, document, Event, Blob, URL, navigator: {userAgent: 'synthetic capture client fixture'},
    performance: {now: () => now}, fetch: async (url, options) => { requests.push({url, options}); return response; }};
  vm.runInNewContext(simulator, context);
  vm.runInNewContext(client, context);
  await elements.get('start-test').click();
  now = 30001;
  finish();
  assert.equal(elements.get('download-recording').hidden, false, 'local download remains available after synthetic completion');
  await elements.get('upload-recording').click();
  return {requests, status: elements.get('upload-status').textContent, upload: elements.get('upload-recording')};
}
(async () => {
  let result = await harness({endpoint: '/wp-json/ks-epk-motion/v1/capture'});
  assert.equal(result.requests.length, 0, 'missing session nonce never sends the local recording');
  assert.match(result.status, /fresh REST nonce/);
  result = await harness({endpoint: 'https://other.test/capture', restNonce: 'synthetic-nonce'});
  assert.equal(result.requests.length, 0, 'a configured external origin cannot receive the nonce or sensor recording');
  assert.match(result.status, /this site's/);
  result = await harness({endpoint: 'https://[invalid', restNonce: 'synthetic-nonce'});
  assert.equal(result.requests.length, 0);
  assert.match(result.status, /invalid/);
  result = await harness({endpoint: '/wp-json/ks-epk-motion/v1/capture', restNonce: 'synthetic-nonce'});
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].url, 'https://example.test/wp-json/ks-epk-motion/v1/capture');
  assert.equal(result.requests[0].options.credentials, 'same-origin');
  assert.equal(result.requests[0].options.headers['X-WP-Nonce'], 'synthetic-nonce');
  assert.equal(result.requests[0].options.headers['X-KS-Motion-Token'], undefined);
  assert.match(result.status, /Saved privately/);
  result = await harness({endpoint: '/wp-json/ks-epk-motion/v1/capture', restNonce: 'expired-fixture'},
    {ok: false, json: async () => ({message: 'Cookie check failed'})});
  assert.match(result.status, /Upload failed: Cookie check failed/);
  assert.equal(result.upload.disabled, false, 'authentication failures allow an explicit retry with refreshed session configuration');
  console.log('WordPress capture client nonce, origin, download and failure handling passed (synthetic; no physical sensor or HTTP authentication claim)');
})().catch(error => { console.error(error); process.exitCode = 1; });
