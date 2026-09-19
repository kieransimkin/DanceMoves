const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "harness/california-screamin/california-screamin.json"), "utf8"));
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, "harness/california-screamin/property-inventory.json"), "utf8"));
const candidate = fs.readFileSync(path.join(root, "qa/california-screamin-harness-candidate.html"), "utf8");
const php = fs.readFileSync(path.join(root, "kieran-epk-device-orientation.php"), "utf8");
const runtime = fs.readFileSync(path.join(root, "assets/ks-epk-device-orientation.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/ks-epk-device-orientation.css"), "utf8");

assert.equal(manifest.effect.pageId, 839);
assert.equal(manifest.release.bpm, 110);
assert.equal(manifest.release.masterDurationMilliseconds, 212007.46);
assert.equal(inventory.writes.length, 1);
assert.deepEqual(inventory.writes[0].properties, ["--cs-x", "--cs-y"]);
assert.match(php, /839\s*=>\s*'california-screamin'/);
assert.match(runtime, /function californiaScreamin\(\)/);
assert.match(runtime, /motion-paused/);
assert.match(css, /data-ks-orientation-adapter="california-screamin"/);
assert.equal((candidate.match(/id="cs-epk"/g) || []).length, 1);
assert.equal((candidate.match(/ks-epk-device-orientation\.js\?ver=2\.3\.5-local/g) || []).length, 1);

for (const [relative, expected] of Object.entries(manifest.effect.productionHashes)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.resolve(path.dirname(path.join(__dirname, "harness/california-screamin/california-screamin.json")), relative))).digest("hex").toUpperCase();
  assert.equal(actual, expected, `production hash mismatch: ${relative}`);
}

console.log("California Screamin' DanceMoves adapter and harness contracts passed");
