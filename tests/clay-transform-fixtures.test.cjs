'use strict';
// Exercises the real PHP entrypoint in a minimal relocated checkout. No WordPress,
// private release tree, generated qa/ candidate, media downloads or PHP extensions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || 'php';
const files = [
  'kieran-epk-device-orientation.php', 'dance-moves-rudiments.php',
  'tests/validate-clay-transform.php', 'tests/validate-clay-legacy-collision.php',
  'tests/helpers/clay-transform-fixture.php',
  'tests/fixtures/clay-transform/base.html',
  'tests/fixtures/clay-transform/expected.html',
  'tests/fixtures/clay-transform/manifest.json',
];
const baseFiles = new Map(files.map(file => [file, fs.readFileSync(path.join(repo, file))]));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dancemoves-clay-php-'));
const checkout = path.join(temporary, 'checkout with spaces');
const elsewhere = path.join(temporary, 'unrelated cwd');
fs.mkdirSync(elsewhere);
let checks = 0;
function prepare() {
  fs.rmSync(checkout, { recursive: true, force: true });
  for (const [file, bytes] of baseFiles) {
    const output = path.join(checkout, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes);
  }
}
function read(file) { return fs.readFileSync(path.join(checkout, file), 'utf8'); }
function write(file, text) { fs.writeFileSync(path.join(checkout, file), text); }
function replace(file, from, to) {
  const original = read(file);
  assert.ok(original.includes(from), `Mutation target missing: ${file}`);
  write(file, original.replace(from, to));
}
function execute(script, args = [], ini = []) {
  const result = spawnSync(php, [...ini, path.join(checkout, 'tests', script), ...args], {
    cwd: elsewhere, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024,
  });
  if (result.error) throw new Error(`Cannot run PHP contract (${php}): ${result.error.message}`);
  return { status: result.status, output: result.stdout + result.stderr };
}
function passed(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.output}`);
  assert.match(result.output, /unit validation: PASS \(\d+ checks\)/, label);
  assert.doesNotMatch(result.output, /(?:Warning|Fatal error|=FAIL)/, label);
}
function failed(result, pattern) {
  assert.notEqual(result.status, 0, `False pass:\n${result.output}`);
  assert.match(result.output, pattern);
}
function test(name, callback) {
  prepare(); callback(); checks++; console.log(`PASS ${name}`);
}
const transform = 'validate-clay-transform.php';
const legacy = 'validate-clay-legacy-collision.php';
const base = 'tests/fixtures/clay-transform/base.html';
const expected = 'tests/fixtures/clay-transform/expected.html';
const manifest = 'tests/fixtures/clay-transform/manifest.json';
const plugin = 'kieran-epk-device-orientation.php';
function changeFilter(from, to) {
  const source = read(plugin);
  const start = source.indexOf('function dance_moves_clay_stars_filter_content(');
  assert.ok(start > 0);
  const filter = source.slice(start);
  assert.ok(filter.includes(from), `Filter mutation target missing: ${from}`);
  write(plugin, source.slice(0, start) + filter.replace(from, to));
}
try {
  test('transform loads the full plugin from an unrelated working directory', () => passed(execute(transform), 'transform'));
  test('legacy collision loads the full plugin without a release workspace', () => passed(execute(legacy), 'legacy'));
  test('both PHP commands leave every input unchanged and create no QA files', () => {
    passed(execute(transform), 'transform'); passed(execute(legacy), 'legacy');
    for (const [file, bytes] of baseFiles) assert.deepEqual(fs.readFileSync(path.join(checkout, file)), bytes, file);
    assert.equal(fs.existsSync(path.join(checkout, 'qa')), false);
  });
  for (const script of [transform, legacy]) {
    test(`${script} runs with zend.assertions disabled`, () => passed(execute(script, [], ['-d', 'zend.assertions=-1']), script));
    test(`${script} accepts CRLF checkout copies`, () => {
      for (const [file, bytes] of baseFiles) write(file, bytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
      passed(execute(script), script);
    });
    test(`${script} rejects a missing base fixture rather than skipping`, () => {
      fs.unlinkSync(path.join(checkout, base));
      failed(execute(script), /missing or unreadable/);
    });
    test(`${script} rejects a missing expected fixture rather than regenerating it`, () => {
      fs.unlinkSync(path.join(checkout, expected));
      failed(execute(script), /missing or unreadable/);
    });
  }
  for (const file of [base, expected]) {
    test(`changed ${path.basename(file)} still fails the pinned hash`, () => {
      write(file, read(file) + '<p>Unreviewed edit</p>\n');
      failed(execute(transform), /fixture hash mismatch/);
    });
  }
  for (const [label, bytes] of [
    ['UTF-8 BOM', Buffer.from([0xef, 0xbb, 0xbf])],
    ['invalid UTF-8', Buffer.from([0xff])], ['null byte', Buffer.from([0])],
    ['replacement character', Buffer.from([0xef, 0xbf, 0xbd])],
  ]) {
    test(`${label} is not silently normalized`, () => {
      write(base, Buffer.concat([bytes, baseFiles.get(base)]));
      failed(execute(transform), /fixture hash mismatch|strict UTF-8/);
    });
  }
  test('invalid manifest fails explicitly', () => {
    write(manifest, '{'); failed(execute(transform), /validation error/);
  });
  test('manifest cannot claim synthetic fixtures are live evidence', () => {
    replace(manifest, 'synthetic-unit-only', 'approved-live'); failed(execute(transform), /Invalid Clay fixture manifest/);
  });
  test('missing pinned digest fails explicitly', () => {
    const value = JSON.parse(read(manifest)); delete value.files['base.html'];
    write(manifest, JSON.stringify(value)); failed(execute(transform), /Invalid Clay fixture manifest/);
  });
  test('an incorrect re-pinned golden file still fails comparison with production', () => {
    const crypto = require('node:crypto');
    replace(expected, 'class="ks-lens-flare"', 'class="incorrect-layer"');
    const value = JSON.parse(read(manifest));
    value.files['expected.html'] = crypto.createHash('sha256').update(read(expected)).digest('hex');
    write(manifest, JSON.stringify(value));
    failed(execute(transform), /transform_matches_independent_expected_fixture=FAIL/);
  });
  for (const [label, from, to] of [
    ['layer insertion', 'class="ks-lens-flare"', 'class="incorrect-layer"'],
    ['script removal', '.*?</script>#s', 'DOES_NOT_MATCH</script>#s'],
    ['page guard', '!dance_moves_clay_stars_is_target() || ', ''],
    ['admin guard', 'is_admin() || ', ''],
    ['loop guard', '!in_the_loop() || ', ''],
    ['main-query guard', ' || !is_main_query()', ''],
  ]) {
    test(`broken ${label} is rejected, even without PHP assertions`, () => {
      changeFilter(from, to); failed(execute(transform, [], ['-d', 'zend.assertions=-1']), /=FAIL/);
    });
  }
  test('broken legacy coexistence guard is rejected', () => {
    changeFilter("defined('KS_CLAY_STARS_EFFECTS_VERSION') || ", '');
    failed(execute(legacy), /legacy_plugin_suppresses_shared_transform=FAIL/);
  });
  test('removed WordPress content-filter registration is rejected', () => {
    changeFilter("add_filter('the_content', 'dance_moves_clay_stars_filter_content', 20);", '');
    failed(execute(transform), /content_filter_registered_at_priority_20=FAIL/);
  });
  test('one supplied release path is an error, not a skipped comparison', () => {
    failed(execute(transform, ['--base', path.join(checkout, base)]), /Both --base and --candidate/);
  });
  test('misspelled release option is rejected', () => {
    failed(execute(transform, ['--canddate', 'missing.html']), /Usage:/);
  });
  test('missing supplied release files fail explicitly', () => {
    failed(execute(transform, ['--base', 'absent.html', '--candidate', 'absent-too.html']), /missing or unreadable/);
  });
  test('network paths cannot become external test dependencies', () => {
    failed(execute(transform, ['--base', 'https://example.invalid/base.html', '--candidate', 'x.html']), /Required local/);
  });
  test('unit fixtures cannot be labelled supplied approved release evidence', () => {
    failed(execute(transform, ['--base', path.join(checkout, base), '--candidate', path.join(checkout, expected)]), /must not be the synthetic unit fixtures/);
  });
  test('explicit extra comparison succeeds or fails on supplied bytes, never regeneration', () => {
    // Synthetic CLI regression data ONLY; this does not verify a real approved page.
    const header = /<!-- Synthetic DanceMoves unit fixture[^\n]*\n/;
    const a = path.join(temporary, 'supplied-base.html');
    const b = path.join(temporary, 'supplied-expected.html');
    fs.writeFileSync(a, read(base).replace(header, ''));
    fs.writeFileSync(b, read(expected).replace(header, ''));
    const args = ['--base', a, '--candidate', b];
    const result = execute(transform, args);
    passed(result, 'supplied pair');
    assert.match(result.output, /transform_matches_supplied_approved_candidate_dom=PASS/);
    fs.appendFileSync(b, '<p>Mismatch</p>\n');
    failed(execute(transform, args), /transform_matches_supplied_approved_candidate_dom=FAIL/);
  });
  console.log(`Clay/Stars relocatable PHP fixture regressions passed (${checks} groups).`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
