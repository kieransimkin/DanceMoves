"use strict";

const assert = require("node:assert/strict");

// The repository uses a numeric MAJOR.MINOR.PATCH WordPress plugin version.
// This is a source-contract check, not a general-purpose PHP parser.
const VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;

/**
 * Validate the entrypoint's real plugin header and literal runtime constant.
 * Return the agreed version without pinning feature tests to a past release.
 * Invalid declarations fail with bounded messages, never the entire PHP source.
 * @param {string} source Complete contents of kieran-epk-device-orientation.php.
 * @returns {string} The matching numeric MAJOR.MINOR.PATCH version.
 */
function assertPluginVersion(source) {
  if (typeof source !== "string") throw new TypeError("Plugin source must be a string");
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const header = text.match(/^\s*<\?php\s*\/\*\*([\s\S]*?)\*\//);
  assert.ok(header, "Entrypoint must start with a PHP plugin header comment");

  const names = Array.from(header[1].matchAll(/^[ \t]*\*[ \t]*Plugin Name:[ \t]*([^\n]*)$/gm));
  assert.equal(names.length, 1, "Plugin header must declare exactly one Plugin Name");
  assert.equal(names[0][1].trim(), "DanceMoves", "Plugin identity must remain DanceMoves");

  const versions = Array.from(header[1].matchAll(/^[ \t]*\*[ \t]*Version:[ \t]*([^\n]*)$/gm));
  assert.equal(versions.length, 1, "Plugin header must declare exactly one Version");
  const version = versions[0][1].trim();
  assert.ok(VERSION.test(version), "Plugin Version must be numeric MAJOR.MINOR.PATCH");

  const declarations = Array.from(text.slice(header[0].length).matchAll(
    /^[ \t]*define\s*\(\s*(['"])DANCE_MOVES_VERSION\1\s*,\s*([^;]*);/gm
  ));
  assert.equal(declarations.length, 1, "Entrypoint must define DANCE_MOVES_VERSION exactly once");
  const literal = declarations[0][2].match(/^(['"])([^'"\n]*)\1\s*\)\s*$/);
  assert.ok(literal, "DANCE_MOVES_VERSION must be a literal quoted version");
  const runtimeVersion = literal[2];
  assert.ok(VERSION.test(runtimeVersion), "DANCE_MOVES_VERSION must be numeric MAJOR.MINOR.PATCH");
  assert.equal(runtimeVersion, version,
    "DANCE_MOVES_VERSION must match the WordPress plugin header Version");
  return version;
}

module.exports = Object.freeze({ assertPluginVersion });
