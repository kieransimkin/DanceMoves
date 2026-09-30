const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { assertPluginVersion } = require('./helpers/plugin-version.cjs');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'assets', 'dance-moves-effects.js'), 'utf8');
const php = fs.readFileSync(path.join(root, 'kieran-epk-device-orientation.php'), 'utf8');

new vm.Script(js, { filename: 'dance-moves-effects.js' });
for (const primitive of ['pointer', 'playbackPulse', 'cueClass', 'cueTimeline', 'lyricStage', 'cooperativeArena', 'quality']) {
  assert.match(js, new RegExp('(?:function ' + primitive + '\\b|' + primitive + ': ' + primitive + '\\b)'));
}
assert.match(js, /dance-moves-effects-ready/);
assert.match(js, /ResizeObserver/);
assert.match(js, /--dance-moves-x/);
assert.match(js, /--dance-moves-y/);
assert.match(js, /motion\.durationMilliseconds\(ticks\)/);
assert.match(js, /audio\.currentTime, 0\) \/ rate/);
assert.match(js, /motion\.onCue\(cue, fire/);
assert.match(js, /resume-after-seek/);
assert.match(js, /resume-after-visible/);
assert.match(js, /manual-restore/);
assert.match(js, /sustained-low-fps/);
assert.match(js, /sustained-recovery/);
assert.match(js, /preference-restored/);
assert.match(js, /prefers-reduced-motion: reduce/);
assert.match(js, /forced-colors: active/);
assert.doesNotMatch(js, /style\.(?:top|right|bottom|left|width|height)\s*=/);
assert.doesNotMatch(js, /(?:backgroundColor|filter|mixBlendMode)\s*=/);
assert.doesNotMatch(js, /paper-dreams|arcadians|amnesty|santa|clay-stars/i);
assert.doesNotMatch(js, /\b(?:86|100|116|145)\b/);
assert.match(php, /'dance-moves-effects'/);
assert.match(php, /'dance-moves-effects',\s*false,/);
assert.match(php, /array\('dance-moves-core', 'dance-moves-effects'\)/);
assertPluginVersion(php);

console.log('DanceMoves reusable effect primitive contracts passed.');
