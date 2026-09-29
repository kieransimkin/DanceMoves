#!/usr/bin/env node
'use strict';

// Offline unit-test inputs, not signed-out browser or release-acceptance evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');

const CLAY_SOURCE = 'qa/prelive/clay-stars/canonical-live-2.3.2.html';
const CLAY_SHA256 = '2F3EC40E763E712CCFD5F94C818E0D651F9F98EF8CA925FEB05A9F39D464B038';
const UNIT_MARKER = '<meta name="dance-moves-fixture" content="unit-only">';
const OUTPUTS = Object.freeze({
  'california-screamin': 'qa/california-screamin-unit-candidate.html',
  'clay-stars': 'qa/clay-stars-unit-candidate.html'
});
const COMMON_STYLES = ['dance-moves-core.css', 'ks-epk-device-orientation.css'];
const COMMON_SCRIPTS = ['dance-moves-core.js', 'dance-moves-effects.js', 'dance-moves-catalogue-timing.js'];
const RUDIMENT_SCRIPTS = ['vendor/dancerudiments/dancerudiments-native.js', 'dance-moves-rudiments.js'];

function readText(filename) {
  let bytes;
  try { bytes = fs.readFileSync(filename); }
  catch (error) { throw new Error(`Required test input is missing or unreadable: ${filename}\n${error.message}`); }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_) { throw new Error(`Test input is not valid UTF-8: ${filename}`); }
  if (text.includes('\0') || text.includes('\uFFFD')) throw new Error(`Invalid null/replacement character: ${filename}`);
  return text;
}
function versionFor(repoRoot) {
  const source = readText(path.join(repoRoot, 'kieran-epk-device-orientation.php'));
  const header = source.match(/\bVersion:\s*(\d+\.\d+\.\d+)\b/);
  const constant = source.match(/define\(\s*['"]DANCE_MOVES_VERSION['"]\s*,\s*['"](\d+\.\d+\.\d+)['"]\s*\)/);
  if (!header || !constant || header[1] !== constant[1]) throw new Error('Plugin header and DANCE_MOVES_VERSION must agree before building test harnesses.');
  return header[1];
}
function count(text, expression) { return (text.match(expression) || []).length; }
function requireCount(text, expression, expected, label) {
  const actual = count(text, expression);
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, found ${actual}`);
}
function assertIdentity(html, slug) {
  if (slug === 'clay-stars') {
    if (!/<title>Made from the clay and the stars \(Anunnaki\)/.test(html)) throw new Error('Clay fixture has the wrong title.');
    requireCount(html, /class="[^"]*ks-clay-stars-v2[^"]*"/g, 1, 'Clay release root');
    requireCount(html, /<audio\b/g, 1, 'Clay audio');
    requireCount(html, /<button[^>]+data-time=/g, 5, 'Clay chapter controls');
  } else if (slug === 'california-screamin') {
    requireCount(html, /id="cs-epk"/g, 1, 'California release root');
    if (!/data-release="california-screamin"/.test(html)) throw new Error('California fixture has the wrong release.');
  } else throw new Error(`Unknown harness: ${slug}`);
  if (/id=["']wpadminbar["']/.test(html)) throw new Error('Test snapshot must be signed out.');
  requireCount(html, /<\/head\s*>/gi, 1, 'HTML closing head');
  requireCount(html, /<\/body\s*>/gi, 1, 'HTML closing body');
}
function removeOldPluginAssets(html) {
  // Keep page-owned scripts/styles; replace only identified plugin tags.
  function owned(tag) {
    return /wp-content\/plugins\/(?:kieran-epk-device-orientation|kieran-made-from-clay-stars-epk-effects)\//i.test(tag) ||
      /\bid=["'](?:dance-moves-[^"']+|ks-epk-device-orientation[^"']*|ks-clay-stars-effects[^"']*)["']/i.test(tag);
  }
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => owned(tag) ? '' : tag)
    .replace(/<link\b[^>]*>/gi, tag => owned(tag) ? '' : tag);
}
function script(src) { return `<script src="${src}"></script>`; }
function inline(name, value) { return `<script>window.${name}=${JSON.stringify(value).replace(/</g, '\\u003c')};</script>`; }
function renderCandidate(source, slug, version, release) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid plugin version.');
  assertIdentity(source, slug);
  if (!Number.isFinite(release.bpm) || release.bpm < 20 || release.bpm > 400 ||
      !Number.isFinite(release.masterDurationMilliseconds) || release.masterDurationMilliseconds <= 0) {
    throw new Error(`Invalid ${slug} release timing in harness manifest.`);
  }
  let html = removeOldPluginAssets(source);
  const clay = slug === 'clay-stars';
  const asset = name => `../assets/${name}?ver=${version}-local`;
  const styles = [...COMMON_STYLES, ...(clay ? ['clay-stars-effects.css', 'clay-stars-rudiments.css'] : [])];
  const head = [UNIT_MARKER, ...styles.map(name => `<link rel="stylesheet" href="${asset(name)}">`),
    script('../tests/harness/plugin-core/harness-probe.js')].join('\n');
  const scripts = [...COMMON_SCRIPTS, ...(clay ? ['clay-stars-effects.js'] : []),
    'ks-epk-device-orientation-core.js'];
  const tail = [
    inline('danceMovesConfig', { pageId: clay ? 252 : 839, version, bpm: release.bpm,
      bpmSource: 'explicit', lyricTimingUrl: '', cueTimingUrl: '',
      masterDurationMilliseconds: release.masterDurationMilliseconds, diagnostics: true }),
    ...scripts.map(name => script(asset(name))),
    inline('ksEpkOrientationConfig', { adapter: slug, pageId: clay ? 252 : 839, version,
      bpm: release.bpm, bpmSource: 'explicit', ticksPerBeat: 16, transitionTargetTicks: 2, harness: true }),
    script(asset('ks-epk-device-orientation.js')),
    ...RUDIMENT_SCRIPTS.map(name => script(asset(name))),
    ...(clay ? [script(asset('clay-stars-rudiments.js'))] : []),
    script(`../tests/harness/${slug}/effect-under-test-adapter.js`),
    script('../tests/harness/plugin-core/harness-bridge.js')
  ].join('\n');
  html = html.replace(/<\/head\s*>/i, `${head}\n</head>`).replace(/<\/body\s*>/i, `${tail}\n</body>`);
  assertIdentity(html, slug);
  if (/wp-content\/plugins\/(?:kieran-epk-device-orientation|kieran-made-from-clay-stars-epk-effects)\//i.test(html)) {
    throw new Error(`${slug} still contains a remote or legacy plugin asset after replacement.`);
  }
  const expected = [...scripts, 'ks-epk-device-orientation.js', ...RUDIMENT_SCRIPTS,
    ...(clay ? ['clay-stars-rudiments.js'] : [])];
  for (const name of expected) {
    const needle = `src="${asset(name)}"`;
    if (html.split(needle).length - 1 !== 1) throw new Error(`Expected exactly one local script: ${name}`);
  }
  return html.replace(/\r\n?/g, '\n').trimEnd() + '\n';
}
function validateLocalReferences(repoRoot, html) {
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\.\.\/(?:assets|tests)\/[^"?#]+)(?:\?[^"#]*)?"/g)) {
    const filename = path.resolve(repoRoot, 'qa', match[1]);
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) throw new Error(`Required harness asset is missing: ${filename}`);
  }
}
function planHarness(repoRoot, slug) {
  if (!Object.hasOwn(OUTPUTS, slug)) throw new Error(`Unknown harness: ${slug}`);
  const version = versionFor(repoRoot);
  const manifest = JSON.parse(readText(path.join(repoRoot, 'tests/harness', slug, `${slug}.json`)));
  const sourcePath = path.join(repoRoot, slug === 'clay-stars' ? CLAY_SOURCE : 'tests/fixtures/california-screamin-unit.html');
  if (slug === 'clay-stars') {
    // Check immutable snapshot bytes, including any BOM. Never repin automatically.
    if (!fs.existsSync(sourcePath)) throw new Error(`Tracked Clay snapshot missing: ${CLAY_SOURCE}. Restore it from Git; do not substitute another page.`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex').toUpperCase();
    if (actual !== CLAY_SHA256) throw new Error(`Tracked Clay snapshot hash mismatch: expected ${CLAY_SHA256}, got ${actual}. Restore the original file from Git.`);
  }
  const html = renderCandidate(readText(sourcePath), slug, version, manifest.release);
  validateLocalReferences(repoRoot, html);
  return { filename: path.join(repoRoot, OUTPUTS[slug]), html, slug, version };
}
function writePlan(plan) {
  fs.mkdirSync(path.dirname(plan.filename), { recursive: true });
  // Do not touch timestamps/OneDrive state on a repeat run with identical bytes.
  if (!fs.existsSync(plan.filename) || fs.readFileSync(plan.filename, 'utf8') !== plan.html) fs.writeFileSync(plan.filename, plan.html, 'utf8');
  return plan.filename;
}
function prepareHarnesses(repoRoot = path.resolve(__dirname, '..')) {
  // Validate BOTH inputs and all references before writing either candidate.
  return Object.keys(OUTPUTS).map(slug => planHarness(repoRoot, slug)).map(writePlan);
}
function readUnitCandidate(repoRoot, slug) {
  const plan = planHarness(repoRoot, slug);
  writePlan(plan);
  return plan.html;
}
module.exports = { prepareHarnesses, readUnitCandidate, versionFor, renderCandidate,
  validateLocalReferences, CLAY_SOURCE, CLAY_SHA256, UNIT_MARKER, OUTPUTS };
if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error('Usage: node tools/prepare-test-harnesses.cjs');
    process.exitCode = 2;
  } else {
    try {
      for (const filename of prepareHarnesses()) console.log(`Prepared unit-only fixture: ${filename}`);
      console.log('Offline fixture preparation complete. This is not a pre-live browser or physical-device pass.');
    } catch (error) { console.error(`Harness preparation failed: ${error.message}`); process.exitCode = 1; }
  }
}
