import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
test('WordPress has one imported frontend and an independently packaged archive',()=>{
 const build=read('tools/build-shared.mjs'),php=read('dance-moves-rudiments.php');
 assert.match(read('src/wordpress.mjs'),/import \{createDanceMoves\} from '\.\/index\.mjs'/);
 assert.match(build,/Exactly the library build/);assert.match(build,/assets\/dance-moves-admin\.js/);
 assert.match(php,/wp_enqueue_script\('dance-moves-rudiments', false/);
 assert.match(read('tools/package-wordpress.py'),/WordPress frontend differs from the shared library artifact/);
});
test('publish jobs use the build commit, protected npm environment and tested tarball',()=>{
 const workflow=read('.github/workflows/release.yml').replaceAll('\r\n','\n');assert.match(workflow,/tags: \['v\*'\]/);
 for(const name of ['npm','github','wordpress-org']){
  const block=workflow.split(`\n  ${name}:\n`)[1]?.split(/\n  [a-z][a-z-]*:\n/)[0];assert.ok(block,`Missing ${name} publisher`);
  assert.match(block,/ref: \$\{\{ needs\.build\.outputs\.commit \}\}/,`${name} must use the tested build commit`);
  assert.match(block,/node tools\/verify-release-output\.mjs/,`${name} must verify the tested distributions`);
 }
 const directory=workflow.split('\n  wordpress-org:\n')[1];
 assert.match(directory,/needs: \[build, github\]/);assert.match(directory,/if: vars\.WPORG_PLUGIN_APPROVED == 'true'/);
 assert.match(directory,/WPORG_SLUG: \$\{\{ vars\.WPORG_PLUGIN_SLUG \}\}/);assert.match(directory,/BUILD_DIR: wordpress-build\/kieran-epk-device-orientation/);
 assert.match(directory,/VERSION: \$\{\{ steps\.directory\.outputs\.version \}\}/);assert.match(directory,/version=\$\{TAG_NAME#v\}/);
 for(const text of ["REQUIRE_LOCK: '1'",'environment: npm','id-token: write','npm run test:browser','npm run test:next:smoke','node tools/verify-release-output.mjs'])assert.ok(workflow.includes(text),text);
 assert.match(read('tools/publish-npm.mjs'),/--provenance/);assert.match(read('tools/publish-npm.mjs'),/\?'next':'latest'/);
 assert.match(read('tools/publish-npm.mjs'),/DIFFERENT bytes/);assert.doesNotMatch(read('tools/publish-github.mjs'),/--clobber/);
});
test('React/Next demo source imports the actual package and canonical Arcadians media',()=>{
 assert.match(read('examples/react/App.jsx'),/from '@kieransimkin\/dancemoves\/react'/);
 assert.match(read('examples/next/app/Demo.jsx'),/react\/App\.jsx/);
 assert.match(read('tools/prepare-app-demos.py'),/prepare-wordpress-examples/);
 assert.match(read('examples/wordpress/shared/boot.mjs'),/import\('\/lib\/index\.mjs'\)/);
});
test('server handlers are not dependencies of the browser entry',()=>{
 assert.doesNotMatch(read('src/index.mjs'),/from ['"].*server/);assert.doesNotMatch(read('src/react.mjs'),/from ['"].*server/);
 const pkg=JSON.parse(read('package.json'));assert.equal(pkg.exports['./server'].import,'./lib/server.mjs');assert.ok(pkg.peerDependenciesMeta.react.optional);
});
test('production WordPress build contains directory metadata and keeps source guides below docs',()=>{
 const root='.build/wordpress/';
 const pkg=JSON.parse(read('package.json'));
 assert.match(read(root+'readme.txt'),new RegExp('Stable tag: '+pkg.version.replaceAll('.','\\.')));
 assert.ok(fs.existsSync(root+'docs/RUDIMENTS-API.md'));
 assert.equal(fs.existsSync(root+'RUDIMENTS-API.md'),false);
 assert.equal(fs.existsSync(root+'tests'),false);
 assert.match(read(root+'kieran-epk-device-orientation.php'),/Text Domain: dancemoves/);
});
