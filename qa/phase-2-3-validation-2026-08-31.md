# DanceMoves Phase 2-3 validation - 2026-08-31

## Scope

Read-only validation of the disabled diagnostics sink and the latest-sample orientation rAF scheduler. This is development evidence only. It does not approve a WordPress package, deployment or individual EPK for publication.

## Exact source hashes

| Artifact | SHA-256 |
|---|---|
| `assets/dance-moves-core.js` | `7337D940C85DAFF366A3B41D7D91997772ACA1C22A53713B5C0529925AA9C59C` |
| `assets/ks-epk-device-orientation-core.js` | `6691A9F8BA02153EADE32295170A40E0988554BD847129983E177D93824AE4F6` |
| `assets/ks-epk-device-orientation.js` | `AD3DD5392A9385D1FF6228915F915BBA834A08743A29C3CE656AAC7B433F4A6C` |
| `assets/ks-epk-device-orientation.css` | `7CCD445D0B3F7EDC474BA4E43CFD31BF2F8A7888C97CB2D7017A81C0DD645CCB` |
| `assets/clay-stars-effects.js` | `7254FBE7F774F8FA19626CA1F367D211B2A289622C261ADCB5D0AC3F59837A40` |
| `tests/harness/plugin-core/harness-probe.js` | `0CFC22815EF9F65EE18D6EFC5E8C647A1AB02D6CB82C0E85EDA4C2401C0018B0` |

## Automated results

- `tools/validate.ps1 -Mode Unit`: **PASS**.
- Diagnostics equivalence: **PASS**; 16 bounded spans for two cue dispatches plus one interval callback, identical event/callback counts with diagnostics off and on, handler and sink failure isolation retained.
- Deterministic diagnostics benchmark: **PASS**; five records per benchmark cue and 2.115-2.885 microseconds additional Node wrapper time per cue across repeated seal runs.
- P-020 through P-028: **PASS**; one pending rAF for 240 pre-frame events, final finite sample wins, zero pre-rAF adapter writes, bounded fuzz outputs, layout-read traps, time-based smoothing equivalence, lifecycle cancellation and single-instance ownership.
- Synthetic refresh runs: **PASS** at 20, 60, 120 and 240 Hz over equal elapsed time.
- Harness schema, lock and production hashes: **PASS**.
- Clay transform parity and feature counts: **PASS**.
- Strict UTF-8 validation: **PASS**.
- Reusable harness workflow forward-test and official skill validation: **PASS**.

## Browser observations

The local core live lab connected and retained editable master/timing/effect controls. A cue plus gentle deterministic motion capture recorded:

- cue p95: 1.00 ms;
- samples: 67;
- long tasks: 0;
- dropped-frame observation: 1.11%;
- frame p95: 33.50 ms; and
- observed FPS: 28.69.

The selected in-app browser was operating at approximately a 30 Hz frame interval. These figures prove the capture path works but do not establish 60 Hz or 120 Hz physical-device performance.

At the 390 px mobile fixture, a recorded gentle orbit replay reached the production runtime's `active` state after 60 samples and produced a non-neutral 3D transform. That tab reported no warnings or errors.

The core live-lab tab reported one source-less `MutationObserver` argument error. The core candidate does not load the orientation runtime and the log supplied no URL or stack, so attribution is unresolved. It is not counted as a plugin failure here; the same symptom is a pre-live blocker if it recurs with an attributable source in an exact EPK run.

## Remaining gates

- No physical iPhone/Android input-to-photon trace or five-minute soak was run.
- Phase 4 Clay tuning/redesign, Phase 5 CSS/property auditing and page-specific EPK gates remain outstanding.
- The source plugin moved concurrently to version 2.2.0; the local development fixture/cache keys were reconciled to that version. No package was rebuilt and no WordPress mutation occurred.
