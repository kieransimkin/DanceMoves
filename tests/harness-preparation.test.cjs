'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const prep = require('../tools/prepare-test-harnesses.cjs');

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const repo = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(repo, 'tests/fixtures/california-screamin-unit.html'), 'utf8');
const californiaTiming = { bpm: 110, masterDurationMilliseconds: 212007.46 };
const clayTiming = { bpm: 90, masterDurationMilliseconds: 359523.560091 };
const california = prep.renderCandidate(fixture, 'california-screamin', '2.9.0', californiaTiming);
// Deliberately small DOM for testing the BUILDER, not a substituted canonical snapshot.
const clayInput = `<!doctype html><html><head><title>Made from the clay and the stars (Anunnaki) - builder unit test</title>
<link id="dance-moves-core-css" href="https://example.invalid/wp-content/plugins/kieran-epk-device-orientation/assets/dance-moves-core.css">
<script id="dance-moves-core-js-extra">var danceMovesConfig={version:'old'};</script>
<script id="theme-owned">window.keepTheme=true;</script></head><body>
<section class="ks-epk ks-clay-stars-v2"><audio></audio>
${Array.from({ length: 5 }, (_, i) => `<button data-time="${i}">Chapter</button>`).join('')}
<span class="ks-warm-bloom"></span><span class="ks-lens-flare"></span><span class="ks-specular-sweep"></span>
</section><script src="https://example.invalid/wp-content/plugins/kieran-epk-device-orientation/assets/dance-moves-core.js"></script>
<script src="https://example.invalid/wp-content/plugins/kieran-made-from-clay-stars-epk-effects/assets/old.js"></script></body></html>`;
const clay = prep.renderCandidate(clayInput, 'clay-stars', '2.9.0', clayTiming);
check('unit-only identity is explicit', () => {
  assert.ok(california.includes(prep.UNIT_MARKER)); assert.ok(clay.includes(prep.UNIT_MARKER));
  assert.match(fixture, /synthetic/); assert.match(fixture, /not the published/);
});
check('current version replaces the old preview cache identity', () => {
  assert.match(clay, /version":"2\.9\.0"/); assert.match(california, /ver=2\.9\.0-local/);
  assert.doesNotMatch(clay, /version:'old'|2\.3\.5-local/);
});
check('clock values remain release-specific', () => {
  assert.match(clay, /"bpm":90/); assert.match(clay, /"masterDurationMilliseconds":359523.560091/);
  assert.match(california, /"bpm":110/);
});
check('probe and shared runtime precede consumers', () => {
  for (const html of [california, clay]) {
    assert.ok(html.indexOf('harness-probe.js') < html.indexOf('dance-moves-core.js'));
    assert.ok(html.indexOf('dance-moves-core.js') < html.indexOf('dance-moves-effects.js'));
    assert.ok(html.indexOf('dance-moves-effects.js') < html.indexOf('dance-moves-catalogue-timing.js'));
    assert.ok(html.indexOf('dancerudiments-native.js') < html.indexOf('dance-moves-rudiments.js'));
  }
  assert.ok(clay.indexOf('clay-stars-effects.js') < clay.indexOf('clay-stars-rudiments.js'));
  assert.ok(clay.indexOf('clay-stars-rudiments.js') < clay.indexOf('effect-under-test-adapter.js'));
});
check('remote and legacy plugin copies are removed, page code stays', () => {
  assert.doesNotMatch(clay, /wp-content\/plugins\//); assert.match(clay, /window.keepTheme=true/);
});
check('exactly one copy of every production script', () => {
  for (const html of [california, clay]) {
    const sources = Array.from(html.matchAll(/<script src="([^"]+)"/g), m => m[1]);
    assert.equal(new Set(sources).size, sources.length);
  }
});
check('generated inline configuration parses', () => {
  for (const html of [california, clay]) for (const m of html.matchAll(/<script\b(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
});
check('duplicate roots are rejected', () => assert.throws(() => prep.renderCandidate(fixture.replace('</body>', '<div id="cs-epk"></div></body>'), 'california-screamin', '2.9.0', californiaTiming), /release root/));
check('wrong release is rejected', () => assert.throws(() => prep.renderCandidate(fixture.replace('data-release="california-screamin"', 'data-release="wrong"'), 'california-screamin', '2.9.0', californiaTiming), /wrong release/));
check('wrong Clay title is rejected', () => assert.throws(() => prep.renderCandidate(clayInput.replace('Made from the clay and the stars', 'Another EPK'), 'clay-stars', '2.9.0', clayTiming), /wrong title/));
check('missing Clay chapter is rejected', () => assert.throws(() => prep.renderCandidate(clayInput.replace('<button data-time="0">Chapter</button>', ''), 'clay-stars', '2.9.0', clayTiming), /chapter/));
check('signed-in snapshots are rejected', () => assert.throws(() => prep.renderCandidate(fixture.replace('</body>', '<div id="wpadminbar"></div></body>'), 'california-screamin', '2.9.0', californiaTiming), /signed out/));
check('malformed document is rejected', () => assert.throws(() => prep.renderCandidate(fixture.replace('</head>', ''), 'california-screamin', '2.9.0', californiaTiming), /closing head/));
check('bad timing and version are rejected', () => {
  assert.throws(() => prep.renderCandidate(fixture, 'california-screamin', 'bad', californiaTiming), /version/);
  assert.throws(() => prep.renderCandidate(fixture, 'california-screamin', '2.9.0', { ...californiaTiming, bpm: NaN }), /timing/);
});
check('rendering is deterministic and LF-only', () => {
  assert.equal(california, prep.renderCandidate(fixture.replace(/\n/g, '\r\n'), 'california-screamin', '2.9.0', californiaTiming));
});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dancemoves-test-worktree-'));
function put(relative, data) { const p = path.join(temp, relative); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
try {
  put('kieran-epk-device-orientation.php', "<?php\n// Version: 2.9.0\ndefine('DANCE_MOVES_VERSION', '2.9.0');\n");
  put('tests/fixtures/california-screamin-unit.html', fixture);
  put('tests/harness/california-screamin/california-screamin.json', JSON.stringify({ release: californiaTiming }));
  put('tests/harness/clay-stars/clay-stars.json', JSON.stringify({ release: clayTiming }));
  // Test-only empty assets exercise path/existence checks, not runtime correctness.
  for (const html of [california, clay]) for (const m of html.matchAll(/(?:src|href)="\.\.\/([^"?]+)(?:\?[^" ]*)?"/g)) put(m[1], '/* builder test asset */\n');
  check('direct tests work without a prior generation command', () => {
    const result = prep.readUnitCandidate(temp, 'california-screamin');
    assert.equal(result, california); assert.ok(fs.existsSync(path.join(temp, prep.OUTPUTS['california-screamin'])));
  });
  check('existing full-page QA candidate is not overwritten', () => {
    put('qa/california-screamin-harness-candidate.html', 'retain real-page evidence');
    prep.readUnitCandidate(temp, 'california-screamin');
    assert.equal(fs.readFileSync(path.join(temp, 'qa/california-screamin-harness-candidate.html'), 'utf8'), 'retain real-page evidence');
  });
  check('repeat preparation does not rewrite unchanged output', () => {
    const p = path.join(temp, prep.OUTPUTS['california-screamin']); const old = new Date('2000-01-01T00:00:00Z');
    fs.utimesSync(p, old, old); prep.readUnitCandidate(temp, 'california-screamin');
    assert.equal(fs.statSync(p).mtimeMs, old.getTime());
  });
  check('stale output is rebuilt', () => {
    put(prep.OUTPUTS['california-screamin'], 'stale'); prep.readUnitCandidate(temp, 'california-screamin');
    assert.equal(fs.readFileSync(path.join(temp, prep.OUTPUTS['california-screamin']), 'utf8'), california);
  });
  check('missing input fails and does not overwrite stale/canonical output', () => {
    fs.unlinkSync(path.join(temp, prep.OUTPUTS['california-screamin']));
    assert.throws(() => prep.prepareHarnesses(temp), /Tracked Clay snapshot missing/);
    assert.equal(fs.existsSync(path.join(temp, prep.OUTPUTS['california-screamin'])), false);
  });
  check('wrong snapshot checksum is a hard failure', () => {
    put(prep.CLAY_SOURCE, clayInput);
    assert.throws(() => prep.prepareHarnesses(temp), /snapshot hash mismatch/);
  });
  check('missing runtime asset is a hard failure', () => {
    fs.unlinkSync(path.join(temp, 'assets/dance-moves-effects.js'));
    assert.throws(() => prep.readUnitCandidate(temp, 'california-screamin'), /Required harness asset/);
  });
  check('header/constant mismatch is a hard failure', () => {
    put('kieran-epk-device-orientation.php', "// Version: 2.9.0\ndefine('DANCE_MOVES_VERSION','2.8.0');");
    assert.throws(() => prep.versionFor(temp), /must agree/);
  });
  check('unknown harness is rejected', () => assert.throws(() => prep.readUnitCandidate(temp, '../unknown'), /Unknown harness/));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
// The PowerShell command delegates to the cross-platform Node coordinator.
// Execute that coordinator with inert child processes and a virtual test list:
// this verifies ordering without recursively running the suite or writing files.
const coordinator = fs.readFileSync(path.join(repo, 'tools/test-legacy.cjs'), 'utf8');
function coordinatorPlan(source, failPreparation = false) {
  const calls = [];
  const fakeFs = {
    readdirSync(directory, options) {
      if (directory === repo && options?.withFileTypes) return [];
      if (directory === 'tests') return ['b.test.cjs', 'README.md', 'a.test.cjs'];
      throw new Error(`Unexpected coordinator directory: ${directory}`);
    }
  };
  const childProcess = {
    spawnSync(command, args, options) {
      calls.push({ command, args: [...args], cwd: options.cwd });
      return { status: failPreparation && args[0] === 'tools/prepare-test-harnesses.cjs' ? 1 : 0 };
    }
  };
  let error = null;
  try {
    vm.runInNewContext(source, {
      __dirname: path.join(repo, 'tools'),
      process: { execPath: process.execPath, chdir(directory) { assert.equal(directory, repo); } },
      console: { log() {} },
      TextDecoder,
      require(name) {
        if (name === 'node:fs') return fakeFs;
        if (name === 'node:path') return path;
        if (name === 'node:child_process') return childProcess;
        throw new Error(`Unexpected coordinator import: ${name}`);
      }
    }, { filename: 'test-legacy.cjs', timeout: 1000 });
  } catch (caught) { error = caught; }
  return { calls, error };
}
function assertPreparationOrder(plan) {
  assert.ifError(plan.error);
  const prepares = plan.calls.filter(call => call.args[0] === 'tools/prepare-test-harnesses.cjs');
  assert.equal(prepares.length, 1, 'prepare exactly once');
  const tests = plan.calls.filter(call => /^tests\/.*\.test\.cjs$/.test(call.args[0]));
  assert.deepEqual(tests.map(call => call.args[0]), ['tests/a.test.cjs', 'tests/b.test.cjs']);
  for (const call of tests) {
    assert.ok(plan.calls.indexOf(prepares[0]) < plan.calls.indexOf(call), 'prepare before every adapter test');
  }
}
check('PowerShell and npm delegate to the canonical Node coordinator', () => {
  const s = fs.readFileSync(path.join(repo, 'tools/validate.ps1'), 'utf8');
  assert.match(s, /& npm run test:legacy\s+if \(\$LASTEXITCODE -ne 0\) \{ throw /);
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['test:legacy'], 'node tools/test-legacy.cjs');
});
check('Node coordinator prepares inputs before every sorted test invocation', () => {
  assertPreparationOrder(coordinatorPlan(coordinator));
});
check('failed preparation stops the coordinator before any adapter test', () => {
  const plan = coordinatorPlan(coordinator, true);
  assert.ok(plan.error && /Validation failed.*prepare-test-harnesses\.cjs/.test(plan.error.message));
  assert.equal(plan.calls.filter(call => /^tests\//.test(call.args[0])).length, 0);
});
check('each scaffold audit receives its corresponding unit-only candidate', () => {
  const plan = coordinatorPlan(coordinator);
  assert.ifError(plan.error);
  for (const name of ['clay-stars', 'california-screamin']) {
    const audits = plan.calls.filter(call => call.args.includes(`tests/harness/${name}`));
    assert.equal(audits.length, 1);
    const args = audits[0].args;
    assert.equal(args[args.indexOf('--candidate-file') + 1], `qa/${name}-unit-candidate.html`);
    assert.equal(args[args.indexOf('--mode') + 1], 'scaffold');
    assert.equal(args[args.indexOf('--manifest-file') + 1], `tests/harness/${name}/${name}.json`);
    assert.equal(args[args.indexOf('--shared-root') + 1], 'tests/harness/plugin-core');
  }
});
check('ordering assertion rejects removed or late preparation', () => {
  const preparation = "run(process.execPath,['tools/prepare-test-harnesses.cjs']);";
  assert.equal(coordinator.split(preparation).length, 2, 'one actual preparation call to mutate');
  const missing = coordinator.replace(preparation, '');
  assert.throws(() => assertPreparationOrder(coordinatorPlan(missing)), /prepare exactly once/);
  assert.throws(() => assertPreparationOrder(coordinatorPlan(missing + '\n' + preparation)), /prepare before/);
});
check('fixture preparation retains its offline contract', () => {
  assert.doesNotMatch(fs.readFileSync(path.join(repo, 'tools/prepare-test-harnesses.cjs'), 'utf8'), /Z:\\|https?:\/\//);
});
console.log(`${checks} harness preparation regression groups passed. No browser/physical-device result is implied.`);
