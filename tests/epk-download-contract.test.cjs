const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const php = fs.readFileSync(path.join(__dirname, "..", "kieran-epk-device-orientation.php"), "utf8");

assert.match(php, /Version:\s*2\.6\.0/);
assert.match(php, /define\('DANCE_MOVES_VERSION',\s*'2\.6\.0'\)/);
assert.match(php, /new WP_HTML_Tag_Processor\(\$content\)/);
assert.match(php, /while \(\$processor->next_tag\('A'\)\)/);
assert.match(php, /null === \$processor->get_attribute\('download'\)/);
assert.doesNotMatch(php, /next_tag\(['"](?:AUDIO|SOURCE)['"]\)/i, "player and source elements must not be rewritten");
assert.match(php, /wp_get_upload_dir\(\)/);
assert.match(php, /hash_hmac\('sha256', \$relative_path, wp_salt\('auth'\)\)/);
assert.match(php, /hash_equals\(dance_moves_epk_download_signature\(\$relative_path\), \$signature\)/);
assert.match(php, /Content-Type: audio\/mpeg/);
assert.match(php, /Content-Disposition: attachment/);
assert.match(php, /Content-Length:/);
assert.match(php, /realpath\(\$uploads\['basedir'\]\)/);
assert.match(php, /!str_starts_with\(\$file_path, \$base_prefix\)/);
assert.match(php, /'GET', 'HEAD'/);

console.log("DanceMoves EPK download routing contract tests passed");
