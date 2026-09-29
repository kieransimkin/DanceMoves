const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const php = fs.readFileSync(path.join(root, "kieran-epk-device-orientation.php"), "utf8");
const core = fs.readFileSync(path.join(root, "assets/dance-moves-core.js"), "utf8");
const coreCss = fs.readFileSync(path.join(root, "assets/dance-moves-core.css"), "utf8");
const clayCss = fs.readFileSync(path.join(root, "assets/clay-stars-effects.css"), "utf8");
const clayJs = fs.readFileSync(path.join(root, "assets/clay-stars-effects.js"), "utf8");

assert.match(php, /Plugin Name:\s*DanceMoves/);
const { assertPluginVersion } = require('./helpers/plugin-version.cjs');
const declaredVersion = assertPluginVersion(php);
assert.match(php, /252\s*=>\s*'clay-stars'/);
for (const key of [
  "_dance_moves_bpm",
  "_dance_moves_lyric_timing_id",
  "_dance_moves_cue_timing_id",
  "_dance_moves_lyric_popups_enabled",
  "_dance_moves_master_duration_ms"
]) assert.ok(php.includes(key), `${key} is registered`);
assert.match(php, /\$display_bpm\s*=\s*is_numeric\(\$stored_bpm\)[\s\S]*\(float\) \$stored_bpm >= 20[\s\S]*\(float\) \$stored_bpm <= 400/);
assert.match(php, /esc_attr\(\$display_bpm\)/);
// Page BPM must flow from the queried page's saved metadata into the runtime.
assert.match(php, /function dance_moves_get_page_config\(\$page_id\)\s*\{[\s\S]*?get_post_meta\(\$page_id, DANCE_MOVES_META_BPM, true\)/);
assert.match(php, /\$source\s*=\s*is_numeric\(\$stored_bpm\)\s*\?\s*'explicit'\s*:\s*'fallback'/);
assert.match(php, /\$page_id\s*=\s*get_queried_object_id\(\)/);
assert.match(php, /\$config\s*=\s*dance_moves_get_page_config\(\$page_id\)/);
assert.match(php, /wp_localize_script\('dance-moves-core', 'danceMovesConfig', \$config\)/);
assert.match(core, /var rawConfig = window\.danceMovesConfig \|\| \{\}/);
assert.match(core, /var bpm = effectiveBpm\(rawConfig\.bpm\)/);
assert.match(core, /root\.dataset\.danceMovesBpm = String\(bpm\)/);

for (const label of ["BPM", "Lyric Timing File", "Cue Timing File", "Timed lyric pop-ups"]) {
  assert.ok(php.includes(label), `${label} is present in Edit Page`);
}
assert.match(php, /wp_nonce_field\('dance_moves_save_epk_timing'/);
assert.match(php, /current_user_can\('edit_post', \$post_id\)/);
assert.match(php, /wp_verify_nonce/);
assert.match(php, /'lrc'\]\s*=\s*'text\/plain'/);
assert.match(php, /'cue'\]\s*=\s*'text\/plain'/);
assert.match(php, /preg_match\('\/\/u'/);
assert.match(php, /timestamps must be monotonic/);
assert.match(php, /!defined\('KS_CLAY_STARS_EFFECTS_VERSION'\)/);
assert.match(php, /DANCE_MOVES_CLAY_STARS_PAGE_ID/);
assert.match(php, /'ticksPerBeat'\s*=>\s*16/);
assert.match(php, /dance-moves-core\.css/);

assert.match(core, /var DEFAULT_BPM = 120/);
assert.match(core, /var LONG_DURATION_QUANTUM_TICKS = 16/);
assert.match(core, /var TICKS_PER_BEAT = 16/);
assert.match(core, /3750 \/ effectiveBpm/);
assert.match(core, /resetRunningAnimations/);
assert.match(core, /animation\.currentTime = 0/);
assert.match(core, /window\.DanceMoves = api/);
assert.match(core, /onCue: onCue/);
assert.match(core, /onLyric: onLyric/);
assert.match(core, /parseLyricTimingFile: parseLyricTimingFile/);
assert.match(core, /dance-moves-lyric/);
assert.match(core, /this\.text\.textContent = detail\.text/);
assert.doesNotMatch(core, /textNode\.innerHTML\s*=/);
assert.match(php, /'lyricPopupsEnabled'\s*=>\s*'1'\s*===/);
assert.match(coreCss, /dance-moves-lyric-popover/);
assert.match(coreCss, /prefers-reduced-motion:\s*reduce/);
assert.match(coreCss, /forced-colors:\s*active/);
assert.match(core, /fireCue: fireCue/);
assert.match(core, /setDiagnosticsSink: setDiagnosticsSink/);
assert.match(core, /rawConfig\.diagnostics === true/);
assert.doesNotMatch(php, /['"]diagnostics['"]\s*=>\s*true/, "ordinary WordPress configuration must leave diagnostics disabled");
assert.match(core, /dance-moves-cue/);
assert.match(core, /kieran-epk-cue/);
assert.match(core, /Math\.abs\(duration - referenceDurationSeconds\)/);
for (const helper of ["onNextInterval", "onEveryInterval", "onNextBeat", "onEveryBeat", "onNextBar", "onEveryBar"]) {
  assert.match(core, new RegExp(`${helper}: ${helper}`));
}
assert.match(core, /data-dance-moves-start-interval/);
assert.match(coreCss, /data-dance-moves-start-interval/);
assert.match(coreCss, /animation-play-state:\s*paused\s*!important/);

for (const ticks of [6, 32, 128, 192, 432, 1584, 2208]) {
  assert.ok(clayCss.includes(`--dance-moves-${ticks}t`), `Clay/Stars uses ${ticks}-tick timing`);
}
assert.ok(clayCss.includes("--dance-moves-neg-64t"), "Clay/Stars uses a four-beat phase offset");
assert.match(clayCss, /prefers-reduced-motion:\s*reduce/);
assert.match(clayJs, /durationMilliseconds\(settings\.particleReleaseTicks\)/);
assert.match(clayCss, /--ks-particle-release-duration/);
assert.match(clayJs, /registerAnimationScope/);
assert.match(clayJs, /motion\.onCue\("\*"/);
assert.match(clayJs, /clay-stars:cue-state/);
assert.doesNotMatch(clayJs, /setTimeout\([^\n]+,\s*1100\)/);
assert.doesNotMatch(clayCss.slice(clayCss.indexOf("@keyframes")), /background-position\s*:/);
assert.doesNotMatch(clayCss, /will-change\s*:[^;]*(?:filter|background-position)/);

const visualDeclarations = clayCss
  .split(/\r?\n/)
  .filter(line => /(?:animation(?:-duration)?|transition(?:-duration)?)\s*:/.test(line))
  .filter(line => !/:\s*$/.test(line))
  .filter(line => !/:\s*none(?:\s*!important)?;/.test(line));
for (const line of visualDeclarations) {
  assert.match(line, /var\(--(?:dance-moves-|ks-particle-release-duration)/, `Visual duration is tick-derived: ${line.trim()}`);
}

console.log("DanceMoves WordPress metadata, cue API and tick-duration contract tests passed");
