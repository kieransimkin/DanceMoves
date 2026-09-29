/** Offline execution of the actual publisher: no npm process or network access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source = fs.readFileSync(new URL('../../tools/publish-npm.mjs', import.meta.url), 'utf8');
const payload = Buffer.from('test-only archive bytes, not a publishable package');
const integrity = 'sha512-' + createHash('sha512').update(payload).digest('base64');
const published = {dist: {integrity}};

async function execute(options = {}) {
  const calls = [];
  const requests = [];
  const version = options.version ?? '3.0.0';
  const files = options.files ?? [`kieransimkin-dancemoves-${version}.tgz`];
  const responses = [...(options.responses ?? [404, published])];
  const input = (options.source ?? source).replace(/^import[^\n]*;\r?\n/gm, '');
  // Remove only built-in import declarations; keep all executable publisher code.
  assert.doesNotMatch(input, /^import\b/m);
  const context = {
    fs: {
      readdirSync(directory) { assert.equal(directory, 'release-output'); return files; },
      readFileSync(file) {
        if (file === 'package.json') return JSON.stringify({name: '@kieransimkin/dancemoves', version});
        assert.equal(path.posix.normalize(file), 'release-output/' + files[0]);
        return payload;
      }
    },
    createHash,
    spawnSync(command, args, settings) {
      calls.push({command, args: Array.from(args), settings});
      assert.match(args[1], /^(?:\.\/|\/|[A-Za-z]:[\\/])/, 'npm must receive an explicit LOCAL tarball path');
      return options.spawnResult ?? {status: 0};
    },
    fetch: async (url) => {
      requests.push(url);
      assert.equal(url, 'https://registry.npmjs.org/%40kieransimkin%2Fdancemoves/' + version);
      assert.ok(responses.length, 'unexpected extra registry request');
      const response = responses.shift();
      return typeof response === 'number'
        ? {status: response, ok: false}
        : {status: 200, ok: true, json: async () => response};
    },
    AbortSignal: {timeout() { return undefined; }},
    process: {platform: options.platform ?? 'linux'},
    console: {log() {}},
    setTimeout(callback) { callback(); }
  };
  let error;
  try {
    await new vm.Script(`(async () => {\n${input}\n})()`, {filename: 'publisher-under-test.mjs'})
      .runInNewContext(context, {timeout: 1000});
  } catch (caught) { error = caught; }
  return {calls, requests, error};
}

test('publisher uses the explicit local tarball and preserves publication flags', async () => {
  const result = await execute();
  assert.ifError(result.error);
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.calls[0].args, ['publish', './release-output/kieransimkin-dancemoves-3.0.0.tgz',
    '--access', 'public', '--provenance', '--ignore-scripts', '--tag', 'latest']);
  assert.equal(result.requests.length, 2);
});

test('Windows invocation still supplies a local tarball', async () => {
  const result = await execute({platform: 'win32'});
  assert.ifError(result.error);
  assert.equal(result.calls[0].command, 'npm.cmd');
  assert.equal(result.calls[0].settings.shell, true);
});

test('prereleases publish under next', async () => {
  const result = await execute({version: '3.0.1-rc.1'});
  assert.ifError(result.error);
  assert.equal(result.calls[0].args.at(-1), 'next');
});

test('identical existing version is a no-op', async () => {
  const result = await execute({responses: [published]});
  assert.ifError(result.error);
  assert.equal(result.calls.length, 0);
});

test('different existing bytes still prevent publication', async () => {
  const result = await execute({responses: [{dist: {integrity: 'sha512-different'}}]});
  assert.match(result.error?.message ?? '', /DIFFERENT bytes/);
  assert.equal(result.calls.length, 0);
});

test('registry failure is not mistaken for an absent package', async () => {
  const result = await execute({responses: [503]});
  assert.match(result.error?.message ?? '', /Registry lookup failed \(503\)/);
  assert.equal(result.calls.length, 0);
});

test('missing or ambiguous tarballs fail before registry access', async () => {
  for (const files of [[], ['one.tgz', 'two.tgz']]) {
    const result = await execute({files});
    assert.match(result.error?.message ?? '', /exactly one tested npm tarball/);
    assert.equal(result.requests.length, 0);
    assert.equal(result.calls.length, 0);
  }
});

test('npm nonzero exit is reported without diagnosing an authentication failure', async () => {
  const result = await execute({spawnResult: {status: 128}, responses: [404]});
  assert.match(result.error?.message ?? '', /exit 128/);
  assert.equal(result.requests.length, 1);
});

test('failure to start npm preserves the original process error', async () => {
  const error = new Error('spawn npm ENOENT');
  const result = await execute({spawnResult: {status: null, error}, responses: [404]});
  assert.equal(result.error, error);
});

test('post-publication archive-integrity verification remains mandatory', async () => {
  const result = await execute({responses: [404, {dist: {integrity: 'sha512-wrong'}}]});
  assert.match(result.error?.message ?? '', /integrity could not be confirmed/);
});

test('removing the local path prefix recreates and detects the regression', async () => {
  const old = source.replace("const file='./release-output/'", "const file='release-output/'");
  assert.notEqual(old, source);
  const result = await execute({source: old});
  assert.match(result.error?.message ?? '', /explicit LOCAL tarball path/);
});
