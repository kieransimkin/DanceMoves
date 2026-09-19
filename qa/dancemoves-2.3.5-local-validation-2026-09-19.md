# DanceMoves 2.3.5 local validation - 19 September 2026

## Scope

- Reconciles the Made from the clay and the stars fallback, preview harness and automated tests with Kieran Simkin's directly confirmed canonical tempo of 90 BPM.
- Preserves California Screamin' at its existing explicit 110 BPM.
- Changes package/version identifiers to 2.3.5 so the corrected files are not silently substituted under the already deployed 2.3.4 version.
- Does not retime or modify the canonical lyric or cue LRC files; their timestamps remain positions in the master recording.

## Verification

- WordPress page 252 was saved with BPM 90. Immediately before save, the BPM field read `90`, lyric timing remained `dance-moves-252-lyric.lrc`, and cue timing remained `dance-moves-252-cue.lrc`.
- WordPress displayed `Page updated.` and revision 14. A fresh public render emitted `danceMovesConfig.bpm = "90"`, `bpmSource = "explicit"`, the same lyric/cue URLs, and still loaded the live 2.3.4 assets.
- Clay and California local preview builders completed successfully at 2.3.5.
- JavaScript syntax checks passed for maintained JS/CJS/MJS sources, excluding the deliberate failing fixture and the pre-existing user-owned dirty contract test.
- PHP lint passed.
- Node test suite passed: 13 tests, 13 passed, 0 failed.
- Clay transform and legacy-collision PHP tests passed.
- `git diff --check` passed.
- Package validator passed with the expected WordPress upgrade root.

## Package

- File: `dist/DanceMoves-2.3.5.zip`
- Bytes: 55216
- Entries: 11
- SHA-256: `02D5B870765C2B4B84C55402C5D5BB4EDDE152314B10C950B3C2AFB76ED5F9E9`
- Manifest: `dist/DanceMoves-2.3.5-manifest.json`

## Status and limits

- The canonical page property is live at 90 BPM.
- DanceMoves 2.3.5 is locally staged and validated, but is not installed on WordPress until Kieran separately approves this exact package.
- Public rendering was verified in the authenticated in-app browser. A genuinely signed-out browser surface was unavailable, so signed-out verification remains outstanding.
- Synthetic software performance budgets passed. Physical 60 Hz and 120 Hz device evidence remains blocked until a phone run is completed.
