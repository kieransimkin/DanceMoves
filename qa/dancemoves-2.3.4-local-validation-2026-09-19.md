# DanceMoves 2.3.4 local validation — 19 September 2026

## Artifact

- WordPress ZIP: `dist/DanceMoves-2.3.4.zip`
- SHA-256: `8EB7A873EDEAA406F35371C8219ED9570E22792A15E76AA8D690CC93C7C6446F`
- Size: 54,799 bytes
- Entries: 11
- Upgrade root: `kieran-epk-device-orientation`
- State: locally built and validated; not uploaded, installed, pushed or published

## Change under test

- Device-orientation input still coalesces raw events through one pending animation frame.
- The first finite target is immediate. Later meaningful targets are limited to a two-tick cadence, with only the latest trailing target retained.
- CSS transform transitions interpolate between targets using `--dance-moves-2t`.
- Reset and teardown cancel pending targets and restore neutral values.
- Page 839 adds a California Screamin' adapter that writes only bounded `--cs-x` and `--cs-y`.
- Page 252 calls the Clay/Stars direct target API, removing the nested animation-frame hop.

## Automated verification

- Package validation: PASS.
- JavaScript syntax: PASS.
- PHP syntax: PASS.
- All clean Node contract tests: PASS.
- Clay content transform and legacy-plugin collision tests: PASS.
- `git diff --check`: PASS.
- The pre-existing modified `tests/dance-moves-wordpress-contract.test.cjs` was preserved and excluded from the clean suite because it still pins the prior 2.3.3 string. A temporary 2.3.4-transformed copy passed earlier in this work session; the user-owned file was not changed.

## EPK checks

### Made from the clay and the stars — page 252

- Verified BPM: 116.
- Canonical master SHA-256: `03F681507F47389AD6E7085C9C0167D74F6AC24A6F2ABC497CA356AEDBE1B838`.
- Candidate adapter: `clay-stars`.
- 1440 × 1000, 900 × 1100 and 390 × 844: PASS for one release root, readable layout and zero horizontal overflow.
- Loaded 2.3.4 transition rule: transform-only at the two-tick duration.

### California Screamin' — page 839

- Artist-confirmed BPM: 110.
- Canonical master SHA-256: `E38FA7A90AF18A372EEDE57329DA5E98D968C6F66F8BEB8E309932F399BD4979`.
- Exact published-payload SHA-256: `F846DF000AE8A3DCF1FBBF10AEB61C438FB5975599FAD4A7F82E054808B7C2F7`.
- Candidate adapter: `california-screamin`.
- 1440 × 1000, 900 × 1100 and 390 × 844: PASS for one release root, readable layout and zero horizontal overflow.
- Loaded 2.3.4 transition rule: transform-only at the two-tick duration.

## Open gates

- Physical iPhone Safari 60 Hz and Android Chrome 120 Hz performance evidence: BLOCKED until those device runs occur.
- California full-page pre-live performance approval: FAIL on existing page-owned audio-progress `width` transition and rain `background-position` keyframes, plus a shared legacy Light Will Win `background-position` transition. The new California tilt path itself is transform-only. These findings remain visible and require a separate EPK payload remediation rather than being suppressed in the adapter test.
- WordPress installation and signed-out public verification: NOT RUN; requires action-time approval for the exact ZIP.
