# DanceMoves 2.8.0 cue-timeline staging — 28 September 2026

## Outcome

Deployed and publicly verified on 28 September 2026. DanceMoves now provides a page-agnostic `cueTimeline()` primitive that owns audio transport recovery and deterministic cue state. Santa Flies Tonight supplies only its cue definitions, visual callbacks and release-specific appearance.

## Shared runtime ownership

- Cue sorting, crossing detection and per-traversal deduplication.
- Discontinuity detection without manufacturing skipped cue fires.
- Reconstruction from the authoritative `audio.currentTime` after seeking, metadata changes, playback-rate changes and visibility/accessibility restoration.
- Active interval reconstruction from declarative cue `time` and `end` values.
- Native `play`, `playing`, `pause`, `seeking`, `seeked`, `ratechange`, `loadedmetadata` and `ended` lifecycle.
- Visibility, reduced-motion and forced-colours recovery.
- One shared animation-frame lifecycle, bounded wall-clock delta for visual callbacks and explicit teardown/snapshot APIs.

## Santa adapter boundary

The local Santa adapter retains only release-specific cue times, chorus/outro interval definitions, bounded warmth/particle drawing and callbacks. It no longer owns audio or visibility listeners, seek recovery, crossing flags, discontinuity detection or an animation-frame scheduler. BPM comes from `window.DanceMoves.bpm`, which remains page-configured in WordPress.

Transient entrance flourishes are not replayed after a seek merely to recreate expired random particles. Stable interval state is reconstructed from the landed playback position.

## Verification

- Full DanceMoves `validate.ps1 -Mode All`: PASS.
- Focused cue-timeline regression: PASS for crossing deduplication, paired play/playing, pause/resume, forward seek, backward traversal, active-interval restoration, visibility restoration and teardown.
- Santa adapter regression: PASS for runtime BPM, no page-owned transport or visibility listeners, cue declarations and rooftop/chorus/outro routing with established particle counts.
- JavaScript syntax checks: PASS.
- WordPress package validation: PASS; 15 entries; upgrade root present.

## Exact staged package

- ZIP: `dist/DanceMoves-2.8.0.zip`
- Manifest: `dist/DanceMoves-2.8.0-manifest.json`
- ZIP SHA-256: `599D6E377F142D8B56DFB735DF96122993FB8CE1015FE582533F21E408F30E48`
- Santa adapter SHA-256: `7C81B493A1123C2A0803DB262EAADF34F13C3AB136E6D8CA0CA4302FAAC7F676`
- Shared effects runtime SHA-256: `838C07570DD02B72ACF9CEE3A9E7BB8E6E205946ED50A76BD692B6819D020F5A`

## Publication evidence

- WordPress replaced DanceMoves 2.7.0 with the exact confirmed 2.8.0 ZIP and displayed `Plugin updated successfully.`
- The persisted public Santa page loads `dance-moves-core.js?ver=2.8.0` and `dance-moves-effects.js?ver=2.8.0`.
- Page ID 397 retains explicit page-configured BPM `86`; no release BPM is hardcoded in the plugin or adapter.
- A footer-load ordering defect found during live QA was corrected with one idempotent `dance-moves-effects-ready` initialisation path, then saved as a later recoverable WordPress revision.
- Fresh public runtime state reported DanceMoves `2.8.0`, `data-dance-moves-cue-status="ready"`, one timing element, seven section cues, 39 timed lyric lines and `data-dance-moves-cue-timeline="metadata"` at the original paused position `0`.
- Seeking through the page's section controls to `58.34` seconds reconstructed `chorusCue="1"`, `sft-warmth-active` and `data-dance-moves-cue-timeline="seeked"`; seeking to `165.16` seconds cleared the chorus and warmth state.
- A fresh reload restored the original paused position `0`, chorus off, timeline `metadata`, and produced no observed JavaScript errors.

## QA limitation

The controlled in-app browser process crashed when its native media scrubber was addressed directly. The non-destructive section-button seek probes and a fresh-tab restoration check completed successfully, but continuous attended play/pause/resume listening remains a perceptual check rather than a claimed automated browser result. The exact crash symptom and safe recovery rule are already retained in the DanceMoves skill's potential-problems guidance.

## Repository state

- Local source commit message: `Add shared cue timeline transport recovery`; use the tagged `v2.8.0` commit as the durable identity after publication.
- The private GitHub push and matching `v2.8.0` release remain pending an explicit approval to transmit the proprietary source commit and the exact ZIP/manifest to `kieransimkin/DanceMoves`.
- Unrelated historical untracked `DanceMoves-2.6.3` package files were deliberately left outside the commit.
