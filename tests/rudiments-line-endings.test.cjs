'use strict';
// Runs the real verifier in isolated copies; never edits this checkout or its pins.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitBlobHash, pinnedTextBytes } = require('../tools/rudiments-source-integrity.cjs');
const root = path.resolve(__dirname, '..');
const pin = JSON.parse(fs.readFileSync(path.join(root, 'vendor/dancerudiments/UPSTREAM.json'), 'utf8'));
const buildManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/dancerudiments/build-manifest.json'), 'utf8'));
let groups = 0;
function check(label, fn) { fn(); groups++; console.log('PASS ' + label); }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function lf(bytes) { return Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'); }
function crlf(bytes) { return Buffer.from(lf(bytes).toString('latin1').replace(/\n/g, '\r\n'), 'latin1'); }
const header = 'include/dancerudiments/dance_rudiments.hpp';
const canonicalHeader = lf(fs.readFileSync(path.join(root, 'vendor/dancerudiments', header)));
check('CRLF header changes the raw blob but reconstructs the current upstream pin', () => {
  assert.equal(gitBlobHash(canonicalHeader), pin.files[header]);
  assert.notEqual(gitBlobHash(crlf(canonicalHeader)), pin.files[header]);
  assert.deepEqual(pinnedTextBytes(crlf(canonicalHeader), pin.files[header], header), canonicalHeader);
});
for (const [name, expected] of Object.entries(pin.files)) {
  const bytes = lf(fs.readFileSync(path.join(root, 'vendor/dancerudiments', name)));
  for (const [mode, candidate] of [['LF', bytes], ['CRLF', crlf(bytes)], ['mixed', Buffer.concat([crlf(bytes.subarray(0, bytes.indexOf(10) + 1)), bytes.subarray(bytes.indexOf(10) + 1)])]]) {
    check(`${name}: ${mode} reconstructs the unchanged pin`, () => {
      const original = Buffer.from(candidate);
      assert.deepEqual(pinnedTextBytes(candidate, expected, name), bytes);
      assert.deepEqual(candidate, original, 'input buffer is not modified');
    });
  }
}
const basic = Buffer.from('alpha\nbeta\n');
const expected = gitBlobHash(basic);
for (const [label, data] of [
  ['changed code', Buffer.from('Alpha\r\nbeta\r\n')],
  ['BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), basic])],
  ['lone CR', Buffer.from('alpha\rbeta\n')],
  ['doubled CR', Buffer.from('alpha\r\r\nbeta\n')],
  ['trailing space', Buffer.from('alpha \r\nbeta\r\n')],
  ['missing final LF', Buffer.from('alpha\r\nbeta')],
  ['extra final LF', Buffer.concat([basic, Buffer.from('\n')])],
  ['null', Buffer.concat([basic, Buffer.from([0])])],
  ['invalid UTF-8', Buffer.concat([basic, Buffer.from([255])])],
  ['empty file', Buffer.alloc(0)],
]) check(`${label} is NOT a permitted normalization`, () => {
  assert.throws(() => pinnedTextBytes(data, expected, label), /integrity mismatch/);
});
check('malformed pins and non-buffer input fail', () => {
  for (const bad of [null, '', 'a'.repeat(39), 'a'.repeat(41), 'x'.repeat(40)]) {
    assert.throws(() => pinnedTextBytes(basic, bad, 'test'), /malformed/);
  }
  assert.throws(() => pinnedTextBytes('alpha', expected, 'test'), TypeError);
});
check('an exact upstream CRLF blob is preserved', () => {
  const bytes = crlf(basic);
  assert.deepEqual(pinnedTextBytes(bytes, gitBlobHash(bytes), 'test'), bytes);
});

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dance-rudiments-eol-'));
const copied = [
  '.gitattributes', 'tools/verify-rudiments.cjs', 'tools/rudiments-source-integrity.cjs',
  'tests/rudiments-source.test.cjs', 'assets/dance-moves-rudiments.js',
  'assets/clay-stars-rudiments.js', 'assets/clay-stars-rudiments.css',
  'vendor/dancerudiments/UPSTREAM.json',
  ...Object.keys(pin.files).map(name => 'vendor/dancerudiments/' + name),
  'assets/vendor/dancerudiments/LICENSE', 'assets/vendor/dancerudiments/build-manifest.json',
  'assets/vendor/dancerudiments/dancerudiments-native.js',
];
const licencePath = 'assets/vendor/dancerudiments/LICENSE';
const vendorPaths = Object.keys(pin.files).map(name => 'vendor/dancerudiments/' + name);
function file(relative) { return path.join(temp, relative); }
function reset() {
  for (const name of copied) {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    const bytes = fs.readFileSync(path.join(root, name));
    fs.writeFileSync(file(name), (vendorPaths.includes(name) || name === licencePath) ? lf(bytes) : bytes);
  }
}
function convert(names) {
  for (const name of names) fs.writeFileSync(file(name), crlf(fs.readFileSync(file(name))));
}
function runNode(script, success, pattern) {
  const result = spawnSync(process.execPath, [file(script)], { cwd: temp, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  const text = result.stdout + result.stderr;
  if (success) assert.equal(result.status, 0, text);
  else assert.notEqual(result.status, 0, text);
  if (pattern) assert.match(text, pattern);
  return text;
}
function unchangedDuring(fn) {
  const before = Object.fromEntries(copied.map(name => [name, sha(fs.readFileSync(file(name)))]));
  fn();
  for (const name of copied) assert.equal(sha(fs.readFileSync(file(name))), before[name], `${name} was modified`);
}
try {
  for (const [label, converted] of [
    ['LF baseline', []],
    ['CRLF header only (reported failure)', [vendorPaths[0]]],
    ['all three vendored sources in CRLF', vendorPaths],
    ['both licence copies and C++ sources in CRLF', [...vendorPaths, licencePath]],
    ['published licence CRLF with source licence LF', [licencePath]],
  ]) check(`real native verifier and ownership test: ${label}`, () => {
    reset(); convert(converted);
    unchangedDuring(() => {
      runNode('tools/verify-rudiments.cjs', true, new RegExp(`${buildManifest.sampleCount} native positions`));
      runNode('tests/rudiments-source.test.cjs', true, /source ownership/);
    });
  });
  check('real verifier rejects a source edit even with CRLF', () => {
    reset(); convert(vendorPaths);
    const p = file(vendorPaths[0]); fs.appendFileSync(p, '// altered\r\n');
    unchangedDuring(() => runNode('tools/verify-rudiments.cjs', false, /not solely a checkout line-ending difference/));
  });
  check('identically corrupted licences do not satisfy equality-only checks', () => {
    reset();
    for (const p of ['vendor/dancerudiments/LICENSE', licencePath]) fs.appendFileSync(file(p), 'Altered licence\n');
    runNode('tools/verify-rudiments.cjs', false, /integrity mismatch/);
    runNode('tests/rudiments-source.test.cjs', false, /integrity mismatch/);
  });
  check('published licence corruption is rejected independently', () => {
    reset(); fs.appendFileSync(file(licencePath), 'Altered licence\n');
    runNode('tools/verify-rudiments.cjs', false, /assets\/vendor\/dancerudiments\/LICENSE/);
  });
  check('generated JS hash remains byte-exact, even for newline-only changes', () => {
    reset(); convert(['assets/vendor/dancerudiments/dancerudiments-native.js']);
    runNode('tools/verify-rudiments.cjs', false, /AssertionError/);
  });
  check('WASM corruption fails even with an updated JS wrapper hash', () => {
    reset();
    const runtimePath = file('assets/vendor/dancerudiments/dancerudiments-native.js');
    const source = fs.readFileSync(runtimePath, 'utf8');
    const match = source.match(/"wasmBase64":"([A-Za-z0-9+/=]+)"/);
    assert.ok(match);
    const binary = Buffer.from(match[1], 'base64'); binary[binary.length - 1] ^= 1;
    const changed = source.replace(match[1], binary.toString('base64'));
    fs.writeFileSync(runtimePath, changed);
    const manifestPath = file('assets/vendor/dancerudiments/build-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    manifest.runtimeSha256 = sha(Buffer.from(changed));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    runNode('tools/verify-rudiments.cjs', false, /AssertionError/);
  });
  check('Git autocrlf=true checkout keeps C++ and licence paths in LF', () => {
    reset();
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_ATTR_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: file('empty-git-config') };
    // A test launched inside a Git hook must not inherit its real index/worktree.
    for (const key of Object.keys(env)) {
      if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+|TEMPLATE_DIR)$/.test(key)) delete env[key];
    }
    fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
    function git(args) {
      const result = spawnSync('git', ['-C', temp, ...args], { env, encoding: 'utf8', timeout: 30000 });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result.stdout;
    }
    git(['init', '-q']); git(['config', 'core.autocrlf', 'true']);
    git(['config', 'core.safecrlf', 'false']);
    const names = [...vendorPaths, licencePath];
    git(['add', '--', '.gitattributes', ...names]);
    for (const name of names) fs.unlinkSync(file(name));
    git(['checkout', '--', ...names]);
    for (const name of names) {
      const bytes = fs.readFileSync(file(name));
      assert.equal(bytes.includes(Buffer.from('\r\n')), false, name);
      const key = name === licencePath ? 'LICENSE' : name.slice('vendor/dancerudiments/'.length);
      assert.equal(gitBlobHash(bytes), pin.files[key], name);
    }
  });
  check('Python builder uses the same strict pinned-text policy', () => {
    const result = spawnSync(process.env.PYTHON || 'python', ['-X', 'utf8', path.join(root, 'tests/test-rudiments-line-endings.py')], {
      cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stdout + result.stderr);
    console.log((result.stdout + result.stderr).trim());
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(`DanceRudiments line-ending integrity regression checks passed (${groups} groups).`);
