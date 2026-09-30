'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

const runtime = read('assets/dance-moves-rudiments.js');
const wordpress = read('dance-moves-rudiments.php');
const modules = read('tools/build-modules.mjs');
const declarations = read('RUDIMENTS-API.d.ts');
assert.doesNotMatch(runtime, /Math\.(?:sin|cos)|clay_keys|stroke_envelope|smooth\(/, 'no JS motion implementation');
assert.match(runtime, /native\.dr_sample/);
assert.match(runtime, /rule\.style\.setProperty/);
assert.doesNotMatch(runtime, /target\.style\./, 'no per-frame inline styles');
assert.doesNotMatch(runtime, /setInterval|setTimeout/, 'no independent timer clock');
assert.match(wordpress, /wp_enqueue_script\('dance-moves-rudiments-native'/);
assert.match(wordpress, /wp_enqueue_script\('dance-moves-rudiments'/);
for (const source of [runtime, wordpress, modules, declarations]) {
  assert.doesNotMatch(source, /DanceMovesClayRudiment|clay-stars-rudiments|DANCE_MOVES_CLAY_STARS_PAGE_ID/,
    'the reusable rudiment layer must not own an EPK adapter, page ID or release asset');
}
assert.equal(fs.existsSync(path.join(root, 'assets/clay-stars-rudiments.js')), false);
assert.equal(fs.existsSync(path.join(root, 'assets/clay-stars-rudiments.css')), false);

const pin = JSON.parse(read('vendor/dancerudiments/UPSTREAM.json'));
const lock = JSON.parse(read('package-lock.json'));
const installedRoot = path.join(root, 'node_modules', ...pin.package.split('/'));
const installed = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
assert.equal(pin.version, '0.2.0');
assert.equal(pin.sourceCatalogueCount, 1731);
assert.equal(pin.selection.length, 15);
assert.equal(lock.packages['node_modules/' + pin.package].integrity, pin.integrity);
assert.equal(installed.version, pin.version);
assert.equal(hash(fs.readFileSync(path.join(installedRoot, 'LICENSE'))), pin.licenseSha256);
assert.equal(hash(fs.readFileSync(path.join(root, 'assets/vendor/dancerudiments/LICENSE'))), pin.licenseSha256);
console.log('PASS selected-source ownership, generic API boundary and package provenance contracts');
