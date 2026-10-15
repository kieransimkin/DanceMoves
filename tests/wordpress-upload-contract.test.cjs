const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const plugin = fs.readFileSync(path.join(__dirname, "../kieran-epk-device-orientation.php"), "utf8");
const page = fs.readFileSync(path.join(__dirname, "epk-motion-lab-4f8c8d11-6a28-4c7c-a2d9-31c56d49d73b.html"), "utf8");
const runtime = fs.readFileSync(path.join(__dirname, "mobile-api-conformance.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../assets/ks-epk-device-orientation.css"), "utf8");

const { assertPluginVersion } = require('./helpers/plugin-version.cjs');
const pluginVersion = assertPluginVersion(plugin);
assert.doesNotMatch(plugin, /KS_EPK_MOTION_CAPTURE_TOKEN|X-KS-Motion-Token/, "public tokens cannot authorize capture writes");
assert.match(page, /restNonce:\s*""/, "development fixture carries no session nonce");
assert.match(page, /noindex,nofollow,noarchive,nosnippet,noimageindex/);
assert.match(page, /\/wp-json\/ks-epk-motion\/v1\/capture/);
assert.match(page, /full 30-second recording/);
assert.match(page, /motion-capture-policy\.js/);
assert.ok(pluginVersion, "WordPress plugin version is present");
for (const asset of [
  "ks-epk-device-orientation-core.js",
  "simulated-device-orientation-event.js",
  "motion-capture-policy.js",
  "mobile-api-conformance.js",
]) {
  const escapedVersion = pluginVersion.replaceAll(".", "\\.");
  assert.match(page, new RegExp(`${asset.replaceAll(".", "\\.")}\\?ver=${escapedVersion}`), `${asset} is cache-versioned to the current plugin`);
}
assert.match(plugin, /Plugin Name:\s*DanceMoves/);
assert.equal(plugin.match(/DANCE_MOVES_VERSION',\s*'([^']+)'/)?.[1], pluginVersion, "runtime version matches plugin header");
assert.match(plugin, /dance-moves-catalogue-timing/);
assert.match(plugin, /252\s*=>\s*'clay-stars'/);
assert.match(plugin, /\$orientation_dependencies\[\]\s*=\s*'dance-moves-clay-stars'/);
assert.match(plugin, /'post_status'\s*=>\s*'private'/);
assert.match(plugin, /count\(\$samples\)\s*>\s*500/);
assert.match(plugin, /strlen\(\$encoded\)\s*>\s*262144/);
assert.match(plugin, /current_user_can\('manage_options'\)/);
assert.match(runtime, /credentials:\s*"same-origin"/);
assert.match(runtime, /X-WP-Nonce/);
assert.doesNotMatch(runtime, /X-KS-Motion-Token/);
assert.match(runtime, /targetDurationMilliseconds:\s*targetDuration/);
assert.match(runtime, /sampleStrategy:\s*"time-decimated"/);
assert.match(runtime, /window\.setTimeout\(finish,\s*targetDuration\)/);
assert.match(plugin, /'captureDurationMilliseconds'/);
assert.match(plugin, /'processedPairCount'/);
assert.match(css, /background-position var\(--dance-moves-2t, 62\.5ms\)/);
assert.match(css, /transform var\(--dance-moves-2t, 62\.5ms\)/);
assert.doesNotMatch(css, /transition-duration:\s*0ms/);
console.log("WordPress private motion-upload contract tests passed");
