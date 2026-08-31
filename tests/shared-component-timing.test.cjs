const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const php = fs.readFileSync(path.join(root, "kieran-epk-device-orientation.php"), "utf8");
const core = fs.readFileSync(path.join(root, "assets/dance-moves-core.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/dance-moves-core.css"), "utf8");

const sharedIds = [
  250, 254, 260, 262, 264, 266, 272, 274, 278, 280,
  282, 284, 286, 288, 290, 292, 294, 296, 300, 302,
  304, 306, 308, 312, 314, 316, 318, 320, 322,
];

for (const id of sharedIds) assert.match(php, new RegExp(`\\b${id}\\b`), `shared-control page ${id} is configured`);
assert.match(php, /sharedControlTicks'\s*=>[\s\S]*\?\s*8\s*:\s*0/);
assert.match(php, /130\s*===\s*\(int\)\s*\$page_id[\s\S]*return 5/);
assert.match(php, /243\s*===\s*\(int\)\s*\$page_id[\s\S]*return 7/);
assert.match(php, /return 6/);

for (const ticks of [5, 6, 7, 8]) {
  assert.match(core, new RegExp(`\\b${ticks}\\b`), `${ticks}-tick CSS property is generated`);
}
assert.match(core, /--dance-moves-shared-control-duration/);
assert.match(core, /--dance-moves-lyric-disclosure-duration/);
assert.match(core, /danceMovesSharedControls = "true"/);
assert.match(core, /registerAnimationScope\(root, sharedSelectors\)/);

assert.match(css, /data-dance-moves-shared-controls="true"/);
assert.match(css, /transition-duration:\s*var\(--dance-moves-shared-control-duration\)\s*!important/);
assert.match(css, /transition-duration:\s*var\(--dance-moves-lyric-disclosure-duration\)\s*!important/);
assert.match(css, /transition-property:\s*background-color, color, transform, border-color/);
assert.doesNotMatch(css, /transition-property:[^;]*box-shadow/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /transition:\s*none\s*!important/);
assert.doesNotMatch(css, /transition-property:\s*all/);

console.log("DanceMoves shared control and lyric timing migration contract tests passed");
