"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { assertPluginVersion } = require("./helpers/plugin-version.cjs");

const root = path.resolve(__dirname, "..");
const phpPath = path.join(root, "kieran-epk-device-orientation.php");
const php = fs.readFileSync(phpPath, "utf8");
let checks = 0;
function check(name, callback) {
  callback();
  checks += 1;
  console.log(`PASS ${name}`);
}
function fixture(header = "7.12.3", runtime = header) {
  return `<?php\n/**\n * Plugin Name: DanceMoves\n * Version: ${header}\n */\ndefine('DANCE_MOVES_VERSION', '${runtime}');\n`;
}
function rejects(source, message) {
  assert.throws(() => assertPluginVersion(source), { code: "ERR_ASSERTION", message });
}

check("actual entrypoint header and runtime constant agree", () => assertPluginVersion(php));
for (const version of ["2.8.0", "2.9.0", "2.10.0", "3.0.0", "12.34.567"]) {
  check(`consistent ${version} is accepted without a hard-coded release pin`, () => {
    assert.equal(assertPluginVersion(fixture(version)), version);
  });
}
check("header/runtime mismatch is still rejected", () => {
  rejects(fixture("2.9.0", "2.8.0"), /must match the WordPress plugin header/);
});
check("missing header version cannot pass by comparing two undefined values", () => {
  rejects(fixture().replace(/ \* Version:[^\n]*\n/, ""), /exactly one Version/);
});
check("missing runtime constant is rejected", () => {
  rejects(fixture().replace(/^define.*\n/m, ""), /define DANCE_MOVES_VERSION exactly once/);
});
check("missing both declarations is rejected", () => {
  rejects("<?php\n/**\n * Plugin Name: DanceMoves\n */\n", /exactly one Version/);
});
check("duplicate header versions are rejected", () => {
  rejects(fixture().replace(" * Version:", " * Version: 7.12.3\n * Version:"), /exactly one Version/);
});
check("duplicate runtime constants are rejected", () => {
  rejects(fixture() + "define('DANCE_MOVES_VERSION', '7.12.3');\n", /define DANCE_MOVES_VERSION exactly once/);
});
for (const version of ["", "2.9", "v2.9.0", "2.9.0-extra", "2.9.0.1", "02.9.0", "2x9x0"]) {
  check(`malformed version ${JSON.stringify(version)} is rejected`, () => {
    rejects(fixture(version), /Plugin Version must be numeric/);
  });
}
check("malformed runtime value is independently rejected", () => {
  rejects(fixture("7.12.3", "7.12"), /DANCE_MOVES_VERSION must be numeric/);
});
check("non-literal runtime version cannot satisfy the contract", () => {
  rejects(fixture().replace("'7.12.3');", "OTHER_VERSION);"), /literal quoted version/);
});
check("UTF-8 BOM and Windows CRLF are accepted", () => {
  assert.equal(assertPluginVersion("\uFEFF" + fixture().replace(/\n/g, "\r\n")), "7.12.3");
});
check("double-quoted PHP constant is accepted", () => {
  assert.equal(assertPluginVersion(fixture().replaceAll("'", '"')), "7.12.3");
});
check("multiline literal define is accepted", () => {
  assert.equal(assertPluginVersion(fixture().replace("define('", "define(\n'").replace(", '", ",\n '")), "7.12.3");
});
check("a version outside the plugin header cannot replace the header", () => {
  rejects(fixture().replace(" * Version: 7.12.3\n", "") + "// Version: 7.12.3\n", /exactly one Version/);
});
check("wrong or absent plugin identity is rejected", () => {
  rejects(fixture().replace("Plugin Name: DanceMoves", "Plugin Name: Other"), /identity must remain DanceMoves/);
  rejects(fixture().replace(" * Plugin Name: DanceMoves\n", ""), /exactly one Plugin Name/);
});
check("a source string rather than an arbitrary object is required", () => {
  for (const value of [null, undefined, {}, 123]) {
    assert.throws(() => assertPluginVersion(value), TypeError);
  }
});
check("failure diagnostics do not dump unrelated PHP source", () => {
  let error;
  try { assertPluginVersion(fixture("2.9.0", "2.8.0") + "\n// PRIVATE_SOURCE_SENTINEL\n"); }
  catch (caught) { error = caught; }
  assert.ok(error);
  assert.doesNotMatch(String(error.stack), /PRIVATE_SOURCE_SENTINEL|<\?php/);
  assert.ok(error.message.length < 300);
});

// Execute the actual consumer tests against temporary in-memory PHP variants.
// Only the PHP read is substituted; no checkout file is changed, and all other
// reads (including the real effects source) use the filesystem normally.
function consumer(file, source) {
  const filename = path.join(__dirname, file);
  const realRequire = createRequire(filename);
  const fileSystem = Object.assign({}, fs, {
    readFileSync(target, ...args) {
      if (typeof target === "string" && path.resolve(target) === phpPath) return source;
      return fs.readFileSync(target, ...args);
    }
  });
  const context = {
    __dirname, __filename: filename,
    console: { log() {} },
    require(name) { return name === "node:fs" ? fileSystem : realRequire(name); }
  };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename, timeout: 5000 });
}
function reversion(source, header, runtime = header) {
  return source
    .replace(/^( \* Version: )[^\r\n]+/m, `$1${header}`)
    .replace(/^(define\('DANCE_MOVES_VERSION', ')[^']+('.*)$/m, `$1${runtime}$2`);
}
for (const file of ["epk-download-contract.test.cjs", "effects-primitives.test.cjs"]) {
  check(`${file}: exact current source passes`, () => consumer(file, php));
  for (const next of ["2.10.0", "3.0.0"]) {
    check(`${file}: a consistent future version needs no test edit (${next})`, () => {
      consumer(file, reversion(php, next));
    });
  }
  check(`${file}: real version mismatch still fails`, () => {
    assert.throws(() => consumer(file, reversion(php, "2.9.0", "2.8.0")), /must match the WordPress plugin header/);
  });
}
check("download routing assertions still reject a missing signature check", () => {
  assert.throws(() => consumer("epk-download-contract.test.cjs",
    php.replace("hash_equals(dance_moves_epk_download_signature($relative_path), $signature)", "true")),
  error => error.code === "ERR_ASSERTION");
});
check("effects assertions still reject a missing enqueue source", () => {
  assert.throws(() => consumer("effects-primitives.test.cjs",
    php.replaceAll("dance-moves-effects.js", "missing-effects.js")),
  error => error.code === "ERR_ASSERTION");
});
console.log(`DanceMoves version regression checks passed (${checks} groups).`);
