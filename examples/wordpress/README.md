# Arcadians / DanceMoves WordPress examples

From the **complete DanceMoves source checkout**, run:

```sh
python tools/prepare-wordpress-examples.py
python tools/serve-wordpress-examples.py
```

Open `http://127.0.0.1:8765/examples/wordpress/`. GitHub displays HTML source;
it does not execute these demos. Opening them with `file://` is not supported.
Use `--port 8766` if that loopback port is occupied. Ctrl+C stops the server.

The alternative `python tools/prepare-wordpress-examples.py --stemlab-root ../stemlab`
copies the same hash-pinned Arcadians recording and artwork from StemLab.
The MP3 and artwork are not duplicated in this patch or the WordPress plugin ZIP.
The canonical lyric LRC is included unchanged; cues and section intervals are
derived from the artist-authored StemLab reference, not newly inferred analysis.

`features.json` is the per-page setup manifest, including all six metadata keys.
`coverage.json` maps 23 feature pages and their executable `demos/*.mjs` modules
to API calls, the 15 native patterns and nine orientation mappings. `index.html`
links every demo. Browser back/forward cache returns deliberately reload the
document so disposed demo controllers do not revive against stale core state.
Each demo presents a local editor, real audio transport,
config inspector, source and bounded event log. The Arcadians journey is
real-page-inspired; the other demos are supplementary teaching examples.

The simulator is not WordPress. It uses the actual repository client assets,
not reimplemented DanceMoves timing or motion formulas. Metadata, revisions,
REST behaviour and HTTP signatures are explicitly local simulations. No data is
sent to the artist's site; capture fixtures are untrusted, synthetic and never
persisted. Ordinary demos never silently substitute audio when Arcadians is missing.
Use the complete [WordPress setup recipes](../../docs/wordpress-examples.md)
and [release guide](../../RELEASING.md) from the repository root navigation.

## Checks

```sh
node tests/wordpress-examples.test.cjs
python tests/test-wordpress-examples.py
php tests/wordpress-examples-configure.test.php
python tests/test-wordpress-examples-browser.py
```

Run commands at the repository root. The first three cover static contracts,
local HTTP/preparation and a stubbed WP-CLI boundary, respectively. The fourth
requires `python -m pip install playwright`, a Chromium installation (normally
`python -m playwright install chromium`), the full source and prepared media.
It writes `qa/wordpress-examples-browser.json` and returns nonzero on failure
or blocked prerequisites. `--chromium /path/to/chromium` selects your installed
renderer. `--synthetic-transport` is an explicit **test-only** silent WAV override
for transport assertions; it is not the real Arcadians listening test and does
not alter any normal demo files. No policy-restriction workaround is provided.

Demos are not part of the packaged WordPress plugin. They are development
examples, not a replacement for signed-out WordPress and real-device QA.
