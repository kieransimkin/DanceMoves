"use strict";
// ONLY for hash-pinned upstream text, never generated JS or WASM binaries.
// A CRLF checkout is accepted only if removing CR from CRLF pairs reconstructs
// the exact existing upstream Git blob. No decoding, trimming or BOM removal.
const crypto = require("node:crypto");

function gitBlobHash(bytes) {
  return crypto.createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex");
}

function crlfToLf(bytes) {
  const result = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10) continue;
    result[length++] = bytes[i];
  }
  return result.subarray(0, length);
}

function pinnedTextBytes(bytes, expected, label) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Pinned source must be a Buffer");
  if (typeof expected !== "string" || !/^[a-f0-9]{40}$/.test(expected)) {
    throw new TypeError(`Missing or malformed upstream Git blob pin: ${label}`);
  }
  const rawHash = gitBlobHash(bytes);
  if (rawHash === expected) return bytes;
  const canonical = crlfToLf(bytes);
  const canonicalHash = gitBlobHash(canonical);
  if (canonicalHash === expected) return canonical;
  throw new Error(`Upstream source integrity mismatch: ${label}; expected ${expected}; ` +
    `raw ${rawHash}; CRLF-to-LF ${canonicalHash}. ` +
    "This is not solely a checkout line-ending difference. No files or pins were changed.");
}

module.exports = { gitBlobHash, crlfToLf, pinnedTextBytes };
