import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const homepage = 'https://kieransimkin.co.uk/my-songs/';

test('all distributable package metadata uses the My Songs homepage', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.homepage, homepage);
  const php = read('kieran-epk-device-orientation.php');
  assert.match(php, /Plugin URI:\s*https:\/\/kieransimkin\.co\.uk\/my-songs\//);
  assert.match(read('tools/package-wordpress.py'), /'homepage':pkg\.get\('homepage',''\)/);
  assert.match(read('tools/package-web.py'), /'homepage':homepage/);
  const build = read('tools/build-shared.mjs');
  assert.match(build, /homepage:packageInfo\.homepage/);
});

test('npm release job is OIDC-only', () => {
  const workflow = read('.github/workflows/release.yml');
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /NPM_BOOTSTRAP_TOKEN/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/);
});

test('GitHub release publication can resume drafts and uploads exact artifacts', () => {
  const publisher = read('tools/publish-github.mjs');
  assert.match(publisher, /\/releases\?per_page=100/);
  assert.match(publisher, /draft:true/);
  assert.match(publisher, /release\.upload_url/);
  assert.match(publisher, /Content-Type':'application\/octet-stream'/);
  assert.match(publisher, /Existing GitHub asset differs/);
  assert.match(publisher, /method:'PATCH'/);
  assert.match(publisher, /make_latest/);
  assert.doesNotMatch(publisher, /release','upload/);
  assert.doesNotMatch(publisher, /--clobber/);
});


test('release artifacts have explicit distribution names', () => {
  const prepare = read('tools/prepare-release.mjs');
  const verify = read('tools/verify-release-output.mjs');
  for (const token of ['DanceMoves-npm-', 'DanceMoves-wordpress-', 'DanceMoves-browser-', 'SHA256SUMS.txt']) {
    assert.ok(prepare.includes(token), token);
    assert.ok(verify.includes(token), token);
  }
  const publisher = read('tools/publish-github.mjs');
  assert.match(publisher, /WordPress plugin/);
  assert.match(publisher, /Browser package/);
  assert.match(publisher, /npm package/);
  assert.match(publisher, /label=/);
});
