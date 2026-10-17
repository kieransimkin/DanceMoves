# DanceMoves: Word-level lyrics and multi-song Pages

Reviewed baseline: `kieransimkin/DanceMoves` main `8c2057306089e7ae10330cf4d8d72c404e3f3683` (17 October 2026).

This ZIP contains a **source installer**, with the modified/additional files in a
separate `payload/` directory. Keep the extracted ZIP **outside your Git checkout**.
The installer checks the existing source text before changing anything. It does
not modify the repository until you run it without `--check`.

## Windows PowerShell

Extract this ZIP, for example to `C:\Users\you\Downloads\dancemoves-word-songbook\`.
From within your existing `DanceMoves` Git checkout run:

```powershell
python "C:\Users\you\Downloads\dancemoves-word-songbook\apply-dancemoves-songbook.py" --repo . --check
python "C:\Users\you\Downloads\dancemoves-word-songbook\apply-dancemoves-songbook.py" --repo .

npm ci
npm test
node --test tests/shared/word-timing.test.mjs tests/shared/song-collection.test.mjs
npm run build
php -l dance-moves-song-collection.php
php tests/shared/song-collection.php
git diff --check
git status --short
```

The exact path to the extracted installer will differ on your PC.

**Commit only the actual changed source files**, new PHP module, docs and tests.
Do not copy the installer or payload into your repo. Avoid `git add -A` if old
patch helpers or `new/` directories are still present. Previous `tempo maps`
commit already contained an extraneous `new/` subtree and its patch installer;
clean those separately if not already removed, after reviewing the changes.

## What is included

- New optional **Per-word Lyric Timing File** field on ordinary WordPress Pages
- Per-word TSV/JSON/enhanced-LRC parser with source-clock events and safe limits
- `runtime.onWord()` and `dance-moves-word` alongside existing `onLyric()`/cues
- New **Page type: Multiple songs**, allowing 1–24 songs, ordered in a repeatable
  EPK editor, with separate media, BPM, fixed alignment, corrected variable BPM
  map, line lyrics, word lyrics and cue files for every track
- Independent per-song audio controls, timing lanes and native beat clocks
- One active motion runtime at a time: previous playback and effects dispose on
  song selection; other songs never dispatch events
- WordPress attachment validation, source-hash matching, REST guards, revision
  metadata, shortcode placement and auto-appending to multi-song Pages
- README, agent instructions, detailed guide and independent regression tests

Full usage: `docs/word-and-multi-song.md` in the patched checkout.

## Validation limits

In the construction environment the standalone PHP song/word validation checks
and the pure JavaScript parser/song-isolation tests were exercised. The installer
was tested on **reconstructed context fixtures**, not a complete network clone.
The real `npm run build`, entire legacy/browser regression suite, WordPress
installation, Page editor media picker and deployment have NOT been verified.
Do not publish a release until those pass in the actual repository/CI.

## Existing timing remains separate

No changed behaviour is enabled on ordinary Pages without a new word attachment;
existing fixed-BPM/offset pages continue as before. A multi-song Page is still a
normal WordPress Page with its existing permalink: its Page type is an opt-in
mode, not a new custom post type. Within it, each track's variable BPM map is
individually optional. The selected song's full beat timing drives DanceMoves
while its word/line/cue files stay in unchanged original audio time.
