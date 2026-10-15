'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const result = spawnSync('php', [path.join(__dirname, 'wordpress-capture-auth.php')], {encoding: 'utf8', cwd: root});
if (result.error) throw result.error;
assert.equal(result.status, 0, result.stdout + result.stderr);
process.stdout.write(result.stdout);
for (const file of ['kieran-epk-device-orientation.php', 'dance-moves-rudiments.php']) {
  const php = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [, name] of php.matchAll(/\bfunction\s+(\w+)\s*\(/g)) {
    assert.match(name, /^(dance_moves_|ks_epk_)/, `${file}: global function ${name} is project-prefixed`);
  }
  for (const [, name] of php.matchAll(/\bdefine\(\s*['"]([^'"]+)['"]/g)) {
    assert.match(name, /^(DANCE_MOVES_|KS_EPK_)/, `${file}: constant ${name} is project-prefixed`);
  }
}
console.log('WordPress production PHP declaration prefixes verified');
