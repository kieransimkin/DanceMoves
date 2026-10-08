# DanceMoves documentation

By [Kieran Simkin](https://kieransimkin.co.uk/), part of [DanceFlow](https://kieransimkin.co.uk/danceflow/).

**Implemented baseline:** DanceMoves **2.8.0**, release tag `v2.8.0`, commit
`4cb6a71f60459b5579be87d7e55ac8b1426c578e` (28 September 2026).
This reference was checked against that source on 29 September 2026. It documents
implemented behaviour, including limitations, rather than treating historical QA
notes or planned harness work as a shipping API.

DanceMoves is **Kieran Simkin's WordPress EPK motion runtime**, part of the wider
**DanceFlow** BPM and motion-response workflow. It supplies shared timing, cue and
lyric state, shared effect primitives, signed MP3 downloads, configurable paper-plane
effects, CSS timing adoption, and permission-aware orientation input. A release
supplies its own artwork, markup, players and visual language.

The default branch is not the release baseline: `main` was still at 2.4.0 when
reviewed. The staging branch `timed-lyrics-staging-2026-09-20` at
`c95f24f326a5f5334e4fe63c1e705ec13b1d59d6` adds only publication evidence
after `v2.8.0`; runtime and README are identical. This reference covers the release,
not a hypothetical 2.9. See [source provenance](source-audit.md).

## Read by task

| Task | Reference |
| --- | --- |
| Install, configure a Page, prepare timing files, enable lyrics | [User and integration guide](guide.md) |
| Mount pointer, pulse, cue-class, cue-timeline, sprite-playback, lyric-stage or quality effects | [Shared effect API](api/effects.md) |
| Enable or integrate the paper-plane renderer | [Paper-plane API](api/paper-planes.md) |
| Create reliable MP3 download links and understand the HTTP endpoint | [Download API](api/downloads.md) |
| Call the musical clock, schedule work, subscribe to cues/lyrics | [JavaScript API](api/javascript.md) |
| Read/write metadata, validate files, integrate PHP, submit captures | [WordPress, PHP and REST API](api/wordpress.md) |
| Use timing variables, style lyrics, inspect DOM state | [CSS and HTML contract](api/styling.md) |
| Integrate orientation, catalogue timing or Clay/Stars effects | [Adapters and orientation API](api/adapters.md) |
| Run tests, use local harnesses, package and troubleshoot | [Development and operations](development.md) |
| Check reference coverage and important implementation caveats | [Source audit](source-audit.md) and [symbol inventory](api/surface.json) |

## Feature map

| Feature | What ships | Important boundary |
| --- | --- | --- |
| Page properties | BPM, lyric attachment, cue attachment, lyric-pop-up opt-in, ambient-effect selection; hidden master duration | Attachment content validation on the editor save path is stronger than REST metadata sanitisation. |
| Musical clock | 16 ticks per beat, duration quantisation, page and audio clocks, beat/bar helpers | A bar helper means four beats; this is not a meter or tempo-map engine. |
| Cue timing | LRC-style timed labels, named/wildcard handlers, scoped animation resets, legacy event alias | `.cue` means the plugin's timestamped text format, not a CD cuesheet. |
| Timed lyrics | Neutral popover or shared three-slot stage, blank clears, playback/seek following, previous/next visible neighbours, callbacks and DOM events | Off by default; a release-specific design review is required before adoption. |
| Shared effects | `pointer`, `playbackPulse`, `cueClass`, `cueTimeline`, `spritePlayback`, `lyricStage`, `quality`; stable-ID instance management | Page code owns appearance; callback, transport and accessibility contracts differ between primitives. |
| Signed MP3 downloads | Attachment-only GET/HEAD endpoint and rewriting of explicit upload download links | HMAC is not user authorisation or an expiring URL; players keep their original URLs. |
| Paper planes | Page-configured hero effect, atlas sprites, compact mode, offscreen/hidden pause | DOM structure, CSS containment and count limits must be preserved; no user-facing tuning panel. |
| Catalogue timing | EPK-owned stylesheet, inline, computed and pseudo-element timing conversion | It cannot rewrite canvas/WebGL phase logic or supply an arbitrary new root registration API. |
| Orientation | Nine release adapters, permission UI, rolling mapping, latest-sample frame coalescing and two-tick target writes | Mobile/capability detection and reduced motion gate the production input runtime. |
| Clay/Stars | Cover/light response, particle release, cue state and recoverable performance tiers | Page 252 only; the legacy effects-plugin constant suppresses takeover. |
| Motion capture | Bounded, sanitised JSON saved as private WordPress posts | Dedicated submission endpoint, not automatic tracking or a secure user-authenticated telemetry service. |
| Diagnostics | Explicitly enabled synchronous timing sink and bounded catalogue evidence | No core diagnostic retention/transmission; external consumers own their storage and privacy obligations. |
| Development | Contract tests, local harnesses, deployment evidence and package tooling | Tests and harness globals are not front-end production APIs. |

## API scope and compatibility

The documented integration surface is `window.DanceMoves` (also exposed as
`window.KieranEpkMotion`), `window.DanceMovesEffects`, the documented conditional adapter globals, the PHP
helpers and WordPress metadata/REST contracts. The internal orientation lifecycle
object is documented for diagnostics but is not a general adapter registry.

There are **no plugin shortcodes, Gutenberg blocks, WP-CLI commands, custom
DanceMoves action/filter extension points, stem-separation models, automatic BPM
analysis, track-loop extraction, or public capture-reading endpoint** in this
baseline. The plugin consumes prepared timing data; it does not call StemLab or a
React timeline service. Those projects can participate upstream in a DanceFlow
workflow without implying an implemented network integration here.

All source links in these documents are repository-relative. The exact audited
blob identifiers are recorded in [surface.json](api/surface.json). When reading a
newer checkout, compare the exports and configuration against that inventory.
The root README contains current usage and troubleshooting. Dated evidence in Git,
`migration/`, `qa/` and the [test plan](../TEST-PLAN.md) does not establish the status
of a newer build or deployment.
