import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function check(pluginUri, authorUri) {
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dancemoves-release-metadata-'));
  try {
    fs.mkdirSync(path.join(fixture,'tools'));
    fs.copyFileSync('tools/check-shared-release.mjs',path.join(fixture,'tools/check-shared-release.mjs'));
    fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'fixture',version:'1.2.3'}));
    fs.writeFileSync(path.join(fixture,'kieran-epk-device-orientation.php'),`<?php\n/**\n * Version: 1.2.3\n${pluginUri?` * Plugin URI: ${pluginUri}\n`:''}${authorUri?` * Author URI: ${authorUri}\n`:''} */\ndefine('DANCE_MOVES_VERSION', '1.2.3');\n`);
    return spawnSync(process.execPath,[path.join(fixture,'tools/check-shared-release.mjs')],{encoding:'utf8',env:{...process.env,TAG_NAME:'v1.2.3'}});
  } finally { fs.rmSync(fixture,{recursive:true,force:true}); }
}
test('distinct WordPress plugin and author pages pass release validation',()=>{
  const result=check('https://example.org/plugin/','https://example.org/');
  assert.equal(result.status,0,result.stderr);
});
test('duplicate WordPress pages fail before release with a specific error',()=>{
  for(const author of ['https://example.org/plugin/','https://example.org/plugin']) {
    const result=check('https://example.org/plugin/',author);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Plugin URI and Author URI must identify different pages/);
  }
});
test('optional URI header remains valid',()=>{
  assert.equal(check('https://example.org/plugin/',null).status,0);
});
