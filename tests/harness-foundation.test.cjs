const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const harnessRoot = path.join(__dirname, "harness", "plugin-core");
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, "harness", "harness-template.lock.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(harnessRoot, "effect-harness.manifest.json"), "utf8"));
const candidate = fs.readFileSync(path.join(harnessRoot, "candidate.html"), "utf8");
const adapter = fs.readFileSync(path.join(harnessRoot, "effect-under-test-adapter.js"), "utf8");
const probe = fs.readFileSync(path.join(harnessRoot, "harness-probe.js"), "utf8");

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

for (const [name, expected] of Object.entries(lock.files)) {
  assert.equal(digest(path.join(harnessRoot, name)), expected, `vendored harness file drifted: ${name}`);
}

assert.equal(manifest.effect.slug, "dance-moves-core");
assert.deepEqual(new Set(manifest.parameters.map(item => item.group)), new Set(["master", "timing", "effect"]));
assert.deepEqual(manifest.preview.viewports.map(item => item.width), [1440, 900, 390]);
assert.equal(manifest.release.bpmSource, "unknown", "foundation fixture must not claim release BPM provenance");

for (const asset of [...manifest.effect.productionCss, ...manifest.effect.productionJs]) {
  const resolved = path.resolve(harnessRoot, asset);
  assert.equal(digest(resolved), manifest.effect.productionHashes[asset], `production hash mismatch: ${asset}`);
}

assert.ok(candidate.indexOf("harness-probe.js") < candidate.indexOf("dance-moves-core.js"), "probe must load before production JavaScript");
assert.ok(candidate.indexOf("window.danceMovesConfig") < candidate.indexOf("dance-moves-core.js"), "production config must exist before the core loads");
assert.doesNotMatch(candidate + adapter, /HARNESS-INTEGRATION-PENDING/);
assert.doesNotMatch(candidate + adapter, /wp-json\/wp\/v2|admin-ajax\.php|\b(?:POST|PUT|PATCH|DELETE)\b/i);
assert.match(adapter, /DanceMoves\.durationMilliseconds/);
assert.match(adapter, /DanceMoves\.fireCue/);
assert.match(adapter, /DanceMoves\.setDiagnosticsSink/);
assert.match(probe, /recordDiagnostic/);
assert.ok(manifest.effect.inputModes.includes("cue"));
assert.ok(manifest.cues.length > 0);
assert.match(adapter, /window\.EPKEffectUnderTest\s*=/);

const packageScript = fs.readFileSync(path.join(repoRoot, "tools", "package.ps1"), "utf8");
assert.doesNotMatch(packageScript, /['"]tests['"]|['"]qa['"]|['"]tools['"]/, "development harness paths must not enter the WordPress package include list");

console.log("DanceMoves harness foundation, template lock and production-asset hash tests passed");
